import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Zap } from 'lucide-react';

export default function AutomationsPage() {
  return (
    <PageContainer>
      <PageHeader title="Automations" description="Automate repetitive ML tasks" />
      <Card>
        <CardContent>
          <EmptyState
            icon={<Zap className="w-8 h-8" />}
            title="No automations yet"
            description="Create automated workflows to handle repetitive ML tasks like scheduled retraining, data drift detection, and model deployment."
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
