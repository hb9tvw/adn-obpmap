/* adn-obpmap - OBP detail panel (HB9TVW)
   Click a server pin on the map (or a row of the OpenBridge table) to open a panel
   with status, uptime, 24 h activity, top talkgroups and the last calls.
   Data: data/tops.json written by obp-recorder. Needs window.OBPMAP. */
(function () {
  const CFG = window.OBPMAP_CONFIG || {timeZone: 'UTC', locale: 'en-GB', serverId: ''};
  const css = `
#obpd{position:fixed;top:0;right:0;bottom:0;width:400px;max-width:100%;z-index:3000;background:linear-gradient(180deg,#101d33,#0b1628);
  border-left:1px solid var(--line2,#2c4466);box-shadow:-14px 0 40px rgba(0,0,0,.55);transform:translateX(105%);transition:transform .22s ease;
  overflow-y:auto;color:var(--txt,#e3edf8)}
#obpd.open{transform:none}
#obpd .dh{position:sticky;top:0;display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(9,18,33,.97);border-bottom:1px solid var(--line,#22344f)}
#obpd .dh img{width:34px;border-radius:3px;box-shadow:0 0 0 1px rgba(255,255,255,.4)}
#obpd .dh .t{flex:1;min-width:0}#obpd .dh b{display:block;font-size:16px}
#obpd .dh small{color:var(--mut,#8aa3bf);font-size:12px}
#obpd .x{background:none;border:1px solid var(--line2,#2c4466);color:var(--txt,#e3edf8);border-radius:8px;width:34px;height:34px;font-size:18px;cursor:pointer}
#obpd .sec{padding:12px 16px;border-bottom:1px solid var(--line,#22344f)}
#obpd h4{margin:0 0 8px;font-size:11.5px;color:var(--mut,#8aa3bf);text-transform:uppercase;letter-spacing:.6px}
#obpd .kp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#obpd .kp div{background:rgba(255,255,255,.03);border:1px solid var(--line,#22344f);border-radius:9px;padding:8px;text-align:center}
#obpd .kp b{display:block;font:700 17px "JetBrains Mono",ui-monospace,monospace}
#obpd .kp span{color:var(--mut,#8aa3bf);font-size:11px}
#obpd .st{display:inline-block;padding:2px 9px;border-radius:7px;font-size:12px;font-weight:700}
#obpd .st.on{color:#3cf07a;border:1px solid rgba(60,240,122,.5);background:rgba(60,240,122,.08)}
#obpd .st.off{color:#f87171;border:1px solid rgba(248,113,113,.5);background:rgba(248,113,113,.08)}
#obpd svg{display:block;width:100%;height:70px}
#obpd .ax{display:flex;justify-content:space-between;color:var(--mut,#8aa3bf);font-size:10.5px}
#obpd table{width:100%;border-collapse:collapse;font-size:12.5px}
#obpd td{padding:5px 4px;border-bottom:1px solid rgba(34,52,79,.6);white-space:nowrap}
#obpd td.r{text-align:right}#obpd .mut{color:var(--mut,#8aa3bf)}
#obpd .tg{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700}
#obpd .nm{display:inline-block;max-width:150px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom;color:var(--mut,#8aa3bf)}
#obpd{overflow-x:hidden}#obpd table{table-layout:auto;max-width:100%}
@media (max-width:700px){#obpd .nm{max-width:34vw}#obpd td{padding:5px 3px;font-size:12px}}
#obpd .cs a{color:inherit;text-decoration:none;font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700}
#obpd .cs a:hover{text-decoration:underline}
#obpd .rx{color:#3cf07a;font-weight:700}#obpd .tx{color:#f87171;font-weight:700}
#obpd table.ttg,#obpd table.tlc{table-layout:fixed;width:100%}
#obpd .ttg td,#obpd .tlc td{overflow:hidden;text-overflow:ellipsis}
#obpd .ttg td:nth-child(1){width:24%}#obpd .ttg td:nth-child(2){width:42%}#obpd .ttg td:nth-child(3){width:15%}#obpd .ttg td:nth-child(4){width:19%}
#obpd .ttg .nm{max-width:100%}
#obpd .tlc td:nth-child(1){width:16%}#obpd .tlc td:nth-child(2){width:11%}#obpd .tlc td:nth-child(3){width:35%}#obpd .tlc td:nth-child(4){width:22%}#obpd .tlc td:nth-child(5){width:16%}
#tb tr{cursor:pointer}#tb tr:hover td{background:rgba(45,212,191,.06)}
@media (max-width:700px){#obpd{top:auto;left:0;width:100%;height:78vh;border-left:0;border-top:1px solid var(--line2,#2c4466);
  border-radius:16px 16px 0 0;transform:translateY(105%)}#obpd.open{transform:none}}`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  const P = document.createElement('div'); P.id = 'obpd'; document.body.appendChild(P);

  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fT = s => s >= 3600 ? (s / 3600).toFixed(1) + ' h' : s >= 60 ? Math.round(s / 60) + ' min' : Math.round(s) + ' s';
  const hm = ts => new Date(ts * 1000).toLocaleTimeString(CFG.locale, {timeZone: CFG.timeZone, hour: '2-digit', minute: '2-digit'});
  const dur = s => { s = Math.max(0, Math.round(s)); return s < 3600 ? Math.max(1, Math.round(s / 60)) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min' : Math.floor(s / 86400) + ' d ' + Math.floor(s % 86400 / 3600) + ' h'; };
  const flag = id => (window.opFlag ? window.opFlag(id) : '');
  let cur = null, D = null, timer = null;

  function uptime(name, win, now) {
    if (!D || !D.st) return [null, 0];
    const t0 = now - win, from = Math.max(t0, D.hsince || t0), known = now - from; let down = 0, n = 0;
    for (const [nm, a, b] of (D.out || [])) { if (nm !== name) continue; const s = Math.max(a, from), e = Math.min(b || now, now);
      if (e > s) { down += e - s; n++; } }
    return [known > 0 ? Math.max(0, 100 - down / known * 100) : null, n];
  }
  function spark(sp) {
    const [rx, tx] = sp, W = 288, H = 70, mid = H / 2, mx = Math.max(1, ...rx, ...tx), k = (mid - 2) / mx;
    const up = rx.map((v, i) => i + ',' + (mid - v * k).toFixed(1)).join(' L'), dn = tx.map((v, i) => i + ',' + (mid + v * k).toFixed(1)).join(' L');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path d="M0,' + mid + ' L' + up + ' L' + (W - 1) + ',' + mid + 'Z" fill="rgba(60,240,122,.2)"/>' +
      '<path d="M0,' + mid + ' L' + dn + ' L' + (W - 1) + ',' + mid + 'Z" fill="rgba(248,113,113,.2)"/><path d="M' + up + '" fill="none" stroke="#3cf07a" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' +
      '<path d="M' + dn + '" fill="none" stroke="#f87171" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' +
      '<line x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '" stroke="#35506f" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
  }
  function render() {
    if (!cur) return;
    const M = window.OBPMAP, n = M && M.nodes[cur], loc = n && n.loc, live = M && M.last && M.last[cur];
    const o = (D && D.obp && D.obp[cur]) || {last: [], tg: [], spark: [new Array(288).fill(0), new Array(288).fill(0)]};
    const nid = (live && live.NETWORK_ID) || (D && D.obps && D.obps[cur] && D.obps[cur].nid) || '?';
    const up = live ? live.CONNECTED : (D && D.st && D.st[cur] ? D.st[cur][0] : null);
    const now = Date.now() / 1000, [u24, o24] = uptime(cur, 86400, now), [u7] = uptime(cur, 604800, now);
    const since = D && D.st && D.st[cur] ? dur(now - D.st[cur][1]) : '';
    const tgn = (D && D.tgn) || {}, csn = (D && D.csn) || {};
    const streams = live ? Object.values(live.STREAMS || {}) : [];
    let h = '<div class="dh"><img src="https://flagcdn.com/w80/' + esc(loc ? loc.cc : 'un') + '.png" alt=""><div class="t"><b>' + esc((loc ? loc.country : cur.replace(/^OBP-/, '')) + ' · ' + nid) +
      '</b><small>' + esc(cur) + '</small></div><button class="x" aria-label="close">×</button></div>';
    h += '<div class="sec"><span class="st ' + (up ? 'on' : 'off') + '">' + (up ? '● Connected' : '● Offline') + '</span> <span class="mut">' + (since ? (up ? 'for ' : 'since ') + since : '') + '</span>';
    if (streams.length) h += '<div style="margin-top:8px">' + streams.map(x => '<div><span class="' + (x[0] === 'RX' ? 'rx' : 'tx') + '">' + x[0] + '</span> ' + flag(x[4]) +
      '<span class="tg">' + esc(x[1]) + '</span> · TG ' + esc(x[2]) + (window.lsnBtn?window.lsnBtn(x[2]):'') + ' <span class="mut">' + esc(tgn[x[2]] || '') + '</span></div>').join('') + '</div>';
    h += '</div><div class="sec"><div class="kp"><div><b>' + (u24 == null ? '–' : u24.toFixed(u24 >= 99.95 ? 0 : 1) + '%') + '</b><span>uptime 24 h</span></div><div><b>' +
      (u7 == null ? '–' : u7.toFixed(u7 >= 99.95 ? 0 : 1) + '%') + '</b><span>uptime 7 d</span></div><div><b>' + o24 + '</b><span>outages 24 h</span></div></div></div>';
    h += '<div class="sec"><h4>Activity 24 h · <span class="rx">RX ▲</span> <span class="tx">TX ▼</span></h4>' + spark(o.spark) +
      '<div class="ax"><span>' + hm(o.spark0 || now - 86400) + '</span><span>' + hm((o.spark0 || now - 86400) + 43200) + '</span><span>now</span></div></div>';
    h += '<div class="sec"><h4>Top talkgroups 24 h</h4>' + (o.tg.length ? '<table class="ttg">' + o.tg.map(a => '<tr><td class="tg">' + esc(a[0]) + (window.lsnBtn?window.lsnBtn(a[0]):'') + '</td><td><span class="nm">' + esc(tgn[a[0]] || '') +
      '</span></td><td class="r">' + a[1] + '×</td><td class="r mut">' + fT(a[2]) + '</td></tr>').join('') + '</table>' : '<span class="mut">no calls yet</span>') + '</div>';
    h += '<div class="sec"><h4>Last calls</h4>' + (o.last.length ? '<table class="tlc">' + o.last.map(c => '<tr><td class="mut">' + hm(c[0]) + '</td><td class="' + (c[1] === 'RX' ? 'rx' : 'tx') + '">' + c[1] +
      '</td><td class="cs">' + flag(c[4]) + '<a href="https://www.qrz.com/db/' + encodeURIComponent(c[2]) + '" target="_blank" rel="noopener" title="' + esc(csn[c[2]] || '') + '">' + esc(c[2]) +
      '</a></td><td class="tg">' + esc(c[3]) + '</td><td class="r mut">' + fT(c[5]) + '</td></tr>').join('') + '</table>' : '<span class="mut">no calls recorded yet</span>') + '</div>';
    P.innerHTML = h;
    P.querySelector('.x').onclick = close;
  }
  function load() { return fetch('data/tops.json?d=' + Date.now(), {cache: 'no-store'}).then(r => r.json()).then(d => { D = d; render(); }).catch(() => render()); }
  function open(name) { cur = name; P.classList.add('open'); render(); load(); clearInterval(timer); timer = setInterval(() => { load(); }, 30000); }
  function close() { P.classList.remove('open'); cur = null; clearInterval(timer); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  setInterval(() => { if (cur) render(); }, 3000);

  function hook() {
    const M = window.OBPMAP; if (!M) return;
    for (const name in M.nodes) { const n = M.nodes[name]; if (n.m && !n.m._dt) { n.m._dt = true; n.m.on('click', () => open(name)); } }
  }
  setInterval(hook, 1000);
  const tb = document.getElementById('tb');
  if (tb) tb.addEventListener('click', e => { const tr = e.target.closest('tr'); if (!tr || !tr.children[1]) return;
    const name = tr.children[1].textContent.trim(); if (name.startsWith('OBP')) open(name); });
})();
