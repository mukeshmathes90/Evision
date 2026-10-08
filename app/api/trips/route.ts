import { guard, ok, fail } from '@/lib/api';
import { deviceFromParams, rangeFromParams } from '@/lib/api-range';
import { getTrips } from '@/lib/data';
import { csvResponse, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const sp = new URL(req.url).searchParams;
    const range = rangeFromParams(sp, sp.get('range') ?? '30d');
    const envelope = await getTrips(deviceFromParams(sp), range);

    if (sp.get('format') === 'csv') {
      const rows: (string | number)[][] = [
        ['trip_id', 'start', 'end', 'distance_km', 'start_soc', 'end_soc', 'energy_kwh', 'avg_power_w', 'peak_power_w', 'avg_temp_c', 'solar_kwh', 'fuelcell_kwh', 'efficiency_kwh_per_km'],
        ...envelope.data.trips.map((t) => [
          t.id,
          fmtDateTime(t.startTime),
          t.endTime ? fmtDateTime(t.endTime) : 'ongoing',
          t.distanceKm,
          t.startSoc,
          t.endSoc,
          t.energyKwh,
          t.avgPowerW,
          t.peakPowerW,
          t.avgTempC,
          t.solarKwh,
          t.fuelCellKwh,
          t.efficiencyKwhPerKm,
        ]),
      ];
      return csvResponse(`evision-trips-${envelope.deviceId}-${range.key}.csv`, rows);
    }

    return ok({ envelope, range });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}
