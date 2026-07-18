"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  api,
  ApiClientError,
  saveReconnectToken,
} from "@/lib/api";
import type { GameOut } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default function JoinPage() {
  const t = useTranslations("join");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code?.toUpperCase() ?? "";
  const { user, fetchMe, initialized } = useAuthStore();
  const [game, setGame] = useState<GameOut | null>(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (!code) return;
    api
      .getGameByCode(code)
      .then(setGame)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.detail : t("notFound")),
      );
  }, [code, t]);

  const join = async (asGuest: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = asGuest
        ? await api.joinGuest(code, { nickname, locale })
        : await api.joinRegistered(code, { locale });
      saveReconnectToken(res.game_id, res.reconnect_token);
      router.push(`/${locale}/play/${res.game_id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    } finally {
      setLoading(false);
    }
  };

  if (!initialized && !game) {
    return <p className="text-slate-500">{tc("loading")}</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardTitle>{t("title")}</CardTitle>
        {game ? (
          <p className="mt-2 text-slate-600">{game.quiz_title}</p>
        ) : null}
        <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-coral-600">
          {code}
        </p>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

        {user ? (
          <div className="mt-6 space-y-3">
            <Button
              className="w-full"
              loading={loading}
              onClick={() => void join(false)}
              disabled={!game || game.status !== "lobby"}
            >
              {t("joinLoggedIn", { nickname: user.nickname })}
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <Input
              label={t("nickname")}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              minLength={2}
              maxLength={40}
            />
            <Button
              className="w-full"
              loading={loading}
              onClick={() => void join(true)}
              disabled={!game || game.status !== "lobby" || nickname.length < 2}
            >
              {t("joinAsGuest")}
            </Button>
            <p className="text-center text-sm text-slate-500">
              {t("loginToJoin")}{" "}
              <Link
                href={`/auth/login?next=/join/${code}`}
                className="text-coral-600 hover:underline"
              >
                {tc("login")}
              </Link>
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
