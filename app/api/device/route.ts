import { guard, ok, fail } from '@/lib/api';
import { deviceFromParams } from '@/lib/api-range';
import { getDevicePage } from '@/lib/data';
import { firebaseHealth } from '@/lib/firebase';
import { DELAYED_WINDOW_S, FIREBASE_PROJECT_ID, ONLINE_WINDOW_S } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const sp = new URL(req.url).searchParams;
    const envelope = await getDevicePage(deviceFromParams(sp));
    const health = await firebaseHealth();
    return ok({
      envelope,
      database: {
        ...health,
        name: FIREBASE_PROJECT_ID,
        collections: {},
        onlineWindowS: ONLINE_WINDOW_S,
        delayedWindowS: DELAYED_WINDOW_S,
      },
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error', 500);
  }
}
