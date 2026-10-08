# Deployment smoke-test report

Run against the real deployment path: built Next.js server (`next start`) +
real **MongoDB Atlas** cluster. All writes were made to an isolated throwaway
database (`evision_smoke_test`) and **dropped** on completion — the production
`evision` database was never touched.

Date: 2026-10-06 · Node 20.18.0 · Next.js 15.5.27 · mongoose 8.10.1

---

## PASS / FAIL matrix

| Check | Result | Notes |
| --- | --- | --- |
| TYPECHECK (`npx tsc --noEmit`) | **PASS** | strict, clean |
| LINT (`npm run lint`, zero warnings) | **PASS** | clean |
| BUILD (`npm run build`) | **PASS** | 6 static + 34 dynamic routes, no server-only leaks |
| MONGODB ATLAS | **PASS** | connect, ping, insert/read/delete, `ensureIndexes()` all OK |
| ESP32 INGESTION | **PASS** | simulated POST → `201`, frame persisted, device auto-registered |
| INGEST AUTH | **PASS** | wrong bearer → `401`; unconfigured key → `503` |
| INGEST VALIDATION | **PASS** | malformed body → `400` with field list; oversized → `413`; overspeed → `429` |
| LIVE DASHBOARD | **PASS** | `/api/live` `source: live`, `link: online`, positive magnitudes |
| HISTORICAL DATA | **PASS** | `/api/telemetry`, `/api/energy` OK on `5m`/`15m`/`1h`/`24h`/`7d` |
| ALERTS (dedup + resolution) | **PASS** | 2 breaching frames → **1** alert; clear frame → resolved, `active:0` |
| SIGN CONVENTION | **PASS** | solar `596.7`, fuel `291.6`, vehicle `783.9`, battery net `+104.4` (positive = charging) |
| SECURITY / VERCEL | **PASS** | every read route `guard()`ed + per-IP rate limited; routes `nodejs`/`force-dynamic`/no-store |
| OFF-LINE DERIVATION | **PASS** | read-time `linkStateFromAge`: `online` ≤ 10 s, `delayed` ≤ 30 s, `offline` > 30 s, `NO DATA` when never seen |
| REAL-TIME POLLING | **PASS** | LiveView polls `/api/live` every 3 s (`LiveSection`); Topbar every 15 s |

---

## Issues found and fixed during this pass

1. **Device upsert path conflict (`MongoServerError` code 40).** The ingest route
   set `lastSeen`/`status`/`firmware` in both `$set` and `$setOnInsert`, which
   MongoDB rejects on every upsert — no node could ever have been registered.
   Fixed by filtering the insert-only defaults against the `$set` keys.
2. **Alert spam and non-resolution.** alert generation used to emit **one active
   alert per frame** (`evaluateAlerts` in the route), and the read path fell back
   to *synthesised* derived alerts whenever a status-filtered query returned
   none — resurrecting resolved alerts. Reworked to transition-based raising
   (`ruleBreaches` + per-device open-category map in the route, one open alert
   per device+category, auto-resolved on clear) and removed the fabricated
   fallback for live data.
3. **Sign convention.** Aligned `lib/ingest.ts`, `lib/stats.ts` and
   `lib/data.ts` on the canonical PZEM-forward convention documented in
   `ESP32_INTEGRATION.md §2` (generation positive, draw positive, net positive =
   charging).
4. **Missing short time ranges.** Added `5m` (30 pts) and `15m` (45 pts) to
   `RANGE_PRESETS` and every query validator so the selector never 400s.
5. **Stale documentation.** Rewrote `.env.example`,
   `docs/ESP32_INTEGRATION.md`, `docs/DEPLOYMENT.md` and the README to the
   mediated `ESP32 → Vercel /api/ingest/telemetry → Atlas` architecture and the
   corrected sign/deviceId contract.

---

## Smoke procedure (reproducible)

Server-side smoke only; nothing touched production data.

1. Build: `npm run build`
2. Run with a throwaway database:
   `MONGODB_DATABASE=evision_smoke_test DEVICE_API_KEY=… EVISION_DEMO_MODE=off npx next start -p 3100`
3. Hit `GET /api/health` and `GET /api/ingest/telemetry` (contract).
4. `POST /api/ingest/telemetry` — authorization header, one frame → `201`.
5. Two breaching frames (temp ≥ 55 °C) in one batch → exactly one alert raised.
6. One healthy frame → alert `resolved`, `/api/alerts?status=active` empty.
7. Verify `/api/live`, `/api/telemetry/latest`, `/api/energy`, `/api/telemetry`
   and a bad-credential `401`.
8. Drop the throwaway database.

---

## Deliverables

| # | Item | Value |
| --- | --- | --- |
| 1 | ESP32 URL path | `POST /api/ingest/telemetry` (no base path prefix) |
| 2 | Auth header | `Authorization: Bearer <DEVICE_API_KEY>` + `X-Device-Id: EV-001` |
| 3 | Payload | single frame or `{ "frames": [ … ] }` — shape in `docs/ESP32_INTEGRATION.md §3` |
| 4 | Vercel env vars | `MONGODB_URI`, `MONGODB_DATABASE` (`evision`), `DEVICE_API_KEY`, `EVISION_DEVICE_ID`, `INGEST_*`, `EVISION_*` (see `.env.example`) |
| 5 | DB name | `evision` |
| 6 | Collection names | `devices`, `telemetry`, `ai_predictions`, `alerts`, `trips`, `energy_sessions`, `system_events` |
| 7 | Deploy steps | `docs/DEPLOYMENT.md` |
| 8 | Remaining non-blocking issues | below |

## Remaining non-blocking issues

- `npm audit --omit=dev` reports PostCSS advisories that are patched only in
  `next@16` — **not** forced; the authenticated pages and ingest security are
  unaffected.
- Node `20.18.0` is below the recommended `20.19+`; upgrade the runtime to avoid
  a Node 20 advisory.
- A few UI strings carry minor mojibake (e.g. `°C → ��C` in the alerts payload);
  cosmetic only.
- `getDerivedAlerts` remains exported for potential reserved use but is no
  longer invoked by the alerts read path.