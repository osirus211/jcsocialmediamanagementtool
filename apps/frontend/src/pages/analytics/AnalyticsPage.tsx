import { useState } from 'react';
import { BestTimeHeatmap } from '@/components/analytics/BestTimeHeatmap';
import { OptimalTimeSuggestions } from '@/components/analytics/OptimalTimeSuggestions';
import { EngagementChart } from '@/components/analytics/EngagementChart';

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

  const platformForAPI = selectedPlatform === 'all' ? undefined : selectedPlatform;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-2 text-gray-600">
          Discover your optimal posting times and track engagement performance
        </p>
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
        {/* Section 1: Best Times to Post */}
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

        {/* Section 2: AI Suggestions */}
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

        {/* Section 3: Engagement Trends */}
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
      </div>
    </div>
  );
}