import { create } from "zustand";
import { api, setCsrfToken } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  fetchMe: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: {
    nickname: string;
    email: string;
    password: string;
    locale: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  setUser(user) {
    set({ user });
  },

  async fetchMe() {
    set({ loading: true });
    try {
      const res = await api.me();
      setCsrfToken(res.csrf_token);
      set({ user: res.user, initialized: true, loading: false });
      return res.user;
    } catch {
      setCsrfToken(null);
      set({ user: null, initialized: true, loading: false });
      return null;
    }
  },

  async login(email, password) {
    set({ loading: true });
    try {
      const res = await api.login({ email, password });
      setCsrfToken(res.csrf_token);
      set({ user: res.user, loading: false, initialized: true });
      return res.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  async signup(data) {
    set({ loading: true });
    try {
      const res = await api.signup(data);
      setCsrfToken(res.csrf_token);
      set({ user: res.user, loading: false, initialized: true });
      return res.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  async logout() {
    // Refresh CSRF from /me so cookie-only sessions work after a full page load.
    try {
      const me = await api.me();
      setCsrfToken(me.csrf_token);
    } catch {
      // Cookie CSRF may still be enough for logout.
    }
    // Do not clear local user if the API call fails — otherwise UI looks logged out
    // while the session cookie remains valid.
    await api.logout();
    setCsrfToken(null);
    set({ user: null });
  },
}));
