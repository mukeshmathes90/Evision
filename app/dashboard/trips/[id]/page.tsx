import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getTrip } from '@/lib/data';
import { TripDetailView } from '@/components/dashboard/views/TripDetailView';

export const dynamic = 'force-dynamic';

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { device } = parseParams(sp);
  const envelope = await getTrip(device, id);
  return <TripDetailView envelope={{ ok: true, envelope }} tripId={id} />;
}