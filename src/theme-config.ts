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
      paper: "#F4EFE5",
      surface: "#FFFCF5",
      surface2: "#EAE1D2",
      ink: "#29251F",
      inkSoft: "#81776A",
      line: "#B8AA98",
      accent: "#B45D38",
      accentInk: "#FFFCF5",
      danger: "#9A4430",
      zone5: "#526C54",
      zone3: "#D2A747",
      zone1: "#B45D38",
      zone0: "#C2B59D",
      shadow: "#81776A",
    },
    backdrop: {
      image: DIWALI_BACKGROUND,
      opacity: 0.18,
    },
    button: {
      radius: "10px",
      shadow: "0 2px 8px rgba(41, 37, 31, 0.10)",
      shadowHover: "0 4px 12px rgba(41, 37, 31, 0.14)",
      shadowActive: "0 1px 3px rgba(41, 37, 31, 0.12)",
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
