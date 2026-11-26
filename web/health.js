/* adn-obpmap - OBP Link health (HB9TVW)
   Reads data/history.json written by obp-recorder (fields st, out, hsince)
   and shows per-OBP uptime and an outage timeline. Self-contained. */
(function () {
  const CFG = window.OBPMAP_CONFIG || {timeZone: 'UTC', locale: 'en-GB', serverId: ''};
  const box = document.getElementById('healthcard');
  if (!box) return;
  const css = `
#healthcard .hrow{display:grid;grid-template-columns:minmax(190px,1.3fr) 200px 70px 70px minmax(220px,3fr);gap:12px;align-items:center;
  padding:9px 18px;border-bottom:1px solid var(--line,#22344f);font-size:13px}
#healthcard .hrow.hd{color:var(--mut,#8aa3bf);font-size:11.5px;text-transform:uppercase;letter-spacing:.6px;font-weight:600}
#healthcard .hrow:last-child{border-bottom:none}
#healthcard .nm{display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#healthcard .nm img{width:22px;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.3)}
#healthcard .s-on{color:var(--rx,#3cf07a);font-weight:600}#healthcard .s-off{color:#f87171;font-weight:700}
#healthcard .pc{font-weight:700;font-family:"JetBrains Mono",ui-monospace,monospace}
#healthcard .bar{position:relative;height:14px;border-radius:4px;background:rgba(60,240,122,.55);overflow:hidden}
#healthcard .bar i{position:absolute;top:0;bottom:0;background:#f87171}
#healthcard .bar b{position:absolute;top:0;bottom:0;background:#3a4b63}
#healthcard .axis{display:flex;justify-content:space-between;color:var(--mut,#8aa3bf);font-size:10.5px;margin-top:2px}
#healthcard .sub{color:var(--mut,#8aa3bf);font-size:11.5px}
@media (max-width:760px){#healthcard .hrow{grid-template-columns:1fr 64px 64px;gap:6px 10px;padding:9px 10px}
  #healthcard .hrow .c-st{grid-column:1/2;grid-row:2}#healthcard .hrow .c-bar{grid-column:1/4}
  #healthcard .hrow.hd .c-st,#healthcard .hrow.hd .c-bar{display:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  box.className = 'card';
  box.innerHTML = '<div class="card-h"><h2>Link health <small>| OBP connection uptime &amp; outages</small></h2>' +
    '<div class="ctl"><div class="seg" id="hrange"><button data-r="86400" class="on">24 h</button><button data-r="604800">7 days</button><button data-r="2592000">30 days</button></div></div></div>' +
    '<div class="note" id="hnote">loading…</div><div id="hlist"></div>';

  const MCC = {'202':'gr','204':'nl','206':'be','208':'fr','214':'es','222':'it','228':'ch','232':'at','234':'gb','262':'de','268':'pt',
    '284':'bg','286':'tr','302':'ca','310':'us','311':'us','312':'us','313':'us','314':'us','315':'us','316':'us','334':'mx','370':'do',
    '505':'au','520':'th','604':'ma','706':'sv','712':'cr','722':'ar','724':'br','730':'cl','748':'uy'};
  const NAMES = {ch:'Switzerland',it:'Italy',gr:'Greece',tr:'Turkey',ma:'Morocco',es:'Spain',sv:'El Salvador',cl:'Chile',br:'Brazil',
    do:'Dominican Rep.',cr:'Costa Rica',au:'Australia',ar:'Argentina',uy:'Uruguay',us:'USA',pt:'Portugal',be:'Belgium',th:'Thailand',
    fr:'France',de:'Germany',at:'Austria',gb:'United Kingdom',nl:'Netherlands',bg:'Bulgaria',mx:'Mexico',ca:'Canada'};
  const ccOf = nid => { const s = String(nid || ''); return MCC[s.slice(0, 3)] || (s.length === 4 && MCC[s.slice(0, 3)]) || 'un'; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmtT = ts => new Date(ts * 1000).toLocaleString(CFG.locale, {timeZone:CFG.timeZone, day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
  const dur = s => { s = Math.max(0, Math.round(s)); if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min';
    if (s < 86400) return Math.floor(s / 3600) + ' h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ' min';
    return Math.floor(s / 86400) + ' d ' + Math.floor(s % 86400 / 3600) + ' h'; };
  let D = null, RANGE = 86400;

  function draw() {
    if (!D || !D.st) { document.getElementById('hnote').textContent = 'Link monitoring starts with the new recorder.'; return; }
    const now = Date.now() / 1000, t0 = now - RANGE, from = Math.max(t0, D.hsince || t0), span = now - t0, known = now - from;
    document.getElementById('hnote').textContent = tt('Monitoring since') + ' ' + fmtT(D.hsince) +
      ' · ' + tt('an OBP counts as down after 2 min without connection') + ' · ' + tt('grey = before monitoring started');
    const names = Object.keys(D.st).sort((a, b) => (D.st[a][0] - D.st[b][0]) || a.localeCompare(b));
    let h = '<div class="hrow hd"><div>OBP</div><div class="c-st">Status</div><div>' + (RANGE === 86400 ? '24 h' : RANGE === 604800 ? '7 d' : '30 d') +
      '</div><div>Outages</div><div class="c-bar">Timeline</div></div>';
    for (const n of names) {
      const o = (D.obps && D.obps[n]) || {}, cc = ccOf(o.nid), [up, since] = D.st[n];
      let down = 0, cnt = 0, segs = '';
      for (const [name, a, b] of (D.out || [])) {
        if (name !== n) continue;
        const s = Math.max(a, from), e = Math.min(b || now, now);
        if (e <= s) continue;
        down += e - s; cnt++;
        segs += '<i style="left:' + ((s - t0) / span * 100).toFixed(2) + '%;width:' + Math.max(0.4, (e - s) / span * 100).toFixed(2) +
          '%" title="' + esc(fmtT(a) + ' → ' + (b ? fmtT(b) : 'now') + ' (' + dur((b || now) - a) + ')') + '"></i>';
      }
      if (from > t0) segs = '<b style="left:0;width:' + ((from - t0) / span * 100).toFixed(2) + '%"></b>' + segs;
      const pc = known > 0 ? Math.max(0, 100 - down / known * 100) : 100;
      const col = pc >= 99 ? 'var(--rx,#3cf07a)' : pc >= 95 ? '#f5b041' : '#f87171';
      h += '<div class="hrow"><div class="nm"><img src="https://flagcdn.com/w40/' + cc + '.png" alt="">' + esc((ctry(cc, NAMES[cc]) || n.replace(/^OBP-/, '')) + ' · ' + (o.nid || '?')) +
        ' <span class="sub">' + esc(n) + '</span></div>' +
        '<div class="c-st ' + (up ? 's-on' : 's-off') + '">' + (up ? '● up' : '● DOWN') + ' <span class="sub">' + (up ? 'for ' : 'since ') + dur(now - since) + '</span></div>' +
        '<div class="pc" style="color:' + col + '">' + pc.toFixed(pc >= 99.95 ? 0 : 1) + '%</div><div class="pc">' + cnt + '</div>' +
        '<div class="c-bar"><div class="bar">' + segs + '</div></div></div>';
    }
    document.getElementById('hlist').innerHTML = h;
  }
  function load() {
    fetch('data/tops.json?h=' + Date.now(), {cache: 'no-store'}).then(r => r.json()).then(d => { D = d; draw(); }).catch(() => {});
  }
  document.querySelectorAll('#hrange button').forEach(b => b.onclick = () => {
    RANGE = +b.dataset.r; document.querySelectorAll('#hrange button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  load(); setInterval(load, 60000);
})();
