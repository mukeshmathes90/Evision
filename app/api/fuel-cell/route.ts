import { guard, ok, fail, rangeSchema } from '@/lib/api';
import { deviceFromParams, rangeFromParams } from '@/lib/api-range';
import { getChannelPage } from '@/lib/data';

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
    const envelope = await getChannelPage(deviceFromParams(sp), 'fuelCell', range);
    return ok({ envelope, range });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}
