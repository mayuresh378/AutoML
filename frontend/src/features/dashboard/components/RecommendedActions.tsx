import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, CheckCircle2, AlertTriangle, Rocket, ArrowRight, Lightbulb } from 'lucide-react';

interface Recommendation {
  id: string;
  type: 'success' | 'warning' | 'deploy' | 'info';
  title: string;
  subtitle: string;
  actionText: string;
  targetRoute: string;
}

interface Props {
  experiments?: any[];
  datasets?: any[];
  models?: any[];
  aiSuggestions?: any[];
}

export default function RecommendedActions({ experiments = [], datasets = [], models = [], aiSuggestions = [] }: Props) {
  const navigate = useNavigate();

  const recommendations: Recommendation[] = [];

  const recentCompleted = experiments
    ? [...experiments].filter((e: any) => e.status === 'completed' || e.status === 'success')
        .sort((a: any, b: any) => new Date(b.created_at || b.run_at || 0).getTime() - new Date(a.created_at || a.run_at || 0).getTime())
    : [];
  if (recentCompleted.length > 0) {
    const top = recentCompleted[0];
    const score = top.cv_score != null && top.cv_score > 0 ? (top.cv_score * 100).toFixed(1) : null;
    recommendations.push({
      id: 'latest-exp',
      type: 'success',
      title: (top.name || top.experiment_name || 'Experiment') + ' completed',
      subtitle: `${top.model || 'Model'}${score ? ` — ${score}% score` : ''}`,
      actionText: 'View Results',
      targetRoute: '/app/experiments',
    });
  } else if (aiSuggestions && aiSuggestions.length > 0) {
    recommendations.push({
      id: 'ai-reco-1',
      type: 'info',
      title: aiSuggestions[0].title || 'AutoML insight',
      subtitle: aiSuggestions[0].message || aiSuggestions[0].body || '',
      actionText: 'View Insights',
      targetRoute: '/app/explain',
    });
  }

  const readyModels = models
    ? models.filter((m: any) => m.status === 'ready' || m.status === 'production' || m.status === 'registered')
    : [];
  if (readyModels.length > 0) {
    const best = readyModels[0];
    recommendations.push({
      id: 'deploy-model',
      type: 'deploy',
      title: 'Model ready for deployment',
      subtitle: `${best.name || best.model || 'Model'} — ready to deploy`,
      actionText: 'Deploy Model',
      targetRoute: '/app/deployments',
    });
  }

  const attentionDatasets = datasets
    ? datasets.filter((d: any) => d.status === 'error')
    : [];
  if (attentionDatasets.length > 0) {
    const d = attentionDatasets[0];
    recommendations.push({
      id: 'dataset-fix',
      type: 'warning',
      title: `Dataset "${d.name || d.filename || 'unknown'}"`,
      subtitle: 'Dataset is in error state and needs attention',
      actionText: 'Fix Dataset',
      targetRoute: '/app/cleaning',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'start',
      type: 'info',
      title: 'Start your first experiment',
      subtitle: 'Upload a dataset and train your first AutoML model',
      actionText: 'New Experiment',
      targetRoute: '/app/datasets',
    });
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-zinc-200 tracking-tight uppercase">Recommended Actions</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recommendations.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -3 }}
            className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                {rec.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                {rec.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                {rec.type === 'deploy' && <Rocket className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                {rec.type === 'info' && <Lightbulb className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                <h4 className="text-xs font-semibold text-zinc-100 truncate">{rec.title}</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4 line-clamp-3">{rec.subtitle}</p>
            </div>

            <button
              onClick={() => navigate(rec.targetRoute)}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                rec.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20'
                  : rec.type === 'warning'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
                  : rec.type === 'deploy'
                  ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20'
                  : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20'
              }`}
            >
              <span>{rec.actionText}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
