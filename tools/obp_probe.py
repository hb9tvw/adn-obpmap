#!/usr/bin/env python3
"""adn-obpmap - read-only probe (HB9TVW).

Listens to the ADN Monitor websocket for a few minutes and measures:
  - how often the Monitor sends the OpenBridge state
  - how long each OBP forward leg (stream x OBP x RX/TX) is visible
so we can tell real TX forwards from forwards quenched at once by BCSQ.
It writes nothing.  Usage:  python3 tools/obp_probe.py [seconds] [monitor_port]
"""
import json, os, socket, sys, time, statistics

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'recorder'))
os.environ.setdefault('OBPMAP_DIR', '/opt/obpmap')
import recorder as R   # only the websocket helpers are used

SECS = int(sys.argv[1]) if len(sys.argv) > 1 else 180
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else R.WS_PORT
END_GAP = 15         # a leg not seen for this long has ended (same as the recorder's STALE)
CONT = 1.5           # sightings closer than this count as continuous visible time


def connect():
    import base64
    s = socket.create_connection(('127.0.0.1', PORT), 10)
    s.settimeout(120)
    key = base64.b64encode(os.urandom(16)).decode()
    s.sendall((f"GET /ws HTTP/1.1\r\nHost: 127.0.0.1:{PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    buf = b''
    while b'\r\n\r\n' not in buf:
        buf += s.recv(4096)
    head, buf = buf.split(b'\r\n\r\n', 1)
    if b' 101 ' not in head.split(b'\r\n')[0]:
        raise SystemExit('websocket refused: %r' % head[:80])
    R.ws_send(s, 1, b'conf,opb,main')
    return s, R.Reader(s, buf)


def main():
    s, rd = connect()
    print('listening %d s on port %d ...' % (SECS, PORT), flush=True)
    t0 = time.time()
    msgs = []                 # arrival times of OpenBridge state messages
    legs = {}                 # (sid, obp, dir) -> [first, last, snapshots]
    done = []
    msg = b''
    sfirst = {}               # stream id -> first time seen (the recorder files a stream under this time)
    while time.time() - t0 < SECS:
        try:
            fin, op, data = rd.frame()
        except socket.timeout:
            break           # a timeout mid-frame would desync the stream: stop here
        now = time.time()
        if op == 9:
            R.ws_send(s, 10, data)
            continue
        if op not in (0, 1, 2):
            continue
        msg += data
        if not fin:
            continue
        t, msg = msg, b''
        if t[:1] != b'o':
            continue
        try:
            ob = json.loads(t[1:])['ctable']['OPENBRIDGES']
        except Exception:
            continue
        msgs.append(now)
        for name, info in (ob or {}).items():
            for sid, st in ((info or {}).get('STREAMS') or {}).items():
                d = 'RX' if st and st[0] == 'RX' else 'TX'
                k = (sid, name, d)
                sfirst.setdefault(sid, now)
                if k in legs:
                    if now - legs[k][1] < CONT:
                        legs[k][3] += now - legs[k][1]
                    legs[k][1] = now
                    legs[k][2] += 1
                else:
                    legs[k] = [now, now, 1, 0.0]
        for k in [k for k, v in legs.items() if now - v[1] > END_GAP]:
            done.append((k, legs.pop(k)))
    done += list(legs.items())

    gaps = [b - a for a, b in zip(msgs, msgs[1:])]
    print('\nOBP state messages: %d' % len(msgs))
    if gaps:
        g = sorted(gaps)
        print('  interval  min %.2f s  median %.2f s  p90 %.2f s  max %.2f s'
              % (g[0], statistics.median(g), g[int(len(g) * .9)], g[-1]))
    rx_span = {}
    for (sid, name, d), (a, b, n, v) in done:
        if d == 'RX':
            rx_span[sid] = max(rx_span.get(sid, 0), b - a)
    for d in ('RX', 'TX'):
        sp = [(b - a, n, sid) for (sid, name, dd), (a, b, n, v) in done if dd == d]
        once = sum(1 for x, n, _ in sp if n == 1)
        short = sum(1 for x, n, _ in sp if n > 1 and x < .5)
        mid = sum(1 for x, n, _ in sp if .5 <= x < 2)
        lng = sum(1 for x, n, _ in sp if x >= 2)
        print('%s legs: %d   seen once: %d   <0.5 s: %d   0.5-2 s: %d   >=2 s: %d'
              % (d, len(sp), once, short, mid, lng))
    q = sum(1 for (sid, name, d), (a, b, n, v) in done
            if d == 'TX' and b - a < .5 and rx_span.get(sid, 0) >= 2)
    print('TX legs shorter than 0.5 s while their RX lasted >= 2 s (likely BCSQ): %d' % q)
    tx = [(b - a, v) for (sid, name, d), (a, b, n, v) in done if d == 'TX']
    blip = sum(1 for span, v in tx if span >= .5 and v < .5)
    print('TX legs whose first-to-last span is >= 0.5 s but visible < 0.5 s (blinks again later): %d' % blip)
    print('TX legs visible >= 0.5 s: %d   visible < 0.5 s: %d' % (sum(1 for s_, v in tx if v >= .5), sum(1 for s_, v in tx if v < .5)))

    # compare with what the running recorder stored for the same whole 30-s buckets
    hist = os.path.join(os.environ['OBPMAP_DIR'], 'data', 'history.json')
    w0 = (int(t0) // 30 + 1) * 30
    w1 = int(t0 + SECS) // 30 * 30 - 30          # leave out the last bucket: its streams may still be running
    if w1 <= w0 or not os.path.exists(hist):
        return
    vis = {}
    for (sid, name, d), (a, b, n, v) in done:
        if d == 'TX' and w0 <= sfirst.get(sid, 0) < w1:
            vis[(sid, name)] = vis.get((sid, name), 0) + v
    p_ok = sum(1 for v in vis.values() if v >= .5)
    print('\nwaiting 50 s for the recorder to close and save those streams ...', flush=True)
    time.sleep(50)
    with open(hist, encoding='utf-8') as fh:
        d = json.load(fh)
    r_ok = r_q = 0
    for t, o, f in d.get('b', []):
        if w0 <= t < w1:
            for v in o.values():
                r_ok += v[1]
                r_q += v[4] if len(v) > 4 else 0
    print('same %d s window   probe: TX passed %d, BCSQ %d   recorder: TX passed %d, BCSQ %d'
          % (w1 - w0, p_ok, len(vis) - p_ok, r_ok, r_q))


if __name__ == '__main__':
    main()
