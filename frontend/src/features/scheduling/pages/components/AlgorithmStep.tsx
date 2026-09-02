import { Check, Star, Sparkles, TreePine, Zap, Sigma, Target, Fingerprint, Brain, CircleDot, Grid3x3, Layers, Boxes } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionCard } from './SectionCard';
import styles from './AlgorithmStep.module.css';

interface AlgoMeta {
  icon: LucideIcon;
  accuracy: number;
  speed: number;
  memory: 'Low' | 'Medium' | 'High';
  recommended?: boolean;
  desc: string;
}

function iconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes('random') || n.includes('decision') || n.includes('tree')) return TreePine;
  if (n.includes('xgb') || n.includes('lgbm') || n.includes('catboost') || n.includes('gradient') || n.includes('adaboost')) return Zap;
  if (n.includes('logistic') || n.includes('ridge') || n.includes('lasso') || n.includes('linear')) return Sigma;
  if (n.includes('svc') || n.includes('svr') || n.includes('svm')) return Target;
  if (n.includes('knn') || n.includes('nearest')) return Fingerprint;
  if (n.includes('naive') || n.includes('bayes') || n.includes('gaussian') || n.includes('mixture')) return Brain;
  if (n.includes('kmeans')) return CircleDot;
  if (n.includes('dbscan')) return Grid3x3;
  if (n.includes('agglomerative') || n.includes('spectral') || n.includes('hierarchical')) return Layers;
  return Boxes;
}

function getMeta(name: string): AlgoMeta {
  const icon = iconFor(name);
  const n = name.toLowerCase();
  let accuracy = 3, speed = 3;
  let memory: AlgoMeta['memory'] = 'Medium';
  let desc = 'Machine learning algorithm';

  if (n.includes('random') || n.includes('forest')) { accuracy = 4; speed = 4; memory = 'Medium'; desc = 'Ensemble of decision trees'; }
  if (n.includes('xgb')) { accuracy = 5; speed = 4; memory = 'Medium'; desc = 'Extreme gradient boosting'; }
  if (n.includes('lgbm')) { accuracy = 5; speed = 5; memory = 'Low'; desc = 'Fast gradient boosting'; }
  if (n.includes('catboost')) { accuracy = 5; speed = 3; memory = 'Medium'; desc = 'Handles categorical features'; }
  if (n.includes('logistic')) { accuracy = 3; speed = 5; memory = 'Low'; desc = 'Linear baseline model'; }
  if (n.includes('gradient')) { accuracy = 4; speed = 3; memory = 'Medium'; desc = 'Sequential boosting'; }
  if (n.includes('svc') || n.includes('svr')) { accuracy = 3; speed = 3; memory = 'Medium'; desc = 'Support vector model'; }
  if (n.includes('decision')) { accuracy = 3; speed = 5; memory = 'Low'; desc = 'Rule-based tree'; }
  if (n.includes('knn') || n.includes('nearest')) { accuracy = 3; speed = 3; memory = 'High'; desc = 'Instance-based'; }
  if (n.includes('naive') || n.includes('bayes')) { accuracy = 3; speed = 5; memory = 'Low'; desc = 'Probabilistic classifier'; }
  if (n.includes('ridge')) { accuracy = 3; speed = 5; memory = 'Low'; desc = 'L2-regularized linear'; }
  if (n.includes('lasso')) { accuracy = 3; speed = 5; memory = 'Low'; desc = 'L1-regularized linear'; }
  if (n.includes('kmeans')) { accuracy = 4; speed = 5; memory = 'Low'; desc = 'Centroid-based clustering'; }
  if (n.includes('dbscan')) { accuracy = 3; speed = 4; memory = 'Medium'; desc = 'Density-based clustering'; }
  if (n.includes('agglomerative')) { accuracy = 3; speed = 3; memory = 'Medium'; desc = 'Hierarchical clustering'; }
  if (n.includes('spectral')) { accuracy = 3; speed = 2; memory = 'High'; desc = 'Graph-based clustering'; }
  if (n.includes('mixture')) { accuracy = 3; speed = 3; memory = 'Medium'; desc = 'Probabilistic clustering'; }
  if (n.includes('linear')) { accuracy = 3; speed = 5; memory = 'Low'; desc = 'Linear regression'; }

  const recommended = n.includes('random') || n.includes('xgb') || n.includes('catboost');
  return { icon, accuracy, speed, memory, recommended, desc };
}

function Stars({ value }: { value: number }) {
  return (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={11} className={i <= value ? styles.starOn : styles.starOff} fill={i <= value ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

interface Props {
  algorithms: string[];
  selected: string[];
  onToggle: (algo: string) => void;
}

export function AlgorithmStep({ algorithms, selected, onToggle }: Props) {
  const recommended = algorithms.filter(a => getMeta(a).recommended);

  const applyRecommended = () => {
    recommended.forEach(a => { if (!selected.includes(a)) onToggle(a); });
  };

  return (
    <SectionCard number={4} title="Algorithms" subtitle={`Select models to train (${selected.length}/${algorithms.length} selected)`}
      action={
        <button className={styles.selBtn} onClick={applyRecommended} disabled={recommended.length === 0}>
          Apply recommended
        </button>
      }
    >
      {recommended.length > 0 && (
        <div className={styles.aiBar}>
          <span className={styles.aiIcon}><Sparkles size={13} /></span>
          <span className={styles.aiText}>
            AI Recommendation: <b>{recommended.join(', ')}</b> — based on your dataset
          </span>
        </div>
      )}

      {algorithms.length === 0 && (
        <p className={styles.empty}>Select a task and dataset to see available algorithms.</p>
      )}

      <div className={styles.grid}>
        {algorithms.map(name => {
          const meta = getMeta(name);
          const on = selected.includes(name);
          const Icon = meta.icon;
          return (
            <button
              key={name}
              className={`${styles.card} ${on ? styles.on : ''}`}
              onClick={() => onToggle(name)}
            >
              <div className={styles.cardTop}>
                <span className={styles.iconWrap}>
                  <Icon size={18} />
                </span>
                {meta.recommended && <span className={styles.badge}>Recommended</span>}
                <span className={`${styles.check} ${on ? styles.checkOn : ''}`}>
                  {on && <Check size={12} />}
                </span>
              </div>
              <span className={styles.name}>{name}</span>
              <span className={styles.desc}>{meta.desc}</span>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Accuracy</span>
                <Stars value={meta.accuracy} />
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Speed</span>
                <Stars value={meta.speed} />
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Memory</span>
                <span className={styles.memory}>{meta.memory}</span>
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
