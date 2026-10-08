import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        void: {
          950: '#04060A',
          900: '#070A11',
           850: '#0A0F1A',
          800: '#0E1420',
          700: '#151C2B',
          600: '#1D2637',
        },
        ink: {
          50: '#F5F8FF',
          100: '#E7EDF8',
          200: '#C4D0E4',
          300: '#93A4C0',
          400: '#6B7C99',
          500: '#4C5A73',
          600: '#37425A',
          700: '#252E42',
        },
        volt: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        ion: {
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
        },
        sun: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        hydro: {
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        danger: {
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
        },
        warn: {
          400: '#FBBF24',
          500: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -32px rgba(0,0,0,0.9)',
        lift: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 30px 70px -30px rgba(37,99,235,0.28)',
        inset: 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'grid-fine':
          'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
        'radial-fade': 'radial-gradient(120% 100% at 50% 0%, rgba(37,99,235,0.10) 0%, rgba(4,6,10,0) 60%)',
      },
      backgroundSize: {
        grid: '44px 44px',
      },
      keyframes: {
        dash: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-1000' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.65' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        flowY: {
          '0%': { transform: 'translateY(-50%)', opacity: '0' },
          '15%': { opacity: '1' },
          '85%': { opacity: '1' },
          '100%': { transform: 'translateY(50%)', opacity: '0' },
        },
      },
      animation: {
        dash: 'dash 3s linear infinite',
        'pulse-ring': 'pulseRing 2.4s cubic-bezier(0.2,0.6,0.2,1) infinite',
        scan: 'scan 7s linear infinite',
        shimmer: 'shimmer 3.2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
