'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar, MobileNavBar } from './Sidebar';
import { Topbar } from './Topbar';
import type { DeviceOption } from './DeviceSelector';
import type { AlertRecord, DataSource, LinkState } from '@/types';

export function DashboardShell({
  devices,
  currentDevice,
  link,
  lastSeen,
  source,
  alerts,
  children,
}: {
  devices: DeviceOption[];
  currentDevice: string;
  link: LinkState;
  lastSeen: string | null;
  source: DataSource;
  alerts: AlertRecord[];
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-void-950" />}>
      <Shell devices={devices} currentDevice={currentDevice} link={link} lastSeen={lastSeen} source={source} alerts={alerts}>
        {children}
      </Shell>
    </Suspense>
  );
}

function Shell({
  devices,
  currentDevice,
  link,
  lastSeen,
  source,
  alerts,
  children,
}: {
  devices: DeviceOption[];
  currentDevice: string;
  link: LinkState;
  lastSeen: string | null;
  source: DataSource;
  alerts: AlertRecord[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const params = useSearchParams();
  const activeCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <div className="min-h-screen bg-void-950">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        alertCount={activeCount}
      />

      <div
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-[258px]'
        }`}
      >
        <Topbar
          devices={devices}
          currentDevice={currentDevice}
          link={link}
          lastSeen={lastSeen}
          source={source}
          alerts={alerts}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1680px] px-4 pb-28 pt-5 lg:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNavBar alertCount={activeCount} />
      <span className="sr-only" data-device={params.get('device') ?? currentDevice} />
    </div>
  );
}
