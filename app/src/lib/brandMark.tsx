// The Bonded Agents mark (two linked rings) for generated images: apple icon,
// default share image. Colours come from the OG palette (Furrow tokens).
import { OG } from "./ogPalette";

export function BrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill={OG.ink} />
      <rect x="10" y="22" width="26" height="20" rx="10" fill="none" stroke={OG.accent} strokeWidth="5" />
      <rect x="28" y="22" width="26" height="20" rx="10" fill="none" stroke={OG.sheet} strokeWidth="5" />
      <path d="M33 22.5 a10 10 0 0 1 3 7" fill="none" stroke={OG.accent} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
