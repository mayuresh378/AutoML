import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../../store/useUIStore';
import { useRegister } from '../hooks/useLogin';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { PageContainer } from '../../../components/layout/PageContainer';
import { motion } from 'framer-motion';
import { UserPlus, Brain, Eye, AlertCircle } from 'lucide-react';
import { registerSchema } from '../../../lib/validators';
import { useNotification } from '../../../hooks/useNotification';
import { getErrorMessage } from '../../../services/http';

export default function RegisterPage() {
  const setActivePage = useUIStore((s) => s.setActivePage);
  const navigate = useNavigate();
  const register = useRegister();
  const { notifyError } = useNotification();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

            <p className="mb-6 text-xs text-zinc-500 text-center">
              Create an account with your email and password to get started.
            </p>

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
