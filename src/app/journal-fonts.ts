import { Fraunces, Gaegu, Sora } from "next/font/google";

// Fonts for the light "journal" theme. They are imported ONLY by
// src/components/journal-theme.tsx, so pages that don't render the wrapper
// (the dark pages) don't request them. Poppins stays in src/app/layout.tsx.

// Display: italic, variable. No `weight` => variable, which is required for `axes`.
// SOFT/WONK values are applied in globals.css (.font-display).
export const fraunces = Fraunces({
  style: "italic",
  axes: ["SOFT", "WONK", "opsz"],
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

// Interface text (variable weight 100-800).
export const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

// Short handwritten notes only (400), plus 700 for the one highlighted word in the landing headline.
// preload: false => the file is fetched when the text is rendered, not via a <link rel="preload">.
export const gaegu = Gaegu({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gaegu",
  display: "swap",
  preload: false,
});
