#!/usr/bin/env python3
"""adn-obpmap - OpenBridge recorder (HB9TVW).

Reads the OpenBridge state from the local ADN Monitor websocket (same data the
dashboard uses) and keeps 24 h of 30-second activity buckets in
<OBPMAP_DIR>/data/history.json for the OBP map page:
  per OBP: streams RX / TX and talk time RX / TX
  flows  : source OBP (or LOCAL) -> destination OBP, count and talk time
  health : OBP link outages (30 days) + Telegram alert on down / up
  tops   : talkgroup and operator rankings (1 h / 24 h / 7 days) in tops.json
Only the Python standard library is used.
"""
import base64, json, os, signal, socket, struct, sys, threading, time, urllib.parse, urllib.request

# All settings come from environment variables (see system/obp-recorder.service).
BASE = os.environ.get('OBPMAP_DIR', '/opt/obpmap')

WS_HOST = os.environ.get('OBP_WS_HOST', '127.0.0.1')
WS_PORT = int(os.environ.get('OBP_WS_PORT', '8080'))   # port of the ADN Monitor (its /ws websocket)
OUT = BASE + '/data/history.json'
STEP = 30            # bucket size in seconds
KEEP = 24 * 3600     # history length
STALE = 15           # seconds without seeing a stream -> it has ended
HEALTH_DELAY = 120   # an OBP must stay down/up this long before it counts (no false alarms)
HEALTH_KEEP = 30 * 86400
TG_CONF = os.environ.get('OBP_TELEGRAM_CONF', '/etc/obpmap/telegram.json')   # {"token": "...", "chat_id": "..."}; missing = no alerts
SERVER_NAME = os.environ.get('OBP_SERVER_NAME', 'ADN server')
ALERT_LANG = os.environ.get('OBP_ALERT_LANG', 'en')   # en or it
MSG = {'en': ('disconnected since', 'connected again after', 'd'), 'it': ('scollegato dalle', 'di nuovo collegato dopo', 'g')}.get(ALERT_LANG, ('disconnected since', 'connected again after', 'd'))
STATS = BASE + '/data/stats.json'   # 5-min buckets of talkgroups / operators (7 days)
TOPS = BASE + '/data/tops.json'     # small ranking file read by the page
SSTEP = 300
SKEEP = 7 * 86400
TOPN = 25


def log(*a):
    print(time.strftime('%Y-%m-%d %H:%M:%S'), *a, flush=True)


class History:
    def __init__(self):
        self.buckets = {}            # t -> {'o': {obp: [rx, tx, rxt, txt]}, 'f': {"a>b": [n, secs]}}
        self.obps = {}
        self.since = int(time.time())
        self.st = {}                 # obp -> [up(bool), since]
        self.out = []                # [obp, start, end (0 = still down)]
        self.hsince = int(time.time())
        try:
            with open(OUT, encoding='utf-8') as fh:
                d = json.load(fh)
            self.since = d.get('since', self.since)
            self.obps = d.get('obps', {})
            self.st = d.get('st', {})
            self.out = d.get('out', [])
            self.hsince = d.get('hsince', self.hsince)
            for t, o, f in d.get('b', []):
                self.buckets[int(t)] = {'o': o, 'f': f}
            log('history loaded:', len(self.buckets), 'buckets')
        except FileNotFoundError:
            log('no history yet, starting fresh')
        except Exception as e:
            log('history unreadable, starting fresh:', e)

    def bucket(self, ts):
        return self.buckets.setdefault(int(ts) // STEP * STEP, {'o': {}, 'f': {}})

    def add(self, ts, obp, idx, val):
        o = self.bucket(ts)['o'].setdefault(obp, [0, 0, 0, 0])
        o[idx] += val

    def flow(self, ts, key, secs):
        f = self.bucket(ts)['f'].setdefault(key, [0, 0])
        f[0] += 1
        f[1] += secs

    def save(self):
        cut = time.time() - KEEP
        for t in [t for t in self.buckets if t < cut]:
            del self.buckets[t]
        b = []
        for t, v in sorted(self.buckets.items()):
            o = {k: [x[0], x[1], round(x[2]), round(x[3])] for k, x in v['o'].items()}
            f = {k: [x[0], round(x[1])] for k, x in v['f'].items()}
            b.append([t, o, f])
        hcut = time.time() - HEALTH_KEEP
        self.out = [o for o in self.out if not o[2] or o[2] >= hcut]
        d = {'v': 2, 'step': STEP, 'since': self.since, 'updated': int(time.time()),
             'obps': self.obps, 'b': b, 'st': self.st, 'out': self.out, 'hsince': self.hsince}
        tmp = OUT + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as fh:
            json.dump(d, fh, separators=(',', ':'))
        os.replace(tmp, OUT)


H = History()


class Stats:
    def __init__(self):
        self.b = {}                  # t -> {'t': {tg: [n, s]}, 'c': {call: [n, s, id, tg, via]}}
        self.tgn, self.csn = {}, {}  # names learnt from the Monitor last-heard feed
        self.recent = {}             # obp -> last calls [ts, dir, call, tg, id, secs]
        try:
            with open(STATS, encoding='utf-8') as fh:
                d = json.load(fh)
            self.b = {int(k): v for k, v in d.get('b', {}).items()}
            self.tgn, self.csn = d.get('tgn', {}), d.get('csn', {})
            self.recent = d.get('recent', {})
            log('stats loaded:', len(self.b), 'buckets')
        except FileNotFoundError:
            pass
        except Exception as e:
            log('stats unreadable, starting fresh:', e)

    def add(self, ts, call, tg, dmrid, via, secs):
        b = self.b.setdefault(int(ts) // SSTEP * SSTEP, {'t': {}, 'c': {}})
        x = b['t'].setdefault(str(tg), [0, 0])
        x[0] += 1
        x[1] += secs
        y = b['c'].setdefault(str(call), [0, 0, dmrid, str(tg), via])
        y[0] += 1
        y[1] += secs
        y[2], y[3], y[4] = dmrid, str(tg), via

    def obp_call(self, ts, obp, d, call, tg, dmrid, secs):
        b = self.b.setdefault(int(ts) // SSTEP * SSTEP, {'t': {}, 'c': {}})
        x = b.setdefault('o', {}).setdefault(obp, {}).setdefault(str(tg), [0, 0])
        x[0] += 1
        x[1] += secs
        r = self.recent.setdefault(obp, [])
        r.insert(0, [int(ts), d, str(call), str(tg), dmrid, round(secs)])
        del r[15:]

    def names(self, lh):
        for e in lh or []:
            tg, tn = str(e.get('tg_num', '')), e.get('tg_callsign') or ''
            if tg and tn:
                self.tgn[tg] = tn
            sub = e.get('subscriber') or []
            if len(sub) >= 2 and sub[0] and sub[1]:
                self.csn[str(sub[0])] = sub[1]

    def save(self):
        now = time.time()
        for k in [k for k in self.b if k < now - SKEEP]:
            del self.b[k]
        rr, used_t, used_c = {}, set(), set()
        for win in (3600, 86400, SKEEP):
            T, C = {}, {}
            for k, v in self.b.items():
                if k < now - win:
                    continue
                for tg, (n, s) in v['t'].items():
                    a = T.setdefault(tg, [0, 0]); a[0] += n; a[1] += s
                for cs, (n, s, i, tg, via) in v['c'].items():
                    a = C.setdefault(cs, [0, 0, i, tg, via, 0])
                    a[0] += n; a[1] += s
                    if k >= a[5]:
                        a[2], a[3], a[4], a[5] = i, tg, via, k
            out = {}
            for key, src in (('n', 0), ('t', 1)):
                tt = sorted(T.items(), key=lambda x: -x[1][src])[:TOPN]
                cc = sorted(C.items(), key=lambda x: -x[1][src])[:TOPN]
                used_t.update(x[0] for x in tt)
                used_t.update(x[1][3] for x in cc)
                used_c.update(x[0] for x in cc)
                out[key] = {'tg': [[k, v[0], round(v[1])] for k, v in tt],
                            'cs': [[k, v[0], round(v[1]), v[2], v[3], v[4]] for k, v in cc]}
            out['tot'] = [sum(v[0] for v in T.values()), round(sum(v[1] for v in T.values())), len(T), len(C)]
            rr[str(win)] = out
        per = {}
        for name in set(H.obps) | set(self.recent):
            T = {}
            for k, v in self.b.items():
                if k < now - 86400:
                    continue
                for tg, (n, s) in v.get('o', {}).get(name, {}).items():
                    a = T.setdefault(tg, [0, 0]); a[0] += n; a[1] += s
            top = sorted(T.items(), key=lambda x: -x[1][0])[:8]
            used_t.update(x[0] for x in top)
            for c in self.recent.get(name, []):
                used_t.add(c[3]); used_c.add(c[2])
            sp_rx, sp_tx, t0 = [0] * 288, [0] * 288, int(now) // 300 * 300 - 287 * 300
            for k, v in H.buckets.items():
                i = (k - t0) // 300
                if 0 <= i < 288 and name in v['o']:
                    sp_rx[i] += v['o'][name][0]; sp_tx[i] += v['o'][name][1]
            per[name] = {'last': self.recent.get(name, []), 'tg': [[k, v[0], round(v[1])] for k, v in top],
                         'spark': [sp_rx, sp_tx], 'spark0': t0}
        tops = {'v': 2, 'updated': int(now), 'r': rr, 'obp': per,
                'obps': H.obps, 'st': H.st, 'out': H.out, 'hsince': H.hsince,
                'tgn': {k: self.tgn[k] for k in used_t if k in self.tgn},
                'csn': {k: self.csn[k] for k in used_c if k in self.csn}}
        for path, data in ((TOPS, tops), (STATS, {'v': 1, 'b': self.b, 'tgn': self.tgn, 'csn': self.csn, 'recent': self.recent})):
            tmp = path + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as fh:
                json.dump(data, fh, separators=(',', ':'))
            os.replace(tmp, path)


S = Stats()
live = {}   # stream id -> {'first': ts, 'last': ts, 'seen': {(obp, dir): [first, last]}}
pending = {}  # obp -> time the raw state started to differ from the confirmed state


def hhmm(ts):
    return time.strftime('%H:%M', time.localtime(ts))


def dur(sec):
    sec = int(sec)
    if sec < 3600:
        return '%d min' % max(1, sec // 60)
    if sec < 86400:
        return '%d h %02d min' % (sec // 3600, sec % 3600 // 60)
    return '%d %s %d h' % (sec // 86400, MSG[2], sec % 86400 // 3600)


def telegram(text):
    if not os.path.exists(TG_CONF):
        return
    def run():
        try:
            with open(TG_CONF, encoding='utf-8') as fh:
                c = json.load(fh)
            data = urllib.parse.urlencode({'chat_id': c['chat_id'], 'text': text,
                                           'parse_mode': 'HTML'}).encode()
            urllib.request.urlopen('https://api.telegram.org/bot%s/sendMessage' % c['token'],
                                   data, timeout=15)
        except Exception as e:
            log('telegram error:', e)
    threading.Thread(target=run, daemon=True).start()


def health(name, nid, up, now):
    st = H.st.get(name)
    if st is None:                       # first time we see this OBP: no alert
        H.st[name] = [up, int(now)]
        if not up:
            H.out.append([name, int(now), 0])
        return
    if up == st[0]:
        pending.pop(name, None)
        return
    t0 = pending.setdefault(name, now)
    if now - t0 < HEALTH_DELAY:
        return
    pending.pop(name, None)
    label = '%s (%s)' % (name, nid)
    if not up:
        H.out.append([name, int(t0), 0])
        telegram('\U0001F534 <b>%s</b> · %s %s %s' % (SERVER_NAME, label, MSG[0], hhmm(t0)))
        log('OBP down:', label)
    else:
        down_for = t0 - st[1]
        for o in reversed(H.out):
            if o[0] == name and not o[2]:
                o[2] = int(t0)
                break
        telegram('\U0001F7E2 <b>%s</b> · %s %s %s' % (SERVER_NAME, label, MSG[1], dur(down_for)))
        log('OBP up:', label, 'after', dur(down_for))
    H.st[name] = [up, int(t0)]


def on_state(ob, now):
    for name, info in ob.items():
        info = info or {}
        H.obps[name] = {'nid': info.get('NETWORK_ID'), 'up': bool(info.get('CONNECTED'))}
        health(name, info.get('NETWORK_ID'), bool(info.get('CONNECTED')), now)
        for sid, s in (info.get('STREAMS') or {}).items():
            d = 'RX' if s and s[0] == 'RX' else 'TX'
            st = live.setdefault(sid, {'first': now, 'last': now, 'seen': {},
                                       'meta': (s[1] if len(s) > 1 else '?', s[2] if len(s) > 2 else '?',
                                                s[4] if len(s) > 4 else 0)})
            k = (name, d)
            if k not in st['seen']:
                st['seen'][k] = [now, now]
                H.add(st['first'], name, 0 if d == 'RX' else 1, 1)
            else:
                st['seen'][k][1] = now
            st['last'] = now
    for sid in [x for x, st in live.items() if now - st['last'] > STALE]:
        finish(live.pop(sid))


def finish(st):
    srcs = [o for (o, d) in st['seen'] if d == 'RX']
    src = srcs[0] if srcs else 'LOCAL'
    longest = max([b - a for (a, b) in st['seen'].values()] + [1.0])
    call, tg, dmrid = st.get('meta', ('?', '?', 0))
    S.add(st['first'], call, tg, dmrid, src.replace('OBP-', ''), longest)
    for (o, d), (a, b) in st['seen'].items():
        dur = max(b - a, 1.0)
        S.obp_call(st['first'], o, d, call, tg, dmrid, dur)
        H.add(st['first'], o, 2 if d == 'RX' else 3, dur)
        if d == 'TX':
            H.flow(st['first'], src + '>' + o, dur)


# ---------------- minimal websocket client ----------------
def ws_send(sock, op, data):
    mask = os.urandom(4)
    n = len(data)
    head = bytes([0x80 | op])
    if n < 126:
        head += bytes([0x80 | n])
    elif n < 65536:
        head += bytes([0x80 | 126]) + struct.pack('>H', n)
    else:
        head += bytes([0x80 | 127]) + struct.pack('>Q', n)
    sock.sendall(head + mask + bytes(c ^ mask[i % 4] for i, c in enumerate(data)))


class Reader:
    def __init__(self, sock, buf):
        self.sock, self.buf = sock, buf

    def need(self, n):
        while len(self.buf) < n:
            c = self.sock.recv(65536)
            if not c:
                raise IOError('connection closed')
            self.buf += c
        r, self.buf = self.buf[:n], self.buf[n:]
        return r

    def frame(self):
        h = self.need(2)
        fin, op, n = h[0] & 0x80, h[0] & 0x0F, h[1] & 0x7F
        masked = h[1] & 0x80
        if n == 126:
            n = struct.unpack('>H', self.need(2))[0]
        elif n == 127:
            n = struct.unpack('>Q', self.need(8))[0]
        mk = self.need(4) if masked else None
        d = self.need(n)
        if mk:
            d = bytes(c ^ mk[i % 4] for i, c in enumerate(d))
        return fin, op, d


def run_ws():
    sock = socket.create_connection((WS_HOST, WS_PORT), 10)
    sock.settimeout(60)
    key = base64.b64encode(os.urandom(16)).decode()
    sock.sendall((f"GET /ws HTTP/1.1\r\nHost: {WS_HOST}:{WS_PORT}\r\nUpgrade: websocket\r\n"
                  f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
                  f"Sec-WebSocket-Version: 13\r\n\r\n").encode())
    buf = b''
    while b'\r\n\r\n' not in buf:
        c = sock.recv(4096)
        if not c:
            raise IOError('closed during handshake')
        buf += c
    head, buf = buf.split(b'\r\n\r\n', 1)
    if b' 101 ' not in head.split(b'\r\n')[0]:
        raise IOError('handshake refused: %r' % head[:80])
    ws_send(sock, 1, b'conf,opb,main')
    log('connected to ADN Monitor websocket')
    rd, msg, last_save, last_stats = Reader(sock, buf), b'', 0.0, 0.0
    while True:
        fin, op, data = rd.frame()
        now = time.time()
        if op == 9:                      # ping -> pong
            ws_send(sock, 10, data)
        elif op == 8:
            raise IOError('server closed the websocket')
        elif op in (0, 1, 2):
            msg += data
            if fin:
                t, msg = msg, b''
                if t[:1] == b'i':
                    try:
                        S.names(json.loads(t[1:]).get('lastheard'))
                    except Exception:
                        pass
                elif t[:1] == b'o':
                    try:
                        ob = json.loads(t[1:])['ctable']['OPENBRIDGES']
                        on_state(ob, now)
                    except Exception as e:
                        log('parse error:', e)
        if now - last_save >= STEP:
            H.save()
            last_save = now
        if now - last_stats >= 60:
            S.save()
            last_stats = now


def stop(*_):
    try:
        H.save()
        S.save()
        log('history saved, exiting')
    finally:
        sys.exit(0)


if __name__ == '__main__':
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    H.save()
    while True:
        try:
            run_ws()
        except SystemExit:
            raise
        except Exception as e:
            log('websocket error:', e, '- retrying in 5 s')
        time.sleep(5)
