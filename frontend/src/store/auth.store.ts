import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthenticatedUser } from "@/lib/api/types";

interface AuthState {
  user: AuthenticatedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (user: AuthenticatedUser, token: string) => void;
  logout: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitializing: true,
      
      login: (user, token) => set({ user, token, isAuthenticated: true, isInitializing: false }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: "medcare-auth", // unique name for localStorage key
      // When rehydrating from localStorage, we know we're done initializing
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isInitializing = false;
        }
      },
    }
  )
);
