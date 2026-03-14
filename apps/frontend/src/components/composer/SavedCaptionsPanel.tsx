/**
 * Saved Captions Panel
 * Module 58: Saved Captions Library
 * 
 * Advanced caption library that beats Buffer, Hootsuite, Sprout Social, Later
 */

import { useState, useEffect, useMemo } from 'react';
import { templateService, PostTemplate, TemplateFilters } from '@/services/template.service';
import { useComposerStore } from '@/store/composer.store';
import { logger } from '@/lib/logger';
import { 
  Save, 
  Trash2, 
  FileText, 
  Loader2, 
  X, 
  Search, 
  Star, 
  StarOff, 
  Copy, 
  Edit3, 
  Filter,
  Download,
  Upload,
  Hash,
  MessageSquare,
  Clock,
  TrendingUp,
  Tag,
  Globe
} from 'lucide-react';

interface SavedCaptionsPanelProps {
  onClose: () => void;
}

interface VariableSubstitution {
  [key: string]: string;
}

interface CaptionFilters extends TemplateFilters {
  sortBy?: 'newest' | 'oldest' | 'mostUsed' | 'leastUsed' | 'alphabetical';
  showPersonalOnly?: boolean;
  showWorkspaceOnly?: boolean;
}

export function SavedCaptionsPanel({ onClose }: SavedCaptionsPanelProps) {
  // State management
  const [captions, setCaptions] = useState<PostTemplate[]>([]);
  const [filteredCaptions, setFilteredCaptions] = useState<PostTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [captionTitle, setCaptionTitle] = useState('');
  const [captionCategory, setCaptionCategory] = useState('general');
  const [captionTags, setCaptionTags] = useState('');
  const [captionPlatforms, setCaptionPlatforms] = useState<string[]>([]);
  const [isPersonal, setIsPersonal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'personal' | 'workspace'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'mostUsed' | 'alphabetical' | 'lastUsed'>('newest');
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Variable substitution state
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState<PostTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<VariableSubstitution>({});
  
  // Other state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  const { mainContent, setContent } = useComposerStore();

  // Available platforms for filtering
  const platforms = [
    { id: 'facebook', name: 'Facebook', color: 'bg-blue-500' },
    { id: 'instagram', name: 'Instagram', color: 'bg-pink-500' },
    { id: 'twitter', name: 'Twitter', color: 'bg-sky-500' },
    { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-600' },
    { id: 'tiktok', name: 'TikTok', color: 'bg-black' },
    { id: 'youtube', name: 'YouTube', color: 'bg-red-500' },
  ];

  // Categories for captions
  const categories = [
    'general', 'promotional', 'educational', 'inspirational', 'question', 
    'announcement', 'behind-the-scenes', 'user-generated', 'seasonal', 'trending'
  ];

  useEffect(() => {
    loadCaptions();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [captions, searchQuery, activeFilter, sortBy, selectedPlatformFilter, selectedCategoryFilter]);

  const loadCaptions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load all templates (we'll treat them as captions)
      const data = await templateService.getTemplates();
      setCaptions(data);
    } catch (err: any) {
      logger.error('Failed to load captions:', { error: err.message });
      setError('Failed to load captions');
    } finally {
      setIsLoading(false);
    }
  };
  const applyFiltersAndSort = () => {
    let filtered = [...captions];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(caption => 
        caption.name.toLowerCase().includes(query) ||
        caption.content.toLowerCase().includes(query) ||
        caption.tags.some(tag => tag.toLowerCase().includes(query)) ||
        caption.category.toLowerCase().includes(query)
      );
    }

    // Apply active filter
    switch (activeFilter) {
      case 'favorites':
        filtered = filtered.filter(caption => caption.isFavorite);
        break;
      case 'personal':
        filtered = filtered.filter(caption => caption.isPersonal);
        break;
      case 'workspace':
        filtered = filtered.filter(caption => !caption.isPersonal);
        break;
    }

    // Apply platform filter
    if (selectedPlatformFilter.length > 0) {
      filtered = filtered.filter(caption => 
        caption.platforms.some(platform => selectedPlatformFilter.includes(platform))
      );
    }

    // Apply category filter
    if (selectedCategoryFilter) {
      filtered = filtered.filter(caption => caption.category === selectedCategoryFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case 'mostUsed':
        filtered.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'lastUsed':
        filtered.sort((a, b) => {
          if (!a.lastUsedAt && !b.lastUsedAt) return 0;
          if (!a.lastUsedAt) return 1;
          if (!b.lastUsedAt) return -1;
          return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
        });
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    setFilteredCaptions(filtered);
  };

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return matches.map(match => match.replace(/[{}]/g, '').trim());
  };

  const substituteVariables = (content: string, variables: VariableSubstitution): string => {
    let result = content;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    });
    return result;
  };
  const handleSaveCaption = async () => {
    if (!captionTitle.trim()) {
      setError('Caption title is required');
      return;
    }

    if (!mainContent.trim()) {
      setError('Cannot save empty caption');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const variables = extractVariables(mainContent);
      const tags = captionTags.split(',').map(tag => tag.trim()).filter(Boolean);
      
      await templateService.createTemplate({
        name: captionTitle.trim(),
        content: mainContent,
        category: captionCategory,
        tags,
        platforms: captionPlatforms,
        variables,
        isPersonal,
        description: `Caption with ${mainContent.length} characters`,
      });

      // Reset form
      setCaptionTitle('');
      setCaptionCategory('general');
      setCaptionTags('');
      setCaptionPlatforms([]);
      setIsPersonal(false);
      setShowSaveDialog(false);
      
      await loadCaptions();
    } catch (err: any) {
      logger.error('Failed to save caption:', { error: err.message });
      setError(err.response?.data?.message || 'Failed to save caption');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseCaption = async (caption: PostTemplate) => {
    try {
      const variables = extractVariables(caption.content);
      
      if (variables.length > 0) {
        // Show variable substitution modal
        setSelectedCaption(caption);
        setVariableValues(variables.reduce((acc, variable) => ({ ...acc, [variable]: '' }), {}));
        setShowVariableModal(true);
      } else {
        // Direct insertion
        setContent('main', caption.content);
        
        // Increment usage count
        await templateService.applyTemplate(caption.id);
        await loadCaptions();
        onClose();
      }
    } catch (err: any) {
      logger.error('Failed to use caption:', { error: err.message });
      setError('Failed to use caption');
    }
  };

  const handleApplyWithVariables = async () => {
    if (!selectedCaption) return;

    try {
      const substitutedContent = substituteVariables(selectedCaption.content, variableValues);
      setContent('main', substitutedContent);
      
      // Increment usage count
      await templateService.applyTemplate(selectedCaption.id, variableValues);
      await loadCaptions();
      
      setShowVariableModal(false);
      setSelectedCaption(null);
      setVariableValues({});
      onClose();
    } catch (err: any) {
      logger.error('Failed to apply caption with variables:', { error: err.message });
      setError('Failed to apply caption');
    }
  };
  const handleToggleFavorite = async (captionId: string) => {
    try {
      const caption = captions.find(c => c.id === captionId);
      if (!caption) return;

      await templateService.updateTemplate(captionId, {
        isFavorite: !caption.isFavorite
      });
      
      await loadCaptions();
    } catch (err: any) {
      logger.error('Failed to toggle favorite:', { error: err.message });
      setError('Failed to update favorite');
    }
  };

  const handleDeleteCaption = async (captionId: string) => {
    try {
      await templateService.deleteTemplate(captionId);
      setDeleteConfirm(null);
      await loadCaptions();
    } catch (err: any) {
      logger.error('Failed to delete caption:', { error: err.message });
      setError('Failed to delete caption');
    }
  };

  const handleDuplicateCaption = async (caption: PostTemplate) => {
    try {
      await templateService.duplicateTemplate(caption.id, `${caption.name} (Copy)`);
      await loadCaptions();
    } catch (err: any) {
      logger.error('Failed to duplicate caption:', { error: err.message });
      setError('Failed to duplicate caption');
    }
  };

  const handleEditCaption = async (captionId: string) => {
    if (!editContent.trim()) {
      setError('Caption content cannot be empty');
      return;
    }

    try {
      const variables = extractVariables(editContent);
      await templateService.updateTemplate(captionId, {
        content: editContent,
        variables,
      });
      
      setEditingCaption(null);
      setEditContent('');
      await loadCaptions();
    } catch (err: any) {
      logger.error('Failed to edit caption:', { error: err.message });
      setError('Failed to edit caption');
    }
  };

  const handleExportCaptions = () => {
    const exportData = {
      captions: filteredCaptions.map(caption => ({
        name: caption.name,
        content: caption.content,
        category: caption.category,
        tags: caption.tags,
        platforms: caption.platforms,
        variables: caption.variables,
        characterCount: caption.characterCount,
        language: caption.language,
      })),
      exportedAt: new Date().toISOString(),
      totalCount: filteredCaptions.length,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saved-captions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleImportCaptions = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (!importData.captions || !Array.isArray(importData.captions)) {
          setError('Invalid import file format');
          return;
        }

        for (const captionData of importData.captions) {
          await templateService.createTemplate({
            name: captionData.name || 'Imported Caption',
            content: captionData.content || '',
            category: captionData.category || 'general',
            tags: captionData.tags || [],
            platforms: captionData.platforms || [],
            variables: captionData.variables || [],
            isPersonal: false,
          });
        }

        await loadCaptions();
        setError(null);
      } catch (err: any) {
        logger.error('Failed to import captions:', { error: err.message });
        setError('Failed to import captions. Please check file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const getPlatformBadgeColor = (platform: string) => {
    const platformConfig = platforms.find(p => p.id === platform);
    return platformConfig?.color || 'bg-gray-500';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCharacterCount = (content: string) => {
    return content.length;
  };

  const getTemplateCharacterCount = (template: PostTemplate) => {
    return template.characterCount || template.content.length;
  };

  const renderVariableHighlights = (content: string) => {
    return content.replace(/\{\{([^}]+)\}\}/g, '<span class="bg-yellow-100 text-yellow-800 px-1 rounded">{{$1}}</span>');
  };
  return (
    <>
      {/* Main Panel */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Saved Captions Library</h2>
              <span className="text-sm text-gray-500">({filteredCaptions.length} captions)</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Export Button */}
              <button
                onClick={handleExportCaptions}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Export captions"
              >
                <Download className="h-5 w-5" />
              </button>
              
              {/* Import Button */}
              <label className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Import captions">
                <Upload className="h-5 w-5" />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportCaptions}
                  className="hidden"
                />
              </label>
              
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title="Toggle filters"
              >
                <Filter className="h-5 w-5" />
              </button>
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close captions panel"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Search and Quick Filters */}
          <div className="p-4 border-b bg-gray-50">
            {/* Search Bar */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search captions, tags, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-2 mb-3">
              {[
                { key: 'all', label: 'All Captions', icon: Globe },
                { key: 'favorites', label: 'Favorites', icon: Star },
                { key: 'personal', label: 'My Captions', icon: MessageSquare },
                { key: 'workspace', label: 'Workspace', icon: MessageSquare },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeFilter === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              {[
                { key: 'newest', label: 'Newest' },
                { key: 'mostUsed', label: 'Most Used' },
                { key: 'alphabetical', label: 'A-Z' },
                { key: 'lastUsed', label: 'Recently Used' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key as any)}
                  className={`px-2 py-1 rounded text-sm transition-colors ${
                    sortBy === key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Advanced Filters (Collapsible) */}
          {showFilters && (
            <div className="p-4 border-b bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Platform Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                  <div className="flex flex-wrap gap-1">
                    {platforms.map(platform => (
                      <button
                        key={platform.id}
                        onClick={() => {
                          setSelectedPlatformFilter(prev => 
                            prev.includes(platform.id)
                              ? prev.filter(p => p !== platform.id)
                              : [...prev, platform.id]
                          );
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          selectedPlatformFilter.includes(platform.id)
                            ? `${platform.color} text-white`
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {platform.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSelectedPlatformFilter([]);
                      setSelectedCategoryFilter('');
                      setSearchQuery('');
                      setActiveFilter('all');
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Caption Button */}
          {!showSaveDialog && (
            <div className="p-4 border-b">
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={!mainContent.trim()}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-gray-700"
              >
                <Save className="h-5 w-5" />
                <span>Save Current Caption ({getCharacterCount(mainContent)} chars)</span>
              </button>
            </div>
          )}
          {/* Save Dialog */}
          {showSaveDialog && (
            <div className="p-4 border-b bg-blue-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Caption Title</label>
                  <input
                    type="text"
                    value={captionTitle}
                    onChange={(e) => setCaptionTitle(e.target.value)}
                    placeholder="e.g., Product Launch Announcement"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={captionCategory}
                    onChange={(e) => setCaptionCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={captionTags}
                    onChange={(e) => setCaptionTags(e.target.value)}
                    placeholder="e.g., product, launch, announcement"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                  <div className="flex flex-wrap gap-1">
                    {platforms.map(platform => (
                      <button
                        key={platform.id}
                        onClick={() => {
                          setCaptionPlatforms(prev => 
                            prev.includes(platform.id)
                              ? prev.filter(p => p !== platform.id)
                              : [...prev, platform.id]
                          );
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          captionPlatforms.includes(platform.id)
                            ? `${platform.color} text-white`
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {platform.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isPersonal}
                    onChange={(e) => setIsPersonal(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Personal caption (only visible to me)</span>
                </label>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSaveCaption}
                  disabled={isSaving || !captionTitle.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Caption</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setCaptionTitle('');
                    setCaptionCategory('general');
                    setCaptionTags('');
                    setCaptionPlatforms([]);
                    setIsPersonal(false);
                    setError(null);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredCaptions.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-lg">
                  {searchQuery || activeFilter !== 'all' || selectedPlatformFilter.length > 0 || selectedCategoryFilter
                    ? 'No captions match your filters'
                    : 'No saved captions yet'
                  }
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchQuery || activeFilter !== 'all' || selectedPlatformFilter.length > 0 || selectedCategoryFilter
                    ? 'Try adjusting your search or filters'
                    : 'Save your first caption to build your library'
                  }
                </p>
              </div>
            )}

            {/* Captions Grid */}
            {!isLoading && filteredCaptions.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredCaptions.map((caption) => (
                  <div
                    key={caption.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all bg-white"
                  >
                    {/* Caption Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{caption.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {caption.category}
                          </span>
                          {caption.isPersonal && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded">
                              Personal
                            </span>
                          )}
                          {caption.language && (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded uppercase">
                              {caption.language}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {getTemplateCharacterCount(caption)} chars
                          </span>
                        </div>
                      </div>
                      
                      {/* Favorite Button */}
                      <button
                        onClick={() => handleToggleFavorite(caption.id)}
                        className={`p-1 rounded transition-colors ${
                          caption.isFavorite
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : 'text-gray-400 hover:text-yellow-500'
                        }`}
                      >
                        {caption.isFavorite ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Caption Content */}
                    {editingCaption === caption.id ? (
                      <div className="mb-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleEditCaption(caption.id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingCaption(null);
                              setEditContent('');
                            }}
                            className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="text-sm text-gray-700 mb-3 line-clamp-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => handleUseCaption(caption)}
                        dangerouslySetInnerHTML={{ __html: renderVariableHighlights(caption.content) }}
                      />
                    )}
                    {/* Platform Tags */}
                    {caption.platforms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {caption.platforms.map(platform => (
                          <span
                            key={platform}
                            className={`text-xs px-2 py-1 rounded text-white ${getPlatformBadgeColor(platform)}`}
                          >
                            {platforms.find(p => p.id === platform)?.name || platform}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {caption.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {caption.tags.map(tag => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded flex items-center gap-1"
                          >
                            <Hash className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Variables */}
                    {caption.variables.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">Variables:</div>
                        <div className="flex flex-wrap gap-1">
                          {caption.variables.map(variable => (
                            <span
                              key={variable}
                              className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded"
                            >
                              {`{{${variable}}}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Caption Stats */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Used {caption.usageCount} times
                        </span>
                        {caption.lastUsedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last used {formatDate(caption.lastUsedAt)}
                          </span>
                        )}
                      </div>
                      <span>Created {formatDate(caption.createdAt)}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleUseCaption(caption)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Use Caption
                      </button>

                      <div className="flex items-center gap-1">
                        {/* Edit Button */}
                        <button
                          onClick={() => {
                            setEditingCaption(caption.id);
                            setEditContent(caption.content);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit caption"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>

                        {/* Duplicate Button */}
                        <button
                          onClick={() => handleDuplicateCaption(caption)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Duplicate caption"
                        >
                          <Copy className="h-3 w-3" />
                        </button>

                        {/* Delete Button */}
                        {deleteConfirm === caption.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDeleteCaption(caption.id)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(caption.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete caption"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Variable Substitution Modal */}
      {showVariableModal && selectedCaption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Fill Variables</h3>
              <p className="text-sm text-gray-600 mt-1">
                This caption contains variables. Fill them in before using.
              </p>
            </div>
            
            <div className="p-4">
              <div className="space-y-3">
                {selectedCaption.variables.map(variable => (
                  <div key={variable}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {variable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    <input
                      type="text"
                      value={variableValues[variable] || ''}
                      onChange={(e) => setVariableValues(prev => ({
                        ...prev,
                        [variable]: e.target.value
                      }))}
                      placeholder={`Enter ${variable}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
              
              {/* Preview */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Preview:</div>
                <div className="text-sm text-gray-600">
                  {substituteVariables(selectedCaption.content, variableValues)}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={handleApplyWithVariables}
                disabled={selectedCaption.variables.some(v => !variableValues[v]?.trim())}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use Caption
              </button>
              <button
                onClick={() => {
                  setShowVariableModal(false);
                  setSelectedCaption(null);
                  setVariableValues({});
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}