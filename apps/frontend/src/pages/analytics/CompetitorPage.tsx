import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Users } from 'lucide-react';
import { CompetitorAccount, competitorService } from '@/services/competitor.service';
import { CompetitorCard } from '@/components/analytics/CompetitorCard';
import { CompetitorBenchmarkChart } from '@/components/analytics/CompetitorBenchmarkChart';
import { CompetitorGrowthChart } from '@/components/analytics/CompetitorGrowthChart';
import { AddCompetitorModal } from '@/components/analytics/AddCompetitorModal';

export function CompetitorPage() {
  const [competitors, setCompetitors] = useState<CompetitorAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompetitors();
  }, []);

  const loadCompetitors = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await competitorService.getCompetitors();
      setCompetitors(data.filter(c => c.isActive));
    } catch (err) {
      console.error('Failed to load competitors:', err);
      setError('Failed to load competitors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await loadCompetitors();
    } catch (err) {
      console.error('Failed to refresh competitors:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRemoveCompetitor = async (id: string) => {
    try {
      await competitorService.removeCompetitor(id);
      setCompetitors(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      console.error('Failed to remove competitor:', err);
      setError('Failed to remove competitor');
    }
  };

  const handleViewDetails = (competitor: CompetitorAccount) => {
    // TODO: Open competitor details modal or navigate to details page
    console.log('View details for:', competitor);
  };

  const handleAddSuccess = () => {
    loadCompetitors();
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
            </div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          
          <div className="space-y-8">
            <div className="h-96 bg-gray-200 rounded-lg"></div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Competitor Benchmarking</h1>
          <p className="mt-2 text-gray-600">
            Track and compare your performance against competitors
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Competitor
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      {/* Empty State */}
      {competitors.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-6">
            <Users className="h-full w-full" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">Track your competitors</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Add competitors to see how you stack up against them. Track their follower growth, 
            engagement rates, and other key metrics.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Your First Competitor
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Competitor Cards */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Competitors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {competitors.map((competitor) => (
                <CompetitorCard
                  key={competitor._id}
                  competitor={competitor}
                  onRemove={handleRemoveCompetitor}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          </section>

          {/* Benchmark Comparison */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Benchmark Comparison</h2>
            <CompetitorBenchmarkChart competitors={competitors} />
          </section>

          {/* Follower Growth */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Follower Growth</h2>
            <CompetitorGrowthChart competitors={competitors} />
          </section>
        </div>
      )}

      {/* Add Competitor Modal */}
      <AddCompetitorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}