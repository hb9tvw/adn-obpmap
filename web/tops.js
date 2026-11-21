/* adn-obpmap - Top talkgroups & operators via OpenBridge (HB9TVW)
   Reads data/tops.json written by obp-recorder every minute. Self-contained. */
(function () {
  const CFG = window.OBPMAP_CONFIG || {timeZone: 'UTC', locale: 'en-GB', serverId: ''};
  const box = document.getElementById('topscard');
  if (!box) return;
  const css = `
#topscard .tw2{display:grid;grid-template-columns:1fr 1.25fr;gap:14px;padding:12px 18px 16px}
#topscard h3{margin:0 0 8px;font-size:13px;color:var(--mut,#8aa3bf);text-transform:uppercase;letter-spacing:.6px;font-weight:600}
#topscard table{width:100%;border-collapse:collapse;font-size:13px}
#topscard td,#topscard th{padding:6px 8px;border-bottom:1px solid var(--line,#22344f);white-space:nowrap;text-align:left}
#topscard th{color:var(--mut,#8aa3bf);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
#topscard td.r,#topscard th.r{text-align:right}
#topscard .rk{color:var(--mut,#8aa3bf);width:22px}
#topscard .rk.g1{color:#f5c542;font-weight:800}#topscard .rk.g2{color:#cfd8e3;font-weight:800}#topscard .rk.g3{color:#d08b4a;font-weight:800}
#topscard .tg{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700}
#topscard .nm{color:var(--mut,#8aa3bf);max-width:220px;overflow:hidden;text-overflow:ellipsis}
#topscard .cs a{color:var(--txt,#e3edf8);text-decoration:none;font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700}
#topscard .cs a:hover{color:var(--teal,#2dd4bf);text-decoration:underline}
#topscard .barc{width:90px}
#topscard .bar{height:7px;border-radius:4px;background:linear-gradient(90deg,#2dd4bf,#3cf07a)}
#topscard .via{font-size:11.5px;color:var(--mut,#8aa3bf)}
#topscard .sum{display:flex;gap:18px;flex-wrap:wrap;padding:10px 18px 0;color:var(--mut,#8aa3bf);font-size:12.5px}
#topscard .sum b{color:var(--txt,#e3edf8)}
@media (max-width:900px){#topscard .tw2{grid-template-columns:1fr}#topscard .barc,#topscard .hm{display:none}#topscard .nm{max-width:130px}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  box.className = 'card';
  box.innerHTML = '<div class="card-h"><h2>Top Talkgroups &amp; Operators <small>| traffic through the OpenBridges of ' + CFG.serverId + '</small></h2>' +
    '<div class="ctl"><div class="seg" id="tmet"><button data-m="n" class="on">Calls</button><button data-m="t">Talk time</button></div>' +
    '<div class="seg" id="trng"><button data-r="3600">1 h</button><button data-r="86400" class="on">24 h</button><button data-r="604800">7 days</button></div></div></div>' +
    '<div class="sum" id="tsum">loading…</div><div class="tw2"><div><h3>Talkgroups</h3><div id="ttg"></div></div><div><h3>Operators</h3><div id="tcs"></div></div></div>';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fT = s => s >= 3600 ? (s / 3600).toFixed(1) + ' h' : s >= 60 ? Math.round(s / 60) + ' min' : Math.round(s) + ' s';
  const flag = id => (window.opFlag ? window.opFlag(id) : '');
  let D = null, R = '86400', M = 'n';

  function draw() {
    if (!D) return;
    const r = D.r && D.r[R]; if (!r) return;
    const x = r[M], tot = r.tot || [0, 0, 0, 0];
    document.getElementById('tsum').innerHTML = '<span>Calls <b>' + tot[0] + '</b></span><span>Talk time <b>' + fT(tot[1]) +
      '</b></span><span>Talkgroups <b>' + tot[2] + '</b></span><span>Operators <b>' + tot[3] + '</b></span>' +
      '<span>updated ' + new Date(D.updated * 1000).toLocaleTimeString(CFG.locale, {timeZone: CFG.timeZone, hour: '2-digit', minute: '2-digit'}) + '</span>';
    const val = a => M === 'n' ? a[1] : a[2];
    const maxT = Math.max(1, ...x.tg.map(val)), maxC = Math.max(1, ...x.cs.map(val));
    let h = '<table><tr><th></th><th>TG</th><th>Name</th><th class="r">Calls</th><th class="r">Time</th><th class="barc"></th></tr>';
    x.tg.forEach((a, i) => { h += '<tr><td class="rk g' + (i + 1) + '">' + (i + 1) + '</td><td class="tg">' + esc(a[0]) + (window.lsnBtn?window.lsnBtn(a[0]):'') + '</td><td class="nm" title="' +
      esc((D.tgn || {})[a[0]] || '') + '">' + esc((D.tgn || {})[a[0]] || '') + '</td><td class="r">' + a[1] + '</td><td class="r">' + fT(a[2]) +
      '</td><td class="barc"><div class="bar" style="width:' + (val(a) / maxT * 100).toFixed(0) + '%"></div></td></tr>'; });
    document.getElementById('ttg').innerHTML = x.tg.length ? h + '</table>' : '<div class="mut">No calls in this period yet.</div>';
    h = '<table><tr><th></th><th>Operator</th><th class="hm">Name</th><th class="r">Calls</th><th class="r">Time</th><th>Last TG</th><th class="barc"></th></tr>';
    x.cs.forEach((a, i) => { const nm = (D.csn || {})[a[0]] || '';
      h += '<tr><td class="rk g' + (i + 1) + '">' + (i + 1) + '</td><td class="cs">' + flag(a[3]) + '<a href="https://www.qrz.com/db/' + encodeURIComponent(a[0]) +
        '" target="_blank" rel="noopener">' + esc(a[0]) + '</a></td><td class="nm hm" title="' + esc(nm) + '">' + esc(nm) + '</td><td class="r">' + a[1] +
        '</td><td class="r">' + fT(a[2]) + '</td><td><span class="tg">' + esc(a[4]) + '</span> <span class="via">' + (a[5] === 'LOCAL' ? 'local' : 'via ' + esc(a[5])) +
        '</span></td><td class="barc"><div class="bar" style="width:' + (val(a) / maxC * 100).toFixed(0) + '%"></div></td></tr>'; });
    document.getElementById('tcs').innerHTML = x.cs.length ? h + '</table>' : '<div class="mut">No calls in this period yet.</div>';
  }
  function load() {
    fetch('data/tops.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.json()).then(d => { D = d; draw(); })
      .catch(() => { if (!D) document.getElementById('tsum').textContent = 'Rankings start with the new recorder (first update within 1 minute).'; });
  }
  const seg = (id, set) => document.querySelectorAll('#' + id + ' button').forEach(b => b.onclick = () => {
    set(b); document.querySelectorAll('#' + id + ' button').forEach(y => y.classList.toggle('on', y === b)); draw(); });
  seg('trng', b => R = b.dataset.r); seg('tmet', b => M = b.dataset.m);
  load(); setInterval(load, 60000);
})();
