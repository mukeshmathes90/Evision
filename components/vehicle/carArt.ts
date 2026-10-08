/**
 * Canonical flat product-illustration car artwork.
 *
 * Single source of truth for the side-profile car used by the marketing hero
 * and the interactive vehicle diagram, so every surface draws the exact same
 * car. Pure geometry + palette — no telemetry, no behaviour.
 *
 * Canonical space: viewBox 0 0 400 160, car facing right, wheels resting on
 * y = 130.
 */

export const CAR_ART = {
  /** Body outline (single flat shape). */
  body:
    'M 16 110 C 16 88 30 76 54 72 L 112 60 C 128 40 150 30 182 28 L 258 28 ' +
    'C 288 30 308 42 322 62 L 370 70 C 392 76 398 90 398 108 L 398 112 ' +
    'C 398 115 396 116 393 116 L 350 116 A 40 40 0 0 0 270 116 L 136 116 ' +
    'A 40 40 0 0 0 56 116 L 19 116 C 16.5 116 16 114 16 111 Z',

  /** Rear side glass (flat). */
  glassRear: 'M 128 57 L 178 31 L 204 31 L 204 57 Z',

  /** Front side glass (flat). */
  glassFront: 'M 212 31 L 255 31 L 306 57 L 212 57 Z',

  /** B-pillar between the two glass panels (drawn as body colour). */
  bPillar: 'M 204 31 L 212 31 L 212 57 L 204 57 Z',

  /** Shoulder crease line. */
  crease: 'M 60 84 C 180 74 300 72 386 84',

  /** Door cut line. */
  doorLine: 'M 208 58 L 208 116',

  /** Door handle. */
  handle: { x: 232, y: 66, w: 14, h: 4, rx: 2 },

  /** Wing mirror. */
  mirror: 'M 314 56 L 336 52 L 340 60 L 316 64 Z',

  /** Headlight (front, flat light band). */
  headlight: 'M 366 78 L 394 94 L 391 102 L 363 88 Z',

  /** Tail light (rear, flat light band). */
  taillight: { x: 20, y: 80, w: 26, h: 9, rx: 4 },

  /** Wheel geometry (rear / front), resting on y = 130. */
  wheels: {
    rear: { cx: 96, cy: 104, r: 26 },
    front: { cx: 310, cy: 104, r: 26 },
  },
} as const;

/** Flat palette shared by every car drawing on the site. */
export const CAR_PALETTE = {
  body: '#171F2E',
  bodyEdge: '#2C3A52',
  glass: '#15263C',
  glassEdge: '#2A3C58',
  pillar: '#101725',
  crease: '#26334A',
  detail: '#3A4A66',
  tyre: '#090D15',
  rim: '#28374E',
  hub: '#8FA3C4',
  well: '#05070C',
  headlight: '#DBEAFE',
  taillight: '#F87171',
} as const;
