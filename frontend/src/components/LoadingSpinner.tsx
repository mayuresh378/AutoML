import styles from './LoadingSpinner.module.css';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  variant?: string;
}

function LoadingSpinner({ size = 'md', label, variant }: Props) {
  return (
    <div className={`${styles.wrapper} ${styles[size]}`}>
      <div className={styles.spinner} />
      {label && <p className={styles.label}>{label}</p>}
    </div>
  );
}

interface PageLoaderProps {
  label?: string;
}

export function PageLoader({ label = 'Loading…' }: PageLoaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 200 }}>
      <LoadingSpinner size="lg" />
      {label && <p>{label}</p>}
    </div>
  );
}

export { LoadingSpinner };
export default LoadingSpinner;
