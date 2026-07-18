"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { GameTimer } from "@/components/game/GameTimer";
import { LeaderboardList } from "@/components/game/LeaderboardList";
import {
  PlayerAnswerPanel,
  QuestionPrompt,
} from "@/components/game/PlayerAnswerPanel";
import { useGameSocket } from "@/hooks/useGameSocket";
import type { GameSnapshot, PublicQuestion, RankedParticipant } from "@/lib/types";

function usePlayerState(
  snapshot: GameSnapshot | null,
  lastEvent: { type: string; payload: Record<string, unknown> } | null,
) {
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [status, setStatus] = useState("lobby");
  const [locked, setLocked] = useState(false);
  const [reveal, setReveal] = useState<{
    is_correct?: boolean;
    points?: number;
    score?: number;
    rank?: number;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<RankedParticipant[]>([]);

  useEffect(() => {
    if (!snapshot) return;
    setStatus(snapshot.status);
    setDeadline(snapshot.deadline);
    if (snapshot.question) setQuestion(snapshot.question);
    if (snapshot.my_submission?.locked) setLocked(true);
    if (snapshot.my_rank) {
      setReveal((r) => ({ ...r, rank: snapshot.my_rank, score: snapshot.me?.score }));
    }
  }, [snapshot]);

  useEffect(() => {
    if (!lastEvent) return;
    const p = lastEvent.payload;
    switch (lastEvent.type) {
      case "countdown":
        setStatus("countdown");
        setLocked(false);
        setReveal(null);
        break;
      case "question":
        setStatus("question_active");
        setQuestion(p.question as PublicQuestion);
        setDeadline(Number(p.deadline));
        setLocked(false);
        setReveal(null);
        break;
      case "answer_locked":
        if (p.participant_id === snapshot?.me?.id) setLocked(true);
        break;
      case "answer_ack":
        setLocked(true);
        break;
      case "question_reveal": {
        setStatus("question_reveal");
        setQuestion(p.question as PublicQuestion);
        const me = (p.players as Array<Record<string, unknown>>)?.find(
          (x) => x.participant_id === snapshot?.me?.id,
        );
        if (me) {
          setReveal({
            is_correct: Boolean(me.is_correct),
            points: Number(me.points_awarded ?? 0),
            score: Number(me.score ?? 0),
            rank: Number(me.rank ?? 0),
          });
        }
        break;
      }
      case "leaderboard":
        setStatus("leaderboard");
        setLeaderboard((p.leaderboard as RankedParticipant[]) ?? []);
        break;
      case "finished":
        setStatus("finished");
        setLeaderboard((p.leaderboard as RankedParticipant[]) ?? []);
        break;
    }
  }, [lastEvent, snapshot?.me?.id]);

  return { question, deadline, status, locked, reveal, leaderboard };
}

export default function PlayPage() {
  const t = useTranslations("play");
  const tc = useTranslations("common");
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const { connected, snapshot, lastEvent, error, sendAnswer } = useGameSocket({
    gameId,
    role: "player",
  });

  const live = usePlayerState(snapshot, lastEvent);

  if (error) {
    return <p className="text-rose-600">{error}</p>;
  }

  if (!connected || !snapshot) {
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
