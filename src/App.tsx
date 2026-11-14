import type { ReactNode } from "react";
import SetupScreen from "./setup.tsx";
import { MatchScreen } from "./match/match-screen.tsx";
import type { MatchSession } from "./match/use-match-session.ts";
import { useMatchSession } from "./match/use-match-session.ts";
import { useDeckSources } from "./use-deck-sources.ts";
import { usePrefs } from "./use-prefs.ts";

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="paper-texture min-h-dvh bg-paper text-ink">
      <div className="diwali-bg" aria-hidden="true" data-testid="diwali-bg" />
      {children}
    </div>
  );
}

export default function App() {
  const sources = useDeckSources();
  const prefs = usePrefs();
  const session = useMatchSession();

  if (!session.match) {
    return (
      <Stage>
        <SetupScreen
          onStart={(config) => session.start(config, sources.all)}
          sources={sources.all}
          busy={session.starting}
          error={session.startError}
          easyMode={prefs.easyMode}
          onEasyModeChange={prefs.setEasyMode}
        />
      </Stage>
    );
  }

  const active: MatchSession = { ...session, match: session.match };
  return (
    <Stage>
      <MatchScreen session={active} sources={sources.all} prefs={prefs} />
    </Stage>
  );
}
