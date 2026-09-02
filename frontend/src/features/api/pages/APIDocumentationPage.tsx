import { useState } from 'react';
import { Copy, Check, BookOpen, Code } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';

const endpoints = [
  {
    method: 'GET',
    path: '/api/v1/health',
    desc: 'Health check',
    auth: false,
  },
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    desc: 'Login with email and password',
    auth: false,
  },
  {
    method: 'POST',
    path: '/api/v1/auth/register',
    desc: 'Register a new account',
    auth: false,
  },
  {
    method: 'GET',
    path: '/api/v1/auth/me',
    desc: 'Get current user profile',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/v1/datasets',
    desc: 'List all datasets',
    auth: true,
  },
  {
    method: 'POST',
    path: '/api/v1/datasets',
    desc: 'Upload a dataset',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/v1/models',
    desc: 'List all models',
    auth: true,
  },
  {
    method: 'POST',
    path: '/api/v1/training',
    desc: 'Start a training job',
    auth: true,
  },
  {
    method: 'GET',
    path: '/api/v1/deployments',
    desc: 'List all deployments',
    auth: true,
  },
  {
    method: 'POST',
    path: '/api/v1/predictions',
    desc: 'Run a prediction',
    auth: true,
  },
];

const methodColors: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-blue-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
  PATCH: 'text-purple-400',
};

const authCode = `curl -X POST /api/v1/auth/login \\
  -d "email=user@example.com" \\
  -d "password=your_password"`;

const predictCode = `curl -X POST /api/v1/predictions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d "model_name=my_model" \\
  -d 'payload={"feature1": "value1", "feature2": 42}'`;

export default function APIDocumentationPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState('endpoints');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 2000); });
  };

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative">
      <pre className="text-sm text-zinc-200 font-mono bg-zinc-900 rounded-xl p-4 overflow-x-auto">{code}</pre>
      <button onClick={() => copyToClipboard(code, id)} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors">
        {copied === id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <PageContainer maxWidth="lg">
      <PageHeader title="API Documentation" description="Integrate with the AutoML API" />

      <Tabs tabs={[
        { id: 'endpoints', label: 'Endpoints', icon: <BookOpen className="w-4 h-4" /> },
        { id: 'examples', label: 'Examples', icon: <Code className="w-4 h-4" /> },
      ]} activeTab={tab} onChange={setTab} className="mb-6" />

      {tab === 'endpoints' && (
        <Card>
          <CardHeader><CardTitle>API Endpoints</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <span className="col-span-2">Method</span>
                <span className="col-span-7">Path</span>
                <span className="col-span-3">Auth</span>
              </div>
              {endpoints.map((ep, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                  <span className={`col-span-2 text-sm font-mono font-medium ${methodColors[ep.method]}`}>{ep.method}</span>
                  <span className="col-span-7 text-sm text-zinc-300 font-mono truncate">{ep.path}</span>
                  <span className="col-span-3 text-xs">{ep.auth ? <span className="text-amber-400">Bearer Token</span> : <span className="text-zinc-500">None</span>}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-zinc-500 mt-6">For the full OpenAPI specification, visit <a href="/docs" className="text-primary hover:underline">/docs</a> (Swagger UI) or <a href="/redoc" className="text-primary hover:underline">/redoc</a> (ReDoc).</p>
          </CardContent>
        </Card>
      )}

      {tab === 'examples' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">Obtain a JWT token by logging in:</p>
              <CodeBlock code={authCode} id="auth" />
              <p className="text-sm text-zinc-400">Use the returned <code className="text-primary text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">token</code> in subsequent requests as a Bearer token.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Running Predictions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">Run a prediction against a deployed model:</p>
              <CodeBlock code={predictCode} id="predict" />
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
