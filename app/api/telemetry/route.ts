import { guard, ok, fail, rangeSchema, telemetryQuerySchema } from '@/lib/api';
import { deviceFromParams, rangeFromParams } from '@/lib/api-range';
import { getTelemetryPage } from '@/lib/data';
import { csvResponse } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const sp = new URL(req.url).searchParams;
    const parsedRange = rangeSchema.safeParse(Object.fromEntries(sp.entries()));
    if (!parsedRange.success) return fail('Invalid range parameters');
    const parsedQuery = telemetryQuerySchema.safeParse(Object.fromEntries(sp.entries()));
    if (!parsedQuery.success) return fail('Invalid query parameters');
    const range = rangeFromParams(sp, parsedRange.data.range);
    const envelope = await getTelemetryPage(deviceFromParams(sp), range, {
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.pageSize,
      sortBy: parsedQuery.data.sort,
      sortDir: parsedQuery.data.dir,
      search: parsedQuery.data.q ?? '',
    });

    if (sp.get('format') === 'csv') {
      const rows: (string | number | null)[][] = [
        ['EVISION AI — telemetry export'],
        ['device', envelope.deviceId],
        ['source', envelope.source.toUpperCase()],
        ['window_from', new Date(range.from).toISOString()],
        ['window_to', new Date(range.to).toISOString()],
        [],
        ['timestamp', 'vehicle_kw', 'bus_v', 'soc_pct', 'range_km', 'solar_kw', 'stack_kw', 't1_c', 't2_c', 't3_c', 't4_c', 'anomaly'],
        ...envelope.data.rows.map((r) => [
          new Date(r.timestamp).toISOString(),
          r.vehicle.power,
          r.vehicle.voltage,
          r.ai.soc,
          r.ai.range,
          r.solar.power,
          r.fuelCell.power,
          r.temperature.t1,
          r.temperature.t2,
          r.temperature.t3,
          r.temperature.t4,
          r.ai.anomalyScore,
        ]),
      ];
      return csvResponse(`evision-telemetry-${envelope.deviceId}-${Date.now()}.csv`, rows);
    }

    return ok({ envelope, range });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}