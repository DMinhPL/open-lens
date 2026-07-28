"use client";

import { useEffect, useState } from "react";

export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;

    const compute = () => {
      const themeAttr = root.getAttribute("data-theme");
      setIsDark(themeAttr ? themeAttr === "dark" : media.matches);
    };

    compute();
    media.addEventListener("change", compute);
    const observer = new MutationObserver(compute);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      media.removeEventListener("change", compute);
      observer.disconnect();
    };
  }, []);

  return isDark;
}

export function useChartInk() {
  const isDark = useIsDarkMode();
  // Charts intentionally use higher-contrast ink than the surrounding UI chrome.
  const text = isDark ? "#c3c2b7" : "#52514e";
  const grid = isDark ? "#2c2c2a" : "#e1e0d9";
  const surface = isDark ? "#1a1a19" : "#fcfcfb";
  const title = isDark ? "#ffffff" : "#0b0b0b";

  return {
    isDark,
    text,
    grid,
    baseline: isDark ? "#383835" : "#c3c2b7",
    surface,
    title,
    tooltip: {
      backgroundColor: surface,
      titleColor: title,
      bodyColor: text,
      borderColor: grid,
      borderWidth: 1,
      padding: 8,
    },
  };
}
