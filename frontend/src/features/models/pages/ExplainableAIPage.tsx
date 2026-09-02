import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { modelsService } from '../../../services/models.service';
import { Lightbulb, Brain } from 'lucide-react';
import { getErrorMessage } from '../../../services/http';

export default function ExplainableAIPage() {
  const [selectedModel, setSelectedModel] = useState('');

  const { data: models, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsService.list(),
    select: (d) => d.models?.filter((m: any) => m.status === 'ready'),
  });

  return (
    <PageContainer>
      <PageHeader title="Explainable AI" description="Understand how your models make predictions" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Model</CardTitle></CardHeader>
            <CardContent>
              <Select
                placeholder="Select a model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                options={(models || []).map((m: any) => ({ value: m.name, label: m.name }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {!selectedModel ? (
            <EmptyState icon={<Lightbulb className="w-8 h-8" />} title="Select a model" description="Choose a model to view feature importance and explanations" />
          ) : (
            <Card>
              <CardHeader><CardTitle>Feature Importance</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-500">Connect to the backend to see SHAP values and feature importance analysis.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
