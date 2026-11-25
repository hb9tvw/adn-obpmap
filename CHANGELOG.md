# Changelog

## 1.2.0 – 2026-11-25

- **BCSQ-quenched forwards are no longer counted as TX.** A TX forward counts only if it is visible for at least 0.5 s (summed: after a BCSQ the TX chip can blink again later in the call); shorter ones (the other server answered BCSQ: it already had the stream) are stored apart and drawn as a grey dashed band in OpenBridge Activity. Flows and rankings count only forwards that really went through. Idea by Antonios SV0XAL (ADN 2022). Measured on ADN 2280: about two thirds of the TX forwards were quenched; probe and recorder agree (331/709 vs 326/706 in the same 4 minutes).
- New read-only tool `tools/obp_probe.py` to measure OBP forward legs on your own server.
- TX recorded before this version cannot be split afterwards.

## 1.1.1 – 2026-11-22

- New option `labels` in config.js: server number shown on a partner pill when the first 4 digits of its NETWORK_ID are wrong
- Map zoom buttons no longer cover the sticky header when scrolling
- install.sh: Monitor port detected from the running adn-monitor service; short message with `--update`

## 1.1.0 – 2026-11-21

- 🎧 buttons open ADN Live directly on the talkgroup (`listen.adn.systems/?tg=…`, thanks Rodrigo); no more copy & paste

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
