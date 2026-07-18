"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiClientError } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { AppLocale } from "@/i18n/routing";

export default function SignupPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signup({ nickname, email, password, locale });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : tc("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardTitle>{t("signupTitle")}</CardTitle>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <Input
            label={t("nickname")}
            required
            minLength={2}
            maxLength={40}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <Input
            label={t("email")}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t("password")}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="submit" className="w-full" loading={loading}>
            {t("signupButton")}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          {t("hasAccount")}{" "}
          <Link href="/auth/login" className="font-semibold text-coral-600 hover:underline">
            {t("goLogin")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
