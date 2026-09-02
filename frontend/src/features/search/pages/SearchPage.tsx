import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search as SearchIcon, Users, FolderKanban, Database, Brain, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchService } from '../../../services/search.service';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useDebounce } from '../../../hooks/useDebounce';
import { getErrorMessage } from '../../../services/http';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <PageContainer maxWidth="lg">
      <PageHeader title="Search" description="Search across all resources" />

      <div className="mb-8">
        <Input
          placeholder="Search projects, datasets, models..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<SearchIcon className="w-5 h-5" />}
          size={undefined}
          className="text-lg py-3"
          autoFocus
        />
      </div>

      {!debouncedQuery || debouncedQuery.length < 2 ? (
        <EmptyState icon={<SearchIcon className="w-8 h-8" />} title="Enter a search term" description="Search across projects, datasets, models, and users" />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : isError ? (
        <ErrorState title="Search failed" message={getErrorMessage(error)} onRetry={refetch} />
      ) : !results || (!results.projects?.length && !results.datasets?.length && !results.models?.length && !results.users?.length) ? (
        <EmptyState title="No results found" description={`No results for "${debouncedQuery}". Try a different term.`} />
      ) : (
        <div className="space-y-6">
          {results.projects?.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2"><FolderKanban className="w-4 h-4" /> Projects ({results.projects.length})</h2>
              <div className="space-y-2">
                {results.projects.map((p: any) => (
                  <Card key={p.id} hover padding="sm" className="cursor-pointer" onClick={() => navigate(`/app/projects/${p.id}`)}>
                    <div className="flex items-center gap-3">
                      <FolderKanban className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">{p.name}</p>
                        {p.description && <p className="text-xs text-zinc-500 truncate">{p.description}</p>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {results.datasets?.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2"><Database className="w-4 h-4" /> Datasets ({results.datasets.length})</h2>
              <div className="space-y-2">
                {results.datasets.map((d: any) => (
                  <Card key={d.id} hover padding="sm" className="cursor-pointer" onClick={() => navigate('/app/explorer')}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">{d.filename || d.name}</p>
                        <p className="text-xs text-zinc-500">{d.rows} rows · {d.columns} columns</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {results.models?.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2"><Brain className="w-4 h-4" /> Models ({results.models.length})</h2>
              <div className="space-y-2">
                {results.models.map((m: any) => (
                  <Card key={m.id || m.name} hover padding="sm" className="cursor-pointer" onClick={() => navigate('/app/models')}>
                    <div className="flex items-center gap-3">
                      <Brain className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">{m.name}</p>
                        <p className="text-xs text-zinc-500">{m.algorithm} · v{m.version}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {results.users?.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Users ({results.users.length})</h2>
              <div className="space-y-2">
                {results.users.map((u: any) => (
                  <Card key={u.id} padding="sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-200">{u.name}</p>
                        <p className="text-xs text-zinc-500">{u.email}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}
