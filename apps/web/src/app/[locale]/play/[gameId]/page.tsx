"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { GameTimer } from "@/components/game/GameTimer";
import { LeaderboardList } from "@/components/game/LeaderboardList";
import {
  PlayerAnswerPanel,
  QuestionPrompt,
} from "@/components/game/PlayerAnswerPanel";
import { useGameSocket, type WsMessage } from "@/hooks/useGameSocket";
import type { GameSnapshot, PublicQuestion, RankedParticipant } from "@/lib/types";

type RevealState = {
  is_correct?: boolean;
  points?: number;
  score?: number;
  rank?: number;
} | null;

type PlayerLiveState = {
  question: PublicQuestion | null;
  deadline: number | null;
  status: string;
  locked: boolean;
  reveal: RevealState;
  leaderboard: RankedParticipant[];
  meId: string | null;
};

function liveFromSnapshot(snapshot: GameSnapshot): PlayerLiveState {
  return {
    status: snapshot.status,
    deadline: snapshot.deadline,
    question: snapshot.question ?? null,
    locked: Boolean(snapshot.my_submission?.locked),
    reveal: snapshot.my_rank
      ? { rank: snapshot.my_rank, score: snapshot.me?.score }
      : null,
    leaderboard: snapshot.leaderboard ?? [],
    meId: snapshot.me?.id ?? null,
  };
}

function applyPlayerEvent(state: PlayerLiveState, msg: WsMessage): PlayerLiveState {
  const p = msg.payload;
  switch (msg.type) {
    case "countdown":
      return {
        ...state,
        status: "countdown",
        locked: false,
        reveal: null,
      };
    case "question":
      return {
        ...state,
        status: "question_active",
        question: p.question as PublicQuestion,
        deadline: Number(p.deadline),
        locked: false,
        reveal: null,
      };
    case "answer_locked":
      if (p.participant_id === state.meId) {
        return { ...state, locked: true };
      }
      return state;
    case "answer_ack":
      return { ...state, locked: true };
    case "question_reveal": {
      const me = (p.players as Array<Record<string, unknown>>)?.find(
        (x) => x.participant_id === state.meId,
      );
      return {
        ...state,
        status: "question_reveal",
        question: p.question as PublicQuestion,
        reveal: me
          ? {
              is_correct: Boolean(me.is_correct),
              points: Number(me.points_awarded ?? 0),
              score: Number(me.score ?? 0),
              rank: Number(me.rank ?? 0),
            }
          : state.reveal,
      };
    }
    case "leaderboard":
      return {
        ...state,
        status: "leaderboard",
        leaderboard: (p.leaderboard as RankedParticipant[]) ?? [],
      };
    case "finished":
      return {
        ...state,
        status: "finished",
        leaderboard: (p.leaderboard as RankedParticipant[]) ?? [],
      };
    default:
      return state;
  }
}

export default function PlayPage() {
  const t = useTranslations("play");
  const tc = useTranslations("common");
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const [live, setLive] = useState<PlayerLiveState | null>(null);

  const onEvent = useCallback((msg: WsMessage) => {
    if (msg.type === "snapshot") {
      setLive(liveFromSnapshot(msg.payload as unknown as GameSnapshot));
      return;
    }
    setLive((prev) => (prev ? applyPlayerEvent(prev, msg) : prev));
  }, []);

  const { connected, snapshot, error, sendAnswer } = useGameSocket({
    gameId,
    role: "player",
    onEvent,
  });

  if (error) {
    return <p className="text-rose-600">{error}</p>;
  }

  if (!connected || !snapshot || !live) {
    return <p className="text-slate-500">{tc("loading")}</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-12">
      <div className="text-center">
        <p className="text-sm text-slate-500">{snapshot.quiz_title}</p>
        <p className="font-semibold text-coral-600">{snapshot.me?.nickname}</p>
      </div>

      {live.status === "lobby" && (
        <Card className="py-12 text-center">
          <p className="text-lg text-slate-600">{t("lobby")}</p>
        </Card>
      )}

      {live.status === "countdown" && (
        <Card className="flex flex-col items-center gap-4 py-12">
          <p className="text-xl font-semibold">{t("getReady")}</p>
          <GameTimer deadline={live.deadline} className="text-5xl" />
        </Card>
      )}

      {live.question &&
        (live.status === "question_active" || live.status === "question_reveal") && (
          <div className="space-y-6">
            <div className="flex justify-center">
              {live.status === "question_active" && !live.locked && (
                <GameTimer deadline={live.deadline} />
              )}
            </div>
            <QuestionPrompt question={live.question} />
            {live.status === "question_active" && (
              <PlayerAnswerPanel
                question={live.question}
                locked={live.locked}
                onSubmit={sendAnswer}
              />
            )}
            {live.locked && live.status === "question_active" && (
              <p className="text-center font-medium text-slate-500">{t("locked")}</p>
            )}
            {live.status === "question_reveal" && live.reveal && (
              <Card className="text-center">
                <p
                  className={
                    live.reveal.is_correct ? "text-emerald-600" : "text-rose-500"
                  }
                >
                  {live.reveal.is_correct ? t("correct") : t("incorrect")}
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {t("points", { points: live.reveal.points ?? 0 })}
                </p>
                <p className="mt-1 text-slate-600">
                  {t("yourScore", { score: live.reveal.score ?? 0 })}
                </p>
                <p className="text-slate-600">
                  {t("yourRank", { rank: live.reveal.rank ?? "-" })}
                </p>
              </Card>
            )}
            {live.status === "question_reveal" && !live.reveal && (
              <p className="text-center text-slate-500">{t("waitingReveal")}</p>
            )}
          </div>
        )}

      {(live.status === "leaderboard" || live.status === "finished") && (
        <div className="space-y-4">
          <h2 className="text-center text-2xl font-bold">
            {live.status === "finished" ? t("finished") : t("yourRank", { rank: live.reveal?.rank ?? "-" })}
          </h2>
          <LeaderboardList
            entries={live.leaderboard}
            highlightId={snapshot.me?.id}
          />
        </div>
      )}
    </div>
  );
}
