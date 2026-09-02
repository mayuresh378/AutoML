import { useParams, useNavigate } from 'react-router-dom';
import { Database, ExternalLink, Upload } from 'lucide-react';
import { useProject } from '../../../hooks/useApi';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { getErrorMessage } from '../../../services/http';
import styles from './ProjectDetailPage.module.css';

export default function ProjectDatasets() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const projectId = routeId || '';
  const base = `/app/projects/${projectId}`;

  const { data: project, isLoading, isError, error, refetch } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <ErrorState title="Failed to load project" message={getErrorMessage(error)} onRetry={refetch} />
    );
  }

  const datasets = (project as any).datasets || [];

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionTitle}>
        <h3>Project Datasets</h3>
        <div className="flex items-center gap-3">
          <button className={styles.sectionLink} onClick={() => navigate(`${base}/data/explorer`)}>Open Data Explorer <ExternalLink className="w-3 h-3 inline" /></button>
          <button className={styles.sectionLink} onClick={() => navigate('/app/datasets')}><Upload className="w-3 h-3 inline mr-1" />Upload</button>
        </div>
      </div>
      {datasets.length === 0 ? (
        <EmptyState
          icon={<Database className="w-8 h-8" />}
          title="No datasets linked"
          description="Upload a dataset or connect a data source to start working with data."
          action={{ label: 'Upload Dataset', onClick: () => navigate('/app/datasets') }}
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Rows</th>
              <th>Columns</th>
              <th>Size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((d: any) => (
              <tr key={d.name} className={styles.datasetRow} onClick={() => navigate(`${base}/data/explorer?dataset=${encodeURIComponent(d.name)}`)}>
                <td><span className={styles.tableName}><Database className="w-4 h-4 text-primary" />{d.name}</span></td>
                <td>{d.rows.toLocaleString()}</td>
                <td>{d.columns}</td>
                <td>{d.size_kb} KB</td>
                <td className="text-right"><ExternalLink className="w-3.5 h-3.5 inline text-zinc-500" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
