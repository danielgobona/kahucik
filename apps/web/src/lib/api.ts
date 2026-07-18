import type {
  AnswerPayload,
  ApiError,
  GameHistoryItem,
  GameOut,
  JoinResponse,
  LeaderboardEntry,
  MeResponse,
  MediaOut,
  QuizOut,
  QuizSummary,
  QuestionIn,
} from "./types";

const CSRF_COOKIE = "kahucik_csrf";

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

function getCsrfFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function resolveCsrf(): string | null {
  // Prefer cookie (authoritative for the browser session) then in-memory.
  return getCsrfFromCookie() ?? csrfToken;
}

function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  return "";
}

export class ApiClientError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    if (typeof body.detail === "string") return body.detail;
    return res.statusText || "Request failed";
  } catch {
    return res.statusText || "Request failed";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    const csrf = resolveCsrf();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    throw new ApiClientError(res.status, await parseError(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  signup(body: {
    nickname: string;
    email: string;
    password: string;
    locale: string;
  }) {
    return request<MeResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  login(body: { email: string; password: string }) {
    return request<MeResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  logout() {
    return request<void>("/api/auth/logout", { method: "POST" });
  },

  me() {
    return request<MeResponse>("/api/auth/me");
  },

  listQuizzes() {
    return request<QuizSummary[]>("/api/quizzes");
  },

  createQuiz(body: { title: string; description?: string }) {
    return request<QuizOut>("/api/quizzes", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getQuiz(id: string) {
    return request<QuizOut>(`/api/quizzes/${id}`);
  },

  updateQuiz(
    id: string,
    body: {
      title?: string;
      description?: string;
      questions?: QuestionIn[];
    },
  ) {
    return request<QuizOut>(`/api/quizzes/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  publishQuiz(id: string) {
    return request<QuizOut>(`/api/quizzes/${id}/publish`, { method: "POST" });
  },

  unpublishQuiz(id: string) {
    return request<QuizOut>(`/api/quizzes/${id}/unpublish`, { method: "POST" });
  },

  archiveQuiz(id: string) {
    return request<QuizOut>(`/api/quizzes/${id}/archive`, { method: "POST" });
  },

  duplicateQuiz(id: string) {
    return request<QuizOut>(`/api/quizzes/${id}/duplicate`, { method: "POST" });
  },

  uploadMedia(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<MediaOut>("/api/media/upload", {
      method: "POST",
      body: form,
    });
  },

  getMedia(id: string) {
    return request<MediaOut>(`/api/media/${id}`);
  },

  hostGame(quizId: string) {
    return request<GameOut>("/api/games/host", {
      method: "POST",
      body: JSON.stringify({ quiz_id: quizId }),
    });
  },

  getGame(id: string) {
    return request<GameOut>(`/api/games/${id}`);
  },

  getGameByCode(code: string) {
    return request<GameOut>(`/api/games/code/${encodeURIComponent(code)}`);
  },

  joinGuest(code: string, body: { nickname: string; locale: string }) {
    return request<JoinResponse>(
      `/api/games/code/${encodeURIComponent(code)}/join/guest`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  joinRegistered(code: string, body: { locale: string }) {
    return request<JoinResponse>(
      `/api/games/code/${encodeURIComponent(code)}/join`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  globalLeaderboard() {
    return request<LeaderboardEntry[]>("/api/games/meta/leaderboard");
  },

  gameHistory() {
    return request<GameHistoryItem[]>("/api/games/meta/history");
  },
};

export function wsUrl(gameId: string): string {
  const base = process.env.NEXT_PUBLIC_WS_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/ws/games/${gameId}`;
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/games/${gameId}`;
  }
  return `/ws/games/${gameId}`;
}

export function saveReconnectToken(gameId: string, token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`kahucik_reconnect_${gameId}`, token);
}

export function loadReconnectToken(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`kahucik_reconnect_${gameId}`);
}

export type { AnswerPayload };
