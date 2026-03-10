import React from 'react';
import { X, Plus, Minus, BarChart3, TrendingUp, Hash, FileText, Clock, PieChart, Activity, Target, Lightbulb, List } from 'lucide-react';
import { Widget, WidgetType, WidgetDefinition } from '@/types/dashboard.types';

interface AddWidgetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: Widget[];
  onToggleWidget: (type: WidgetType, isVisible: boolean) => void;
}

const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: WidgetType.ENGAGEMENT_CHART,
    title: 'Engagement Trends',
    description: 'Track engagement rate over time',
    icon: '📈',
    defaultSize: 'medium',
    supportedSizes: ['medium', 'large'],
  },
  {
    type: WidgetType.FOLLOWER_GROWTH,
    title: 'Follower Growth',
    description: 'Monitor follower growth across platforms',
    icon: '👥',
    defaultSize: 'medium',
    supportedSizes: ['medium', 'large'],
  },
  {
    type: WidgetType.HASHTAG_TABLE,
    title: 'Hashtag Performance',
    description: 'Analyze hashtag effectiveness',
    icon: '#️⃣',
    defaultSize: 'large',
    supportedSizes: ['medium', 'large'],
  },
  {
    type: WidgetType.TOP_POSTS,
    title: 'Top Posts',
    description: 'View your best performing posts',
    icon: '🏆',
    defaultSize: 'large',
    supportedSizes: ['medium', 'large'],
  },
  {
    type: WidgetType.BEST_TIME_HEATMAP,
    title: 'Best Times to Post',
    description: 'Heatmap of optimal posting times',
    icon: '🕐',
    defaultSize: 'medium',
    supportedSizes: ['medium', 'large'],
  },
  {
    type: WidgetType.PLATFORM_BREAKDOWN,
    title: 'Platform Breakdown',
    description: 'Performance comparison by platform',
    icon: '📊',
    defaultSize: 'medium',
    supportedSizes: ['small', 'medium', 'large'],
  },
  {
    type: WidgetType.KPI_OVERVIEW,
    title: 'KPI Overview',
    description: 'Key performance indicators at a glance',
    icon: '📋',
    defaultSize: 'large',
    supportedSizes: ['medium', 'large'],
  },
  {
    type: WidgetType.HASHTAG_SUGGESTIONS,
    title: 'Hashtag Suggestions',
    description: 'AI-powered hashtag recommendations',
    icon: '💡',
    defaultSize: 'small',
    supportedSizes: ['small', 'medium'],
  },
  {
    type: WidgetType.OPTIMAL_TIMING,
    title: 'AI Timing Suggestions',
    description: 'Smart recommendations for posting times',
    icon: '🎯',
    defaultSize: 'medium',
    supportedSizes: ['medium', 'large'],
  },
  {
    type: WidgetType.RECENT_POSTS,
    title: 'Recent Posts',
    description: 'Latest posts and their performance',
    icon: '📝',
    defaultSize: 'medium',
    supportedSizes: ['medium', 'large'],
  },
];

export function AddWidgetPanel({ isOpen, onClose, widgets, onToggleWidget }: AddWidgetPanelProps) {
  if (!isOpen) return null;

  const getWidgetVisibility = (type: WidgetType) => {
    const widget = widgets.find(w => w.type === type);
    return widget?.isVisible ?? false;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Customize Dashboard</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {WIDGET_DEFINITIONS.map((definition) => {
                const isVisible = getWidgetVisibility(definition.type);
                
                return (
                  <div
                    key={definition.type}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{definition.icon}</span>
                          <div>
                            <h3 className="font-medium text-gray-900">{definition.title}</h3>
                            <p className="text-sm text-gray-600">{definition.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>Sizes:</span>
                          {definition.supportedSizes.map((size, index) => (
                            <span key={size}>
                              {size}
                              {index < definition.supportedSizes.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => onToggleWidget(definition.type, !isVisible)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isVisible
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        {isVisible ? (
                          <>
                            <Minus className="h-4 w-4" />
                            Remove
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Add
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}