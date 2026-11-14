import { useState } from "react";
import { formatClock, totalTurns } from "../game.ts";
import type { DeckSource } from "../types.ts";
import type { usePrefs } from "../use-prefs.ts";
import { LeaveMatchSheet, SettingsSheet } from "./match-sheets.tsx";
import { MatchHeader } from "./match-header.tsx";
import { PassScreen } from "./pass-screen.tsx";
import { phaseView } from "./phase-view.ts";
import { PlayPanel } from "./play-panel.tsx";
import { ScorePanel } from "./score-panel.tsx";
import { SpectrumBoard } from "./spectrum-board.tsx";
import type { MatchSession } from "./use-match-session.ts";

/** The match that is on screen: header, the phase, and the two sheets. */
export function MatchScreen({
  session,
  sources,
  prefs,
}: {
  session: MatchSession;
  sources: DeckSource[];
  prefs: ReturnType<typeof usePrefs>;
}) {
  const { match } = session;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [homePromptOpen, setHomePromptOpen] = useState(false);

  const view = phaseView(match.phase);
  const teamIndex = match.turnIndex % match.teams.length;
  const team = match.teams[teamIndex];
  const cardNo = (match.cardIndex % match.deck.length) + 1;
  const card = match.deck[cardNo - 1] ?? { left: "—", right: "—" };
  const turns = totalTurns(match.teams.length, match.rounds);
  const skipsLeft = match.maxSkipsPerTeam - (match.skipsUsed[teamIndex] ?? 0);
  const timedOut = session.remaining <= 0 && !session.paused;

  return (
    <>
      <MatchHeader
        teamName={team.name}
        teamColor={team.color}
        turnLabel={`${match.turnIndex + 1}/${turns}`}
        clock={formatClock(session.remaining)}
        urgent={timedOut}
        paused={session.paused}
        onHome={() => setHomePromptOpen(true)}
        onTogglePause={session.togglePause}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="match-shell relative z-10 mx-auto px-4 pb-4 pt-4">
        {view.passDevice ? (
          <PassScreen teamName={team.name} teamColor={team.color} onReady={session.pass} />
        ) : (
          <div className="match-grid">
            <SpectrumBoard
              card={card}
              phase={match.phase}
              easyMode={prefs.easyMode}
              needle={match.needleAngle}
              target={match.targetAngle}
              showNeedle={view.showNeedle}
              showTarget={view.showTarget}
              interactive={view.interactive}
              points={match.lastPoints}
              turnIndex={match.turnIndex}
              onNeedle={session.needle}
            />
            <PlayPanel
              match={match}
              team={team}
              skipsLeft={skipsLeft}
              timedOut={timedOut}
              turns={turns}
              turnIndex={match.turnIndex}
              lastConfig={session.lastConfig}
              onHideTarget={session.hideTarget}
              onSkip={session.skip}
              onReveal={session.reveal}
              onNext={session.next}
              onPlayAgain={() => session.playAgain(sources)}
              onNewSetup={session.abort}
            />
            {view.showScore && <ScorePanel teams={match.teams} activeIndex={teamIndex} />}
          </div>
        )}
      </main>

      {homePromptOpen && (
        <LeaveMatchSheet
          onStay={() => setHomePromptOpen(false)}
          onLeave={() => {
            setHomePromptOpen(false);
            session.abort();
          }}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          match={match}
          sources={sources}
          cardNo={cardNo}
          soundOn={prefs.soundOn}
          easyMode={prefs.easyMode}
          onClose={() => setSettingsOpen(false)}
          onToggleSound={() => prefs.setSoundOn((value) => !value)}
          onToggleEasy={() => prefs.setEasyMode((value) => !value)}
          onAbort={() => {
            setSettingsOpen(false);
            session.abort();
          }}
        />
      )}
    </>
  );
}
