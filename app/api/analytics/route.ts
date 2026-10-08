import { guard, ok, fail, rangeSchema } from '@/lib/api';
import { deviceFromParams, rangeFromParams, numParam } from '@/lib/api-range';
import { getAnalytics } from '@/lib/data';

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
    const envelope = await getAnalytics(deviceFromParams(sp), range, bucketMs);
    return ok({ envelope, range, bucketMs });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}