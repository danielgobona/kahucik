"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { api, ApiClientError } from "@/lib/api";
import type { GameHistoryItem, QuizSummary } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Radio, Copy, Archive } from "lucide-react";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { user, initialized, fetchMe } = useAuthStore();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostingId, setHostingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchMe().then((u) => {
      if (!u) router.replace("/auth/login");
    });
  }, [fetchMe, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([api.listQuizzes(), api.gameHistory()])
      .then(([q, h]) => {
        setQuizzes(q);
        setHistory(h);
      })
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.detail : tc("error")),
      )
      .finally(() => setLoading(false));
  }, [user, tc]);

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
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    }
  };

  if (!initialized || !user) {
    return <p className="text-slate-500">{tc("loading")}</p>;
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
        {loading ? (
          <p className="text-slate-500">{tc("loading")}</p>
        ) : quizzes.length === 0 ? (
          <Card>
            <p className="text-slate-600">{t("emptyQuizzes")}</p>
          </Card>
        ) : (
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
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("history")}</h2>
        {loading ? (
          <p className="text-slate-500">{tc("loading")}</p>
        ) : history.length === 0 ? (
          <Card>
            <p className="text-slate-600">{t("emptyHistory")}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <Card key={item.game_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
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
          </div>
        )}
      </section>
    </div>
  );
}
