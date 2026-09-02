import { useState, useEffect } from 'react';
import { useUIStore } from '../../../store/useUIStore';
import { authService } from '../../../services/auth.service';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { PageContainer } from '../../../components/layout/PageContainer';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { CheckCircle, XCircle, Mail } from 'lucide-react';
import { getErrorMessage } from '../../../services/http';

export default function VerifyEmailPage() {
  const setActivePage = useUIStore((s) => s.setActivePage);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in URL');
      return;
    }
    authService.verifyEmail(token)
      .then(() => { setStatus('success'); setMessage('Email verified successfully!'); })
      .catch((err) => { setStatus('error'); setMessage(getErrorMessage(err)); });
  }, []);

  return (
    <PageContainer maxWidth="sm">
      <div className="min-h-[80vh] flex items-center justify-center">
        <Card variant="glass" padding="lg" className="w-full text-center">
          {status === 'loading' && (
            <div className="py-8">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-zinc-400 mt-4">Verifying your email...</p>
            </div>
          )}
          {status === 'success' && (
            <div>
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-zinc-100 mb-2">Email verified</h1>
              <p className="text-sm text-zinc-400 mb-6">{message}</p>
              <Button onClick={() => setActivePage('Dashboard')}>Go to Dashboard</Button>
            </div>
          )}
          {status === 'error' && (
            <div>
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-zinc-100 mb-2">Verification failed</h1>
              <p className="text-sm text-zinc-400 mb-6">{message}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={() => setActivePage('Dashboard')}>Dashboard</Button>
                <Button onClick={() => authService.sendVerification().then(() => setMessage('New verification email sent!')).catch(() => {})} icon={<Mail className="w-4 h-4" />}>Resend Email</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
