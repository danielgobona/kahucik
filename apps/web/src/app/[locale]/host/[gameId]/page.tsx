"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { GameTimer } from "@/components/game/GameTimer";
import { LeaderboardList } from "@/components/game/LeaderboardList";
import { QuestionPrompt } from "@/components/game/PlayerAnswerPanel";
import { useGameSocket, type WsMessage } from "@/hooks/useGameSocket";
import type { GameSnapshot, PublicQuestion, RankedParticipant } from "@/lib/types";
import { KahucikLogo } from "@/components/brand/KahucikLogo";
import { Users } from "lucide-react";

type HostLiveState = {
  eventStatus: string | null;
  question: PublicQuestion | null;
  deadline: number | null;
  answered: number;
  total: number;
  leaderboard: RankedParticipant[];
  countdown: number | null;
  participants: GameSnapshot["participants"];
  questionIndex: number;
};

function liveFromSnapshot(snapshot: GameSnapshot): HostLiveState {
  return {
    eventStatus: null,
    answered: snapshot.answered,
    total: snapshot.total_present,
    deadline: snapshot.deadline,
    participants: snapshot.participants ?? [],
    questionIndex: snapshot.current_question_index,
    question: snapshot.question ?? null,
    leaderboard: snapshot.leaderboard ?? [],
    countdown: null,
  };
}

function applyHostEvent(state: HostLiveState, msg: WsMessage): HostLiveState {
  const p = msg.payload;
  switch (msg.type) {
    case "lobby_update":
      if (Array.isArray(p.participants)) {
        const list = p.participants as GameSnapshot["participants"];
        return { ...state, participants: list, total: list.length };
      }
      return state;
    case "countdown":
      return {
        ...state,
        eventStatus: "countdown",
        countdown: Number(p.seconds ?? 0),
        deadline: p.deadline ? Number(p.deadline) : state.deadline,
      };
    case "question":
      return {
        ...state,
        eventStatus: "question_active",
        question: p.question as PublicQuestion,
        deadline: Number(p.deadline),
        answered: 0,
        questionIndex: typeof p.index === "number" ? p.index : state.questionIndex,
      };
    case "answer_progress":
      return {
        ...state,
        answered: Number(p.answered ?? 0),
        total: Number(p.total ?? 0),
      };
    case "question_reveal":
      return {
        ...state,
        eventStatus: "question_reveal",
        question: p.question as PublicQuestion,
        leaderboard: (p.leaderboard as RankedParticipant[]) ?? [],
      };
    case "leaderboard":
      return {
        ...state,
        eventStatus: "leaderboard",
        leaderboard: (p.leaderboard as RankedParticipant[]) ?? [],
      };
    case "finished":
      return {
        ...state,
        eventStatus: "finished",
        leaderboard: (p.leaderboard as RankedParticipant[]) ?? [],
      };
    default:
      return state;
  }
}

export default function HostPage() {
  const t = useTranslations("host");
  const tc = useTranslations("common");
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const [liveState, setLiveState] = useState<HostLiveState | null>(null);

  const onEvent = useCallback((msg: WsMessage) => {
    if (msg.type === "snapshot") {
      setLiveState(liveFromSnapshot(msg.payload as unknown as GameSnapshot));
      return;
    }
    setLiveState((prev) => (prev ? applyHostEvent(prev, msg) : prev));
  }, []);

  const { connected, snapshot, error, hostStart, hostNext } =
    useGameSocket({ gameId, role: "host", onEvent });

  const live = liveState;
  const status = live?.eventStatus ?? snapshot?.status ?? "lobby";

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const code = snapshot?.code ?? "";
    return `${window.location.origin}/join/${code}`;
  }, [snapshot?.code]);

  if (error) {
    return <p className="text-rose-600">{error}</p>;
  }

  if (!connected || !snapshot || !live) {
    return <p className="text-slate-500">{tc("loading")}</p>;
  }

  return (
    <div className="min-h-[80vh] space-y-6">
      <div className="flex items-center justify-between">
        <KahucikLogo variant="compact" className="h-12 w-12" />
        <span className="font-mono text-3xl font-black tracking-widest text-coral-600">
          {snapshot.code}
        </span>
      </div>

      {status === "lobby" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col items-center gap-4 py-8">
            <CardTitle>{t("scanQr")}</CardTitle>
            {joinUrl ? (
              <QRCodeSVG value={joinUrl} size={220} bgColor="#ffffff" fgColor="#1e293b" />
            ) : null}
            <p className="font-mono text-4xl font-black text-coral-500">{snapshot.code}</p>
          </Card>
          <Card>
            <CardTitle>
              <Users className="mr-2 inline h-5 w-5" />
              {t("players", { count: live.participants.length })}
            </CardTitle>
            <ul className="mt-4 space-y-2">
              {live.participants.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700"
                >
                  {p.nickname}
                  {!p.connected && (
                    <span className="ml-2 text-xs text-slate-400">offline</span>
                  )}
                </li>
              ))}
            </ul>
            {live.participants.length === 0 && (
              <p className="mt-4 text-slate-500">{t("waitingPlayers")}</p>
            )}
            <Button
              className="mt-6 w-full"
              size="lg"
              onClick={hostStart}
              disabled={live.participants.length === 0}
            >
              {t("start")}
            </Button>
          </Card>
        </div>
      )}

      {status === "countdown" && (
        <div className="flex flex-col items-center gap-6 py-20">
          <p className="text-2xl font-semibold text-slate-600">
            {t("countdown", { seconds: live.countdown ?? 3 })}
          </p>
          <GameTimer deadline={live.deadline} className="text-6xl" />
        </div>
      )}

      {(status === "question_active" || status === "question_reveal") &&
        live.question && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-lg text-slate-600">
                {t("questionOf", {
                  current: (live.questionIndex ?? 0) + 1,
                  total: snapshot.total_questions,
                })}
              </p>
              <div className="flex items-center gap-4">
                {status === "question_active" && (
                  <>
                    <GameTimer deadline={live.deadline} />
                    <span className="rounded-full bg-sky-100 px-4 py-2 font-semibold text-sky-800">
                      {t("answered", { answered: live.answered, total: live.total })}
                    </span>
                  </>
                )}
              </div>
            </div>
            <QuestionPrompt question={live.question} />
            {status === "question_reveal" && (
              <div className="mx-auto max-w-lg space-y-6">
                <LeaderboardList entries={live.leaderboard} />
                <Button className="w-full" size="lg" onClick={hostNext}>
                  {t("next")}
                </Button>
              </div>
            )}
          </div>
        )}

      {(status === "leaderboard" || status === "finished") && (
        <div className="mx-auto max-w-lg space-y-6">
          <h2 className="text-center text-3xl font-bold">
            {status === "finished" ? t("finished") : t("showLeaderboard")}
          </h2>
          <LeaderboardList entries={live.leaderboard} />
          {status === "leaderboard" && (
            <Button className="w-full" size="lg" onClick={hostNext}>
              {t("next")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
