import { useState } from 'react';
import { useUIStore } from '../../../store/useUIStore';
import { authService } from '../../../services/auth.service';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { PageContainer } from '../../../components/layout/PageContainer';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { emailSchema } from '../../../lib/validators';
import { getErrorMessage } from '../../../services/http';

export default function ForgotPasswordPage() {
  const setActivePage = useUIStore((s) => s.setActivePage);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = emailSchema.safeParse(email);
    if (!result.success) { setError('Please enter a valid email address'); return; }
    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer maxWidth="sm">
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <Card variant="glass" padding="lg" className="w-full">
            <button onClick={() => setActivePage('Login')} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </button>

            {sent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <h1 className="text-xl font-bold text-zinc-100 mb-2">Check your email</h1>
                <p className="text-sm text-zinc-400">We've sent a password reset link to <strong className="text-zinc-200">{email}</strong></p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-bold text-zinc-100">Forgot password</h1>
                  <p className="text-sm text-zinc-400 mt-1">Enter your email and we'll send you a reset link</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} placeholder="you@example.com" icon={<Mail className="w-4 h-4" />} />
                  {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-sm text-red-400"><AlertCircle className="w-4 h-4" />{error}</div>}
                  <Button type="submit" loading={isLoading} className="w-full" icon={<Mail className="w-4 h-4" />}>Send Reset Link</Button>
                </form>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </PageContainer>
  );
}
