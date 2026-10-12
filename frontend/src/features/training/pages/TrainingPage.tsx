import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, History, PlayCircle } from 'lucide-react';
import { trainingService } from '../../../services/training.service';
import { datasetsService } from '../../../services/datasets.service';
import { TrainingWorkflow } from '../components/TrainingWorkflow';
import { TrainingHistoryDashboard } from '../components/TrainingHistoryDashboard';
import { fadeProps } from '../../../lib/animations';
import styles from './TrainingPage.module.css';

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<'workflow' | 'history'>('workflow');

  const { data: datasets = [], isLoading: loadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d) => d.datasets,
  });

  const { data: historyData } = useQuery({
    queryKey: ['trainingHistoryCount'],
    queryFn: () => trainingService.history({ limit: 1 }),
  });

  const historyCount = historyData?.total || 0;

  return (
    <div className={styles.page}>
      <motion.div {...fadeProps('up')}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Model Training</h1>
            <p className={styles.subtitle}>Configure AutoML workflows, run experiments, and track persistent training history</p>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'workflow' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('workflow')}
            >
              <PlayCircle className={styles.tabIcon} />
              <span>New Experiment</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History className={styles.tabIcon} />
              <span>Training History</span>
              {historyCount > 0 && <span className={styles.tabBadge}>{historyCount}</span>}
            </button>
          </div>
        </div>

        {activeTab === 'workflow' ? (
          loadingDatasets ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
            </div>
          ) : (
            <TrainingWorkflow datasets={datasets} />
          )
        ) : (
          <TrainingHistoryDashboard />
        )}
      </motion.div>
    </div>
  );
}
