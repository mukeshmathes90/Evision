import { guard, ok, fail, rangeSchema } from '@/lib/api';
import { deviceFromParams, rangeFromParams, numParam } from '@/lib/api-range';
import { getEnergy } from '@/lib/data';
import { csvResponse } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const sp = new URL(req.url).searchParams;
    const parsed = rangeSchema.safeParse(Object.fromEntries(sp.entries()));
    if (!parsed.success) return fail('Invalid range parameters');
    const range = rangeFromParams(sp, parsed.data.range);
    const bucketMs = Math.max(60_000, numParam(sp, 'bucketMs', range.bucketMs));
    const deviceId = deviceFromParams(sp);
    const envelope = await getEnergy(deviceId, range, bucketMs);

    if (sp.get('format') === 'csv') {
      const rows: (string | number | null)[][] = [
        ['EVISION AI — energy export'],
        ['device', envelope.deviceId],
        ['source', envelope.source.toUpperCase()],
        ['window_from', new Date(range.from).toISOString()],
        ['window_to', new Date(range.to).toISOString()],
        [],
        ['timestamp', 'solar_kwh', 'fuelcell_kwh', 'vehicle_kwh', 'battery_kwh', 'net_kwh', 'avg_power_w', 'soc_avg_pct', 'temp_avg_c'],
        ...envelope.data.buckets.map((b) => [
          new Date(b.t).toISOString(),
          b.solarKwh,
          b.fuelCellKwh,
          b.vehicleKwh,
          b.batteryKwh,
          b.netKwh,
          b.avgPowerW,
          b.socAvg,
          b.tempAvg,
        ]),
      ];
      return csvResponse(`evision-energy-${envelope.deviceId}-${Date.now()}.csv`, rows);
    }

    return ok({ envelope, range, bucketMs });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}
