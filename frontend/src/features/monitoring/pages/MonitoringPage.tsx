import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useMonitoringDashboard } from '../../../hooks/useApi';
import type { MonitoringDashboard } from '../../../services/monitoring.service';
import { MonitoringHeader } from './components/MonitoringHeader';
import { MetricCards } from './components/MetricCards';
import { TrafficChart } from './components/TrafficChart';
import { LatencyChart } from './components/LatencyChart';
import { DriftPanel } from './components/DriftPanel';
import { SystemHealth } from './components/SystemHealth';
import { AlertsTable } from './components/AlertsTable';
import { ModelHealth } from './components/ModelHealth';
import styles from './MonitoringPage.module.css';

export default function MonitoringPage() {
  const [timeRange, setTimeRange] = useState('24h');
  const { data: dash, isLoading, refetch } = useMonitoringDashboard();

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <RefreshCw size={28} className={styles.spin} />
          <span>Loading monitoring data...</span>
        </div>
      </div>
    );
  }

  if (!dash) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <AlertTriangle size={28} />
          <span>Failed to load monitoring data</span>
        </div>
      </div>
    );
  }

  const d = dash as MonitoringDashboard;

  return (
    <div className={styles.page}>
      <MonitoringHeader
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onRefresh={handleRefresh}
      />

      <MetricCards
        predictions={d.predictions}
        latency={d.latency}
        cpu={d.cpu}
        cpuCores={d.cpu_cores}
        loadAvg={d.load_avg}
        ram={d.ram}
        ramTotalGb={d.ram_total_gb}
        ramUsedGb={d.ram_used_gb}
        traffic={d.traffic}
        errorRate={d.error_rate}
        successRate={d.success_rate}
      />

      <div className={styles.row7030}>
        <TrafficChart data={d.traffic.per_hour} />
        <LatencyChart histogram={d.latency.histogram} />
      </div>

      <DriftPanel
        modelDrift={d.model_drift}
        dataDrift={d.data_drift}
        driftTimeline={d.drift_timeline}
        confidenceDistribution={d.confidence_distribution}
        successRate={d.success_rate}
        errorRate={d.error_rate}
        latency={d.latency}
      />

      <SystemHealth
        cpu={d.cpu}
        cpuCores={d.cpu_cores}
        loadAvg={d.load_avg}
        ram={d.ram}
        ramTotalGb={d.ram_total_gb}
        ramUsedGb={d.ram_used_gb}
        disk={d.disk}
        diskFreeGb={d.disk_free_gb}
        alerts={d.alerts}
      />

      <AlertsTable alerts={d.alerts} />

      <ModelHealth logs={d.logs} />
    </div>
  );
}
