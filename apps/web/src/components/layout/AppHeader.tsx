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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <KahucikLogo variant="compact" className="h-9 w-9 sm:h-11 sm:w-11" />
          <span className="sr-only">Kahúcik</span>
        </Link>
        <nav className="flex shrink-0 flex-nowrap items-center gap-1 sm:gap-3">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className="whitespace-nowrap px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm"
                >
                  {t("dashboard")}
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                className="whitespace-nowrap px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm"
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="whitespace-nowrap px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm"
                >
                  {t("login")}
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button
                  size="sm"
                  className="whitespace-nowrap px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm"
                >
                  {t("signup")}
                </Button>
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
