import { guard, ok, fail } from '@/lib/api';
import { deviceFromParams } from '@/lib/api-range';
import { getTrip } from '@/lib/data';
import { csvResponse, fmtDateTime, fmtTime, type CsvCell } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const tripId = decodeURIComponent(id).slice(0, 60);
    const sp = new URL(req.url).searchParams;
    const envelope = await getTrip(deviceFromParams(sp), tripId);
    const trip = envelope.data;
    if (!trip) return fail('Trip not found', 404);

    if (sp.get('format') === 'csv') {
      // Nulls export as empty cells — never as 0 — so a dropped sensor stays
      // distinguishable from a genuine zero reading.
      const rows: CsvCell[][] = [
        ['trip_id', 'sample_time_utc', 'vehicle_power_w', 'soc_pct', 'range_km', 'T1_C', 'T2_C', 'T3_C', 'T4_C', 'anomaly_score'],
        ...trip.points.map((p) => [
          trip.id,
          fmtDateTime(new Date(p.t).toISOString()),
          p.vehiclePower,
          p.soc,
          p.range,
          p.t1,
          p.t2,
          p.t3,
          p.t4,
          p.anomalyScore,
        ]),
        [],
        ['ai_event_time_utc', 'model', 'label', 'detail', 'status'],
        ...trip.aiEvents.map((e): CsvCell[] => [fmtTime(e.timestamp), e.model, e.label, e.detail, e.status]),
      ];
      return csvResponse(`evision-trip-${trip.id}.csv`, rows);
    }

    return ok({ envelope });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}
