'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

const LINKS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Live Vehicle', href: '/dashboard/live' },
  { label: 'Energy', href: '/dashboard/energy' },
  { label: 'AI Intelligence', href: '/dashboard/ai' },
  { label: 'Architecture', href: '/architecture' },
  { label: 'Technology', href: '/technology' },
];

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-white/[0.07] bg-void-950/80 backdrop-blur-2xl' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5 lg:px-8">
        <Link href="/">
          <Logo />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-ink-400 transition-colors hover:bg-white/[0.05] hover:text-ink-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/about" className="btn-ghost hidden sm:inline-flex">
            About
          </Link>
          <Link href="/vehicle" className="btn-primary">
            View my car
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-ink-300 lg:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/[0.07] bg-void-950/95 backdrop-blur-2xl lg:hidden"
          >
            <nav className="flex flex-col p-3">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-[13px] font-medium text-ink-300 transition-colors hover:bg-white/[0.05] hover:text-ink-50"
                >
                  {l.label}
                </Link>
              ))}
              <Link href="/about" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-[13px] font-medium text-ink-300 hover:bg-white/[0.05]">
                About the project
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
