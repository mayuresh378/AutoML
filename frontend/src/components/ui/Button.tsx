import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'premium';
  size?: 'sm' | 'md' | 'lg' | 'none';
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  className = '',
  icon,
  iconRight,
  ...rest
}: Props) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${size !== 'none' ? styles[size] : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.loader} /> : <>{icon}{children}{iconRight}</>}
    </button>
  );
}

export { Button };
export default Button;
