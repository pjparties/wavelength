import { useEffect, useState, type RefObject } from "react";

/**
 * Covers the screen with `board`. Uses the browser fullscreen API when the
 * device allows it, and a CSS class when it does not (iPhone will not
 * fullscreen a plain element). Escape or a second toggle leaves the cover.
 */
export function useFullscreen(board: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    const el = board.current;
    if (!el) return;
    if (active || document.fullscreenElement === el) {
      setActive(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      return;
    }
    setActive(true);
    const request = el.requestFullscreen?.bind(el);
    if (request) void request().catch(() => {});
  };

  return { active, toggle };
}
