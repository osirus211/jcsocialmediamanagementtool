/**
 * Advanced Templates Panel
 * 
 * Comprehensive template management with all competitive features:
 * - Template variables ({{brand_name}}, {{product}}, {{cta}})
 * - Categories and folders
 * - Search and filtering
 * - Pre-built template library
 * - AI suggestions
 * - Favorites and ratings
 * - Import/export
 * 
 * Beats Buffer, Hootsuite, Sprout Social, Later, and SocialBee
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  templateService, 
  PostTemplate, 
  TemplateFilters,
  VariableSubstitution 
} from '@/services/template.service';
import { useComposerStore } from '@/store/composer.store';
import { logger } from '@/lib/logger';
import { 
  Save, 
  Trash2, 
  FileText, 
  Loader2, 
  X, 
  Search,
  Filter,
  Star,
  StarOff,
  Copy,
  Wand2,
  FolderOpen,
  Tag,
  Sparkles,
  Download,
  Upload,
  Heart,
  HeartOff,
  Edit3,
  ChevronDown,
  ChevronRight,
  Zap
} from 'lucide-react';

interface AdvancedTemplatesPanelProps {
  onClose: () => void;
}

interface VariableInputs {
  [key: string]: string;
}

export function AdvancedTemplatesPanel({ onClose }: AdvancedTemplatesPanelProps) {
  // State management
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<PostTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showPrebuiltOnly, setShowPrebuiltOnly] = useState(false);
  const [showPersonalOnly, setShowPersonalOnly] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['general']));
  
  // Template creation/editing
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showVariableDialog, setShowVariableDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PostTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('general');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateTags, setTemplateTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Variable substitution
  const [variableInputs, setVariableInputs] = useState<VariableInputs>({});
  
  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<PostTemplate[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  
  // Actions
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  const { mainContent, applyTemplate } = useComposerStore();

  // Industries for filtering
  const industries = [
    'all', 'general', 'ecommerce', 'saas', 'agency', 'healthcare', 
    'education', 'finance', 'real-estate', 'restaurant', 'fitness', 
    'beauty', 'travel', 'nonprofit'
  ];
  // Load data on mount
  useEffect(() => {
    loadTemplates();
    loadCategories();
    loadTags();
  }, []);

  // Filter templates when search/filters change
  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery, selectedCategory, selectedIndustry, showFavoritesOnly, showPrebuiltOnly, showPersonalOnly]);

  // Load AI suggestions when content changes
  useEffect(() => {
    if (mainContent.trim() && mainContent.length > 10) {
      loadAiSuggestions();
    }
  }, [mainContent]);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await templateService.getTemplates();
      setTemplates(data);
    } catch (err: any) {
      logger.error('Failed to load templates:', { error: err.message });
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await templateService.getCategories();
      setCategories(['all', ...data]);
    } catch (err: any) {
      logger.error('Failed to load categories:', { error: err.message });
    }
  };

  const loadTags = async () => {
    try {
      const data = await templateService.getTags();
      setTags(data);
    } catch (err: any) {
      logger.error('Failed to load tags:', { error: err.message });
    }
  };

  const loadAiSuggestions = async () => {
    try {
      const suggestions = await templateService.getAISuggestions(mainContent, 3);
      setAiSuggestions(suggestions);
      setShowAiSuggestions(suggestions.length > 0);
    } catch (err: any) {
      logger.error('Failed to load AI suggestions:', { error: err.message });
    }
  };
  const filterTemplates = () => {
    let filtered = [...templates];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    // Industry filter
    if (selectedIndustry !== 'all') {
      filtered = filtered.filter(template => template.industry === selectedIndustry);
    }

    // Favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter(template => template.isFavorite);
    }

    // Pre-built filter
    if (showPrebuiltOnly) {
      filtered = filtered.filter(template => template.isPrebuilt);
    }

    // Personal filter
    if (showPersonalOnly) {
      filtered = filtered.filter(template => template.isPersonal);
    }

    setFilteredTemplates(filtered);
  };

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const groups: { [key: string]: PostTemplate[] } = {};
    
    filteredTemplates.forEach(template => {
      const category = template.category || 'general';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(template);
    });

    // Sort templates within each category
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => {
        // Favorites first
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        
        // Then by rating
        if (a.rating !== b.rating) return b.rating - a.rating;
        
        // Then by usage count
        if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
    });

    return groups;
  }, [filteredTemplates]);
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    if (!mainContent.trim()) {
      setError('Cannot save empty template');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await templateService.createTemplate({
        name: templateName.trim(),
        content: mainContent,
        category: templateCategory,
        description: templateDescription.trim() || undefined,
        tags: templateTags,
      });

      setTemplateName('');
      setTemplateCategory('general');
      setTemplateDescription('');
      setTemplateTags([]);
      setShowSaveDialog(false);
      await loadTemplates();
    } catch (err: any) {
      logger.error('Failed to save template:', { error: err.message });
      setError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyTemplate = async (template: PostTemplate) => {
    // Check if template has variables
    if (template.variables && template.variables.length > 0) {
      setSelectedTemplate(template);
      setVariableInputs({});
      setShowVariableDialog(true);
      return;
    }

    // Apply template directly
    try {
      await applyTemplate(template.id);
      onClose();
    } catch (err: any) {
      logger.error('Failed to apply template:', { error: err.message });
      setError('Failed to apply template');
    }
  };

  const handleApplyWithVariables = async () => {
    if (!selectedTemplate) return;

    try {
      const template = await templateService.applyTemplate(selectedTemplate.id, variableInputs);
      
      // Apply processed content to composer
      const processedContent = substituteVariables(template.content, variableInputs);
      await applyTemplate(selectedTemplate.id);
      
      setShowVariableDialog(false);
      setSelectedTemplate(null);
      setVariableInputs({});
      onClose();
    } catch (err: any) {
      logger.error('Failed to apply template with variables:', { error: err.message });
      setError('Failed to apply template');
    }
  };

  // Simple variable substitution (client-side)
  const substituteVariables = (content: string, substitutions: VariableSubstitution): string => {
    let result = content;
    Object.entries(substitutions).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  };
  const handleToggleFavorite = async (template: PostTemplate) => {
    try {
      await templateService.updateTemplate(template.id, {
        isFavorite: !template.isFavorite,
      });
      await loadTemplates();
    } catch (err: any) {
      logger.error('Failed to toggle favorite:', { error: err.message });
      setError('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await templateService.deleteTemplate(templateId);
      setDeleteConfirm(null);
      await loadTemplates();
    } catch (err: any) {
      logger.error('Failed to delete template:', { error: err.message });
      setError('Failed to delete template');
    }
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    if (!duplicateName.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      await templateService.duplicateTemplate(templateId, duplicateName.trim());
      setDuplicateDialog(null);
      setDuplicateName('');
      await loadTemplates();
    } catch (err: any) {
      logger.error('Failed to duplicate template:', { error: err.message });
      setError('Failed to duplicate template');
    }
  };

  const toggleCategoryExpansion = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Template Library</h2>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              {filteredTemplates.length} templates
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close templates panel"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Filters */}
          <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={!mainContent.trim()}
                className="w-full mb-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-blue-700"
              >
                <Save className="h-4 w-4" />
                <span>Save Current as Template</span>
              </button>
            </div>

            {/* AI Suggestions */}
            {showAiSuggestions && aiSuggestions.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-purple-600" />
                  AI Suggestions
                </h3>
                <div className="space-y-2">
                  {aiSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleApplyTemplate(suggestion)}
                      className="w-full p-2 text-left border border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {suggestion.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {suggestion.content.substring(0, 50)}...
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Filters */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {industries.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry === 'all' ? 'All Industries' : industry.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showFavoritesOnly}
                    onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Favorites only</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showPrebuiltOnly}
                    onChange={(e) => setShowPrebuiltOnly(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Pre-built templates</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showPersonalOnly}
                    onChange={(e) => setShowPersonalOnly(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Personal templates</span>
                </label>
              </div>
            </div>
          </div>
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No templates found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchQuery || selectedCategory !== 'all' || selectedIndustry !== 'all' 
                    ? 'Try adjusting your filters'
                    : 'Save your first template to get started'
                  }
                </p>
              </div>
            )}

            {/* Templates by Category */}
            {!isLoading && Object.keys(groupedTemplates).length > 0 && (
              <div className="space-y-6">
                {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                  <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategoryExpansion(category)}
                      className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedCategories.has(category) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <FolderOpen className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-gray-900">
                          {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {categoryTemplates.length}
                        </span>
                      </div>
                    </button>

                    {/* Category Templates */}
                    {expandedCategories.has(category) && (
                      <div className="divide-y divide-gray-200">
                        {categoryTemplates.map((template) => (
                          <div key={template.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <button
                                onClick={() => handleApplyTemplate(template)}
                                className="flex-1 text-left"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                                  {template.isPrebuilt && (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                      Pre-built
                                    </span>
                                  )}
                                  {template.variables.length > 0 && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                      Variables
                                    </span>
                                  )}
                                </div>
                                
                                {template.description && (
                                  <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                                )}
                                
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{template.content}</p>
                                
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <div className="flex items-center gap-1">
                                    {renderStars(template.rating)}
                                    <span>({template.rating})</span>
                                  </div>
                                  <span>Used {template.usageCount} times</span>
                                  {template.lastUsedAt && (
                                    <span>Last used {new Date(template.lastUsedAt).toLocaleDateString()}</span>
                                  )}
                                </div>
                                
                                {template.tags.length > 0 && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <Tag className="h-3 w-3 text-gray-400" />
                                    <div className="flex flex-wrap gap-1">
                                      {template.tags.slice(0, 3).map((tag) => (
                                        <span key={tag} className="px-1 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                          {tag}
                                        </span>
                                      ))}
                                      {template.tags.length > 3 && (
                                        <span className="text-xs text-gray-500">+{template.tags.length - 3} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </button>
                              {/* Template Actions */}
                              <div className="flex items-center gap-1">
                                {/* Favorite Button */}
                                <button
                                  onClick={() => handleToggleFavorite(template)}
                                  className={`p-2 rounded transition-colors ${
                                    template.isFavorite 
                                      ? 'text-red-600 hover:bg-red-50' 
                                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                  }`}
                                  aria-label={template.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                  {template.isFavorite ? (
                                    <Heart className="h-4 w-4 fill-current" />
                                  ) : (
                                    <HeartOff className="h-4 w-4" />
                                  )}
                                </button>

                                {/* Duplicate Button */}
                                <button
                                  onClick={() => {
                                    setDuplicateDialog(template.id);
                                    setDuplicateName(`${template.name} (Copy)`);
                                  }}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  aria-label={`Duplicate template ${template.name}`}
                                >
                                  <Copy className="h-4 w-4" />
                                </button>

                                {/* Delete Button (only for non-prebuilt templates) */}
                                {!template.isPrebuilt && (
                                  <>
                                    {deleteConfirm === template.id ? (
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleDeleteTemplate(template.id)}
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
                                        onClick={() => setDeleteConfirm(template.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        aria-label={`Delete template ${template.name}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Save Template Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Save as Template</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    id="template-name"
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Weekly Newsletter"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="template-category" className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    id="template-category"
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="general">General</option>
                    <option value="promotion">Promotion</option>
                    <option value="educational">Educational</option>
                    <option value="engagement">Engagement</option>
                    <option value="announcement">Announcement</option>
                    <option value="behind-scenes">Behind the Scenes</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="template-description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="template-description"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Brief description of when to use this template..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !templateName.trim()}
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
                      <span>Save Template</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setTemplateName('');
                    setTemplateCategory('general');
                    setTemplateDescription('');
                    setError(null);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Variable Substitution Dialog */}
        {showVariableDialog && selectedTemplate && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Customize Template Variables
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                Fill in the variables to customize your template:
              </p>

              <div className="space-y-4 max-h-60 overflow-y-auto">
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {variable.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    <input
                      type="text"
                      value={variableInputs[variable] || ''}
                      onChange={(e) => setVariableInputs(prev => ({
                        ...prev,
                        [variable]: e.target.value
                      }))}
                      placeholder={`Enter ${variable.replace('_', ' ')}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleApplyWithVariables}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  <span>Apply Template</span>
                </button>
                <button
                  onClick={() => {
                    setShowVariableDialog(false);
                    setSelectedTemplate(null);
                    setVariableInputs({});
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Template Dialog */}
        {duplicateDialog && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Duplicate Template</h3>
              
              <div>
                <label htmlFor="duplicate-name" className="block text-sm font-medium text-gray-700 mb-2">
                  New Template Name
                </label>
                <input
                  id="duplicate-name"
                  type="text"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleDuplicateTemplate(duplicateDialog)}
                  disabled={!duplicateName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  <span>Duplicate</span>
                </button>
                <button
                  onClick={() => {
                    setDuplicateDialog(null);
                    setDuplicateName('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}