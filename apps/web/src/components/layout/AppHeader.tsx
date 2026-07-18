"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Link } from "@/i18n/navigation";
import { KahucikLogo } from "@/components/brand/KahucikLogo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Button } from "@/components/ui/Button";
import { useTranslations } from "next-intl";

export function AppHeader() {
  const t = useTranslations("nav");
  const { user, initialized, fetchMe, logout } = useAuthStore();

  useEffect(() => {
    if (!initialized) void fetchMe();
  }, [initialized, fetchMe]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <KahucikLogo variant="compact" className="h-11 w-11" />
          <span className="sr-only">Kahúcik</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  {t("dashboard")}
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void logout().catch(() => {
                    // Keep session UI; CSRF/network failures should not fake a logout.
                  });
                }}
              >
                {t("logout")}
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  {t("login")}
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm">{t("signup")}</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
