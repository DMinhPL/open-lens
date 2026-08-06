"use client";

import { useWallpaper } from "@/core/appearance/use-wallpaper";

const DEFAULT_WALLPAPER = "/wallpaper.jpg";

/**
 * Ambient background behind the liquid-glass panels. Rendered as real DOM nodes (not a
 * pseudo-element) so the saved wallpaper can be applied directly via inline style — no
 * CSS custom-property indirection to go wrong.
 */
export function WallpaperLayer() {
  const { dataUrl } = useWallpaper();

  return (
    <div aria-hidden className="wallpaper-layer">
      <div className="wallpaper-layer__blobs" />
      <div
        className="wallpaper-layer__image"
        style={{ backgroundImage: `url("${dataUrl ?? DEFAULT_WALLPAPER}")` }}
      />
      <div className="wallpaper-layer__tint" />
    </div>
  );
}
