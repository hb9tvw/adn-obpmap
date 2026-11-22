/* adn-obpmap - configuration of YOUR server.
   Copy this file to config.js (the installer does it once) and edit the values.
   config.js is never overwritten by updates. */
window.OBPMAP_CONFIG = {
  serverId: '2280',                 // ADN server number shown on the map pin and in titles
  serverName: 'ADN 2280',           // name used in tooltips, flows and Telegram alerts
  homeNetworkId: '22810',           // optional: the OpenBridge NETWORK_ID other servers know you by
  country: 'Switzerland',           // shown in the header and in the hub tooltip
  cc: 'ch',                         // ISO 3166 two-letter country code (flag)
  city: 'Basel',
  lat: 47.56, lon: 7.59,            // where the hub pill is drawn

  timeZone: 'Europe/Zurich',        // IANA time zone for all times on the page
  tzLabel: 'CH',                    // short label next to the local clock
  locale: 'de-CH',                  // date/time format (e.g. en-GB, it-IT, es-ES)

  // OBP NETWORK_IDs of other servers that sit at the same place as this one
  // (e.g. your second and third server). They are drawn stacked above / below the hub.
  stacked: ['2283', '22812'],

  // Optional: server number shown on the pill of an OBP partner. By default a 5-digit
  // NETWORK_ID shows its first 4 digits (20820 -> 2082); set it here when that is wrong.
  labels: {
    // '22810': '2280',
  },

  // Optional: position (or override) of OBP partners the map does not know yet.
  // NETWORK_ID: [country code, latitude, longitude, country name, preferred tooltip side]
  locations: {
    // '22210': ['it', 41.90, 12.50, 'Italy', 'left'],
  },

  // Optional "network" card: several of your own ADN servers side by side.
  // url = the tops.json of that server (this one: data/tops.json, the others: data/net/<id>.json,
  // copied every minute by netfetch). Leave the list empty to hide the card.
  networkTitle: 'Swiss ADN network',
  network: [
    // {id: '2280', name: 'ADN 2280', sub: 'Master server', cc: 'ch', url: 'data/tops.json', dash: '/'},
    // {id: '2283', name: 'ADN 2283', sub: 'VPS Basel', cc: 'ch', url: 'data/net/2283.json', dash: 'https://2283.adn.systems/'},
  ],

  adnLiveUrl: 'https://listen.adn.systems/',   // page embedded by /obpmap/live/ and opened by the 🎧 buttons
  footer: 'ADN Systems 2280 · Funk-Amateur-Club Basel HB9CSR · HB9TVW'
};
