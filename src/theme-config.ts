import { DIWALI_BACKGROUND } from "./diwali.ts";

export type ThemeConfig = {
  id: string;
  colors: {
    paper: string;
    surface: string;
    surface2: string;
    ink: string;
    inkSoft: string;
    line: string;
    accent: string;
    accentInk: string;
    danger: string;
    zone5: string;
    zone3: string;
    zone1: string;
    zone0: string;
    shadow: string;
  };
  backdrop: {
    image: string;
    opacity: number;
  };
  button: {
    radius: string;
    shadow: string;
    shadowHover: string;
    shadowActive: string;
  };
};

/**
 * The one look the app ships: warm diwali paper, marigold and terracotta zones.
 * `theme.css` reads these through the custom properties `applyTheme` sets.
 */
export const THEME = {
  id: "diwali",
  colors: {
    // warm cream paper, like diwali sweets-box card stock
    paper: "#FBEFD9",
    surface: "#FFF9EC",
    surface2: "#F6E0B8",
    // deep maroon-brown, like kajal / dark wood
    ink: "#3A1620",
    inkSoft: "#8A6258",
    // antique gold borders
    line: "#E0B96F",
    // diya terracotta-vermilion
    accent: "#D9531E",
    accentInk: "#FFF9EC",
    danger: "#A3182E",
    // score zones: marigold gold (best) -> saffron -> rani pink -> faded cream
    zone5: "#E8A317",
    zone3: "#E26A2C",
    zone1: "#C23B63",
    zone0: "#E8D8BC",
    shadow: "#8A4B2E",
  },
  backdrop: {
    image: DIWALI_BACKGROUND,
    opacity: 1,
  },
  button: {
    radius: "12px",
    shadow: "0 2px 8px rgba(138, 75, 46, 0.18)",
    shadowHover: "0 4px 14px rgba(217, 83, 30, 0.28)",
    shadowActive: "0 1px 3px rgba(138, 75, 46, 0.2)",
  },
} satisfies ThemeConfig;

export function applyTheme(theme: ThemeConfig = THEME): void {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.style.setProperty("--paper", theme.colors.paper);
  root.style.setProperty("--surface", theme.colors.surface);
  root.style.setProperty("--surface-2", theme.colors.surface2);
  root.style.setProperty("--ink", theme.colors.ink);
  root.style.setProperty("--ink-soft", theme.colors.inkSoft);
  root.style.setProperty("--line", theme.colors.line);
  root.style.setProperty("--accent", theme.colors.accent);
  root.style.setProperty("--accent-ink", theme.colors.accentInk);
  root.style.setProperty("--danger", theme.colors.danger);
  root.style.setProperty("--zone-5", theme.colors.zone5);
  root.style.setProperty("--zone-3", theme.colors.zone3);
  root.style.setProperty("--zone-1", theme.colors.zone1);
  root.style.setProperty("--zone-0", theme.colors.zone0);
  root.style.setProperty("--shadow", theme.colors.shadow);
  root.style.setProperty("--backdrop-image", theme.backdrop.image);
  root.style.setProperty("--backdrop-opacity", String(theme.backdrop.opacity));
  root.style.setProperty("--button-radius", theme.button.radius);
  root.style.setProperty("--button-shadow", theme.button.shadow);
  root.style.setProperty("--button-shadow-hover", theme.button.shadowHover);
  root.style.setProperty("--button-shadow-active", theme.button.shadowActive);
}