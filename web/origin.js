/* adn-obpmap - operator origin on the OBP map (HB9TVW)
   The first 3 digits of a DMR ID are the country code (MCC). For every live
   stream this draws the operator's country (flag dot) and a dotted line to the
   OBP that brought the stream in (or to this server for local users).
   Needs window.OBPMAP exposed by index.html. */
(function () {
  const CC = {'202':'gr','204':'nl','206':'be','208':'fr','212':'mc','213':'ad','214':'es','216':'hu','218':'ba','219':'hr','220':'rs','222':'it',
    '225':'va','226':'ro','228':'ch','230':'cz','231':'sk','232':'at','234':'gb','235':'gb','238':'dk','240':'se','242':'no','244':'fi','246':'lt',
    '247':'lv','248':'ee','250':'ru','255':'ua','257':'by','259':'md','260':'pl','262':'de','263':'de','264':'de','265':'de','268':'pt','270':'lu',
    '272':'ie','274':'is','276':'al','278':'mt','280':'cy','282':'ge','283':'am','284':'bg','286':'tr','293':'si','294':'mk','295':'li','297':'me',
    '302':'ca','310':'us','311':'us','312':'us','313':'us','314':'us','315':'us','316':'us','317':'us','318':'us','319':'us','330':'pr','334':'mx',
    '338':'jm','368':'cu','370':'do','404':'in','405':'in','410':'pk','420':'sa','424':'ae','425':'il','440':'jp','450':'kr','452':'vn','454':'hk',
    '460':'cn','466':'tw','502':'my','505':'au','510':'id','515':'ph','520':'th','525':'sg','530':'nz','602':'eg','603':'dz','604':'ma','605':'tn',
    '655':'za','704':'gt','706':'sv','708':'hn','710':'ni','712':'cr','714':'pa','716':'pe','722':'ar','724':'br','730':'cl','732':'co','734':'ve',
    '736':'bo','740':'ec','744':'py','748':'uy'};
  const LL = {gr:[37.98,23.73],nl:[52.37,4.9],be:[50.85,4.35],fr:[48.86,2.35],mc:[43.73,7.42],ad:[42.51,1.52],es:[40.42,-3.7],hu:[47.5,19.04],
    ba:[43.86,18.41],hr:[45.81,15.98],rs:[44.79,20.45],it:[41.9,12.5],va:[41.9,12.45],ro:[44.43,26.1],ch:[46.95,7.45],cz:[50.08,14.44],
    sk:[48.15,17.11],at:[48.21,16.37],gb:[51.51,-0.13],dk:[55.68,12.57],se:[59.33,18.07],no:[59.91,10.75],fi:[60.17,24.94],lt:[54.69,25.28],
    lv:[56.95,24.11],ee:[59.44,24.75],ru:[55.76,37.62],ua:[50.45,30.52],by:[53.9,27.57],md:[47.01,28.86],pl:[52.23,21.01],de:[52.52,13.4],
    pt:[38.72,-9.14],lu:[49.61,6.13],ie:[53.35,-6.26],is:[64.15,-21.94],al:[41.33,19.82],mt:[35.9,14.51],cy:[35.17,33.36],ge:[41.72,44.79],
    am:[40.18,44.51],bg:[42.7,23.32],tr:[39.93,32.86],si:[46.06,14.51],mk:[41.99,21.43],li:[47.14,9.52],me:[42.44,19.26],ca:[45.42,-75.7],
    us:[39.5,-98.35],pr:[18.47,-66.11],mx:[19.43,-99.13],jm:[18.0,-76.79],cu:[23.11,-82.37],do:[18.49,-69.93],in:[28.61,77.21],pk:[33.68,73.05],
    sa:[24.71,46.68],ae:[24.45,54.38],il:[31.77,35.21],jp:[35.68,139.69],kr:[37.57,126.98],vn:[21.03,105.85],hk:[22.32,114.17],cn:[39.9,116.4],
    tw:[25.03,121.57],my:[3.14,101.69],au:[-33.87,151.21],id:[-6.21,106.85],ph:[14.6,120.98],th:[13.76,100.5],sg:[1.35,103.82],nz:[-41.29,174.78],
    eg:[30.04,31.24],dz:[36.75,3.06],ma:[34.02,-6.84],tn:[36.81,10.18],za:[-25.75,28.19],gt:[14.63,-90.51],sv:[13.69,-89.22],hn:[14.07,-87.19],
    ni:[12.11,-86.24],cr:[9.93,-84.08],pa:[8.98,-79.52],pe:[-12.05,-77.04],ar:[-34.6,-58.38],br:[-15.79,-47.88],cl:[-33.45,-70.67],co:[4.71,-74.07],
    ve:[10.48,-66.9],bo:[-16.5,-68.15],ec:[-0.18,-78.47],py:[-25.26,-57.58],uy:[-34.9,-56.16]};
  const ccOf = id => { const s = String(id || ''); return s.length >= 6 ? (CC[s.slice(0, 3)] || null) : null; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  window.opFlag = id => { const c = ccOf(id); return c ? '<img class="opf" src="https://flagcdn.com/w40/' + c + '.png" alt="" title="' + c.toUpperCase() + '"> ' : ''; };

  const css = document.createElement('style');
  css.textContent = `.opf{width:16px;height:auto;border-radius:2px;vertical-align:-2px;box-shadow:0 0 0 1px rgba(255,255,255,.35)}
.opdot{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:rgba(9,22,40,.92);
  border:2px solid #7dd3fc;box-shadow:0 0 10px rgba(125,211,252,.8);animation:oppulse 1.6s ease-in-out infinite}
.opdot img{width:16px!important;height:auto!important;border-radius:2px}
@keyframes oppulse{50%{box-shadow:0 0 2px rgba(125,211,252,.2)}}
.opline{stroke:#7dd3fc;stroke-width:1.6;stroke-dasharray:2 6;stroke-linecap:round;fill:none;opacity:.9}
@media (max-width:700px){.opdot{width:20px;height:20px}.opdot img{width:12px!important}}`;
  document.head.appendChild(css);

  function start() {
    const M = window.OBPMAP;
    if (!M || !window.L) { setTimeout(start, 500); return; }
    const map = M.map, layer = L.layerGroup().addTo(map);
    if (!map.getPane('opdots')) map.createPane('opdots').style.zIndex = 660;   // above live boxes, always clickable
    // legend entry
    const lg = document.querySelector('.legend');
    if (lg && !document.getElementById('oplg')) {
      const sp = document.createElement('span'); sp.id = 'oplg';
      sp.innerHTML = '<i style="color:#7dd3fc;border-top-style:dotted"></i>Operator country (from DMR ID)';
      lg.insertBefore(sp, lg.querySelector('.credit'));
    }
    let lastKey = '';
    function pinLL(n) {
      if (!n || !n.loc) return null;
      const p = map.latLngToContainerPoint(n.loc.ll), d = n.d || {dx: 0, dy: 0};
      p.x += d.dx; p.y += d.dy; return map.containerPointToLatLng(p);
    }
    function draw() {
      const ob = M.last; if (!ob) return;
      // stream id -> obp where it arrives (RX)
      const rxAt = {};
      for (const name in ob) for (const sid in (ob[name].STREAMS || {})) if (ob[name].STREAMS[sid][0] === 'RX') rxAt[sid] = name;
      // group operators by (country, target)
      const groups = {};
      for (const name in ob) for (const sid in (ob[name].STREAMS || {})) {
        const s = ob[name].STREAMS[sid], cc = ccOf(s[4]); if (!cc || !LL[cc]) continue;
        let target;
        if (s[0] === 'RX') target = name; else if (!rxAt[sid]) target = 'LOCAL'; else continue;
        const k = cc + '|' + target, g = groups[k] || (groups[k] = {cc, target, ops: {}});
        g.ops[s[1] + '|' + s[2]] = s;
      }
      const key = Object.keys(groups).sort().join(',') + '|' + map.getZoom() + '|' + map.getCenter().toString() +
        '|' + Object.keys(groups).map(k => Object.keys(groups[k].ops).join(';')).join('/');
      if (key === lastKey) return; lastKey = key;
      layer.clearLayers();
      // screen rectangles of the server pins (and the Swiss block) to keep the dots clear of them
      const pins = [], tips = [], hp = map.latLngToContainerPoint(M.home.ll);
      pins.push({x: hp.x - 45, y: hp.y - 55, w: 90, h: 110});
      for (const nm in M.nodes) { const n = M.nodes[nm]; if (!n || !n.loc || n.loc.sat) continue;
        const p = map.latLngToContainerPoint(n.loc.ll), d = n.d || {dx: 0, dy: 0}, w = n.w || 60;
        pins.push({x: p.x + d.dx - w / 2 - 4, y: p.y + d.dy - 17, w: w + 8, h: 34}); }
      const mr = map.getContainer().getBoundingClientRect();
      document.querySelectorAll('.leaflet-tooltip.on-air').forEach(el => { const r = el.getBoundingClientRect();
        tips.push({x: r.left - mr.left - 4, y: r.top - mr.top - 4, w: r.width + 8, h: r.height + 8}); });
      const R = 15, hit = (c, list) => list.some(r => c.x + R > r.x && c.x - R < r.x + r.w && c.y + R > r.y && c.y - R < r.y + r.h);
      const usedDots = [], place = cc => {
        const real = L.latLng(LL[cc]), c0 = map.latLngToContainerPoint(real), near = [[0,0]], far = [];
        for (const r of [38, 60, 85, 115]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4;
          (r <= 85 ? near : far).push([Math.round(r * Math.sin(a)), Math.round(-r * Math.cos(a))]); }
        // 1) close by, clear of pins, live boxes and other dots  2) clear of pins and dots only (may sit under a box)
        const passes = [[near, pins.concat(tips)], [near.concat(far), pins]];
        for (const [steps, obst] of passes) for (const [dx, dy] of steps) { const c = L.point(c0.x + dx, c0.y + dy);
          if (!hit(c, obst.concat(usedDots))) { usedDots.push({x: c.x - R, y: c.y - R, w: 2 * R, h: 2 * R});
            return {ll: map.containerPointToLatLng(c), moved: dx || dy, real}; } }
        return {ll: real, moved: 0, real};
      };
      const dotPos = {};
      const dots = {};
      for (const k in groups) {
        const g = groups[k], pos = dotPos[g.cc] || (dotPos[g.cc] = place(g.cc)), from = pos.ll;
        const to = g.target === 'LOCAL' ? L.latLng(M.home.ll) : pinLL(M.nodes[g.target]);
        if (!to) continue;
        const a = map.latLngToContainerPoint(from), b = map.latLngToContainerPoint(to);
        if (a.distanceTo(b) > 28) L.polyline([from, to], {className: 'opline', interactive: false}).addTo(layer);
        const dd = dots[g.cc] || (dots[g.cc] = {ops: []});
        for (const o in g.ops) { const s = g.ops[o]; dd.ops.push('<div class="r"><span class="' + (s[0] === 'RX' ? 'rx' : 'tx') + '">' +
          (g.target === 'LOCAL' ? 'LOCAL' : 'via ' + esc(g.target.replace(/^OBP-/, ''))) + '</span> <span class="cs">' + esc(s[1]) + '</span> · TG ' + esc(s[2]) + '</div>'); }
      }
      for (const cc in dots) {
        const pos = dotPos[cc];
        if (pos.moved) L.polyline([pos.real, pos.ll], {className: 'opline', interactive: false}).addTo(layer);
        L.marker(pos.ll, {pane: 'opdots', zIndexOffset: 1300, icon: L.divIcon({className: '', html: '<div class="opdot"><img src="https://flagcdn.com/w40/' + cc + '.png" alt=""></div>',
          iconSize: [26, 26], iconAnchor: [13, 13]})})
          .bindTooltip('<b>Operators · ' + cc.toUpperCase() + '</b>' + dots[cc].ops.join(''), {className: 'tip', direction: 'top', offset: [0, -14]})
          .addTo(layer);
      }
    }
    setInterval(draw, 1000);
    map.on('zoomend moveend', () => { lastKey = ''; draw(); });
  }
  start();
})();
