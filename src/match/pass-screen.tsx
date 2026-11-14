import { BUTTON_TEXT } from "../ui-copy.ts";

/** Hand the device to the psychic before the target is shown. */
export function PassScreen({
  teamName,
  teamColor,
  onReady,
}: {
  teamName: string;
  teamColor: string;
  onReady: () => void;
}) {
  return (
    <div className="card p-6 text-center">
      <p className="text-xs font-bold uppercase tracking-widest opacity-60">Pass the device to</p>
      <h2 className="title text-4xl" style={{ color: teamColor }}>
        {teamName}
      </h2>
      <p className="mt-1 text-lg font-black uppercase">Psychic</p>
      <p className="mx-auto mt-3 max-w-xs text-sm opacity-70">
        Only the psychic may look at the target. Everyone else, look away.
      </p>
      <button type="button" className="btn btn-primary btn-lg mt-5 w-full max-w-xs" data-testid="psychic" onClick={onReady}>
        {BUTTON_TEXT.psychic}
      </button>
    </div>
  );
}
