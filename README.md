# EVISION AI

**Intelligent Energy & Vehicle Intelligence Platform** — a real-time telemetry
platform for an electric vehicle that combines a solar array, a hydrogen fuel-cell
stack, a 48 V LiFePO₄ pack and embedded AI inference on a single ESP32-S3 edge
node.

Built by **Viyal Tech**.

---

## What this platform is

A production Next.js application that renders every metric server-side from
MongoDB Atlas. The browser never talks to the database, never holds a credential,
and never invents a number: when a dataset is empty the UI shows a waiting state
instead of a fabricated `0.00`.

The ingestion path is a single line:

```
ESP32-S3 ──HTTPS/Bearer──> Vercel /api/ingest/telemetry ──> MongoDB Atlas ──> Next.js server routes ──> browser
```

The node never holds the Atlas URI: it authenticates to the platform's ingest
endpoint with a shared device credential (`DEVICE_API_KEY`) and the platform
writes to MongoDB. See [`docs/ESP32_INTEGRATION.md`](docs/ESP32_INTEGRATION.md)
for the exact POST contract and the canonical power-sign convention.

### Hardware the data comes from

| Component | Detail |
| --- | --- |
| MCU | ESP32-S3 N16R8 (16 MB flash, 8 MB PSRAM) |
| Power channels | 3 × PZEM-017 over Modbus-RTU (UART/TTL) |
| Address map | `0x01` solar, `0x02` fuel cell, `0x03` traction/load |
| Temperature | 4 × DS18B20 on 1-Wire (12-bit) |
| Storage | MicroSD (SPI) segment log |
| Bus | 48 V DC nominal (BMS range ~46–58.4 V) |
| Connectivity | Wi-Fi 802.11 b/g/n with TLS 1.2 |
| Edge AI | TensorFlow Lite Micro / EspDl, SOC + range + anomaly models |

### Embedded AI models

Three inference heads run on the node itself:

- **AI-MODEL-01 — SOC prediction.** Recurrent inference over voltage, current and
  load history; forecasts state of charge forward so range planning stays ahead.
- **AI-MODEL-02 — Range estimation.** Rolling efficiency window projected from
  the pack state and recent traction energy.
- **AI-MODEL-03 — Anomaly detection.** Normalised 0–1 score correlated against
  thermal, current and voltage excursions; drives the alert engine.

---

## Live vs demo data

Two datasets exist and they are **never merged**:

| | Live | Demo |
| --- | --- | --- |
| Device id | `EV-001` | `EV-DEMO-001` |
| Origin | Measured by the ESP32-S3 | Deterministic synthetic model |
| Badge | `LIVE` (green) | `DEMO DEVICE` (amber) + banner |
| Served when | Atlas is configured and reachable | Atlas missing/unreachable, or `EVISION_DEMO_MODE=on` |

Every server response is wrapped in a `DataEnvelope` that carries its own
`source`, `deviceId` and `link` state, so a view cannot accidentally present
synthetic numbers as measured ones.

Set `EVISION_DEMO_MODE=off` to disable synthetic data entirely and render only
real waiting states.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in MONGODB_URI
npm run dev                    # http://localhost:3000
```

### Validation

```bash
npm run typecheck   # tsc --noEmit, strict
npm run lint        # eslint, next/core-web-vitals + next/typescript
npm run build       # production build + type validation
```

### Seed a cluster

```bash
npm run seed                # EV-001, last 72 h at 60 s resolution
npm run seed -- --hours=168 --interval=30000
npm run seed:demo           # isolated synthetic device EV-DEMO-001
npm run seed -- --wipe      # delete this device's data first
npm run seed -- --dry-run   # print the plan, write nothing (needs no credentials)
```

The seed script reuses the same physical model that powers the demo dataset, so a
fresh cluster immediately has coherent telemetry, AI predictions, alerts, trips,
energy sessions and system events — plus all declared indexes.

---

## Routes

### Marketing

`/` · `/vehicle` · `/architecture` · `/technology` · `/about` · `/performance`

### Control centre

| Route | Purpose |
| --- | --- |
| `/dashboard` | Mission control — sources, pack, traction bus, thermal, AI |
| `/dashboard/live` | Live frame with streaming updates |
| `/dashboard/battery` | Pack state, mode, cell voltage, health |
| `/dashboard/solar` | Channel explorer for the PV array |
| `/dashboard/fuel-cell` | Channel explorer for the stack |
| `/dashboard/energy` | Flow, generation/consumption split, bucketed ledger |
| `/dashboard/analytics` | Range analytics over all channels |
| `/dashboard/ai` | Model state, runtime, timeline, series |
| `/dashboard/thermal` | Probe grid, thermal map, excursions |
| `/dashboard/alerts` | Filterable alert stream (read-only) |
| `/dashboard/trips` | Trip ledger with efficiency and SOC delta |
| `/dashboard/trips/[id]` | Trip dossier with charts and AI annotations |
| `/dashboard/data` | Paginated raw frames + collection reference |
| `/dashboard/reports` | Daily/weekly/monthly/trip/energy/AI/thermal dossiers, CSV + print |
| `/dashboard/device` | Registration, channel health, hardware snapshot, event log |
| `/dashboard/settings` | Resolved runtime configuration and thresholds |

### API

All routes are `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, rate-limited
and accept `device` + `range` query parameters.

`/api/dashboard` · `/api/live` · `/api/battery` · `/api/solar` · `/api/fuel-cell`
· `/api/energy` · `/api/analytics` · `/api/ai` · `/api/thermal` · `/api/alerts`
· `/api/trips` · `/api/trips/[id]` · `/api/telemetry` · `/api/telemetry/latest`
· `/api/telemetry/history` · `/api/device` · `/api/fleet` · `/api/reports`
· `/api/health`

ESP32 ingest: `POST /api/ingest/telemetry` with `Authorization: Bearer
<DEVICE_API_KEY>` and `X-Device-Id` — see
[`docs/ESP32_INTEGRATION.md`](docs/ESP32_INTEGRATION.md). `GET` on the same path
returns the machine-readable contract.

Success shape:

```jsonc
{
  "ok": true,
  "envelope": {
    "source": "live",          // or "demo"
    "deviceId": "EV-001",
    "deviceLabel": "EVISION Edge Node 01",
    "link": "online",
    "lastSeen": "2026-10-06T14:29:58.000Z",
    "generatedAt": "2026-10-06T14:30:00.000Z",
    "empty": null,             // human-readable reason when the dataset is empty
    "data": { }
  },
  "range": { "key": "24h", "from": 0, "to": 0, "label": "24 hours", "bucketMs": 60000 }
}
```

Export `?format=csv` from `/api/telemetry`, `/api/energy` or `/api/reports`.

---

## Configuration

Full list in [`.env.example`](.env.example). The essentials:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas connection string. **Server-side only.** |
| `MONGODB_DATABASE` | Logical database name |
| `EVISION_DEVICE_ID` | Canonical live device id (`EV-001`) |
| `EVISION_DEMO_MODE` | `auto` \| `on` \| `off` |
| `EVISION_ONLINE_WINDOW_S` / `EVISION_DELAYED_WINDOW_S` | Link-state liveness windows |
| `EVISION_API_RATE_LIMIT` / `EVISION_API_RATE_WINDOW_S` | Per-IP rate limiting |
| `DEVICE_API_KEY` | Shared secret the ESP32 presents as `Authorization: Bearer …` on every ingest POST |
| `INGEST_RATE_LIMIT` / `INGEST_RATE_WINDOW_S` | Per-device ingest frame rate limit |
| `INGEST_MAX_BODY_BYTES` / `INGEST_MAX_FRAMES` | Per-POST hard ceilings |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | Session signing secret for production |
| `EVISION_REQUIRE_AUTH` | `on` to enforce the bearer/session guard on every API route |

Never prefix any of these with `NEXT_PUBLIC_` — that ships credentials to the
browser. Modules that touch the database import `server-only`, so an accidental
client import fails the build rather than leaking a URI.

---

## Project layout

```
app/
  api/                 route handlers (nodejs runtime, no-store)
  dashboard/           control-centre pages
components/
  charts/              recharts wrappers + gauges
  dashboard/views/     one client view per dashboard page
  layout/              shell, sidebar, nav, footer
  live/                LiveSection polling primitive
  marketing/           public-site sections
  ui/                  panels, metric cards, page headers, empty states
  vehicle/             interactive vehicle visualisation
lib/
  api.ts               response helpers, auth guard, zod schemas
  api-range.ts         device/range/bucket param parsing
  constants.ts         hardware, thresholds, alert rules, AI metadata
  data.ts              unified live/demo data gateway
  demo.ts              deterministic demo fleet
  demo-table.ts        demo pagination/sorting
  env.ts               validated environment
  format.ts            number/date formatting, tone maps, CSV
  mongodb.ts           pooled Atlas connection
  queries.ts           all Atlas reads and aggregations
  stats.ts             bucketing, statistics, thermal map
  synthetic.ts         physical telemetry model
models/                seven Mongoose schemas + indexes
scripts/seed.ts        Atlas seeding tool
types/                 shared domain and API types
```

---

## Thresholds

Centralised in `lib/constants.ts` and consumed by alerts, charts, reports and the
settings page — one source of truth.

| Metric | Warning | Critical |
| --- | --- | --- |
| State of charge | 25 % | 12 % |
| Bus voltage | < 46 V / > 58.4 V | — |
| Traction current | 60 A | — |
| Traction power | 3 000 W | — |
| Probe temperature | 55 °C | 68 °C |
| Anomaly score | 0.35 | 0.60 |

Link state derives from the age of the newest frame: online ≤ 10 s, delayed
≤ 30 s, offline beyond that (both configurable).

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the Vercel walkthrough, Atlas
network access rules and the firmware ingest contract. Integration details for the
edge node are in [`docs/ESP32_INTEGRATION.md`](docs/ESP32_INTEGRATION.md).

## Licence

Proprietary — © Viyal Tech.