import { useRef } from "react";
import Dial from "../dial.tsx";
import { FullscreenIcon } from "../icons.tsx";
import { BUTTON_ARIA } from "../ui-copy.ts";
import { toScale } from "../game.ts";
import type { Phase, Spectrum } from "../types.ts";
import { pointChips } from "./point-chips.ts";
import { useFullscreen } from "./use-fullscreen.ts";

const POINTS_COLOR: Record<number, string> = {
  4: "var(--zone-5)",
  3: "var(--zone-3)",
  2: "var(--zone-1)",
  0: "var(--zone-0)",
};

/** The dial, its two poles, and the control that covers the screen with them. */
export function SpectrumBoard({
  card,
  phase,
  easyMode,
  needle,
  target,
  showNeedle,
  showTarget,
  interactive,
  points,
  turnIndex,
  onNeedle,
}: {
  card: Spectrum;
  phase: Phase;
  easyMode: boolean;
  needle: number;
  target: number;
  showNeedle: boolean;
  showTarget: boolean;
  interactive: boolean;
  points: number | null;
  turnIndex: number;
  onNeedle: (angle: number) => void;
}) {
  const board = useRef<HTMLElement>(null);
  const screen = useFullscreen(board);
  const chips =
    points !== null && phase === "reveal" && !screen.active ? pointChips(points, turnIndex) : [];

  return (
    <section
      ref={board}
      className={`card relative mb-3 p-3 ${screen.active ? "spectrum-full" : ""}`}
      data-testid="board"
    >
      <button
        type="button"
        className="btn absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center p-0"
        data-testid="spectrum-fullscreen"
        aria-label={screen.active ? BUTTON_ARIA.spectrumExit : BUTTON_ARIA.spectrumFull}
        onClick={screen.toggle}
      >
        <FullscreenIcon className="h-5 w-5" exit={screen.active} />
      </button>
      <Dial
        needle={showNeedle ? needle : null}
        target={showTarget ? target : null}
        plainFace={phase === "psychic"}
        showScale={easyMode}
        interactive={interactive}
        onChange={onNeedle}
      />
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="points-chip text-2xl"
          style={{
            left: chip.left,
            top: chip.top,
            color: POINTS_COLOR[points ?? 0],
            animationDelay: `${chip.delay}s`,
          }}
        >
          +{points}
        </span>
      ))}
      <div className="mt-3 pt-3" data-testid="spectrum-card">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 break-words text-center text-base font-black uppercase leading-tight sm:text-xl">
            {card.left}
          </p>
          <svg viewBox="0 0 120 12" className="h-3 w-24 shrink-0 sm:w-40" aria-hidden="true">
            <line x1="6" y1="6" x2="114" y2="6" stroke="currentColor" strokeWidth="2" />
            <path d="M6 1 L16 6 L6 11 Z" fill="currentColor" />
            <path d="M114 1 L104 6 L114 11 Z" fill="currentColor" />
          </svg>
          <p className="min-w-0 flex-1 break-words text-center text-base font-black uppercase leading-tight sm:text-xl">
            {card.right}
          </p>
        </div>
        {phase === "psychic" && easyMode && (
          <p className="mono-num mt-3 text-center text-sm font-bold opacity-80">
            Target sits at {toScale(target).toFixed(1)} / 10
          </p>
        )}
        {phase === "guess" && easyMode && (
          <p className="mono-num mt-3 text-center text-sm font-bold opacity-80">
            Needle at {toScale(needle).toFixed(1)} / 10
          </p>
        )}
      </div>
    </section>
  );
}
