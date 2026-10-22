import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_MAX_SKIPS,
  parseCustomSpectra,
  TEAM_NAMES,
  TEAM_PALETTE,
  validateSetup,
} from "./game.ts";
import type { SetupConfig, SetupErrors } from "./types.ts";
import type { DeckSource } from "./types.ts";
import Sheet from "./sheet.tsx";
import { GearIcon } from "./icons.tsx";
import { BUTTON_ARIA, BUTTON_TEXT } from "./ui-copy.ts";

export type SetupScreenProps = {
  onStart: (config: SetupConfig) => void | Promise<void>;
  /** Decks the app can offer: built-in and any configured backend. */
  sources: DeckSource[];
  /** True while the questions are being loaded. */
  busy?: boolean;
  /** Message from a failed load. */
  error?: string | null;
  easyMode: boolean;
  onEasyModeChange: (enabled: boolean) => void;
};

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-70">
        {label}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs opacity-60">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-bold text-danger">{error}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border-2 border-line bg-surface px-3 py-2 text-ink outline-none focus-ring";

export default function SetupScreen({
  onStart,
  sources,
  busy = false,
  error = null,
  easyMode,
  onEasyModeChange,
}: SetupScreenProps) {
  const [teams, setTeams] = useState([
    { name: TEAM_NAMES[0], color: TEAM_PALETTE[0] },
    { name: TEAM_NAMES[1], color: TEAM_PALETTE[1] },
  ]);
  const [roundsText, setRoundsText] = useState("5");
  const [psychicSeconds, setPsychicSeconds] = useState(90);
  const [guessSeconds, setGuessSeconds] = useState(90);
  const [decks, setDecks] = useState<string[]>(["clean"]);
  const [useCustom, setUseCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customFirst, setCustomFirst] = useState(true);
  const [targetScore, setTargetScore] = useState<string>("");
  const [maxSkips, setMaxSkips] = useState(DEFAULT_MAX_SKIPS);
  const [showErrors, setShowErrors] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const custom = useMemo(() => parseCustomSpectra(customText), [customText]);
  // An empty (or cleared) rounds field means one round.
  const rounds = Math.max(1, Number(roundsText) || 1);

  const config: SetupConfig = {
    teams,
    rounds,
    psychicSeconds,
    guessSeconds,
    decks,
    custom: useCustom ? custom.items : [],
    customFirst,
    targetScore: targetScore.trim() === "" ? null : Number(targetScore),
    maxSkipsPerTeam: maxSkips,
  };

  const errors: SetupErrors = validateSetup(config);
  const errorList = Object.values(errors).filter(Boolean) as string[];

  const deckLabels = [
    ...decks.map((id) => sources.find((source) => source.id === id)?.label ?? id),
    ...(useCustom && custom.items.length > 0 ? [`${custom.items.length} custom`] : []),
  ];

  const setTeam = (index: number, patch: Partial<(typeof teams)[number]>) => {
    setTeams((prev) => prev.map((team, i) => (i === index ? { ...team, ...patch } : team)));
  };

  const cycleColor = (index: number) => {
    const current = teams[index].color;
    const next = TEAM_PALETTE[(TEAM_PALETTE.indexOf(current) + 1) % TEAM_PALETTE.length];
    setTeam(index, { color: next });
  };

  const toggleDeck = (id: string) => {
    setDecks((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const start = () => {
    if (errorList.length > 0) {
      setShowErrors(true);
      return;
    }
    onStart(config);
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6 flex items-start gap-3 text-center">
        <div className="flex-1">
          <h1 className="title text-4xl sm:text-5xl">WAVELENGTH</h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] opacity-60">
            Offline pass-and-play
          </p>
        </div>
        <button
          type="button"
          className="btn grid h-11 w-11 shrink-0 place-items-center p-0"
            data-testid="setup-settings"
          aria-label={BUTTON_ARIA.settings}
          onClick={() => setSettingsOpen(true)}
        >
          <GearIcon className="h-7 w-7" />
        </button>
      </header>

      <section className="card mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-wide">Teams</h2>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="add-team"
            disabled={teams.length >= 8}
            onClick={() =>
              setTeams((prev) => [
                ...prev,
                {
                  name: TEAM_NAMES[prev.length] ?? `Team ${prev.length + 1}`,
                  color: TEAM_PALETTE[prev.length % TEAM_PALETTE.length],
                },
              ])
            }
          >
            {BUTTON_TEXT.addTeam}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {teams.map((team, index) => (
            <div key={index} className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Change colour for ${team.name}`}
                onClick={() => cycleColor(index)}
                className="h-9 w-9 shrink-0 rounded-md border-2 border-line"
                style={{ background: team.color }}
              />
              <input
                className={inputClass}
                data-testid={`team-name-${index}`}
                value={team.name}
                maxLength={24}
                onChange={(event) => setTeam(index, { name: event.target.value })}
                placeholder={`Team ${index + 1}`}
              />
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={teams.length <= 2}
                onClick={() => setTeams((prev) => prev.filter((_, i) => i !== index))}
                aria-label={`Remove ${team.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {errors.teams && showErrors && (
          <p className="mt-2 text-xs font-bold text-danger">{errors.teams}</p>
        )}
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 text-lg font-black uppercase tracking-wide">Decks</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {sources.map((source) => {
            const on = decks.includes(source.id);
            return (
              <button
                key={source.id}
                type="button"
                data-testid={`deck-${source.id}`}
                onClick={() => toggleDeck(source.id)}
                className={`btn ${on ? "btn-primary" : ""}`}
              >
                {on ? "✓ " : ""}
                {source.label}
                {source.size !== undefined ? ` (${source.size})` : ""}
              </button>
            );
          })}
          <button
            type="button"
            data-testid="deck-custom"
            onClick={() => setUseCustom((value) => !value)}
            className={`btn ${useCustom ? "btn-primary" : ""}`}
          >
            {useCustom ? "✓ " : ""}{BUTTON_TEXT.customSpectra}
          </button>
        </div>
        {errors.decks && showErrors && (
          <p className="mt-1 text-xs font-bold text-danger">{errors.decks}</p>
        )}

        {useCustom && (
          <div className="mt-3">
            <p className="text-xs opacity-70">
              One per line: <code className="mono-num">Total Cringe : Pure Masterpiece</code>
              <br />
              The left pole is always 0, the right pole always 100.
            </p>
            <textarea
              value={customText}
              data-testid="custom-spectra"
              onChange={(event) => setCustomText(event.target.value)}
              rows={4}
              spellCheck={false}
              className={`${inputClass} mono-num mt-2 resize-y`}
              placeholder={"Total Cringe : Pure Masterpiece\nRainy Day : Beach Day"}
            />
            {custom.errors.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-xs font-bold text-danger">
                {custom.errors.map((error) => (
                  <li key={error.line}>
                    Line {error.line}: {error.message}
                  </li>
                ))}
              </ul>
            )}
            {custom.items.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 text-xs">
                {custom.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="mono-num shrink-0 rounded bg-surface-2 px-1.5 py-0.5">
                      0 → 100
                    </span>
                    <span className="font-semibold">{item.left}</span>
                    <span className="opacity-50">:</span>
                    <span className="font-semibold">{item.right}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                data-testid="custom-first"
                onClick={() => setCustomFirst(true)}
                className={`btn ${customFirst ? "btn-primary" : ""}`}
              >
                {customFirst ? "✓ " : ""}{BUTTON_TEXT.customFirst}
              </button>
              <button
                type="button"
                data-testid="custom-shuffle"
                onClick={() => setCustomFirst(false)}
                className={`btn ${!customFirst ? "btn-primary" : ""}`}
              >
                {!customFirst ? "✓ " : ""}{BUTTON_TEXT.customShuffle}
              </button>
            </div>
          </div>
        )}
      </section>

      {settingsOpen && (
        <Sheet onClose={() => setSettingsOpen(false)}>
          <div className="card max-h-[90dvh] w-full overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-wide">Settings</h2>
              <button
                type="button"
                className="btn btn-sm"
                data-testid="close-setup-settings"
                aria-label={BUTTON_ARIA.closeSettings}
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <section className="mb-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest opacity-60">Rules</h3>
              <Field
                label="Target points (optional)"
                hint={`First team to reach it wins. Max ${rounds * 4} points (${rounds} round${rounds === 1 ? "" : "s"} x 4).`}
                error={showErrors ? errors.targetScore : undefined}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={inputClass}
                  data-testid="target-score"
                  value={targetScore}
                  placeholder="no limit"
                  onChange={(event) => setTargetScore(event.target.value)}
                />
              </Field>
              <div className="mt-3">
                <Field
                  label="Max skips per team"
                  hint="Each team may skip this many cards. 0 turns skips off."
                  error={showErrors ? errors.maxSkipsPerTeam : undefined}
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={10}
                    className={inputClass}
                    data-testid="max-skips"
                    value={maxSkips}
                    onChange={(event) => setMaxSkips(Number(event.target.value))}
                  />
                </Field>
              </div>
            </section>

            <section className="mb-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest opacity-60">Match setup</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Rounds per team"
                  hint="Empty means 1 round."
                  error={showErrors ? errors.rounds : undefined}
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    className={inputClass}
                    data-testid="rounds"
                    value={roundsText}
                    onChange={(event) => setRoundsText(event.target.value)}
                  />
                </Field>
                <Field label="Psychic time (seconds)" error={showErrors ? errors.psychicSeconds : undefined}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={15}
                    max={300}
                    className={inputClass}
                    data-testid="psychic-seconds"
                    value={psychicSeconds}
                    onChange={(event) => setPsychicSeconds(Number(event.target.value))}
                  />
                </Field>
                <Field label="Guesser time (seconds)" error={showErrors ? errors.guessSeconds : undefined}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={15}
                    max={300}
                    className={inputClass}
                    data-testid="guess-seconds"
                    value={guessSeconds}
                    onChange={(event) => setGuessSeconds(Number(event.target.value))}
                  />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest opacity-60">Difficulty</h3>
              <button
                type="button"
                className={`btn btn-sm w-full ${easyMode ? "btn-primary" : ""}`}
                data-testid="setup-toggle-easy"
                onClick={() => onEasyModeChange(!easyMode)}
              >
                {easyMode ? `✓ ${BUTTON_TEXT.easyMode}` : BUTTON_TEXT.hardMode}
              </button>
              <p className="mt-1 text-xs opacity-60">
                Easy mode shows the 0-10 scale and position readouts.
              </p>
            </section>
          </div>
        </Sheet>
      )}

      {showErrors && errorList.length > 0 && (
        <ul className="card mb-4 flex flex-col gap-1 p-4 text-sm font-bold text-danger">
          {errorList.map((message) => (
            <li key={message}>• {message}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="btn btn-primary btn-lg w-full"
        data-testid="start-match"
        onClick={start}
        disabled={busy}
      >
        {busy ? BUTTON_TEXT.loadingQuestions : BUTTON_TEXT.startMatch}
      </button>
      {error && <p className="mt-2 text-center text-sm font-bold text-danger">{error}</p>}
      <p className="mt-3 text-center text-xs opacity-60" data-testid="deck-summary">
        Deck: {deckLabels.join(" + ") || "none"}
      </p>
    </div>
  );
}
