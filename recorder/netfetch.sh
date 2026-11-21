#!/bin/sh
# adn-obpmap - copies the tops.json of your other ADN servers for the "network" card (HB9TVW)
# One server per line in netfetch.list:   <server id> <url of its tops.json>
#   2283 https://2283.adn.systems/obpdata/tops.json
# Run every minute by /etc/cron.d/obpmap-netfetch as the recorder user.
BASE=${OBPMAP_DIR:-/opt/obpmap}
LIST="$BASE/netfetch.list"
D="$BASE/data/net"
[ -f "$LIST" ] || exit 0
mkdir -p "$D"
grep -vE '^\s*(#|$)' "$LIST" | while read -r id url; do
  case "$id" in *[!0-9A-Za-z_-]*|'') continue ;; esac
  if curl -sf --max-time 25 "$url" -o "$D/$id.tmp" && head -c 1 "$D/$id.tmp" | grep -q '{'; then
    mv "$D/$id.tmp" "$D/$id.json"
  fi
  rm -f "$D/$id.tmp"
done
