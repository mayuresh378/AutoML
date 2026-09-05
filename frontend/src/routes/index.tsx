import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import RequireAuth from '../components/RequireAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import Landing from '../pages/Landing';
import NotFound from '../pages/NotFound';

const Login = lazy(() => import('../features/auth/pages/LoginPage'));
const Register = lazy(() => import('../features/auth/pages/RegisterPage'));
const ForgotPassword = lazy(() => import('../features/auth/pages/ForgotPasswordPage'));
const ResetPassword = lazy(() => import('../features/auth/pages/ResetPasswordPage'));
const VerifyEmail = lazy(() => import('../features/auth/pages/VerifyEmailPage'));

const Dashboard = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const Datasets = lazy(() => import('../features/datasets/pages/DatasetsPage'));
const Training = lazy(() => import('../features/training/pages/TrainingPage'));
const Experiments = lazy(() => import('../features/experiments/pages/ExperimentsPage'));
const Models = lazy(() => import('../features/models/pages/ModelRegistryPage'));
const Deployments = lazy(() => import('../features/deployments/pages/DeploymentsPage'));
const Monitoring = lazy(() => import('../features/monitoring/pages/MonitoringPage'));
const Settings = lazy(() => import('../features/settings/pages/SettingsPage'));
const SQLEditor = lazy(() => import('../features/sql/pages/SQLEditorPage'));
const Explain = lazy(() => import('../features/explain/pages/ExplainPage'));
const ModelEvaluation = lazy(() => import('../features/evaluation/pages/ModelEvaluationPage'));
const AIAssistant = lazy(() => import('../features/ai/pages/AIAssistantPage'));
const HPO = lazy(() => import('../features/training/pages/HyperparameterPage'));
const AutoMLEngine = lazy(() => import('../features/scheduling/pages/AutomlEnginePage'));
const ProjectWorkspace = lazy(() => import('../features/projects/pages/ProjectWorkspace'));
const ProjectOverview = lazy(() => import('../features/projects/pages/ProjectOverview'));
const ProjectDatasets = lazy(() => import('../features/projects/pages/ProjectDatasets'));
const ProjectSettings = lazy(() => import('../features/projects/pages/ProjectSettings'));

const Projects = lazy(() => import('../features/projects/pages/ProjectsPage'));
const Explorer = lazy(() => import('../features/datasets/pages/ExplorerPage'));
const DataProfiling = lazy(() => import('../features/datasets/pages/DatasetAnalysisPage'));
const DataCleaning = lazy(() => import('../features/datasets/pages/CleaningPage'));
const FeatureEngineering = lazy(() => import('../features/datasets/pages/FeatureEngineeringPage'));
const Pipelines = lazy(() => import('../features/pipelines/pages/PipelinesPage'));
const ModelComparison = lazy(() => import('../features/models/pages/ModelComparisonPage'));
const Prediction = lazy(() => import('../features/prediction/pages/PredictionPage'));
const BatchPrediction = lazy(() => import('../features/prediction/pages/BatchPredictionPage'));
const Leaderboard = lazy(() => import('../features/experiments/pages/LeaderboardPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <Landing />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <Register />
      </Suspense>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ForgotPassword />
      </Suspense>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <ResetPassword />
      </Suspense>
    ),
  },
  {
    path: '/verify-email',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <VerifyEmail />
      </Suspense>
    ),
  },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'datasets', element: <Datasets /> },
      { path: 'datasets/:name', element: <DataProfiling /> },
      { path: 'training', element: <Training /> },
      { path: 'hpo', element: <HPO /> },
      { path: 'engine', element: <AutoMLEngine /> },
      { path: 'experiments', element: <Experiments /> },
      { path: 'models', element: <Models /> },
      { path: 'deployments', element: <Deployments /> },
      { path: 'monitoring', element: <Monitoring /> },
      { path: 'settings', element: <Settings /> },
      { path: 'sql', element: <SQLEditor /> },
      { path: 'explain', element: <Explain /> },
      { path: 'evaluation', element: <ModelEvaluation /> },
      { path: 'ai', element: <AIAssistant /> },
      { path: 'projects', element: <Projects /> },
      {
        path: 'projects/:id',
        element: <ProjectWorkspace />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <ProjectOverview /> },
          { path: 'settings', element: <ProjectSettings /> },
          { path: 'datasets', element: <ProjectDatasets /> },
          { path: 'data', element: <Navigate to="datasets" replace /> },
          { path: 'data/datasets', element: <ProjectDatasets /> },
          { path: 'data/explorer', element: <Explorer /> },
          { path: 'data/sql', element: <SQLEditor /> },
          { path: 'data/profiling', element: <DataProfiling /> },
          { path: 'data/cleaning', element: <DataCleaning /> },
          { path: 'data/features', element: <FeatureEngineering /> },
          { path: 'ml', element: <Navigate to="automl" replace /> },
          { path: 'ml/automl', element: <AutoMLEngine /> },
          { path: 'ml/training', element: <Training /> },
          { path: 'ml/hpo', element: <HPO /> },
          { path: 'ml/experiments', element: <Experiments /> },
          { path: 'ml/leaderboard', element: <Leaderboard /> },
          { path: 'models', element: <Navigate to="registry" replace /> },
          { path: 'models/registry', element: <Models /> },
          { path: 'models/evaluation', element: <ModelEvaluation /> },
          { path: 'models/explain', element: <Explain /> },
          { path: 'models/comparison', element: <ModelComparison /> },
          { path: 'production', element: <Navigate to="deployment" replace /> },
          { path: 'production/deployment', element: <Deployments /> },
          { path: 'production/monitoring', element: <Monitoring /> },
          { path: 'production/batch', element: <BatchPrediction /> },
        ],
      },
      { path: 'explorer', element: <Explorer /> },
      { path: 'profiling', element: <DataProfiling /> },
      { path: 'cleaning', element: <DataCleaning /> },
      { path: 'feature-engineering', element: <FeatureEngineering /> },
      { path: 'pipelines', element: <Pipelines /> },
      { path: 'model-comparison', element: <ModelComparison /> },
      { path: 'prediction', element: <Prediction /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
