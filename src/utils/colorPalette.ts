export interface ColorOption {
  name: string;
  hex: string;
  family: string;
}

export interface ColorSpec {
  hex: string;
  fade: string;
  mid: string;
  deep: string;
  isLight?: boolean;
}

export const PRESET_COLORS: ColorOption[] = [
  // Reds & Pinks
  { name: 'Red', hex: '#ef4444', family: 'Reds & Pinks' },
  { name: 'Crimson', hex: '#dc2626', family: 'Reds & Pinks' },
  { name: 'Maroon', hex: '#991b1b', family: 'Reds & Pinks' },
  { name: 'Burgundy', hex: '#881337', family: 'Reds & Pinks' },
  { name: 'Pink', hex: '#f472b6', family: 'Reds & Pinks' },
  { name: 'Rose', hex: '#e11d48', family: 'Reds & Pinks' },
  { name: 'Blush', hex: '#fda4af', family: 'Reds & Pinks' },
  { name: 'Baby Pink', hex: '#f9a8d4', family: 'Reds & Pinks' },
  { name: 'Magenta', hex: '#c026d3', family: 'Reds & Pinks' },
  { name: 'Fuchsia', hex: '#d946ef', family: 'Reds & Pinks' },

  // Yellows & Oranges
  { name: 'Yellow', hex: '#facc15', family: 'Yellows & Oranges' },
  { name: 'Gold', hex: '#eab308', family: 'Yellows & Oranges' },
  { name: 'Mustard', hex: '#ca8a04', family: 'Yellows & Oranges' },
  { name: 'Orange', hex: '#f97316', family: 'Yellows & Oranges' },
  { name: 'Peach', hex: '#fdba74', family: 'Yellows & Oranges' },
  { name: 'Coral', hex: '#fb7185', family: 'Yellows & Oranges' },
  { name: 'Apricot', hex: '#fed7aa', family: 'Yellows & Oranges' },
  { name: 'Rust', hex: '#c2410c', family: 'Yellows & Oranges' },
  { name: 'Amber', hex: '#d97706', family: 'Yellows & Oranges' },

  // Blues
  { name: 'Blue', hex: '#3b82f6', family: 'Blues' },
  { name: 'Sky Blue', hex: '#38bdf8', family: 'Blues' },
  { name: 'Baby Blue', hex: '#7dd3fc', family: 'Blues' },
  { name: 'Navy', hex: '#1e3a8a', family: 'Blues' },
  { name: 'Royal Blue', hex: '#1d4ed8', family: 'Blues' },
  { name: 'Teal', hex: '#0d9488', family: 'Blues' },
  { name: 'Turquoise', hex: '#2dd4bf', family: 'Blues' },

  // Purples & Lavenders
  { name: 'Lavender', hex: '#a855f7', family: 'Purples & Lavenders' },
  { name: 'Purple', hex: '#9333ea', family: 'Purples & Lavenders' },
  { name: 'Violet', hex: '#8b5cf6', family: 'Purples & Lavenders' },
  { name: 'Lilac', hex: '#c084fc', family: 'Purples & Lavenders' },
  { name: 'Plum', hex: '#701a75', family: 'Purples & Lavenders' },

  // Greens
  { name: 'Green', hex: '#22c55e', family: 'Greens' },
  { name: 'Sage', hex: '#8C9B7F', family: 'Greens' },
  { name: 'Moss', hex: '#58643F', family: 'Greens' },
  { name: 'Olive', hex: '#65a30d', family: 'Greens' },
  { name: 'Mint', hex: '#34d399', family: 'Greens' },
  { name: 'Emerald', hex: '#10b981', family: 'Greens' },
  { name: 'Forest', hex: '#15803d', family: 'Greens' },

  // Whites & Neutrals
  { name: 'White', hex: '#ffffff', family: 'Whites & Neutrals' },
  { name: 'Ivory', hex: '#fffbeb', family: 'Whites & Neutrals' },
  { name: 'Cream', hex: '#fef3c7', family: 'Whites & Neutrals' },
  { name: 'Beige', hex: '#f5f5dc', family: 'Whites & Neutrals' },
  { name: 'Tan', hex: '#d2b48c', family: 'Whites & Neutrals' },
  { name: 'Camel', hex: '#c19a6b', family: 'Whites & Neutrals' },
  { name: 'Brown', hex: '#78350f', family: 'Whites & Neutrals' },
  { name: 'Bark', hex: '#382E2B', family: 'Whites & Neutrals' },
  { name: 'Black', hex: '#1c1917', family: 'Whites & Neutrals' },
  { name: 'Charcoal', hex: '#334155', family: 'Whites & Neutrals' },
  { name: 'Grey', hex: '#6b7280', family: 'Whites & Neutrals' },
  { name: 'Silver', hex: '#e2e8f0', family: 'Whites & Neutrals' },
];

export const COLOR_SPECS: Record<string, ColorSpec> = {
  // Pinks & Roses
  pink: { hex: '#f472b6', fade: '#fbcfe8', mid: '#f472b6', deep: '#be185d' },
  rose: { hex: '#e11d48', fade: '#fda4af', mid: '#e11d48', deep: '#881337' },
  blush: { hex: '#fda4af', fade: '#ffe4e6', mid: '#fecdd3', deep: '#fda4af', isLight: true },
  'blush pink': { hex: '#fda4af', fade: '#fce7f3', mid: '#fbcfe8', deep: '#f472b6', isLight: true },
  'baby pink': { hex: '#f9a8d4', fade: '#fdf2f8', mid: '#fce7f3', deep: '#f472b6', isLight: true },
  'hot pink': { hex: '#db2777', fade: '#f472b6', mid: '#db2777', deep: '#831843' },
  magenta: { hex: '#c026d3', fade: '#f0abfc', mid: '#c026d3', deep: '#701a75' },
  fuchsia: { hex: '#d946ef', fade: '#f5d0fe', mid: '#d946ef', deep: '#86198f' },

  // Reds
  red: { hex: '#ef4444', fade: '#fca5a5', mid: '#ef4444', deep: '#991b1b' },
  crimson: { hex: '#dc2626', fade: '#fda4af', mid: '#dc2626', deep: '#881337' },
  maroon: { hex: '#991b1b', fade: '#fb7185', mid: '#991b1b', deep: '#450a0a' },
  ruby: { hex: '#e11d48', fade: '#fda4af', mid: '#e11d48', deep: '#881337' },
  cherry: { hex: '#be123c', fade: '#fca5a5', mid: '#be123c', deep: '#701a75' },
  burgundy: { hex: '#881337', fade: '#be123c', mid: '#881337', deep: '#450a0a' },

  // Blues
  blue: { hex: '#3b82f6', fade: '#93c5fd', mid: '#3b82f6', deep: '#1e3a8a' },
  'sky blue': { hex: '#38bdf8', fade: '#e0f2fe', mid: '#38bdf8', deep: '#0369a1' },
  'baby blue': { hex: '#7dd3fc', fade: '#f0f9ff', mid: '#bae6fd', deep: '#38bdf8', isLight: true },
  'light blue': { hex: '#60a5fa', fade: '#e0f2fe', mid: '#60a5fa', deep: '#1d4ed8' },
  navy: { hex: '#1e3a8a', fade: '#60a5fa', mid: '#1e40af', deep: '#0a0f1d' },
  'royal blue': { hex: '#1d4ed8', fade: '#93c5fd', mid: '#1d4ed8', deep: '#172554' },
  cyan: { hex: '#06b6d4', fade: '#a5f3fc', mid: '#06b6d4', deep: '#0e7490' },
  teal: { hex: '#0d9488', fade: '#99f6e4', mid: '#0d9488', deep: '#134e4a' },
  turquoise: { hex: '#2dd4bf', fade: '#ccfbf1', mid: '#2dd4bf', deep: '#0f766e', isLight: true },
  ocean: { hex: '#0284c7', fade: '#7dd3fc', mid: '#0284c7', deep: '#082f49' },

  // Yellows & Golds
  yellow: { hex: '#facc15', fade: '#fef9c3', mid: '#fde047', deep: '#ca8a04', isLight: true },
  'light yellow': { hex: '#fef08a', fade: '#fefce8', mid: '#fef08a', deep: '#facc15', isLight: true },
  lemon: { hex: '#fde047', fade: '#fef9c3', mid: '#fde047', deep: '#ca8a04', isLight: true },
  mustard: { hex: '#ca8a04', fade: '#fef08a', mid: '#ca8a04', deep: '#713f12' },
  gold: { hex: '#eab308', fade: '#fef3c7', mid: '#f59e0b', deep: '#92400e', isLight: true },
  golden: { hex: '#eab308', fade: '#fef3c7', mid: '#f59e0b', deep: '#92400e', isLight: true },

  // Purples & Lavenders
  lavender: { hex: '#a855f7', fade: '#f3e8ff', mid: '#a855f7', deep: '#581c87' },
  purple: { hex: '#9333ea', fade: '#e9d5ff', mid: '#9333ea', deep: '#4c1d95' },
  violet: { hex: '#8b5cf6', fade: '#ddd6fe', mid: '#7c3aed', deep: '#3b0764' },
  lilac: { hex: '#c084fc', fade: '#f3e8ff', mid: '#c084fc', deep: '#6b21a8' },
  plum: { hex: '#701a75', fade: '#d946ef', mid: '#701a75', deep: '#2e0854' },
  mauve: { hex: '#a855f7', fade: '#f3e8ff', mid: '#a855f7', deep: '#581c87' },

  // Whites & Creams
  white: { hex: '#ffffff', fade: '#ffffff', mid: '#fffdfa', deep: '#fbf8f1', isLight: true },
  ivory: { hex: '#fffbeb', fade: '#ffffff', mid: '#fffbeb', deep: '#fde68a', isLight: true },
  cream: { hex: '#fef3c7', fade: '#fffbeb', mid: '#fef3c7', deep: '#fcd34d', isLight: true },
  'off white': { hex: '#fafaf9', fade: '#ffffff', mid: '#fafaf9', deep: '#f5f2ea', isLight: true },
  pearl: { hex: '#f5f5f4', fade: '#ffffff', mid: '#fbf8f1', deep: '#f2eee5', isLight: true },

  // Greens
  green: { hex: '#22c55e', fade: '#86efac', mid: '#22c55e', deep: '#14532d' },
  sage: { hex: '#8C9B7F', fade: '#d1fae5', mid: '#8C9B7F', deep: '#3f4e38' },
  moss: { hex: '#58643F', fade: '#a3b18a', mid: '#58643F', deep: '#283618' },
  olive: { hex: '#65a30d', fade: '#bef264', mid: '#65a30d', deep: '#365314' },
  mint: { hex: '#34d399', fade: '#d1fae5', mid: '#34d399', deep: '#065f46', isLight: true },
  emerald: { hex: '#10b981', fade: '#6ee7b7', mid: '#10b981', deep: '#064e3b' },
  forest: { hex: '#15803d', fade: '#4ade80', mid: '#15803d', deep: '#052e16' },

  // Oranges & Peaches
  orange: { hex: '#f97316', fade: '#fed7aa', mid: '#f97316', deep: '#9a3412' },
  peach: { hex: '#fdba74', fade: '#ffedd5', mid: '#fdba74', deep: '#ea580c', isLight: true },
  coral: { hex: '#fb7185', fade: '#fecdd3', mid: '#fb7185', deep: '#be123c' },
  apricot: { hex: '#fed7aa', fade: '#ffedd5', mid: '#fed7aa', deep: '#ea580c', isLight: true },
  rust: { hex: '#c2410c', fade: '#fb923c', mid: '#c2410c', deep: '#6c220a' },
  amber: { hex: '#d97706', fade: '#fde68a', mid: '#d97706', deep: '#78350f' },

  // Browns & Neutrals
  brown: { hex: '#78350f', fade: '#d2b48c', mid: '#78350f', deep: '#381a04' },
  bark: { hex: '#382E2B', fade: '#6b5751', mid: '#382E2B', deep: '#181210' },
  coffee: { hex: '#451a03', fade: '#a16207', mid: '#451a03', deep: '#1a0801' },
  chocolate: { hex: '#3b1c11', fade: '#78350f', mid: '#3b1c11', deep: '#170703' },
  tan: { hex: '#d2b48c', fade: '#fef3c7', mid: '#d2b48c', deep: '#8c633a', isLight: true },
  camel: { hex: '#c19a6b', fade: '#f5ecd7', mid: '#c19a6b', deep: '#6b4c23' },
  beige: { hex: '#f5f5dc', fade: '#fffbeb', mid: '#f5f5dc', deep: '#c5b88c', isLight: true },
  canvas: { hex: '#CBB89A', fade: '#f2ece1', mid: '#CBB89A', deep: '#8c7859', isLight: true },

  // Blacks & Grays
  black: { hex: '#1c1917', fade: '#52525b', mid: '#27272a', deep: '#09090b' },
  charcoal: { hex: '#334155', fade: '#64748b', mid: '#334155', deep: '#0f172a' },
  grey: { hex: '#6b7280', fade: '#cbd5e1', mid: '#64748b', deep: '#1e293b' },
  gray: { hex: '#6b7280', fade: '#cbd5e1', mid: '#64748b', deep: '#1e293b' },
  silver: { hex: '#e2e8f0', fade: '#ffffff', mid: '#e2e8f0', deep: '#94a3b8', isLight: true },
};

export const MULTI_GRADIENT = 'linear-gradient(135deg, #f43f5e 0%, #a855f7 35%, #3b82f6 70%, #10b981 100%)';

/**
 * Returns ColorSpec for any raw string hue.
 */
export function getColorSpec(rawName: string): ColorSpec {
  if (!rawName) return COLOR_SPECS.bark;
  const clean = rawName.toLowerCase().trim();
  if (COLOR_SPECS[clean]) return COLOR_SPECS[clean];

  // Partial match
  for (const key of Object.keys(COLOR_SPECS)) {
    if (clean.includes(key)) return COLOR_SPECS[key];
  }

  // Fallback
  return {
    hex: clean.startsWith('#') ? clean : '#8C9B7F',
    fade: '#d1fae5',
    mid: clean.startsWith('#') ? clean : '#8C9B7F',
    deep: '#382E2B',
  };
}

/**
 * Parses color string into individual parts (e.g. "Yellow + Blue" => ["Yellow", "Blue"]).
 */
export function parseColorParts(rawColor: string): string[] {
  if (!rawColor) return [];
  const clean = rawColor.trim();

  // Multi / rainbow check
  const lower = clean.toLowerCase();
  if (
    lower.includes('mix') ||
    lower.includes('multi') ||
    lower.includes('rainbow') ||
    lower.includes('assort') ||
    lower.includes('custom')
  ) {
    return [clean];
  }

  // Split by +, /, &, or 'and'
  const parts = clean
    .split(/\s*(?:\+|\/|&|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [clean];
}

export interface HueStyleResult {
  background: string;
  color: string;
  border?: string;
  textShadow?: string;
  descriptor?: string;
  isMultiColor: boolean;
  parts: string[];
}

/**
 * Resolves full button background gradient, typography contrast, and descriptor for ProductDetail.
 */
export function resolveHueStyle(rawColor: string): HueStyleResult {
  if (!rawColor) {
    return {
      background: 'linear-gradient(135deg, #6b5751 0%, #382E2B 55%, #181210 100%)',
      color: '#ffffff',
      isMultiColor: false,
      parts: [],
    };
  }

  const parts = parseColorParts(rawColor);
  const clean = rawColor.toLowerCase().trim();

  // Multi / Mix Bouquet
  if (
    clean.includes('mix') ||
    clean.includes('multi') ||
    clean.includes('rainbow') ||
    clean.includes('assort') ||
    clean.includes('custom')
  ) {
    return {
      background: MULTI_GRADIENT,
      color: '#ffffff',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
      descriptor: 'Artisan Studio Blend',
      isMultiColor: true,
      parts: [rawColor],
    };
  }

  // Two-Color (Dual-tone) Combination: e.g. "Yellow + Blue", "Pink + White"
  if (parts.length === 2) {
    const spec1 = getColorSpec(parts[0]);
    const spec2 = getColorSpec(parts[1]);

    // Seamless, organic 2-color floral blend (zero harsh cuts or stripes)
    const background = `linear-gradient(135deg, ${spec1.fade} 0%, ${spec1.deep} 40%, ${spec2.mid} 65%, ${spec2.deep} 100%)`;
    const bothLight = spec1.isLight && spec2.isLight;
    const color = bothLight ? '#382E2B' : '#ffffff';

    return {
      background,
      color,
      border: bothLight ? '1px solid rgba(56, 46, 43, 0.2)' : '1px solid rgba(255, 255, 255, 0.25)',
      textShadow: bothLight ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.75), 0 0 6px rgba(0, 0, 0, 0.5)',
      descriptor: `Primary: ${parts[0]} · Accent: ${parts[1]}`,
      isMultiColor: true,
      parts,
    };
  }

  // Three-Color (Tri-tone) Combination: e.g. "Yellow + White + Burgundy", "Pink + White + Sage"
  if (parts.length >= 3) {
    const spec1 = getColorSpec(parts[0]);
    const spec2 = getColorSpec(parts[1]);
    const spec3 = getColorSpec(parts[2]);

    // Fluid 3-tone floral harmony: Color 1 -> Color 2 -> Color 3 without any harsh stripes
    const background = `linear-gradient(135deg, ${spec1.mid} 0%, ${spec1.deep} 28%, ${spec2.mid} 50%, ${spec3.mid} 72%, ${spec3.deep} 100%)`;
    const allLight = spec1.isLight && spec2.isLight && spec3.isLight;
    const color = allLight ? '#382E2B' : '#ffffff';

    return {
      background,
      color,
      border: allLight ? '1px solid rgba(56, 46, 43, 0.2)' : '1px solid rgba(255, 255, 255, 0.25)',
      textShadow: allLight ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.8), 0 0 6px rgba(0, 0, 0, 0.55)',
      descriptor: `Primary: ${parts[0]} · Secondary: ${parts[1]} · Accent: ${parts[2]}`,
      isMultiColor: true,
      parts,
    };
  }

  // Single Color
  const spec = getColorSpec(parts[0] || rawColor);
  const background = `linear-gradient(135deg, ${spec.fade} 0%, ${spec.mid} 50%, ${spec.deep} 100%)`;

  return {
    background,
    color: spec.isLight ? '#382E2B' : '#ffffff',
    border: spec.isLight ? '1px solid rgba(56, 46, 43, 0.18)' : undefined,
    textShadow: spec.isLight ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.25)',
    isMultiColor: false,
    parts,
  };
}

export interface QuickViewDotMeta {
  dot: string;
  isGradient: boolean;
  isDual: boolean;
  parts: string[];
}

/**
 * Resolves QuickView circular indicator dot style.
 */
export function getQuickViewDotMeta(rawColor: string): QuickViewDotMeta {
  if (!rawColor) {
    return { dot: '#d4cecb', isGradient: false, isDual: false, parts: [] };
  }

  const clean = rawColor.toLowerCase().trim();

  // Multi / Mix
  if (
    clean.includes('mix') ||
    clean.includes('multi') ||
    clean.includes('rainbow') ||
    clean.includes('assort') ||
    clean.includes('custom')
  ) {
    return { dot: MULTI_GRADIENT, isGradient: true, isDual: false, parts: [rawColor] };
  }

  const parts = parseColorParts(rawColor);

  // Dual Color: 50/50 sharp split circle dot
  if (parts.length === 2) {
    const spec1 = getColorSpec(parts[0]);
    const spec2 = getColorSpec(parts[1]);
    return {
      dot: `linear-gradient(135deg, ${spec1.hex} 50%, ${spec2.hex} 50%)`,
      isGradient: true,
      isDual: true,
      parts,
    };
  }

  // Tri Color: 3-way split conic circle dot
  if (parts.length >= 3) {
    const spec1 = getColorSpec(parts[0]);
    const spec2 = getColorSpec(parts[1]);
    const spec3 = getColorSpec(parts[2]);
    return {
      dot: `conic-gradient(${spec1.hex} 0deg 120deg, ${spec2.hex} 120deg 240deg, ${spec3.hex} 240deg 360deg)`,
      isGradient: true,
      isDual: true,
      parts,
    };
  }

  // Single Color
  const spec = getColorSpec(parts[0] || rawColor);
  return {
    dot: spec.hex,
    isGradient: false,
    isDual: false,
    parts,
  };
}
