export type PaletteId =
  | "noir"
  | "paper"
  | "terminal"
  | "midnight"
  | "rust"
  | "mono"
  | "kodak"
  | "vapor"
  | "fjord"
  | "forest";

export type Palette = {
  id: PaletteId;
  label: string;
  // five-stop preview swatches (bg, panel, ink, long, short)
  swatches: [string, string, string, string, string];
};

export const PALETTES: Palette[] = [
  { id: "noir",     label: "noir",     swatches: ["#08090C", "#0E1014", "#E8E4D8", "#86D9A0", "#E87A99"] },
  { id: "paper",    label: "paper",    swatches: ["#F4F0E6", "#FFFCF4", "#16161C", "#3BAA66", "#C04668"] },
  { id: "terminal", label: "terminal", swatches: ["#020602", "#0A0F0A", "#7CFFB3", "#A8FF60", "#FFC857"] },
  { id: "midnight", label: "midnight", swatches: ["#0A0F1F", "#101729", "#E6ECF2", "#7AB8FF", "#FF7A8A"] },
  { id: "rust",     label: "rust",     swatches: ["#1B130F", "#23170F", "#F0D9B5", "#E8A04A", "#D4513C"] },
  { id: "mono",     label: "mono",     swatches: ["#101012", "#17181B", "#F2F2F2", "#D8D8D8", "#7A7A7A"] },
  { id: "kodak",    label: "kodak",    swatches: ["#1A130A", "#231A0E", "#EEDEC2", "#E4B046", "#C24A88"] },
  { id: "vapor",    label: "vapor",    swatches: ["#0E0820", "#16102F", "#F2D9FF", "#76E0FF", "#FF6FB5"] },
  { id: "fjord",    label: "fjord",    swatches: ["#0C141B", "#10191F", "#DDE9F0", "#6FB8C2", "#E8849A"] },
  { id: "forest",   label: "forest",   swatches: ["#0A130D", "#0F1A11", "#E8E0CE", "#7DCA8A", "#D86A6A"] },
];

export const DEFAULT_PALETTE: PaletteId = "noir";

export function paletteById(id: string | null | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Deterministic palette pick from a drand randomness hex */
export function pickPaletteIndex(randomnessHex: string): number {
  const clean = randomnessHex.startsWith("0x") ? randomnessHex.slice(2) : randomnessHex;
  const u32 = parseInt(clean.slice(0, 8), 16) >>> 0;
  return u32 % PALETTES.length;
}

/* ---------- chart style ---------- */

export type ChartStyleId = "candle" | "bar" | "line" | "area";

export type ChartStyle = { id: ChartStyleId; label: string };

export const CHART_STYLES: ChartStyle[] = [
  { id: "candle", label: "candles" },
  { id: "bar",    label: "bars" },
  { id: "line",   label: "line" },
  { id: "area",   label: "area" },
];

export const DEFAULT_CHART_STYLE: ChartStyleId = "candle";

export function chartStyleById(id: string | null | undefined): ChartStyle {
  return CHART_STYLES.find((s) => s.id === id) ?? CHART_STYLES[0];
}

/** Deterministic chart-style pick using a different slice of the same randomness */
export function pickChartStyleIndex(randomnessHex: string): number {
  const clean = randomnessHex.startsWith("0x") ? randomnessHex.slice(2) : randomnessHex;
  const u32 = parseInt(clean.slice(8, 16), 16) >>> 0;
  return u32 % CHART_STYLES.length;
}
