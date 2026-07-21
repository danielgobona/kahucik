"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="inline-flex shrink-0 rounded-full border border-coral-200 bg-white/80 p-0.5 shadow-sm backdrop-blur sm:p-1">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          className={`rounded-full px-2 py-0.5 text-xs font-medium transition sm:px-3 sm:py-1 sm:text-sm ${
            locale === loc
              ? "bg-coral-500 text-white shadow"
              : "text-slate-600 hover:bg-coral-50"
          }`}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
