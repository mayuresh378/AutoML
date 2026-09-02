import { useNavigate } from 'react-router-dom';
import styles from './NotFound.module.css';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.desc}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => navigate(-1)}>
          Go back
        </button>
        <button
          className={`${styles.btn} ${styles.primary}`}
          onClick={() => navigate('/app/dashboard')}
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}
