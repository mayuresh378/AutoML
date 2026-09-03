import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  email_verified?: boolean;
  avatar_url?: string | null;
  preferences?: Record<string, any>;
  created_at?: string;
  firebase_uid?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  firebaseUid: string | null;
  setAuth: (token: string, user: User, refreshToken?: string) => void;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setFirebaseUid: (uid: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isLoading: true,
      firebaseUid: null,
      setAuth: (token, user, refreshToken) =>
        set({ token, user, refreshToken: refreshToken || null, isLoading: false, firebaseUid: user.firebase_uid || null }),
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user, firebaseUid: user?.firebase_uid || null }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setFirebaseUid: (firebaseUid) => set({ firebaseUid }),
      logout: () => set({ token: null, refreshToken: null, user: null, firebaseUid: null, isLoading: false }),
    }),
    {
      name: 'automl-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        firebaseUid: state.firebaseUid,
      }),
    }
  )
);
