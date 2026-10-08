import { guard, ok, fail } from '@/lib/api';
import { getFleet } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const devices = await getFleet();
    return ok({ devices });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}
