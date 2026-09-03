import { useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../services/auth.service';
import { configureHttp } from '../services/http';
import { auth } from '../lib/firebase';

export function useAuth() {
  const { token, user, setAuth, setToken, setUser, logout: storeLogout, isLoading: isStoreLoading } = useAuthStore();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.me(),
    enabled: !!token,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (profile && !user) {
      setUser(profile);
    }
  }, [profile, user, setUser]);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),
    onSuccess: (data) => {
      setAuth(data.token, data.user, data.refresh_token);
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      authService.register(email, password, name),
    onSuccess: (data) => {
      setAuth(data.token, data.user, data.refresh_token);
    },
  });

  const logout = useCallback(async () => {
    try { await signOut(auth); } catch {}
    try { await authService.logout(); } catch {}
    storeLogout();
  }, [storeLogout]);

  return {
    user,
    token,
    isAuthenticated: !!token,
    isLoading: isStoreLoading || profileLoading,
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoginLoading: loginMutation.isPending,
    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    isRegisterLoading: registerMutation.isPending,
    logout,
  };
}

export function initAuth() {
  configureHttp({
    tokenGetter: async () => {
      if (auth.currentUser) {
        try {
          return await auth.currentUser.getIdToken();
        } catch {
          // fallback to stored token
        }
      }
      return useAuthStore.getState().token;
    },
    onUnauthorized: () => {
      useAuthStore.getState().logout();
    },
  });

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const idToken = await firebaseUser.getIdToken();
        const res = await authService.googleLogin(idToken);
        useAuthStore.getState().setAuth(res.token, res.user, res.refresh_token);
      } catch (err) {
        console.error('Failed to sync Firebase user with backend:', err);
      }
    }
    useAuthStore.getState().setIsLoading(false);
  });
}
