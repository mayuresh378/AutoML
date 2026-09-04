import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { useUIStore } from '../../../store/useUIStore';
import { useRegister, useGoogleLogin } from '../hooks/useLogin';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { PageContainer } from '../../../components/layout/PageContainer';
import { motion } from 'framer-motion';
import { UserPlus, Brain, Eye, AlertCircle } from 'lucide-react';
import { registerSchema } from '../../../lib/validators';
import { useNotification } from '../../../hooks/useNotification';
import { getErrorMessage } from '../../../services/http';
import { auth, googleProvider, isFirebaseConfigured } from '../../../lib/firebase';

export default function RegisterPage() {
  const setActivePage = useUIStore((s) => s.setActivePage);
  const navigate = useNavigate();
  const register = useRegister();
  const googleLogin = useGoogleLogin();
  const { notifyError, notifySuccess } = useNotification();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      notifyError(
        'Firebase Not Configured',
        'Firebase environment variables (VITE_FIREBASE_*) are missing or invalid. Please check configuration.'
      );
      return;
    }

    setIsGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      googleLogin.mutate(idToken, {
        onSuccess: (data) => {
          notifySuccess('Google Sign-In Successful', `Welcome, ${data.user.name}!`);
          setActivePage('Dashboard');
          navigate('/app/dashboard', { replace: true });
        },
        onError: (err) => notifyError('Google Sign-In Failed', getErrorMessage(err)),
      });
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        // User intentionally closed popup, no intrusive error needed
      } else {
        notifyError('Google Sign-In Failed', error?.message || 'Failed to authenticate with Google');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const validate = () => {
    const result = registerSchema.safeParse({ name, email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    register.mutate(
      { name, email, password },
      {
        onSuccess: () => {
          setActivePage('Dashboard');
          navigate('/app/dashboard', { replace: true });
        },
        onError: (err) => notifyError('Registration failed', getErrorMessage(err)),
      },
    );
  };

  return (
    <PageContainer maxWidth="sm">
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <Card variant="glass" padding="lg" className="w-full">
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center mb-4">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl text-zinc-100">Create account</h1>
              <p className="text-sm text-zinc-400 mt-1">Get started with AutoML Cloud</p>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={handleGoogleSignIn}
              loading={isGoogleLoading || googleLogin.isPending}
              className="w-full mb-6 border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200"
              size="lg"
            >
              <GoogleIcon />
              Sign up with Google
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-900/90 px-3 text-zinc-500 font-medium">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Your full name" autoComplete="name" />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} placeholder="you@example.com" autoComplete="email" />
              <Input label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} placeholder="Min. 8 characters" iconRight={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-zinc-500 hover:text-zinc-300"><Eye className="w-4 h-4" /></button>} autoComplete="new-password" />
              <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} placeholder="Repeat your password" autoComplete="new-password" />

              {register.error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{getErrorMessage(register.error)}</span>
                </div>
              )}

              <Button type="submit" loading={register.isPending} className="w-full" size="lg" icon={<UserPlus className="w-4 h-4" />}>
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="text-white hover:text-white/80 font-medium transition-colors">Sign in</button>
            </div>
          </Card>
        </motion.div>
      </div>
    </PageContainer>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 mr-2 inline-block" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
