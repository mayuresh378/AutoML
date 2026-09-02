import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { trainingService } from '../../../services/training.service';
import { datasetsService } from '../../../services/datasets.service';
import { TrainingWorkflow } from '../components/TrainingWorkflow';
import { fadeProps } from '../../../lib/animations';
import styles from './TrainingPage.module.css';

export default function TrainingPage() {
  const { data: datasets = [], isLoading: loadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d) => d.datasets,
  });

  return (
    <div className={styles.page}>
      <motion.div {...fadeProps('up')}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Model Training</h1>
            <p className={styles.subtitle}>Configure and run AutoML training workflows</p>
          </div>
        </div>

        {loadingDatasets ? (
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
          </div>
        ) : (
          <TrainingWorkflow datasets={datasets} />
        )}
      </motion.div>
    </div>
  );
}
