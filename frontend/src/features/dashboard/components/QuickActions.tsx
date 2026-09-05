import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Upload, FlaskConical, Play, Rocket } from 'lucide-react';

interface QuickActionsProps {
  onNewExperiment: () => void;
}

const ACTION_CLASSES = [
  'hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]',
  'hover:border-indigo-500/30 hover:bg-indigo-500/[0.06]',
  'hover:border-emerald-500/30 hover:bg-emerald-500/[0.06]',
  'hover:border-amber-500/30 hover:bg-amber-500/[0.06]',
];

export default function QuickActions({ onNewExperiment }: QuickActionsProps) {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Upload Dataset',
      description: 'Add a CSV to your workspace',
      icon: Upload,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      onClick: () => navigate('/app/datasets'),
    },
    {
      label: 'New Experiment',
      description: 'Configure an AutoML run',
      icon: FlaskConical,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      onClick: onNewExperiment,
    },
    {
      label: 'Start Training',
      description: 'Launch a training job',
      icon: Play,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      onClick: () => navigate('/app/training'),
    },
    {
      label: 'Deploy Model',
      description: 'Ship a model to production',
      icon: Rocket,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      onClick: () => navigate('/app/deployments'),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.label}
            onClick={action.onClick}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 transition-colors text-left cursor-pointer ${ACTION_CLASSES[i % ACTION_CLASSES.length]}`}
          >
            <div className={`p-2 rounded-lg border ${action.bg} shrink-0`}>
              <Icon className={`w-4 h-4 ${action.color}`} />
            </div>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-100 truncate">{action.label}</span>
              <span className="block text-xs text-zinc-500 truncate">{action.description}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}