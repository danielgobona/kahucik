"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiClientError } from "@/lib/api";
import type { GameHistoryItem, QuizSummary } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Radio, Copy, Archive } from "lucide-react";

const QUIZ_PAGE_SIZE = 12;
const HISTORY_PAGE_SIZE = 20;

function QuizCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3">
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </Card>
  );
}

function HistoryItemSkeleton() {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>

      <section>
        <Skeleton className="mb-4 h-7 w-36" />
        <div className="grid gap-4 sm:grid-cols-2">
          <QuizCardSkeleton />
          <QuizCardSkeleton />
        </div>
      </section>

      <section>
        <Skeleton className="mb-4 h-7 w-28" />
        <div className="space-y-2">
          <HistoryItemSkeleton />
          <HistoryItemSkeleton />
          <HistoryItemSkeleton />
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { user, initialized, fetchMe } = useAuthStore();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizzesTotal, setQuizzesTotal] = useState(0);
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hostingId, setHostingId] = useState<string | null>(null);
  const [loadingMoreQuizzes, setLoadingMoreQuizzes] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const loading = !user || loadedUserId !== user.id;
  const hasMoreQuizzes = quizzes.length < quizzesTotal;
  const hasMoreHistory = history.length < historyTotal;

  useEffect(() => {
    void fetchMe().then((u) => {
      if (!u) router.replace("/auth/login");
    });
  }, [fetchMe, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      api.listQuizzes({ limit: QUIZ_PAGE_SIZE, offset: 0 }),
      api.gameHistory({ limit: HISTORY_PAGE_SIZE, offset: 0 }),
    ])
      .then(([q, h]) => {
        if (cancelled) return;
        setQuizzes(q.items);
        setQuizzesTotal(q.total);
        setHistory(h.items);
        setHistoryTotal(h.total);
        setLoadedUserId(user.id);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.detail : tc("error"));
        setLoadedUserId(user.id);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tc]);

  const loadMoreQuizzes = useCallback(async () => {
    if (loadingMoreQuizzes || !hasMoreQuizzes) return;
    setLoadingMoreQuizzes(true);
    try {
      const page = await api.listQuizzes({
        limit: QUIZ_PAGE_SIZE,
        offset: quizzes.length,
      });
      setQuizzes((prev) => {
        const seen = new Set(prev.map((q) => q.id));
        return [...prev, ...page.items.filter((q) => !seen.has(q.id))];
      });
      setQuizzesTotal(page.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    } finally {
      setLoadingMoreQuizzes(false);
    }
  }, [loadingMoreQuizzes, hasMoreQuizzes, quizzes.length, tc]);

  const loadMoreHistory = useCallback(async () => {
    if (loadingMoreHistory || !hasMoreHistory) return;
    setLoadingMoreHistory(true);
    try {
      const page = await api.gameHistory({
        limit: HISTORY_PAGE_SIZE,
        offset: history.length,
      });
      setHistory((prev) => {
        const seen = new Set(prev.map((item) => item.game_id));
        return [...prev, ...page.items.filter((item) => !seen.has(item.game_id))];
      });
      setHistoryTotal(page.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    } finally {
      setLoadingMoreHistory(false);
    }
  }, [loadingMoreHistory, hasMoreHistory, history.length, tc]);

  const handleHost = async (quizId: string) => {
    setHostingId(quizId);
    try {
      const game = await api.hostGame(quizId);
      router.push(`/host/${game.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    } finally {
      setHostingId(null);
    }
  };

  const handleDuplicate = async (quizId: string) => {
    try {
      const clone = await api.duplicateQuiz(quizId);
      router.push(`/quiz/${clone.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    }
  };

  const handleArchive = async (quizId: string) => {
    try {
      await api.archiveQuiz(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      setQuizzesTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    }
  };

  if (!initialized || !user || loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-800">{t("title")}</h1>
        <Link href="/quiz/new">
          <Button>
            <Plus className="h-4 w-4" />
            {t("newQuiz")}
          </Button>
        </Link>
      </div>

      {error ? <p className="text-rose-600">{error}</p> : null}

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("myQuizzes")}</h2>
        {quizzes.length === 0 ? (
          <Card>
            <p className="text-slate-600">{t("emptyQuizzes")}</p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {quizzes.map((quiz) => (
                <Card key={quiz.id} className="flex flex-col gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800">{quiz.title}</h3>
                    <p className="text-sm text-slate-500">
                      {{
                        draft: t("statusDraft"),
                        published: t("statusPublished"),
                        archived: t("statusArchived"),
                      }[quiz.status]}
                      {" · "}
                      {t("questions", { count: quiz.question_count })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/quiz/${quiz.id}`}>
                      <Button variant="secondary" size="sm">
                        {t("edit")}
                      </Button>
                    </Link>
                    {quiz.status === "published" && (
                      <Button
                        size="sm"
                        loading={hostingId === quiz.id}
                        onClick={() => void handleHost(quiz.id)}
                      >
                        <Radio className="h-4 w-4" />
                        {t("host")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDuplicate(quiz.id)}
                    >
                      <Copy className="h-4 w-4" />
                      {t("duplicate")}
                    </Button>
                    {quiz.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleArchive(quiz.id)}
                      >
                        <Archive className="h-4 w-4" />
                        {t("archive")}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              {loadingMoreQuizzes ? (
                <>
                  <QuizCardSkeleton />
                  <QuizCardSkeleton />
                </>
              ) : null}
            </div>
            {hasMoreQuizzes ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="secondary"
                  loading={loadingMoreQuizzes}
                  onClick={() => void loadMoreQuizzes()}
                >
                  {t("loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("history")}</h2>
        {history.length === 0 ? (
          <Card>
            <p className="text-slate-600">{t("emptyHistory")}</p>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {history.map((item) => (
                <Card
                  key={item.game_id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-medium">{item.quiz_title}</p>
                    <p className="text-sm text-slate-500">
                      {t("correct", {
                        correct: item.answers_correct,
                        total: item.answers_total,
                      })}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-coral-600">
                      {t("rank", { rank: item.rank })}
                    </p>
                    <p>{t("score", { score: item.score })}</p>
                  </div>
                </Card>
              ))}
              {loadingMoreHistory ? (
                <>
                  <HistoryItemSkeleton />
                  <HistoryItemSkeleton />
                </>
              ) : null}
            </div>
            {hasMoreHistory ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="secondary"
                  loading={loadingMoreHistory}
                  onClick={() => void loadMoreHistory()}
                >
                  {t("loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
