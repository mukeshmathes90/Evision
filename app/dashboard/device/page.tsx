import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getDevicePage } from '@/lib/data';
import { DeviceView } from '@/components/dashboard/views/DeviceView';

export const dynamic = 'force-dynamic';

export default async function DevicePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device } = parseParams(await searchParams);
  const envelope = await getDevicePage(device);
  return <DeviceView envelope={{ ok: true, envelope }} />;
}