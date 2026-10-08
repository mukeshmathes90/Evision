import { parseParams, type RawSearchParams } from '@/lib/page-params';
import { getAi } from '@/lib/data';
import { AiView } from '@/components/dashboard/views/AiView';

export const dynamic = 'force-dynamic';

export default async function AiPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { device, range } = parseParams(await searchParams);
  const envelope = await getAi(device, range);
  return <AiView initial={{ ok: true, envelope, range }} deviceId={device} range={range} />;
}