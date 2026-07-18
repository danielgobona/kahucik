"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KahucikLogo } from "@/components/brand/KahucikLogo";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";
import { useEffect } from "react";
import { Sparkles, Trophy } from "lucide-react";

export default function HomePage() {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [code, setCode] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLb, setLoadingLb] = useState(true);

  useEffect(() => {
    api
      .globalLeaderboard()
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
      .finally(() => setLoadingLb(false));
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) router.push(`/join/${trimmed}`);
  };

  return (
    <div className="space-y-10">
      <section className="flex flex-col items-center gap-6 text-center">
        <KahucikLogo variant="full" className="h-20 w-full max-w-md animate-float-soft" />
        <p className="max-w-xl text-lg text-slate-600">{t("tagline")}</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-coral-200 bg-gradient-to-br from-white to-coral-50">
          <CardTitle>{t("joinTitle")}</CardTitle>
          <form onSubmit={handleJoin} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("joinPlaceholder")}
              className="flex-1 font-mono uppercase tracking-widest"
              maxLength={8}
            />
            <Button type="submit" size="lg">
              {t("joinButton")}
            </Button>
          </form>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-white to-amber-50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <CardTitle>{user ? t("createCtaLoggedIn") : t("createCta")}</CardTitle>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {user ? t("createCtaDescLoggedIn") : t("createCtaDesc")}
          </p>
          <Link href={user ? "/dashboard" : "/auth/signup"} className="mt-4 inline-block">
            <Button variant="secondary">
              {user ? t("createCtaLoggedIn") : t("createCta")}
            </Button>
          </Link>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-coral-500" />
          <CardTitle>{t("leaderboardTitle")}</CardTitle>
        </div>
        {loadingLb ? (
          <p className="text-slate-500">{tc("loading")}</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-slate-500">{t("leaderboardEmpty")}</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.slice(0, 10).map((entry) => (
              <li
                key={entry.user_id ?? entry.nickname}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2"
              >
                <span className="font-medium">
                  <span className="mr-2 text-coral-500">#{entry.rank}</span>
                  {entry.nickname}
                </span>
                <span className="text-sm text-slate-600">
                  {entry.score} pts
                  {entry.games_played != null && (
                    <span className="ml-2 hidden sm:inline">
                      · {t("gamesPlayed", { count: entry.games_played })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
