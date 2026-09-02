import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingBag, Download, Star, Search, Filter } from 'lucide-react';
import { marketplaceService } from '../../../services/marketplace.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { useNotification } from '../../../hooks/useNotification';
import { staggerContainer, staggerItem } from '../../../lib/animations';
import { formatNumber } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';

const categories = [
  { id: 'all', label: 'All' },
  { id: 'model', label: 'Models' },
  { id: 'pipeline', label: 'Pipelines' },
  { id: 'dataset', label: 'Datasets' },
  { id: 'notebook', label: 'Notebooks' },
  { id: 'tool', label: 'Tools' },
];

export default function MarketplacePage() {
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const { data: items, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['marketplace', category],
    queryFn: () => marketplaceService.list(category === 'all' ? undefined : category),
    select: (d) => d.items,
  });

  const installMutation = useMutation({
    mutationFn: (itemId: string) => marketplaceService.install(itemId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marketplace'] }); notifySuccess('Item installed'); },
    onError: (err) => notifyError('Failed to install', getErrorMessage(err)),
  });

  const filtered = (items || []).filter((item: any) =>
    item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer>
      <PageHeader title="Marketplace" description="Discover models, pipelines, and tools">
        <Input placeholder="Search marketplace..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-4 h-4" />} className="w-64" />
      </PageHeader>

      <Tabs tabs={categories} activeTab={category} onChange={setCategory} variant="pills" className="mb-6" />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : isError ? (
        <ErrorState title="Failed to load marketplace" message={getErrorMessage(error)} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="w-8 h-8" />} title={search ? 'No items match your search' : 'No items available'} description={search ? 'Try a different search term' : 'Check back later for new additions'} />
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item: any) => (
            <motion.div key={item.id} variants={staggerItem}>
              <Card hover padding="md" className="h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="default" size="sm">{item.category}</Badge>
                  {item.installed ? <Badge variant="success" size="sm">Installed</Badge> : null}
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">{item.name}</h3>
                <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{item.description}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
                  <span>v{item.version}</span>
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> {item.rating.toFixed(1)}</span>
                  <span>{formatNumber(item.downloads)} downloads</span>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-xs text-zinc-500">by {item.author}</span>
                  <Button
                    size="sm"
                    variant={item.installed ? 'secondary' : 'primary'}
                    onClick={() => !item.installed && installMutation.mutate(item.id)}
                    disabled={item.installed}
                    loading={installMutation.isPending && installMutation.variables === item.id}
                    icon={item.installed ? undefined : <Download className="w-3 h-3" />}
                  >
                    {item.installed ? 'Installed' : 'Install'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageContainer>
  );
}
