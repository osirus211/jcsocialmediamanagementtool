import React, { useState, useEffect } from 'react';
import { 
  Hash, 
  Search, 
  TrendingUp, 
  Clock, 
  Users, 
  AlertTriangle,
  CheckCircle,
  Filter,
  Star,
  BarChart3,
  Target,
  Zap,
  Sparkles,
  Loader2
} from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import HashtagGroupsPanel from './HashtagGroupsPanel';
import HashtagCounter from './HashtagCounter';

interface HashtagData {
  hashtag: string;
  postCount: number;
  engagementRate: number;
  difficulty: 'easy' | 'medium' | 'hard';
  difficultyScore: number;
  isBanned: boolean;
  banReason?: string;
  alternatives?: string[];
  category: 'suggested' | 'trending' | 'related' | 'recent';
  relevanceScore?: number;
}

interface EnhancedHashtagPanelProps {
  selectedPlatform: string;
  currentHashtags: string[];
  onHashtagsAdd: (hashtags: string[]) => void;
  onHashtagsReplace: (hashtags: string[]) => void;
  content: string;
}

const EnhancedHashtagPanel: React.FC<EnhancedHashtagPanelProps> = ({
  selectedPlatform,
  currentHashtags,
  onHashtagsAdd,
  onHashtagsReplace,
  content
}) => {
  const { workspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'suggested' | 'trending' | 'groups' | 'recent' | 'competitor'>('suggested');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Hashtag data
  const [suggestedHashtags, setSuggestedHashtags] = useState<HashtagData[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<HashtagData[]>([]);
  const [relatedHashtags, setRelatedHashtags] = useState<HashtagData[]>([]);
  const [recentHashtags, setRecentHashtags] = useState<HashtagData[]>([]);
  const [competitorHashtags] = useState<HashtagData[]>([]);
  
  // Selection state
  const [selectedHashtags, setSelectedHashtags] = useState<Set<string>>(new Set());

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [showOnlySafe, setShowOnlySafe] = useState(true);

  useEffect(() => {
    if (content && activeTab === 'suggested') {
      generateSuggestedHashtags();
    }
  }, [content, selectedPlatform]);

  useEffect(() => {
    if (activeTab === 'trending') {
      fetchTrendingHashtags();
    } else if (activeTab === 'recent') {
      fetchRecentHashtags();
    }
  }, [activeTab, selectedPlatform]);

  const generateSuggestedHashtags = async () => {
    if (!content.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Generate AI hashtags
      const aiResponse = await fetch('/api/v1/ai/generate-hashtags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': workspace!._id
        },
        body: JSON.stringify({
          content,
          platform: selectedPlatform
        })
      });

      if (!aiResponse.ok) throw new Error('Failed to generate hashtags');
      const aiData = await aiResponse.json();

      // Check hashtag safety and difficulty
      const hashtagsToCheck = aiData.data.hashtags;
      
      const [safetyResponse, difficultyResponse] = await Promise.all([
        fetch('/api/v1/hashtag-checker/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            hashtags: hashtagsToCheck,
            platform: selectedPlatform
          })
        }),
        fetch('/api/v1/hashtag-difficulty/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            hashtags: hashtagsToCheck,
            platform: selectedPlatform
          })
        })
      ]);

      const safetyData = await safetyResponse.json();
      const difficultyData = await difficultyResponse.json();

      // Combine data
      const enhancedHashtags: HashtagData[] = hashtagsToCheck.map((hashtag: string) => {
        const safetyInfo = safetyData.data.results.find((r: any) => r.hashtag === hashtag);
        const difficultyInfo = difficultyData.data.hashtags.find((h: any) => h.hashtag === hashtag);

        return {
          hashtag,
          postCount: difficultyInfo?.postCount || 0,
          engagementRate: difficultyInfo?.engagementRate || 0,
          difficulty: difficultyInfo?.difficulty || 'medium',
          difficultyScore: difficultyInfo?.score || 50,
          isBanned: safetyInfo?.isBanned || false,
          banReason: safetyInfo?.info?.reason,
          alternatives: safetyInfo?.info?.alternatives || [],
          category: 'suggested',
          relevanceScore: Math.floor(Math.random() * 30) + 70 // Mock relevance score
        };
      });

      setSuggestedHashtags(enhancedHashtags);

      // Get related hashtags for the first few suggested ones
      if (enhancedHashtags.length > 0) {
        fetchRelatedHashtags(enhancedHashtags.slice(0, 3).map(h => h.hashtag));
      }

    } catch (error) {
      console.error('Error generating hashtags:', error);
      setError('Failed to generate hashtags');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingHashtags = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/trending-hashtags?platform=${selectedPlatform}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch trending hashtags');
      const data = await response.json();

      const trendingData: HashtagData[] = data.data.hashtags.map((h: any) => ({
        hashtag: h.hashtag,
        postCount: h.postCount,
        engagementRate: h.engagementRate,
        difficulty: h.trendScore > 80 ? 'hard' : h.trendScore > 50 ? 'medium' : 'easy',
        difficultyScore: h.trendScore,
        isBanned: false,
        category: 'trending' as const,
        relevanceScore: h.trendScore
      }));

      setTrendingHashtags(trendingData);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      setError('Failed to fetch trending hashtags');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedHashtags = async (baseHashtags: string[]) => {
    try {
      const response = await fetch('/api/v1/related-hashtags/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          hashtags: baseHashtags,
          platform: selectedPlatform
        })
      });

      if (!response.ok) throw new Error('Failed to fetch related hashtags');
      const data = await response.json();

      const relatedData: HashtagData[] = data.data.combinedSuggestions.map((h: any) => ({
        hashtag: h.hashtag,
        postCount: h.postCount,
        engagementRate: h.engagementRate,
        difficulty: h.relevanceScore > 80 ? 'easy' : h.relevanceScore > 60 ? 'medium' : 'hard',
        difficultyScore: 100 - h.relevanceScore,
        isBanned: false,
        category: 'related' as const,
        relevanceScore: h.relevanceScore
      }));

      setRelatedHashtags(relatedData);
    } catch (error) {
      console.error('Error fetching related hashtags:', error);
    }
  };

  const fetchRecentHashtags = async () => {
    if (!workspace) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/v1/hashtag-history/recent?platform=${selectedPlatform}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': workspace._id
        }
      });

      if (!response.ok) throw new Error('Failed to fetch recent hashtags');
      const data = await response.json();

      const recentData: HashtagData[] = data.data.map((h: any) => ({
        hashtag: h.hashtag,
        postCount: 0,
        engagementRate: 0,
        difficulty: h.frequency === 'high' ? 'easy' : h.frequency === 'medium' ? 'medium' : 'hard',
        difficultyScore: h.frequency === 'high' ? 30 : h.frequency === 'medium' ? 50 : 70,
        isBanned: false,
        category: 'recent' as const,
        relevanceScore: h.usageCount * 10
      }));

      setRecentHashtags(recentData);
    } catch (error) {
      console.error('Error fetching recent hashtags:', error);
      setError('Failed to fetch recent hashtags');
    } finally {
      setLoading(false);
    }
  };

  const handleHashtagToggle = (hashtag: string) => {
    const newSelected = new Set(selectedHashtags);
    if (newSelected.has(hashtag)) {
      newSelected.delete(hashtag);
    } else {
      newSelected.add(hashtag);
    }
    setSelectedHashtags(newSelected);
  };

  const handleAddSelected = () => {
    if (selectedHashtags.size === 0) return;
    
    const hashtagsArray = Array.from(selectedHashtags);
    onHashtagsAdd(hashtagsArray);
    setSelectedHashtags(new Set());
  };

  const handleAddAll = (hashtags: HashtagData[]) => {
    const filteredHashtags = hashtags
      .filter(h => showOnlySafe ? !h.isBanned : true)
      .filter(h => difficultyFilter === 'all' || h.difficulty === difficultyFilter)
      .map(h => h.hashtag);
    
    onHashtagsAdd(filteredHashtags);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return <Target className="w-3 h-3" />;
      case 'medium': return <BarChart3 className="w-3 h-3" />;
      case 'hard': return <Zap className="w-3 h-3" />;
      default: return <Hash className="w-3 h-3" />;
    }
  };

  const getFilteredHashtags = (hashtags: HashtagData[]) => {
    return hashtags
      .filter(h => {
        if (searchTerm && !h.hashtag.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        if (showOnlySafe && h.isBanned) {
          return false;
        }
        if (difficultyFilter !== 'all' && h.difficulty !== difficultyFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  };

  const renderHashtagCard = (hashtagData: HashtagData) => {
    const isSelected = selectedHashtags.has(hashtagData.hashtag);
    const isCurrentlyUsed = currentHashtags.includes(hashtagData.hashtag);

    return (
      <div
        key={hashtagData.hashtag}
        className={`p-3 border rounded-lg cursor-pointer transition-all ${
          isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : isCurrentlyUsed
            ? 'border-green-500 bg-green-50'
            : hashtagData.isBanned
            ? 'border-red-300 bg-red-50'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
        onClick={() => !hashtagData.isBanned && handleHashtagToggle(hashtagData.hashtag)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{hashtagData.hashtag}</span>
            {isCurrentlyUsed && (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
            {hashtagData.isBanned && (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getDifficultyColor(hashtagData.difficulty)}`}>
            {getDifficultyIcon(hashtagData.difficulty)}
            {hashtagData.difficulty}
          </div>
        </div>

        <div className="space-y-1 text-xs text-gray-600">
          {hashtagData.postCount > 0 && (
            <div className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              <span>{hashtagData.postCount.toLocaleString()} posts</span>
            </div>
          )}
          {hashtagData.engagementRate > 0 && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{hashtagData.engagementRate}% engagement</span>
            </div>
          )}
          {hashtagData.relevanceScore && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              <span>{hashtagData.relevanceScore}% relevance</span>
            </div>
          )}
        </div>

        {hashtagData.isBanned && (
          <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
            <div className="font-medium">Banned: {hashtagData.banReason}</div>
            {hashtagData.alternatives && hashtagData.alternatives.length > 0 && (
              <div className="mt-1">
                <span className="font-medium">Try instead:</span> {hashtagData.alternatives.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const getCurrentHashtags = () => {
    switch (activeTab) {
      case 'suggested':
        return [...suggestedHashtags, ...relatedHashtags];
      case 'trending':
        return trendingHashtags;
      case 'recent':
        return recentHashtags;
      case 'competitor':
        return competitorHashtags;
      default:
        return [];
    }
  };

  return (
    <div className="space-y-4">
      {/* Hashtag Counter */}
      <HashtagCounter 
        hashtags={currentHashtags} 
        platform={selectedPlatform}
      />

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search hashtags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as any)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="all">All Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlySafe}
              onChange={(e) => setShowOnlySafe(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Safe only</span>
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          {[
            { id: 'suggested', label: 'Suggested', icon: Sparkles },
            { id: 'trending', label: 'Trending', icon: TrendingUp },
            { id: 'groups', label: 'Groups', icon: Users },
            { id: 'recent', label: 'Recent', icon: Clock },
            { id: 'competitor', label: 'Competitor', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {activeTab === 'groups' ? (
          <HashtagGroupsPanel 
            onHashtagsInsert={onHashtagsAdd}
            selectedPlatform={selectedPlatform}
          />
        ) : (
          <>
            {/* Action Buttons */}
            {getCurrentHashtags().length > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {getFilteredHashtags(getCurrentHashtags()).length} hashtags
                </div>
                <div className="flex gap-2">
                  {selectedHashtags.size > 0 && (
                    <button
                      onClick={handleAddSelected}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Add Selected ({selectedHashtags.size})
                    </button>
                  )}
                  <button
                    onClick={() => handleAddAll(getCurrentHashtags())}
                    className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                  >
                    Add All
                  </button>
                </div>
              </div>
            )}

            {/* Generate Button for Suggested Tab */}
            {activeTab === 'suggested' && (
              <button
                onClick={generateSuggestedHashtags}
                disabled={loading || !content.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Hash className="h-4 w-4" />
                    Generate Hashtags
                  </>
                )}
              </button>
            )}

            {/* Hashtags Grid */}
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading hashtags...
              </div>
            ) : (
              <div className="grid gap-3">
                {getFilteredHashtags(getCurrentHashtags()).map(renderHashtagCard)}
                {getFilteredHashtags(getCurrentHashtags()).length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500">
                    {activeTab === 'suggested' && !content.trim() 
                      ? 'Write some content first to get hashtag suggestions'
                      : 'No hashtags found'
                    }
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EnhancedHashtagPanel;