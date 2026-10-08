# Deployment

Target: **Vercel** (frontend + server routes) with **MongoDB Atlas** as the single
source of truth. The ESP32-S3 **never talks to MongoDB directly** — it POSTs HTTPS
telemetry to Vercel's `/api/ingest/telemetry`, which validates, maps and persists
the frame. The Atlas connection string exists only in the Vercel server
environment.

```
ESP32-S3 ──HTTPS/Bearer──> Vercel /api/ingest/telemetry ──> MongoDB Atlas ──> dashboard/API reads
```

---

## 1. Atlas cluster

1. Create a free **M0** cluster (or a paid `M10`+ for production).
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → allow Vercel's serverless egress. Atlas serverless pools
   do not have a fixed egress IP, so allow `0.0.0.0/0` (Vercel network isolation
   + TLS protects the traffic) and scope the database user to this database only.
4. Copy the connection string and replace the `<password>` placeholder.
5. Optional, not required: Atlas Search on `alerts.message`, Time Series for
   `telemetry`. The platform works on plain documents.

### Indexes

Run `npm run seed` once (or any request after a cold start) — `ensureIndexes()`
creates every declared index idempotently:

| Collection | Indexes |
| --- | --- |
| `telemetry` | `{ deviceId, timestamp }`, `{ timestamp }`, `{ deviceId, ai.anomalyScore }` |
| `devices` | `{ deviceId }` unique, `{ status, lastSeen }` |
| `ai_predictions` | `{ deviceId, model, timestamp }` |
| `alerts` | `{ deviceId, status, timestamp }`, `{ deviceId, category, timestamp }` |
| `trips` | `{ tripId }` unique, `{ deviceId, startTime }` |
| `energy_sessions` | `{ deviceId, startTime }`, `{ deviceId, bucket, startTime }` |
| `system_events` | `{ deviceId, timestamp }`, `{ deviceId, type, timestamp }` |

---

## 2. Environment variables

Copy `.env.example` and set the values in **Vercel → Project → Settings →
Environment Variables**. Mark them *Sensitive* so they cannot be read back from
the dashboard.

| Variable | Value | Notes |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb+srv://…` | Required. Never `NEXT_PUBLIC_`. |
| `MONGODB_DATABASE` | `evision` | Must match the URI path. |
| `MONGODB_COLLECTION_*` | `devices` etc. | Only if you renamed collections. |
| `DEVICE_API_KEY` | `openssl rand -hex 32` | Shared secret the ESP32 presents as `Authorization: Bearer …`. |
| `EVISION_DEVICE_ID` | `EV-001` | The firmware's `X-Device-Id`. |
| `EVISION_DEMO_MODE` | `auto` | `auto` shows synthetic data only if Atlas is unreachable. Set `off` in production once real frames are arriving. |
| `EVISION_ONLINE_WINDOW_S` / `EVISION_DELAYED_WINDOW_S` | `10` / `30` | Link-state liveness windows in seconds. |
| `INGEST_RATE_LIMIT` / `INGEST_RATE_WINDOW_S` | `600` / `60` | Per-device ingest frame rate limit. |
| `INGEST_MAX_BODY_BYTES` / `INGEST_MAX_FRAMES` | `262144` / `200` | Hard ceilings per POST. |
| `INGEST_AUTO_REGISTER` | `on` | `off` rejects unknown device ids. |
| `EVISION_API_RATE_LIMIT` / `EVISION_API_RATE_WINDOW_S` | `240` / `60` | Per-IP read rate limit. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Session signing secret. |
| `EVISION_REQUIRE_AUTH` | `on` | Enforces the guard on every API route. |

`EVISION_INGEST_TOKEN` still works as a legacy alias for `DEVICE_API_KEY`; set one
of the two, not both.

---

## 3. Deploy

```bash
npm run typecheck && npm run lint && npm run build   # must pass before deploy
npx vercel                                            # preview
npx vercel --prod                                     # production
```

`vercel.json` / `next.config.mjs` set security headers:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN`
- `Permissions-Policy` denying camera, microphone and geolocation

All API routes are `runtime = 'nodejs'` and `cache = 'no-store'`; the only
runtime entry points are server route handlers and the server components.

---

## 4. Smoke test

```bash
# 1. storage health
curl -s https://<domain>/api/health | jq

# 2. ingest contract (auth + limits, no secrets)
curl -s https://<domain>/api/ingest/telemetry | jq

# 3. simulated ESP32 frame (matches docs/ESP32_INTEGRATION.md §3)
curl -s -X POST https://<domain>/api/ingest/telemetry \
  -H "Authorization: Bearer $DEVICE_API_KEY" \
  -H "X-Device-Id: EV-001" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-10-06T14:29:58.000Z","solar":{"power":596.7,"valid":true},"fuelCell":{"power":291.6},"vehicle":{"power":783.9},"temperature":{"avg":35.95},"ai":{"soc":78.4,"range":148.2,"anomalyScore":0.08}}'
# expect 201 { ok:true, accepted:1 }

# 4. live overview
curl -s "https://<domain>/api/dashboard?device=EV-001&range=24h" | jq '.envelope | {source, link, lastSeen}'

# 5. energy ledger + CSV export
curl -s "https://<domain>/api/energy?device=EV-001&range=7d" | jq '.envelope.data.totals'
curl -s "https://<domain>/api/energy?device=EV-001&range=7d&format=csv" | head -5

# 6. a generated report
curl -s "https://<domain>/api/reports?kind=weekly&device=EV-001&range=7d" | jq '.report.findings'
```

Expected: `source` is `live` once the node (or the simulated frame) has written,
`link` is `online` within the freshness window. If Atlas is unreachable you get
`source: "demo"` and the amber banner instead of an error page.

---

## 5. Going live checklist

- [ ] `DEVICE_API_KEY` set, and the same value loaded into the node's NVS (never commit it)
- [ ] `EVISION_DEMO_MODE=off` once real frames are arriving
- [ ] `INGEST_AUTO_REGISTER=off` once the live node is registered
- [ ] `NEXTAUTH_SECRET` set and `EVISION_REQUIRE_AUTH=on` so the dashboard is reachable only to operators
- [ ] Atlas user scoped to read/write on this database only
- [ ] `MONGODB_URI` and `DEVICE_API_KEY` marked Sensitive in Vercel
- [ ] Node alert route configured (email/SMS/webhook on `critical`)
- [ ] Atlas backup policy enabled (continuous or daily snapshots)
- [ ] `/api/health` wired into an uptime monitor

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| All pages show the demo banner | `MONGODB_URI` unset/invalid, or Atlas network block | Check Vercel logs, allow Vercel egress in Atlas Network Access |
| Ingest POST returns `503` | `DEVICE_API_KEY` not configured, or storage unavailable | Set `DEVICE_API_KEY` in Vercel; check `/api/health` |
| Ingest POST returns `401` | Wrong `DEVICE_API_KEY` or no bearer header | Compare the node's NVS copy against the Vercel value |
| Ingest POST returns `400` | Frame violates the schema | Read the returned field list; see `docs/ESP32_INTEGRATION.md §3` |
| Ingest POST returns `429` | Frame rate above `INGEST_RATE_LIMIT` | Batch 10 frames per POST and honor `Retry-After` |
| `link` stuck `offline` | No frames in the freshness window, or node clock off | Confirm the node's `timestamp` and SNTP sync |
| `Range too large` | `{ deviceId, timestamp }` index missing | Run `npm run seed` or hit `/api/health` to trigger `ensureIndexes()` |
| Build fails on `server-only` | A module importing `lib/mongodb` leaked into a client component | Keep data access in `app/api/**` and server components |
| Empty charts but a populated table | `range` param outside the data window | Check `range` / `from` / `to`; the URL carries the active window |