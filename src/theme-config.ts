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

export const THEMES = {
  diwali: {
    id: "diwali",
    colors: {
      paper: "#EDE3D4",
      surface: "#F7F0E3",
      surface2: "#E2D5BE",
      ink: "#2B2118",
      inkSoft: "#7A6A55",
      line: "#2B2118",
      accent: "#A2542B",
      accentInk: "#FFF8EE",
      danger: "#8C2F21",
      zone5: "#3C5A48",
      zone3: "#C89B3C",
      zone1: "#A2542B",
      zone0: "#B5A88F",
      shadow: "#2B2118",
    },
    backdrop: {
      image: DIWALI_BACKGROUND,
      opacity: 0.4,
    },
    button: {
      radius: "4px",
      shadow: "4px 4px 0",
      shadowHover: "5px 5px 0",
      shadowActive: "1px 1px 0",
    },
  },
} satisfies Record<string, ThemeConfig>;

export const ACTIVE_THEME = THEMES.diwali;

export function applyTheme(theme: ThemeConfig = ACTIVE_THEME): void {
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
