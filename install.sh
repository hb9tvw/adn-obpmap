#!/bin/bash
# adn-obpmap installer (HB9TVW) - OpenBridge map, statistics and ADN Live page for ADN Monitor
#   sudo ./install.sh            first installation (asks a few questions)
#   sudo ./install.sh --update   update the code, keep config.js, netfetch.list and data
set -euo pipefail

DEST=/opt/obpmap
USER_REC=obprec
HERE="$(cd "$(dirname "$0")" && pwd)"
MODE=install; [ "${1:-}" = "--update" ] && MODE=update

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*"; }
ask()  { # question on stderr (stdout is the answer), answer from the terminal; default if none
  local q="$1" d="$2" a=""
  printf '%s [%s]: ' "$q" "$d" >&2
  if [ -r /dev/tty ] && { exec 3</dev/tty; } 2>/dev/null; then read -r a <&3 || true; exec 3<&-; else echo >&2; fi
  echo "${a:-$d}"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo ./install.sh)"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
command -v curl >/dev/null || warn "curl not found: needed only for the network card (netfetch)"

if [ "$MODE" = install ]; then
  echo "Tip: the ADN Monitor port is the one your dashboard proxies /ws to (ProxyPass /ws ws://127.0.0.1:<port>/ws)."
  # 1) the port the running adn-monitor service listens on; 2) else the Apache proxy of /ws
  MPID=$(systemctl show -p MainPID --value adn-monitor 2>/dev/null || true)
  MPORT=""
  if [ -n "$MPID" ] && [ "$MPID" != 0 ] && command -v ss >/dev/null; then
    MPORT=$( (ss -ltnpH 2>/dev/null || true) | grep -E "pid=($MPID|$(pgrep -d'|' -P "$MPID" 2>/dev/null || echo x))," | awk '{print $4}' | grep -oE '[0-9]+$' | head -1 || true)
  fi
  [ -n "$MPORT" ] || MPORT=$( (grep -rhoE 'ws://(127\.0\.0\.1|localhost):[0-9]+/ws' /etc/apache2/sites-enabled/ 2>/dev/null || true) | head -1 | grep -oE '[0-9]+/ws' | grep -oE '^[0-9]+' || true)
  MPORT=${MPORT:-8080}
  SID=$(ask "ADN server number (e.g. 2280)" "0000")
  SNAME=$(ask "Server name for titles and alerts" "ADN $SID")
  MPORT=$(ask "Port of the ADN Monitor websocket (/ws)" "$MPORT")
  ALANG=$(ask "Language of the Telegram alerts (en/it)" "en")
fi

say "Recorder user: $USER_REC"
id "$USER_REC" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$USER_REC"

say "Copying files to $DEST"
mkdir -p "$DEST/live" "$DEST/data"
cp "$HERE"/web/*.js "$HERE"/web/index.html "$DEST"/
cp "$HERE"/web/live/index.html "$DEST/live/"
# cache-busting: every update gets its own ?v= on the scripts, so browsers never keep old copies
VER=$(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || date +%s)
sed -i -E "s/\.js\?v=[0-9A-Za-z]+/.js?v=$VER/g" "$DEST/index.html" "$DEST/live/index.html"
cat "$HERE/VERSION" > "$DEST/version.txt" 2>/dev/null || echo "$VER" > "$DEST/version.txt"
cp "$HERE/recorder/recorder.py" "$HERE/recorder/netfetch.sh" "$DEST"/
chmod 755 "$DEST/netfetch.sh"
[ -f "$DEST/netfetch.list" ] || cp "$HERE/recorder/netfetch.example.list" "$DEST/netfetch.list"
chown -R "$USER_REC:$USER_REC" "$DEST/data"

if [ ! -f "$DEST/config.js" ]; then
  sed -e "s/serverId: '2280'/serverId: '${SID:-0000}'/" -e "s/serverName: 'ADN 2280'/serverName: '${SNAME:-ADN 0000}'/" \
      -e "s/stacked: \['2283', '22812'\]/stacked: []/" -e "s/homeNetworkId: '22810'/homeNetworkId: ''/" -e "s/footer: '.*'/footer: 'ADN Systems ${SID:-0000}'/" \
      "$HERE/web/config.example.js" > "$DEST/config.js"
  warn "Created $DEST/config.js - edit country, city, coordinates and time zone!"
fi

SIDNOW=$(grep -oE "serverId: *'[^']*'" "$DEST/config.js" | grep -oE "'[^']*'" | tr -d "'")
sed "s/{SRV}/$SIDNOW/g" "$HERE/web/manifest.template.webmanifest" > "$DEST/manifest.webmanifest"

if [ ! -f "$DEST/icon-512.png" ]; then
  LOGO=""
  for l in /opt/adn-monitor/frontend/dist/img/logo.png /opt/ADN-Monitor/frontend/dist/img/logo.png; do [ -f "$l" ] && LOGO=$l && break; done
  if python3 -c "import PIL" 2>/dev/null; then
    python3 "$HERE/tools/make_icons.py" "${LOGO:-none}" "$SIDNOW" "$DEST" || warn "icons not created"
  else
    warn "python3-pil missing: app icons not created (apt install python3-pil fonts-dejavu-core, then run install.sh --update)"
  fi
fi

say "Recorder service"
if [ "$MODE" = install ] || [ ! -f /etc/systemd/system/obp-recorder.service ]; then
  sed -e "s/^Environment=OBP_SERVER_NAME=.*/Environment=OBP_SERVER_NAME=${SNAME:-ADN server}/" \
      -e "s/^Environment=OBP_WS_PORT=.*/Environment=OBP_WS_PORT=${MPORT:-8080}/" \
      -e "s/^Environment=OBP_ALERT_LANG=.*/Environment=OBP_ALERT_LANG=${ALANG:-en}/" \
      "$HERE/system/obp-recorder.service" > /etc/systemd/system/obp-recorder.service
fi
cp "$HERE/system/obpmap-netfetch.cron" /etc/cron.d/obpmap-netfetch
systemctl daemon-reload
systemctl enable obp-recorder >/dev/null 2>&1
systemctl restart obp-recorder
sleep 3
systemctl is-active --quiet obp-recorder && say "obp-recorder is running" || warn "obp-recorder is not running: journalctl -u obp-recorder -n 30"

if [ "$MODE" = update ]; then
  echo; say "Update done (config.js, netfetch.list and data kept). Reload the page in the browser."
  exit 0
fi

cat <<MSG

$(say "Done.")
Next steps (see README.md for details):
 1. Apache: add the lines of system/apache-obpmap.conf to the VirtualHost of your dashboard,
    then: apache2ctl configtest && systemctl reload apache2
 2. Edit $DEST/config.js (country, city, lat/lon, time zone, stacked servers, network card).
 3. Optional menu entry in the dashboard (adn-monitor.yaml, nav_links), then restart adn-monitor.
 4. Optional Telegram alerts: create /etc/obpmap/telegram.json  {"token": "...", "chat_id": "..."}
    (chown root:$USER_REC, chmod 640) and: systemctl restart obp-recorder
 5. Open https://<your-dashboard>/obpmap/
MSG
