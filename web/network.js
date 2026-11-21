/* adn-obpmap - Swiss ADN network view (HB9TVW)
   Shows several ADN servers side by side (config.js: network). Data: data/tops.json (this server)
   and data/net/<id>.json (the others) copied every minute by netfetch.sh. */
(function () {
  const CFG = window.OBPMAP_CONFIG || {timeZone: 'UTC', locale: 'en-GB', serverId: ''};
  const box = document.getElementById('netcard');
  if (!box) return;
  const SERVERS = CFG.network || [];
  if (!SERVERS.length) { box.style.display = 'none'; return; }
  const css = `
#netcard .ng{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px 18px 16px}
#netcard .sv{border:1px solid var(--line,#22344f);border-radius:12px;padding:12px 14px;background:rgba(255,255,255,.02)}
#netcard .sv.me{border-color:rgba(45,212,191,.55);box-shadow:0 0 0 1px rgba(45,212,191,.2) inset}
#netcard .sh{display:flex;align-items:center;gap:9px}
#netcard .sh img{width:28px;border-radius:3px;box-shadow:0 0 0 1px rgba(255,255,255,.4)}
#netcard .sh b{font-size:15px}#netcard .sh small{display:block;color:var(--mut,#8aa3bf);font-size:11.5px}
#netcard .sh a{margin-left:auto;font-size:12px;color:var(--teal,#2dd4bf);text-decoration:none;white-space:nowrap}
#netcard .lv{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;margin-top:8px}
#netcard .lv i{width:8px;height:8px;border-radius:50%;background:#64748b}
#netcard .lv.ok{color:#3cf07a}#netcard .lv.ok i{background:#3cf07a;box-shadow:0 0 6px #3cf07a}
#netcard .lv.bad{color:#f87171}#netcard .lv.bad i{background:#f87171}
#netcard .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}
#netcard .kp div{background:rgba(255,255,255,.03);border:1px solid var(--line,#22344f);border-radius:8px;padding:6px 4px;text-align:center}
#netcard .kp b{display:block;font:700 15px "JetBrains Mono",ui-monospace,monospace}
#netcard .kp span{color:var(--mut,#8aa3bf);font-size:10.5px}
#netcard h4{margin:10px 0 5px;font-size:11px;color:var(--mut,#8aa3bf);text-transform:uppercase;letter-spacing:.6px}
#netcard .chips{display:flex;flex-wrap:wrap;gap:4px}
#netcard .chip{display:inline-flex;align-items:center;gap:4px;padding:1px 7px 1px 3px;border-radius:9px;font:700 10.5px "JetBrains Mono",ui-monospace,monospace;
  border:1px solid rgba(60,240,122,.5);background:rgba(60,240,122,.06)}
#netcard .chip img{width:14px;border-radius:2px}
#netcard .chip.off{border-color:rgba(248,113,113,.6);background:rgba(248,113,113,.08);color:#fca5a5}
#netcard table{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed}
#netcard td{padding:4px 3px;border-bottom:1px solid rgba(34,52,79,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#netcard td:nth-child(1){width:30%;font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700}
#netcard td:nth-child(2){width:48%;color:var(--mut,#8aa3bf)}#netcard td:nth-child(3){width:22%;text-align:right}
#netcard .mut{color:var(--mut,#8aa3bf);font-size:12px}
@media (max-width:1000px){#netcard .ng{grid-template-columns:1fr}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const esc0 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  box.className = 'card';
  box.innerHTML = '<div class="card-h"><h2>' + esc0(CFG.networkTitle || 'ADN network') + ' <small>| ' + SERVERS.map(s => esc0(s.id)).join(' · ') + ' together</small></h2></div><div class="ng" id="ngrid"></div>';

  const MCC = {'202':'gr','204':'nl','206':'be','208':'fr','214':'es','222':'it','228':'ch','232':'at','234':'gb','262':'de','268':'pt','284':'bg',
    '286':'tr','302':'ca','310':'us','311':'us','312':'us','313':'us','314':'us','315':'us','316':'us','334':'mx','370':'do','505':'au','520':'th',
    '604':'ma','706':'sv','712':'cr','722':'ar','724':'br','730':'cl','748':'uy'};
  const cc = nid => MCC[String(nid || '').slice(0, 3)] || 'un';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fT = s => s >= 3600 ? (s / 3600).toFixed(1) + ' h' : s >= 60 ? Math.round(s / 60) + ' min' : Math.round(s) + ' s';
  const dur = s => { s = Math.max(0, Math.round(s)); return s < 3600 ? Math.max(1, Math.round(s / 60)) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' d'; };
  const D = {};

  function col(S) {
    const d = D[S.id], now = Date.now() / 1000;
    let h = '<div class="sv' + (S.id === CFG.serverId ? ' me' : '') + '"><div class="sh"><img src="https://flagcdn.com/w40/' + (S.cc || CFG.cc || 'un') + '.png" alt=""><div><b>' + S.name +
      '</b><small>' + S.sub + '</small></div><a href="' + S.dash + '" target="_blank" rel="noopener">Dashboard ↗</a></div>';
    if (!d) return h + '<div class="lv bad"><i></i>no data</div></div>';
    const age = now - (d.updated || 0), fresh = age < 180;
    const names = Object.keys(d.st || {}), up = names.filter(n => d.st[n][0]);
    const h1 = (d.r && d.r['3600'] && d.r['3600'].tot) || [0, 0, 0, 0], h24 = (d.r && d.r['86400'] && d.r['86400'].tot) || [0, 0, 0, 0];
    h += '<div class="lv ' + (fresh ? 'ok' : 'bad') + '"><i></i>' + (fresh ? 'recording · OBP ' + up.length + '/' + names.length + ' up' : 'no update for ' + dur(age)) + '</div>';
    h += '<div class="kp"><div><b>' + h1[0] + '</b><span>calls 1 h</span></div><div><b>' + fT(h1[1]) + '</b><span>talk 1 h</span></div><div><b>' + h24[0] +
      '</b><span>calls 24 h</span></div><div><b>' + h24[3] + '</b><span>ops 24 h</span></div></div>';
    h += '<h4>OpenBridges</h4><div class="chips">' + names.sort((a, b) => (d.st[b][0] - d.st[a][0]) || a.localeCompare(b)).map(n => {
      const o = (d.obps || {})[n] || {}, on = d.st[n][0];
      return '<span class="chip' + (on ? '' : ' off') + '" title="' + esc(n + (on ? ' · up ' : ' · DOWN since ') + dur(now - d.st[n][1])) + '"><img src="https://flagcdn.com/w40/' + cc(o.nid) + '.png" alt="">' + esc(o.nid || n) + '</span>';
    }).join('') + '</div>';
    const tg = (d.r && d.r['86400'] && d.r['86400'].n && d.r['86400'].n.tg || []).slice(0, 5);
    h += '<h4>Top TG 24 h</h4>' + (tg.length ? '<table>' + tg.map(a => '<tr><td>' + esc(a[0]) + (window.lsnBtn ? window.lsnBtn(a[0]) : '') + '</td><td>' + esc((d.tgn || {})[a[0]] || '') +
      '</td><td>' + a[1] + '×</td></tr>').join('') + '</table>' : '<span class="mut">no calls yet</span>');
    return h + '</div>';
  }
  function draw() { document.getElementById('ngrid').innerHTML = SERVERS.map(col).join(''); }
  function load() {
    Promise.all(SERVERS.map(S => fetch(S.url + '?n=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(j => { if (j) D[S.id] = j; }).catch(() => {})))
      .then(draw);
  }
  draw(); load(); setInterval(load, 60000);
})();
