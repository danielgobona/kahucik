/**
 * Capture host lobby + player answering screenshots for the README.
 * Usage: node scripts/capture-readme-screenshots.mjs
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "apps/web/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.PUBLIC_BASE_URL || "http://localhost:8080";
const OUT = path.join(ROOT, "docs", "assets");

const stamp = Date.now().toString().slice(-6);
const host = {
  nickname: `ReadmeH${stamp}`,
  email: `readme-host-${stamp}@example.com`,
  password: "readme-capture-password",
};

function cookieHeader(setCookie) {
  if (!setCookie) return "";
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

function parseCookies(setCookie, url) {
  const parts = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const { hostname } = new URL(url);
  return parts.map((raw) => {
    const [pair, ...attrs] = raw.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const cookie = { name, value, domain: hostname, path: "/" };
    for (const attr of attrs) {
      const a = attr.trim().toLowerCase();
      if (a.startsWith("path=")) cookie.path = attr.split("=")[1];
    }
    return cookie;
  });
}

async function api(pathname, { method = "GET", body, cookie, csrf } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} -> ${res.status}: ${text}`);
  }
  return { data, setCookie, headers: res.headers };
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const signup = await api("/api/auth/signup", {
    method: "POST",
    body: { ...host, locale: "en" },
  });
  const cookie = cookieHeader(signup.setCookie);
  const csrf = signup.data.csrf_token;

  const quiz = await api("/api/quizzes", {
    method: "POST",
    body: { title: "Geography Warmup", description: "Demo quiz for screenshots" },
    cookie,
    csrf,
  });
  const quizId = quiz.data.id;

  await api(`/api/quizzes/${quizId}`, {
    method: "PUT",
    body: {
      questions: [
        {
          type: "quiz",
          text: "What is the capital of France?",
          timer_seconds: 90,
          options: [
            { text: "Paris", is_correct: true },
            { text: "London", is_correct: false },
            { text: "Berlin", is_correct: false },
            { text: "Rome", is_correct: false },
          ],
        },
      ],
    },
    cookie,
    csrf,
  });
  await api(`/api/quizzes/${quizId}/publish`, { method: "POST", cookie, csrf });

  const game = await api("/api/games/host", {
    method: "POST",
    body: { quiz_id: quizId },
    cookie,
    csrf,
  });
  const gameId = game.data.id;
  const code = game.data.code;

  const guest = await api(`/api/games/code/${code}/join/guest`, {
    method: "POST",
    body: { nickname: "Alex", locale: "en" },
  });

  const browser = await chromium.launch({ headless: true });
  const hostCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  await hostCtx.addCookies(parseCookies(signup.setCookie, BASE));
  const hostPage = await hostCtx.newPage();
  await hostPage.goto(`${BASE}/en/host/${gameId}`, { waitUntil: "networkidle" });
  await hostPage.getByText("Scan to join").waitFor({ timeout: 15000 });
  await hostPage.getByText("Alex").waitFor({ timeout: 15000 });
  await hostPage.waitForTimeout(500);
  await hostPage.screenshot({
    path: path.join(OUT, "host-lobby.png"),
    fullPage: false,
  });

  const playerCtx = await browser.newContext({
    viewport: { width: 420, height: 860 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const playerPage = await playerCtx.newPage();
  await playerPage.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
  await playerPage.evaluate(
    ({ gameId, token }) => {
      localStorage.setItem(`kahucik_reconnect_${gameId}`, token);
    },
    { gameId, token: guest.data.reconnect_token },
  );
  await playerPage.goto(`${BASE}/en/play/${gameId}`, { waitUntil: "networkidle" });
  await playerPage.getByText("You're in!").waitFor({ timeout: 15000 });

  await hostPage.getByRole("button", { name: /start/i }).click();
  await playerPage.getByRole("heading", { name: /capital of france/i }).waitFor({
    timeout: 20000,
  });
  await playerPage.getByRole("button", { name: "Paris" }).waitFor();
  await playerPage.waitForTimeout(400);
  await playerPage.screenshot({
    path: path.join(OUT, "player-play.png"),
    fullPage: false,
  });

  await browser.close();

  // Logo SVG already expected at docs/assets/logo.svg — ensure present
  const logoSrc = path.join(ROOT, "apps/web/src/app/icon.svg");
  const logoDst = path.join(OUT, "logo.svg");
  const { copyFile } = await import("node:fs/promises");
  await copyFile(logoSrc, logoDst);

  console.log("Wrote:");
  console.log(" -", path.join(OUT, "logo.svg"));
  console.log(" -", path.join(OUT, "host-lobby.png"));
  console.log(" -", path.join(OUT, "player-play.png"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
