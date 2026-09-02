import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface Props {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'glass';
  padding?: 'sm' | 'md' | 'lg' | 'none';
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  hover,
  style,
  onClick,
}: Props) {
  return (
    <div
      className={`${styles.card} ${styles[variant]} ${styles[`pad-${padding}`]} ${hover ? styles.hover : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.header} ${className}`}>{children}</div>;
}

function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`${styles.title} ${className}`}>{children}</h3>;
}

function CardContent({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`${styles.content} ${className}`} style={style}>{children}</div>;
}

export { Card, CardHeader, CardTitle, CardContent };
export default Card;
