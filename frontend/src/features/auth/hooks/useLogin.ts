import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/useAuthStore';
import { authService } from '../../../services/auth.service';
import type { AuthResponse } from '../../../types/api';

export function useLogin(): UseMutationResult<AuthResponse, Error, { email: string; password: string }> {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),
    onSuccess: (data) => {
      setAuth(data.token, data.user, data.refresh_token);
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      authService.register(email, password, name),
    onSuccess: (data) => {
      setAuth(data.token, data.user, data.refresh_token);
    },
  });
}

export function useGoogleLogin(): UseMutationResult<AuthResponse, Error, string> {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (idToken: string) => authService.googleLogin(idToken),
    onSuccess: (data) => {
      setAuth(data.token, data.user, data.refresh_token);
    },
  });
}
