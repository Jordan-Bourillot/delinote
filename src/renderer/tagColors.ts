/**
 * Deterministic color palette for tags.
 * Each tag string maps to one of 12 harmonious color pairs (background + text).
 * Same tag → same color forever (consistent across all notes & sessions).
 *
 * Returns a {bg, text, dot} triple usable in inline styles.
 */

export type TagColor = { bg: string; text: string; dot: string };

const PALETTE: TagColor[] = [
  { bg: '#fde68a', text: '#7c2d12', dot: '#f59e0b' }, // amber
  { bg: '#bbf7d0', text: '#14532d', dot: '#22c55e' }, // green
  { bg: '#bfdbfe', text: '#1e3a8a', dot: '#3b82f6' }, // blue
  { bg: '#ddd6fe', text: '#4c1d95', dot: '#8b5cf6' }, // purple
  { bg: '#fbcfe8', text: '#831843', dot: '#ec4899' }, // pink
  { bg: '#fed7aa', text: '#7c2d12', dot: '#f97316' }, // orange
  { bg: '#a5f3fc', text: '#0e4f5e', dot: '#06b6d4' }, // cyan
  { bg: '#fecaca', text: '#7f1d1d', dot: '#ef4444' }, // red
  { bg: '#d9f99d', text: '#365314', dot: '#84cc16' }, // lime
  { bg: '#e9d5ff', text: '#581c87', dot: '#a855f7' }, // violet
  { bg: '#fef3c7', text: '#78350f', dot: '#eab308' }, // yellow
  { bg: '#ccfbf1', text: '#134e4a', dot: '#14b8a6' }, // teal
];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function tagColor(tag: string): TagColor {
  if (!tag) return PALETTE[0];
  return PALETTE[hash(tag.toLowerCase()) % PALETTE.length];
}

/** Inline-style helper for a colored tag pill. */
export function tagPillStyle(tag: string): React.CSSProperties {
  const c = tagColor(tag);
  return { background: c.bg, color: c.text };
}
