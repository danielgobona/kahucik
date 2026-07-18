"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { GameTimer } from "@/components/game/GameTimer";
import { LeaderboardList } from "@/components/game/LeaderboardList";
import { QuestionPrompt } from "@/components/game/PlayerAnswerPanel";
import { useGameSocket } from "@/hooks/useGameSocket";
import type { GameSnapshot, PublicQuestion, RankedParticipant } from "@/lib/types";
import { KahucikLogo } from "@/components/brand/KahucikLogo";
import { Users } from "lucide-react";

function useLiveState(
  snapshot: GameSnapshot | null,
  lastEvent: { type: string; payload: Record<string, unknown> } | null,
) {
  // Event-driven overrides; null means "use authoritative snapshot.status"
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [answered, setAnswered] = useState(0);
  const [total, setTotal] = useState(0);
  const [leaderboard, setLeaderboard] = useState<RankedParticipant[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [participants, setParticipants] = useState<GameSnapshot["participants"]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);

  useEffect(() => {
    if (!snapshot) return;
    // Reconnect/snapshot is source of truth — clear stale event overrides
    setEventStatus(null);
    setAnswered(snapshot.answered);
    setTotal(snapshot.total_present);
    setDeadline(snapshot.deadline);
    setParticipants(snapshot.participants ?? []);
    setQuestionIndex(snapshot.current_question_index);
    if (snapshot.question) setQuestion(snapshot.question);
    if (snapshot.leaderboard) setLeaderboard(snapshot.leaderboard);
  }, [snapshot]);

  useEffect(() => {
    if (!lastEvent) return;
    // Snapshot messages only refresh baseline state above
    if (lastEvent.type === "snapshot") return;

    const p = lastEvent.payload;
    switch (lastEvent.type) {
      case "lobby_update":
        if (Array.isArray(p.participants)) {
          const list = p.participants as GameSnapshot["participants"];
          setParticipants(list);
          setTotal(list.length);
        }
        break;
      case "countdown":
        setEventStatus("countdown");
        setCountdown(Number(p.seconds ?? 0));
        if (p.deadline) setDeadline(Number(p.deadline));
        break;
      case "question":
        setEventStatus("question_active");
        setQuestion(p.question as PublicQuestion);
        setDeadline(Number(p.deadline));
        setAnswered(0);
        if (typeof p.index === "number") setQuestionIndex(p.index);
        break;
      case "answer_progress":
        setAnswered(Number(p.answered ?? 0));
        setTotal(Number(p.total ?? 0));
        break;
      case "question_reveal":
        setEventStatus("question_reveal");
        setQuestion(p.question as PublicQuestion);
        setLeaderboard((p.leaderboard as RankedParticipant[]) ?? []);
        break;
      case "leaderboard":
        setEventStatus("leaderboard");
        setLeaderboard((p.leaderboard as RankedParticipant[]) ?? []);
        break;
      case "finished":
        setEventStatus("finished");
        setLeaderboard((p.leaderboard as RankedParticipant[]) ?? []);
        break;
    }
  }, [lastEvent]);

  const status = eventStatus ?? snapshot?.status ?? "lobby";

  return {
    question,
    deadline,
    answered,
    total,
    leaderboard,
    status,
    countdown,
    participants,
    questionIndex,
  };
}

export default function HostPage() {
  const t = useTranslations("host");
  const tc = useTranslations("common");
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const { connected, snapshot, lastEvent, error, hostStart, hostShowLeaderboard, hostNext } =
    useGameSocket({ gameId, role: "host" });

  const live = useLiveState(snapshot, lastEvent);
  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const code = snapshot?.code ?? "";
    return `${window.location.origin}/join/${code}`;
  }, [snapshot?.code]);

  if (error) {
    return <p className="text-rose-600">{error}</p>;
  }

  if (!connected || !snapshot) {
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

      {live.status === "lobby" && (
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

      {live.status === "countdown" && (
        <div className="flex flex-col items-center gap-6 py-20">
          <p className="text-2xl font-semibold text-slate-600">
            {t("countdown", { seconds: live.countdown ?? 3 })}
          </p>
          <GameTimer deadline={live.deadline} className="text-6xl" />
        </div>
      )}

      {(live.status === "question_active" || live.status === "question_reveal") &&
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
                {live.status === "question_active" && (
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
            {live.status === "question_reveal" && (
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" onClick={hostShowLeaderboard}>
                  {t("showLeaderboard")}
                </Button>
                <Button size="lg" variant="secondary" onClick={hostNext}>
                  {t("next")}
                </Button>
              </div>
            )}
          </div>
        )}

      {(live.status === "leaderboard" || live.status === "finished") && (
        <div className="mx-auto max-w-lg space-y-6">
          <h2 className="text-center text-3xl font-bold">
            {live.status === "finished" ? t("finished") : t("showLeaderboard")}
          </h2>
          <LeaderboardList entries={live.leaderboard} />
          {live.status === "leaderboard" && (
            <Button className="w-full" size="lg" onClick={hostNext}>
              {t("next")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
