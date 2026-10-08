'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BatteryCharging,
  Bell,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileBarChart,
  Flame,
  Gauge,
  LineChart,
  LayoutDashboard,
  Menu,
  Network,
  Route,
  Radio,
  Settings2,
  Sun,
  Table2,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_GROUPS } from '@/lib/constants';
import { Logo } from '@/components/brand/Logo';

const ICONS: Record<string, typeof Activity> = {
  LayoutDashboard,
  Radio,
  Zap,
  BatteryCharging,
  Sun,
  Flame,
  BrainCircuit,
  Thermometer,
  LineChart,
  Route,
  Bell,
  Table2,
  FileBarChart,
  Cpu,
  Network,
  Settings2,
};

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
  alertCount,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  alertCount: number;
}) {
  const pathname = usePathname();

  useEffect(() => {
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn('flex items-center gap-3 border-b border-white/[0.06] px-4 py-4', collapsed && 'justify-center px-2')}>
        <Link href="/" className="flex items-center gap-3" aria-label="EVISION AI home">
          <Logo compact={collapsed} />
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          className="ml-auto rounded-lg p-1.5 text-ink-400 hover:bg-white/5 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="no-scrollbar flex-1 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed ? <p className="micro mb-2 px-2.5">{group.label}</p> : <div className="mx-auto mb-3 h-px w-6 bg-white/10" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const IconCmp = ICONS[item.icon] ?? Activity;
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && item.href !== '/architecture' && pathname.startsWith(`${item.href}/`)) ||
                  (item.href === '/dashboard' && pathname === '/dashboard');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors duration-200',
                        collapsed && 'justify-center px-0',
                        active ? 'text-ink-50' : 'text-ink-400 hover:bg-white/[0.05] hover:text-ink-200',
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="nav-active"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-lg border border-white/[0.09] bg-white/[0.055]"
                        >
                          <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-gradient-to-b from-volt-400 to-ion-400" />
                        </motion.span>
                      ) : null}
                      <IconCmp className={cn('relative h-4 w-4 shrink-0 transition-colors', active ? 'text-volt-300' : 'text-ink-500 group-hover:text-ink-300')} />
                      {!collapsed ? <span className="relative truncate">{item.label}</span> : null}
                      {!collapsed && item.label === 'Alerts' && alertCount > 0 ? (
                        <span className="relative ml-auto rounded-full bg-danger-500/20 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-danger-400">
                          {alertCount > 99 ? '99+' : alertCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Fleet shortcut */}
      {!collapsed ? (
        <div className="px-2.5 pb-3">
          <div className="panel-inset p-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-ion-300" />
              <span className="micro-strong">Edge Link</span>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
              ESP32-S3 → MongoDB Atlas direct-write telemetry. Status is derived from the newest{' '}
              <span className="font-mono text-ink-300">timestamp</span> in the database.
            </p>
            <Link href="/architecture" className="btn-ghost mt-2 w-full !py-1.5 !text-[11px]">
              <Network className="h-3.5 w-3.5" />
              View architecture
            </Link>
          </div>
        </div>
      ) : null}

      {/* Collapse */}
      <button
        type="button"
        onClick={onToggle}
        className="hidden items-center justify-center gap-2 border-t border-white/[0.06] px-4 py-3 text-[11px] font-medium text-ink-500 transition-colors hover:text-ink-200 lg:flex"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {!collapsed ? <span>Collapse</span> : null}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 258 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.06] bg-void-900/80 backdrop-blur-2xl lg:block"
      >
        {content}
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 z-50 bg-void-950/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[268px] border-r border-white/[0.08] bg-void-900 lg:hidden"
            >
              {content}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function MobileNavBar({ alertCount }: { alertCount: number }) {
  const pathname = usePathname();
  const items = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/energy', label: 'Energy', icon: Zap },
    { href: '/dashboard/ai', label: 'AI', icon: BrainCircuit },
    { href: '/dashboard/alerts', label: 'Alerts', icon: Bell, badge: alertCount },
    { href: '/dashboard/live', label: 'Live', icon: ArrowLeftRight },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[0.08] bg-void-900/95 backdrop-blur-xl lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[9.5px] font-medium uppercase tracking-[0.12em] transition-colors',
              active ? 'text-volt-300' : 'text-ink-500',
            )}
          >
            {active ? <span className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-volt-400" /> : null}
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.badge && item.badge > 0 ? (
              <span className="absolute right-4 top-1.5 h-1.5 w-1.5 rounded-full bg-danger-400" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export { Menu, AlertTriangle, BarChart3, Thermometer, Table2 };
