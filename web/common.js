/* adn-obpmap - shared helpers (HB9TVW)
   Replaces the {TOKENS} in the page with the values of config.js before anything else runs. */
(function () {
  const C = window.OBPMAP_CONFIG = Object.assign({
    serverId: '0000', serverName: 'ADN 0000', homeNetworkId: '', country: 'Country', cc: 'un', city: 'City',
    lat: 46.95, lon: 7.45, timeZone: 'UTC', tzLabel: 'UTC', locale: 'en-GB', stacked: [], locations: {}, labels: {},
    network: [], networkTitle: 'ADN network', adnLiveUrl: 'https://listen.adn.systems/', footer: ''
  }, window.OBPMAP_CONFIG || {});
  const flag = cc => (cc || '').length === 2 ? String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))) : '';
  const T = {SRV: C.serverId, SERVER: C.serverName, COUNTRY: C.country, CITY: C.city, FLAG: flag(C.cc), TZLABEL: C.tzLabel,
    FOOTER: C.footer || ('ADN Systems ' + C.serverId)};
  const rep = s => s.replace(/\{(SRV|SERVER|COUNTRY|CITY|FLAG|TZLABEL|FOOTER)\}/g, (m, k) => T[k]);
  document.title = rep(document.title);
  const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) if (n.nodeValue.indexOf('{') >= 0) n.nodeValue = rep(n.nodeValue);
  window.OBPMAP_TOKENS = T;
})();
