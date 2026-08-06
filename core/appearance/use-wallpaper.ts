"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-managed background wallpaper for the liquid-glass theme. There's no server-side
 * storage for this app, so the image is kept as a data URL in `localStorage` (per-browser).
 *
 * Multiple components mount their own `useWallpaper()` instance (the app-wide `<WallpaperLayer />`
 * and the settings page preview) — a plain `useState` per instance wouldn't see updates made by
 * another instance, so writes go through this module-level listener set to keep every mounted
 * instance in sync within the same tab.
 */
export const WALLPAPER_KEY = "openlens_wallpaper";

type Listener = (value: string | null) => void;
const listeners = new Set<Listener>();

/** Reads the saved wallpaper data URL directly from `localStorage` (no React state). */
export function getWallpaper(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WALLPAPER_KEY);
}

function setWallpaper(value: string | null) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(WALLPAPER_KEY, value);
  else window.localStorage.removeItem(WALLPAPER_KEY);
  listeners.forEach((listener) => listener(value));
}

export function useWallpaper() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial read of browser-only storage
    setDataUrl(getWallpaper());
    listeners.add(setDataUrl);
    return () => {
      listeners.delete(setDataUrl);
    };
  }, []);

  const save = useCallback((next: string) => setWallpaper(next), []);
  const clear = useCallback(() => setWallpaper(null), []);

  return { dataUrl, hasCustom: Boolean(dataUrl), save, clear };
}
