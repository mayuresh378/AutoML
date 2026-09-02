import { type InputHTMLAttributes, forwardRef, type ReactNode } from 'react';
import styles from './Input.module.css';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, hint, helperText, className = '', id, icon, iconRight, ...rest }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={styles.field}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {icon && <span style={{ position: 'absolute', left: 10, color: 'var(--color-text-tertiary)', display: 'flex' }}>{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={`${styles.input} ${error ? styles.hasError : ''} ${icon ? 'pl-9' : ''} ${className}`}
            style={icon ? { paddingLeft: 36 } : undefined}
            {...rest}
          />
          {iconRight && <span style={{ position: 'absolute', right: 10, color: 'var(--color-text-tertiary)', display: 'flex' }}>{iconRight}</span>}
        </div>
        {error && <span className={styles.error}>{error}</span>}
        {!error && hint && <span className={styles.hint}>{hint}</span>}
        {!error && !hint && helperText && <span className={styles.hint}>{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;
