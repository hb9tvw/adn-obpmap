/* adn-obpmap - "listen" buttons (HB9TVW)
   The button opens /obpmap/live/?tg=N, which embeds ADN Live directly on that TG
   (listen.adn.systems/?tg=N). */
(function () {
  const CFG = window.OBPMAP_CONFIG || {timeZone: 'UTC', locale: 'en-GB', serverId: ''};
  const css = document.createElement('style');
  css.textContent = `.lsn{background:rgba(45,212,191,.12);border:1px solid rgba(45,212,191,.5);color:#2dd4bf;border-radius:7px;
  padding:0 5px;margin-left:5px;font-size:12px;line-height:18px;cursor:pointer;vertical-align:1px}
.lsn:hover{background:rgba(45,212,191,.25)}
#lsntoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:4000;background:#0b1628;color:#e3edf8;
  border:1px solid #2dd4bf;border-radius:10px;padding:10px 16px;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.5);display:none;max-width:90vw;text-align:center}`;
  document.head.appendChild(css);
  const toast = document.createElement('div'); toast.id = 'lsntoast'; document.body.appendChild(toast);
  let tmr = null;
  function show(msg) { toast.innerHTML = msg; toast.style.display = 'block'; clearTimeout(tmr); tmr = setTimeout(() => toast.style.display = 'none', 4500); }
  window.listenTG = function (tg) {
    tg = String(tg).replace(/[^0-9]/g, '');
    show('🎧 ADN Live – TG <b>' + tg + '</b>');
    window.open('/obpmap/live/?tg=' + tg, 'adnlive');
  };
  window.lsnBtn = function (tg) {
    const t = String(tg || '').replace(/[^0-9]/g, '');
    return t ? '<button class="lsn" title="Listen on ADN Live" onclick="event.stopPropagation();listenTG(\'' + t + '\')">🎧</button>' : '';
  };
})();
