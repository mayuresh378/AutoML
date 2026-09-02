import { Upload, Cpu, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUIStore } from '../store/useUIStore';
import { Button } from '../components/ui/Button';
import { staggerContainer, staggerItem } from '../lib/animations';

const ACTIONS = [
  { icon: Upload, label: 'Upload dataset', page: 'Datasets', primary: true },
  { icon: Cpu, label: 'New training run', page: 'Training', primary: false },
  { icon: Rocket, label: 'Deploy a model', page: 'Deployment', primary: false },
];

export function QuickActions() {
  const setActivePage = useUIStore((s) => s.setActivePage);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap items-center gap-2.5"
    >
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <motion.div key={action.label} variants={staggerItem}>
            <Button
              variant={action.primary ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActivePage(action.page)}
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
