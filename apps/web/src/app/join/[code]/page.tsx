import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

function pickLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return routing.defaultLocale;
  const lower = acceptLanguage.toLowerCase();
  if (lower.includes("sk")) return "sk";
  return routing.defaultLocale;
}

export default async function JoinRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const h = await headers();
  const locale = pickLocale(h.get("accept-language"));
  redirect(`/${locale}/join/${encodeURIComponent(code.toUpperCase())}`);
}
