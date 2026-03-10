import { useState } from 'react';
import { BestTimeHeatmap } from '@/components/analytics/BestTimeHeatmap';
import { OptimalTimeSuggestions } from '@/components/analytics/OptimalTimeSuggestions';
import { EngagementChart } from '@/components/analytics/EngagementChart';
import { FollowerGrowthSummary } from '@/components/analytics/FollowerGrowthSummary';
import { FollowerGrowthChart } from '@/components/analytics/FollowerGrowthChart';
import { HashtagSuggestions } from '@/components/analytics/HashtagSuggestions';
import { HashtagPerformanceTable } from '@/components/analytics/HashtagPerformanceTable';
import { HashtagTrendChart } from '@/components/analytics/HashtagTrendChart';
import { TopPostsTable } from '@/components/analytics/TopPostsTable';
import { ExportReportButton } from '@/components/analytics/ExportReportButton';
import { ScheduledReportsPanel } from '@/components/analytics/ScheduledReportsPanel';

const PLATFORMS = [
  { id: 'all', name: 'All Platforms', icon: '📊' },
  { id: 'twitter', name: 'Twitter', icon: '🐦' },
  { id: 'facebook', name: 'Facebook', icon: '📘' },
  { id: 'instagram', name: 'Instagram', icon: '📷' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵' },
  { id: 'threads', name: 'Threads', icon: '@' },
  { id: 'bluesky', name: 'Bluesky', icon: '🦋' },
];

export function AnalyticsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);

  const platformForAPI = selectedPlatform === 'all' ? undefined : selectedPlatform;

  const handleHashtagClick = (hashtag: string) => {
    setSelectedHashtag(hashtag);
  };

  const handleCloseHashtagTrend = () => {
    setSelectedHashtag(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-gray-600">
            Discover your optimal posting times and track engagement performance
          </p>
        </div>
        <ExportReportButton />
      </div>

      {/* Platform Filter */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selectedPlatform === platform.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{platform.icon}</span>
                {platform.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="space-y-12">
        {/* Section 1: Hashtag Performance */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Hashtag Performance</h2>
            <p className="mt-2 text-gray-600">
              Discover which hashtags drive the most engagement
            </p>
          </div>
          
          <div className="space-y-6">
            <HashtagSuggestions />
            <HashtagPerformanceTable onHashtagClick={handleHashtagClick} />
            
            {/* Hashtag Trend Modal/Panel */}
            {selectedHashtag && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <HashtagTrendChart 
                    hashtag={selectedHashtag} 
                    onClose={handleCloseHashtagTrend}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Follower Growth */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Follower Growth</h2>
            <p className="mt-2 text-gray-600">
              Track your follower growth across all platforms
            </p>
          </div>
          
          <div className="space-y-6">
            <FollowerGrowthSummary dateRange="30d" />
            <FollowerGrowthChart />
          </div>
        </section>

        {/* Section 3: Best Times to Post */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Best Times to Post</h2>
            <p className="mt-2 text-gray-600">
              Heatmap showing when your posts get the most engagement
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <BestTimeHeatmap platform={platformForAPI} />
          </div>
        </section>

        {/* Section 4: AI Suggestions */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">AI Suggestions</h2>
            <p className="mt-2 text-gray-600">
              Personalized recommendations for optimal posting times
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <OptimalTimeSuggestions selectedPlatform={platformForAPI} />
          </div>
        </section>

        {/* Section 5: Engagement Trends */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Engagement Trends</h2>
            <p className="mt-2 text-gray-600">
              Track your engagement rate over time
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <EngagementChart selectedPlatform={platformForAPI} />
          </div>
        </section>

        {/* Section 6: Post Performance */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Post Performance</h2>
            <p className="mt-2 text-gray-600">
              Analyze individual post performance and ROI
            </p>
          </div>
          
          <TopPostsTable />
        </section>

        {/* Section 7: Scheduled Reports */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Scheduled Reports</h2>
            <p className="mt-2 text-gray-600">
              Set up automated analytics reports delivered to your inbox
            </p>
          </div>
          
          <ScheduledReportsPanel />
        </section>
      </div>
    </div>
  );
}