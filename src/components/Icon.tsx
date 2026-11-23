import type { CSSProperties } from "react";

/** An icon from the prototype sprite (see Sprite.tsx). */
export function Icon({ name, size = 20, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} aria-hidden="true" style={style}>
      <use href={`#${name}`} />
    </svg>
  );
}

export function Logo({ size = 16, color = "currentColor", stroke }: { size?: number; color?: string; stroke?: string }) {
  return (
    <svg width={size} height={(size * 56) / 48} aria-hidden="true" style={{ color, ["--logo-s" as string]: stroke }}>
      <use href="#logo" />
    </svg>
  );
}
