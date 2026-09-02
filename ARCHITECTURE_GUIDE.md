# AutoML Frontend - Architecture & Integration Guide

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React Application                 │
│                    (React 19 + Vite)                │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼───┐    ┌────▼────┐    ┌───▼─────┐
   │ Router │    │  Zustand │   │ TanStack │
   │ (v7)   │    │  (Store) │   │  Query   │
   └────┬───┘    └──────────┘    └───┬─────┘
        │                             │
   ┌────▼─────────────────────────────▼──┐
   │        API Service Layer             │
   │   (REST API Calls to FastAPI)        │
   └────┬─────────────────────────────────┘
        │
   ┌────▼──────────────────┐
   │  FastAPI Backend      │
   │  (http://0.0.0.0:8000)│
   └───────────────────────┘
```

## Component Hierarchy

```
<App>
  └── <BrowserRouter>
      └── <QueryClientProvider>
          └── <Layout>
              ├── <Header>
              │   ├── Breadcrumb
              │   ├── Search
              │   ├── Notifications
              │   └── UserMenu
              │
              ├── <Sidebar>
              │   ├── Logo
              │   ├── NavigationLinks
              │   ├── AIAssistantWidget
              │   └── CollapseButton
              │
              └── <main>
                  ├── <Routes>
                  │   ├── /dashboard → <DashboardPage>
                  │   ├── /upload → <UploadPage>
                  │   ├── /explorer → <ExplorerPage>
                  │   ├── /cleaning → <CleaningPage>
                  │   ├── /engineering → <EngineeringPage>
                  │   ├── /training → <TrainingPage>
                  │   ├── /comparison → <ComparisonPage>
                  │   ├── /prediction → <PredictionPage>
                  │   ├── /reports → <ReportsPage>
                  │   ├── /history → <HistoryPage>
                  │   └── /settings → <SettingsPage>
```

## Page Structure Pattern

Each page follows this structure:

```tsx
import { motion } from 'framer-motion';
import { SomeIcon } from 'lucide-react';

function PageName() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-6"
    >
      {/* Hero/Header Section */}
      <section className="rounded-[32px] border border-white/10 bg-[#111827]/80 p-6">
        {/* Title + CTA */}
      </section>

      {/* Main Content Grid */}
      <section className="grid gap-6 lg:grid-cols-[...]">
        {/* Content Cards */}
      </section>
    </motion.div>
  );
}

export default PageName;
```

## Tailwind Design Tokens

### Sizing Scale
```
Spacing: space-1 through space-12
Heights: h-2, h-4, h-5, h-8, h-9, h-16, h-24, h-32, h-40, h-48, h-64
Widths:  w-2, w-4, w-5, w-10, w-16, w-20, w-32, w-80, w-full
```

### Border Radius
```
sm: 4px   (rounded)
md: 6px   (rounded-md)
lg: 12px  (rounded-lg)
xl: 16px  (rounded-xl)
2xl: 24px (rounded-2xl)
3xl: 32px (rounded-3xl)
```

### Typography Scale
```
Text sizes: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl
Font weights: font-medium (500), font-semibold (600), font-bold (700)
Line height: leading-tight, leading-snug, leading-normal, leading-relaxed, leading-loose
```

### Colors
```
Background: bg-canvas (#09090B)
Surface:    bg-surface (#111827)
Card:       bg-card (#18181B)
Borders:    border-white/10, border-white/5, border-primary/20, etc.
Text:       text-white, text-slate-100, text-slate-300, text-slate-400, text-slate-500
```

## API Service Layer Pattern

Create this file: `src/services/api.ts`

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = 'http://localhost:8000';

// Dataset APIs
export async function uploadDataset(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

export function useUploadDataset() {
  return useMutation({
    mutationFn: uploadDataset,
    onSuccess: (data) => {
      console.log('Dataset uploaded:', data);
    },
  });
}

// Training APIs
export async function startTraining(datasetId: string, targetColumn: string) {
  const response = await fetch(`${API_BASE}/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id: datasetId, target_column: targetColumn }),
  });
  return response.json();
}

export function useStartTraining() {
  return useMutation({
    mutationFn: (params: { datasetId: string; targetColumn: string }) =>
      startTraining(params.datasetId, params.targetColumn),
  });
}

// Prediction APIs
export async function makePrediction(modelId: string, inputData: Record<string, any>) {
  const response = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model_id: modelId, data: inputData }),
  });
  return response.json();
}

export function useMakePrediction() {
  return useMutation({
    mutationFn: (params: { modelId: string; inputData: Record<string, any> }) =>
      makePrediction(params.modelId, params.inputData),
  });
}
```

## State Management with Zustand

Create this file: `src/store/appStore.ts`

```typescript
import { create } from 'zustand';

interface AppState {
  // UI State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // User State
  currentUser: { name: string; role: string } | null;
  setCurrentUser: (user: { name: string; role: string } | null) => void;

  // Workspace State
  currentWorkspace: string;
  setCurrentWorkspace: (workspace: string) => void;

  // Dataset State
  selectedDataset: string | null;
  setSelectedDataset: (datasetId: string | null) => void;

  // Experiment State
  activeExperiments: string[];
  addExperiment: (experimentId: string) => void;
  removeExperiment: (experimentId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // UI
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // User
  currentUser: { name: 'Alicia Chen', role: 'Principal ML Lead' },
  setCurrentUser: (user) => set({ currentUser: user }),

  // Workspace
  currentWorkspace: 'Default',
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),

  // Dataset
  selectedDataset: null,
  setSelectedDataset: (datasetId) => set({ selectedDataset: datasetId }),

  // Experiments
  activeExperiments: [],
  addExperiment: (id) =>
    set((state) => ({
      activeExperiments: [...state.activeExperiments, id],
    })),
  removeExperiment: (id) =>
    set((state) => ({
      activeExperiments: state.activeExperiments.filter((expId) => expId !== id),
    })),
}));
```

## Form Validation with Zod

Example: `src/forms/trainForm.ts`

```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const trainSchema = z.object({
  datasetId: z.string().uuid('Invalid dataset'),
  targetColumn: z.string().min(1, 'Target column required'),
  testSize: z.number().min(0.1).max(0.5),
  randomState: z.number().int().optional(),
});

export type TrainFormData = z.infer<typeof trainSchema>;

export function useTrainForm() {
  return useForm<TrainFormData>({
    resolver: zodResolver(trainSchema),
    defaultValues: {
      testSize: 0.2,
      randomState: 42,
    },
  });
}
```

## Implementing Real API Calls

### Example 1: Dashboard with Real Data

```tsx
import { useQuery } from '@tanstack/react-query';

function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/stats');
      return res.json();
    },
  });

  if (isLoading) return <DashboardSkeleton />;

  return (
    <motion.div>
      {/* Use stats?.datasets, stats?.models, stats?.predictions */}
    </motion.div>
  );
}
```

### Example 2: Upload with Progress

```tsx
import { useUploadDataset } from '../services/api';

function UploadPage() {
  const { mutate: upload, isPending, progress } = useUploadDataset();

  const handleFileSelect = (file: File) => {
    upload(file);
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
      />
      {isPending && <ProgressBar value={progress} />}
    </div>
  );
}
```

### Example 3: Polling for Training Status

```tsx
import { useQuery } from '@tanstack/react-query';

function TrainingPage() {
  const { data: training } = useQuery({
    queryKey: ['training', 'active'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/experiments/active');
      return res.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });

  return (
    <div>
      <ProgressBar value={training?.progress} />
      <span>{training?.timeRemaining} min remaining</span>
    </div>
  );
}
```

## Styling Patterns

### Card Component
```tsx
<div className="rounded-[32px] border border-white/10 bg-[#111827]/80 p-6 backdrop-blur">
  {/* Content */}
</div>
```

### Button Component
```tsx
// Primary
<button className="rounded-2xl bg-primary/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/30">
  Action
</button>

// Secondary
<button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
  Action
</button>

// Danger
<button className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-medium text-danger hover:bg-danger/20">
  Cancel
</button>
```

### Badge Component
```tsx
<div className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-400">
  Active
</div>
```

## Performance Optimization

### Code Splitting (Vite ready)
```tsx
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));

// In routes
<Suspense fallback={<LoadingSkeleton />}>
  <Route path="/dashboard" element={<DashboardPage />} />
</Suspense>
```

### Image Optimization
```tsx
<img
  src={dataset}
  alt="Dataset preview"
  loading="lazy"
  decoding="async"
/>
```

### Query Caching
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});
```

## Error Handling Pattern

```tsx
import { useQuery } from '@tanstack/react-query';

function DatasetExplorer() {
  const { data, isError, error, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/datasets');
      if (!res.ok) throw new Error('Failed to fetch datasets');
      return res.json();
    },
  });

  if (isLoading) return <Skeleton />;
  if (isError) return <ErrorCard message={error?.message} />;

  return <DataTable data={data} />;
}
```

## Environment Variables

Create `.env.local`:
```
VITE_API_BASE=http://localhost:8000
VITE_APP_NAME=AutoML Cloud Platform
VITE_ENABLE_ANALYTICS=false
```

Use in code:
```tsx
const API_BASE = import.meta.env.VITE_API_BASE;
```

## Testing Ready

Structure for Jest + React Testing Library:

```tsx
// __tests__/pages/DashboardPage.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../../pages/DashboardPage';

test('renders dashboard with title', () => {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
  expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
});
```

---

**This guide provides everything needed to extend and maintain the AutoML frontend as a production SaaS platform.**
