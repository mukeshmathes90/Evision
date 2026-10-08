import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getAlerts } from '@/lib/data';
import { AlertsView } from '@/components/dashboard/views/AlertsView';

export const dynamic = 'force-dynamic';

export default async function AlertsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getAlerts(device, range, {});
  return <AlertsView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}