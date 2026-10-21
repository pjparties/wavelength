import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  parseCustomSpectra,
  TEAM_PALETTE,
  validateSetup,
} from "./game.ts";
import type { SetupConfig, SetupErrors } from "./types.ts";
import type { DeckSource } from "./types.ts";

export type SetupScreenProps = {
  onStart: (config: SetupConfig) => void | Promise<void>;
  /** Decks the app can offer: built-in and any configured backend. */
  sources: DeckSource[];
  /** True while the questions are being loaded. */
  busy?: boolean;
  /** Message from a failed load. */
  error?: string | null;
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
}: SetupScreenProps) {
  const [teams, setTeams] = useState([
    { name: "Team 1", color: TEAM_PALETTE[0] },
    { name: "Team 2", color: TEAM_PALETTE[1] },
  ]);
  const [rounds, setRounds] = useState(5);
  const [psychicSeconds, setPsychicSeconds] = useState(60);
  const [guessSeconds, setGuessSeconds] = useState(45);
  const [decks, setDecks] = useState<string[]>(["sfw"]);
  const [useCustom, setUseCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customFirst, setCustomFirst] = useState(true);
  const [targetScore, setTargetScore] = useState<string>("");
  const [showErrors, setShowErrors] = useState(false);

  const custom = useMemo(() => parseCustomSpectra(customText), [customText]);

  const config: SetupConfig = {
    teams,
    rounds,
    psychicSeconds,
    guessSeconds,
    decks,
    custom: useCustom ? custom.items : [],
    customFirst,
    targetScore: targetScore.trim() === "" ? null : Number(targetScore),
  };

  const errors: SetupErrors = validateSetup(config);
  const errorList = Object.values(errors).filter(Boolean) as string[];

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
      <header className="mb-6 text-center">
        <h1 className="title text-5xl sm:text-6xl">WAVELENGTH</h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] opacity-60">
          Offline pass-and-play
        </p>
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
                { name: `Team ${prev.length + 1}`, color: TEAM_PALETTE[prev.length % TEAM_PALETTE.length] },
              ])
            }
          >
            + Add team
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
        <h2 className="mb-3 text-lg font-black uppercase tracking-wide">Match setup</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rounds per team" error={showErrors ? errors.rounds : undefined}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              className={inputClass}
              data-testid="rounds"
              value={rounds}
              onChange={(event) => setRounds(Number(event.target.value))}
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

        <div className="mt-4">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest opacity-70">
            Decks
          </span>
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
              {useCustom ? "✓ " : ""}Custom spectra
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
                  {customFirst ? "✓ " : ""}Play custom first
                </button>
                <button
                  type="button"
                  data-testid="custom-shuffle"
                  onClick={() => setCustomFirst(false)}
                  className={`btn ${!customFirst ? "btn-primary" : ""}`}
                >
                  {!customFirst ? "✓ " : ""}Shuffle into deck
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <Field
            label="Target points (optional)"
            hint={`First team to reach it wins. Max ${rounds * 5} points (${rounds} rounds x 5).`}
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
        </div>
      </section>

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
        {busy ? "Loading questions…" : "Start match"}
      </button>
      {error && <p className="mt-2 text-center text-sm font-bold text-danger">{error}</p>}
      <p className="mt-3 text-center text-xs opacity-60">
        Deck: {useCustom ? custom.items.length : 0} custom +{" "}
        {decks
          .map((id) => sources.find((source) => source.id === id)?.label ?? id)
          .join(" ")}
      </p>
    </div>
  );
}
