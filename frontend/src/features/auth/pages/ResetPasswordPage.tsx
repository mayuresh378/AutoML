import { useState } from 'react';
import { useUIStore } from '../../../store/useUIStore';
import { authService } from '../../../services/auth.service';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { PageContainer } from '../../../components/layout/PageContainer';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '../../../services/http';

export default function ResetPasswordPage() {
  const setActivePage = useUIStore((s) => s.setActivePage);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) { setError('Reset token is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <PageContainer maxWidth="sm">
        <div className="min-h-[80vh] flex items-center justify-center">
          <Card variant="glass" padding="lg" className="w-full text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 mb-2">Password reset successful</h1>
            <p className="text-sm text-zinc-400 mb-6">Your password has been updated. You can now sign in with your new password.</p>
            <Button onClick={() => setActivePage('Login')}>Sign In</Button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="sm">
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <Card variant="glass" padding="lg">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-zinc-100">Reset password</h1>
              <p className="text-sm text-zinc-400 mt-1">Enter the reset token from your email and choose a new password</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Reset Token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your reset token" />
              <Input label="New Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" iconRight={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-zinc-500 hover:text-zinc-300"><Eye className="w-4 h-4" /></button>} />
              <Input label="Confirm Password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
              {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-sm text-red-400"><AlertCircle className="w-4 h-4" />{error}</div>}
              <Button type="submit" loading={isLoading} className="w-full" icon={<Lock className="w-4 h-4" />}>Reset Password</Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </PageContainer>
  );
}
