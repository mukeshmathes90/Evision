import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { PRODUCT } from '@/lib/constants';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://evision-ai.vercel.app'),
  title: {
    default: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    template: `%s · ${PRODUCT.name}`,
  },
  description:
    'Real-time energy intelligence for electric mobility: solar generation, fuel-cell power, battery monitoring, thermal sensing and embedded AI inference on the ESP32-S3, streamed straight into Firebase Realtime Database and rendered by a professional analytics platform.',
  keywords: [
    'EV energy monitoring',
    'embedded AI',
    'ESP32-S3',
    'PZEM-017',
    'fuel cell telemetry',
    'solar vehicle',
    'state of charge prediction',
    'Firebase Realtime Database IoT',
    'anomaly detection',
  ],
  authors: [{ name: PRODUCT.company }],
  openGraph: {
    type: 'website',
    title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    description: PRODUCT.description,
    siteName: PRODUCT.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PRODUCT.name} — ${PRODUCT.tagline}`,
    description: PRODUCT.description,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#04060A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-void-950 text-ink-100 antialiased">{children}</body>
    </html>
  );
}
