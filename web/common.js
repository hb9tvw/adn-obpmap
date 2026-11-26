/* adn-obpmap - shared helpers (HB9TVW)
   Replaces the {TOKENS} in the page with the values of config.js before anything else runs. */
(function () {
  const C = window.OBPMAP_CONFIG = Object.assign({
    serverId: '0000', serverName: 'ADN 0000', homeNetworkId: '', country: 'Country', cc: 'un', city: 'City',
    lat: 46.95, lon: 7.45, timeZone: 'UTC', tzLabel: 'UTC', locale: 'en-GB', stacked: [], locations: {}, labels: {},
    network: [], networkTitle: 'ADN network', adnLiveUrl: 'https://listen.adn.systems/', footer: '', updateCheck: true
  }, window.OBPMAP_CONFIG || {});
  const flag = cc => (cc || '').length === 2 ? String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))) : '';
  const T = {SRV: C.serverId, SERVER: C.serverName, COUNTRY: C.country, CITY: C.city, FLAG: flag(C.cc), TZLABEL: C.tzLabel,
    FOOTER: C.footer || ('ADN Systems ' + C.serverId)};
  const rep = s => s.replace(/\{(SRV|SERVER|COUNTRY|CITY|FLAG|TZLABEL|FOOTER)\}/g, (m, k) => T[k]);
  document.title = rep(document.title);
  const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) if (n.nodeValue.indexOf('{') >= 0) n.nodeValue = rep(n.nodeValue);
  window.OBPMAP_TOKENS = T;
  // tt(s): translation of s (i18n.js loads last, so look it up at call time)
  window.tt = s => (window.obpT ? window.obpT(s) : s);
  // ctry(cc, fallback): country name in the page language (browser Intl), English list as fallback
  const m = document.cookie.match(/(?:^|;\s*)language=([^;]*)/);
  const LG = m ? decodeURIComponent(m[1]) : (navigator.language || 'en').slice(0, 2).toLowerCase();
  let DN = null; try { if (LG !== 'en') DN = new Intl.DisplayNames([LG], {type: 'region'}); } catch (e) { DN = null; }
  window.ctry = (cc, fb) => { if (!DN || !cc || cc.length !== 2 || cc === 'un') return fb; try { return DN.of(cc.toUpperCase()) || fb; } catch (e) { return fb; } };
})();
