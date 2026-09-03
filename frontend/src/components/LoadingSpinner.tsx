import styles from './LoadingSpinner.module.css';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  variant?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

function LoadingSpinner({ size = 'md', label, variant }: Props) {
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const isPremium = variant === 'premium';
  const isPulse = variant === 'pulse';

  return (
    <div className={`${styles.wrapper} ${styles[size]}`}>
      {isPulse ? (
        <span className="relative flex h-8 w-8">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-8 w-8 bg-sky-500"></span>
        </span>
      ) : (
        <svg className={`animate-spin ${sizeClass}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className={`opacity-75 ${isPremium ? 'text-primary' : ''}`} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
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
