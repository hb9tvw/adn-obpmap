# Changelog

## 1.0.1 – 2026-11-21

- install.sh: the questions are visible again (they were hidden by mistake)

## 1.0.0 – 2026-11-21

First public release, extracted from the map running on ADN 2280 (Switzerland).

- Live OpenBridge world map (server pins, animated RX/TX lines, live stream boxes, operator country dots)
- OpenBridge Activity chart, Flows diagram and OBP table with detail panel
- Link health (uptime 24 h / 7 d / 30 d, outages, timeline) and optional Telegram alerts
- Top talkgroups & operators (1 h / 24 h / 7 days)
- Optional "network" card for several ADN servers
- 🎧 listen buttons and `/obpmap/live/` page embedding ADN Live
- Installable web app (manifest, icons, service worker)
- 17 languages, shared with ADN Monitor through the `language` cookie
- Everything server-specific moved to `config.js`; installer `install.sh`
