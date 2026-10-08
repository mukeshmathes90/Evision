# ESP32-S3 integration

This document is the contract between the edge node (ESP32-S3) and the EVISION
platform. It defines the HTTPS telemetry endpoint, authentication, the JSON
payload shape and the power sign convention the entire platform depends on.

```
PZEM-017 ×3 ──Modbus-RTU/TTL──┐
DS18B20 ×4  ──1-Wire───────────┼──> ESP32-S3 ──Wi-Fi/TLS──> Vercel /api/ingest/telemetry ──> MongoDB Atlas ──> Next.js
MicroSD     ──SPI (buffer)────┘         │                         │
                              TensorFlow Lite Micro (SOC / range / anomaly)
```

**Design rule:** the firmware never talks to MongoDB. It POSTs HTTPS JSON to the
platform's ingest endpoint, which validates, maps and persists the frame. The
Atlas connection string therefore never exists on the node — the node only stores
its own device id and the ingest credential (`DEVICE_API_KEY`).

---

## 1. Hardware configuration

| Item | Setting |
| --- | --- |
| Board | ESP32-S3 N16R8 (16 MB flash / 8 MB PSRAM) |
| Framework | ESP-IDF v5.x (Arduino works; ESP-IDF recommended for TFLite Micro) |
| UART | `UART_NUM_1` @ 9600 8N1 to the PZEM-017 bus (RS485 direction pin if using a transceiver) |
| 1-Wire | `GPIO4` with a 4.7 kΩ pull-up to 3V3 |
| SD | SPI: `GPIO11` MOSI, `GPIO12` MISO, `GPIO13` SCK, `GPIO10` CS |
| Modbus address map | `0x01` solar · `0x02` fuel cell · `0x03` traction/load |
| Sample period | 1000 ms (dashboard buckets adapt to any interval) |
| Time sync | SNTP (`pool.ntp.org`) before the first POST; UTC only |

### Bus rules

- The three PZEM-017 units sit on one RS-485 bus at distinct addresses. Poll
  sequentially, never concurrently — simultaneous requests collide.
- **Power sign (canonical, whole platform):** channels report *forward*
  (magnitude) power, exactly as the PZEM-017 presents it:
  - `solar.power` and `fuelCell.power` are **positive** while delivering energy
    to the 48 V bus (generation).
  - `vehicle.power` is **positive** while the traction system draws from the bus.
  - Battery pack balance is `netPowerW = solar.power + fuelCell.power − vehicle.power`;
    **positive = charging**, negative = discharging. `battery.mode` follows with
    an 8 W deadband.

  Do **not** negate solar/fuel-cell power before posting. A rejected/corrupt
  channel posts `"valid": false` (see §3); never post negative magnitudes.
- `current` follows the same convention as `power` on each channel (`I = P / V`,
  so it too is positive when delivering / drawing). `voltage` is always positive.
- `energy` must be **monotonically increasing cumulative Wh/kWh** from the PZEM
  EEPROM, never a per-interval value. Reports difference the first and last sample
  of a window, so resetting it mid-day corrupts the daily ledger.
- Probe `t1`–`t4` are the DS18B20 sensors. Publish `min` / `max` / `avg`
  alongside the raw readings; the thermal page and alert engine read those.

---

## 2. Endpoint

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/ingest/telemetry` |
| Headers | `Authorization: Bearer <DEVICE_API_KEY>` · `X-Device-Id: EV-001` · `Content-Type: application/json` |
| Accepts | a single frame **or** `{ "frames": [ … ] }` (buffered batch) |
| Limits | body ≤ 256 KB · batch ≤ 200 frames · rate limit 600 frames/min per caller |
| Success | `201 { "ok": true, "accepted": n, "alerts": n, "resolved": n }` |

Every frame carries a `deviceId` (schema-enforced) and the POST carries the
`X-Device-Id` header. The authenticated header takes precedence over the body
field, so a misconfigured node cannot silently write into another device's
series even if its firmware hard-codes the body id.

A `GET /api/ingest/telemetry` returns the machine-readable contract
(path, auth header, limits). Use `curl` or the platform docs to confirm the
deployment is configured:

```
curl -s https://<domain>/api/ingest/telemetry | jq
# { ok: true, endpoint: "POST /api/ingest/telemetry", configured: true, maxFrames: 200, maxBodyBytes: 262144 }
```

### Credentials on the node

Store only the device credential in NVS flash, never an Atlas URI:

```c
#define NVS_NS      "evision"
#define NVS_API_KEY "ingest_key"
#define NVS_BASE    "api_base"

// once, over serial at provisioning time:
nvs_set_str(NVS_NS, NVS_API_KEY, DEVICE_API_KEY_FROM_PORTAL);
nvs_set_str(NVS_NS, NVS_BASE,    "https://<domain>");
nvs_commit(NVS_NS);

// on boot:
char key[65];
nvs_get_str(NVS_NS, NVS_API_KEY, key, sizeof(key));
```

The platform reads `DEVICE_API_KEY` from its own environment and rejects any
POST that does not present it (`401` when the secret is wrong, `503` when the
endpoint has no credential configured).

---

## 3. Telemetry frame (the POST body)

The body is a single frame or a batch. This is the exact shape the schema in
`lib/ingest-schema.ts` validates:

```json
{
  "deviceId": "EV-001",
  "timestamp": "2026-10-06T14:29:58.000Z",

  "solar":    { "voltage": 48.12, "current": 12.4,  "power": 596.7, "energy": 812440, "valid": true },
  "fuelCell": { "voltage": 47.80, "current": 6.10,  "power": 291.6, "energy": 264190, "valid": true },
  "vehicle":  { "voltage": 52.61, "current": 14.9,  "power": 783.9, "energy": 1930770, "valid": true },

  "temperature": { "t1": 34.2, "t2": 38.7, "t3": 41.1, "t4": 29.8, "min": 29.8, "max": 41.1, "avg": 35.95 },

  "ai": {
    "soc": 78.4,
    "range": 148.2,
    "anomalyScore": 0.08,
    "horizonS": 180,
    "inferenceMs": 6.9,
    "modelsActive": 7,
    "modelVersion": "evision-edge-1.4.2"
  },

  "battery": {
    "soc": 78.4,
    "mode": "charging",
    "netPowerW": 104.4,
    "condition": "good",
    "healthPct": 96.2,
    "cycles": 142,
    "cellVoltage": 3.29,
    "cellCount": 16
  },

  "meta": {
    "firmware": "evision-edge-1.4.2",
    "ip": "192.168.1.44",
    "rssi": -52,
    "freeHeap": 271000,
    "sdFreeMb": 14800
  },

  "sequence": 1048576,
  "deviceUptimeMs": 3628800000,
  "wifi": true
}
```

Buffered send:

```json
{ "frames": [ { … }, { … } ] }
```

### Field notes

| Field | Rule |
| --- | --- |
| `deviceId` | 2–40 chars. **Required in every frame** (the schema enforces it). The `X-Device-Id` header, when present, takes precedence over it — so always send both, with the header matching the node's identity. |
| `timestamp` | ISO-8601 **UTC** from the SNTP-synced clock. This drives every window query and the link state. A drifting clock shows as a permanently offline device. |
| `solar` · `fuelCell` · `vehicle` | All numbers optional. `valid: false` (bad Modbus CRC) makes the server store every field of that channel as `null`, rendered `N/A` — never a fabricated `0`. |
| `energy` | Cumulative Wh from the PZEM EEPROM; never reset mid-lifetime. |
| `ai.soc` / `ai.range` / `ai.anomalyScore` | Optional but strongly recommended — the AI page, battery cards and alert engine read them. |
| `battery` | Optional. When absent the server derives `netPowerW` (from channel powers), `mode` (8 W deadband) and `cellVoltage`. |
| `meta.*` | Optional; `freeHeap` in **bytes**. |
| `sequence` | Monotonic counter; gaps make telemetry loss visible in the Data page. |
| `status.sd` / `status.cloud` | Optional booleans mirrored into the `devices` document. |

A frame that is structurally broken (wrong types, unknown fields, out-of-range
values) is rejected with `400` and a short field list. The endpoint returns
`201` only when the frame was accepted; the platform is tolerant of partial
measurements by design.

---

## 4. Recommended send loop

1. Sample all sensors, run inference, append the frame to an in-RAM buffer.
2. Every 10 frames (10 s) — or on a 5 s timer — flush the buffer as one `POST`
   with `{ "frames": [ … ] }`.
3. On a non-201 response, log the reason once, keep the buffer and retry with an
   exponential back-off (5 s → 15 s → 60 s). On success, clear the buffer.
4. Mirror every flush to MicroSD as a rolling segment log. On boot, replay any
   unsent segments.

This keeps network pressure at ~6 POSTs/minute instead of 60, and a brief outage
loses nothing beyond one buffer.

### TLS

Use the bundled `esp-tls`/`mbedtls` CA store. Point at the platform domain and
**do not** pin a leaf certificate so TLS renewals never brick the node. Log the
negotiated cipher suite at boot — a failed handshake is almost always an outdated
CA bundle.

### Failure handling

| Condition | Action |
| --- | --- |
| DNS or handshake fails | Back off 5 s → 15 s → 60 s, keep sampling into the SD buffer |
| POST returns `401` | Stops sending immediately — the `DEVICE_API_KEY` is wrong. Surface a provisioning error, do not hammer the endpoint |
| POST returns `400` | Log the schema issues, fix the frame shape, drop that batch |
| POST returns `503` | Storage/ingest temporarily unavailable — back off and retry |
| Rate limited (`429`) | Honor `Retry-After`, hold the batch |
| Free heap < 40 KB | Skip inference for that cycle, keep telemetry streaming |
| SD write fails | Disable mirroring, raise a `system_events` error row |

---

## 5. What the platform derives server-side

The ingest route maps each posted frame into:

1. **`telemetry`** — the exact document shape above plus
   `timestamp`/`sequence`/`ingestMs`.
2. **`ai_predictions`** — SOC / range / anomaly rows derived from the edge
   models' own output (for the AI timeline).
3. **`alerts`** — rule evaluation happens server-side against the thresholds in
   `lib/constants.ts`. Alerts record state **changes**, not every frame: one
   open alert per device+category, automatically resolved when the condition
   clears (no alert spam).
4. **`devices`** — refreshed `lastSeen`, channel states and hardware snapshot per
   POST (upsert), so the overview and live pages read a single document.

`comm-failure` alerts are raised when any channel returns `valid: false`; they
resolve as soon as all channels return valid frames. Device **offline** state is
a read-time decision on the platform: `link` derives from the age of the newest
frame (`online` ≤ 10 s, `delayed` ≤ 30 s, `offline` beyond — both env-tunable),
so a node that stops posting shows `offline` on the next page load.

---

## 6. Verifying the pipeline

```bash
# 1. Health: storage configured + reachable
curl -s https://<domain>/api/health | jq

# 2. Contract (auth + limits)
curl -s https://<domain>/api/ingest/telemetry | jq

# 3. Simulated frame (replace the token)
curl -s -X POST https://<domain>/api/ingest/telemetry \
  -H "Authorization: Bearer $DEVICE_API_KEY" \
  -H "X-Device-Id: EV-001" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-10-06T14:29:58.000Z","solar":{"power":596.7,"valid":true},"fuelCell":{"power":291.6},"vehicle":{"power":783.9},"temperature":{"avg":35.95},"ai":{"soc":78.4,"range":148.2,"anomalyScore":0.08}}'

# 4. Live state on the platform
curl -s "https://<domain>/api/live?device=EV-001&range=5m" | jq '.envelope | {source, link, lastSeen}'
```

Expect `source: "live"`, `link: "online"`, and the Device page showing all
channels `connected` with a frame age under `EVISION_ONLINE_WINDOW_S`. A stuck
`offline` means no successful POSTs or a device-clock drift.

---

## 7. Reference constants

Server-side thresholds live in `lib/constants.ts` and are shown read-only on
`/dashboard/settings`. Mirror them in firmware so the node and the platform agree
on what counts as a breach.

| Constant | Value |
| --- | --- |
| `socLow` / `socCritical` | 25 % / 12 % |
| `batteryVoltageLow` / `Nominal` / `High` | 46 V / 52.8 V / 58.4 V |
| `vehicleCurrentHigh` / `vehiclePowerHigh` | 60 A / 3 000 W |
| `solarPowerNominal` / `fuelCellPowerNominal` | 2 000 W / 1 500 W |
| `thermal.warm` / `high` / `critical` | 40 °C / 55 °C / 68 °C |
| `anomaly.warning` / `critical` | 0.35 / 0.60 |
| `trip.gapSeconds` / `minDistanceKm` / `minSpeedKph` | 300 s / 0.2 km / 4 km/h |