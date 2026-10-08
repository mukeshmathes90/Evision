export type ClassValue = string | number | null | undefined | false | ClassValue[] | Record<string, boolean | undefined | null>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    for (const [k, on] of Object.entries(v)) if (on) out.push(k);
  };
  inputs.forEach(walk);
  return out.join(' ');
}

export const MOTION = {
  fadeUp: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
  },
  fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  scaleIn: {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1 },
  },
  stagger: (i: number, delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: delay + i * 0.045, ease: [0.22, 1, 0.36, 1] },
  }),
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};
