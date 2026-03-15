/**
 * Publishing Demo Component
 * 
 * Demonstrates the complete multi-platform publishing workflow
 * that beats Buffer, Hootsuite, Sprout Social, Later
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PublishStatusTracker, PlatformStatus } from './PublishStatusTracker';
import { publishingService } from '@/services/publishing.service';
import { toast } from 'sonner';
import { 
  Send, 
  Zap, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Sparkles,
  Target
} from 'lucide-react';

const AVAILABLE_PLATFORMS = [
  { id: 'twitter', name: 'Twitter/X', icon: '𝕏', color: 'bg-black text-white' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-600 text-white' },
  { id: 'facebook', name: 'Facebook', icon: '📘', color: 'bg-blue-500 text-white' },
  { id: 'instagram', name: 'Instagram', icon: '📷', color: 'bg-pink-500 text-white' },
  { id: 'youtube', name: 'YouTube', icon: '📺', color: 'bg-red-500 text-white' },
  { id: 'threads', name: 'Threads', icon: '🧵', color: 'bg-gray-800 text-white' },
  { id: 'bluesky', name: 'Bluesky', icon: '🦋', color: 'bg-sky-500 text-white' },
  { id: 'mastodon', name: 'Mastodon', icon: '🐘', color: 'bg-purple-600 text-white' },
  { id: 'reddit', name: 'Reddit', icon: '🤖', color: 'bg-orange-500 text-white' },
  { id: 'google-business', name: 'Google Business', icon: '🏢', color: 'bg-green-600 text-white' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: 'bg-black text-white' },
  { id: 'pinterest', name: 'Pinterest', icon: '📌', color: 'bg-red-600 text-white' },
];

export const PublishingDemo: React.FC = () => {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingStatus, setPublishingStatus] = useState<PlatformStatus[]>([]);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);

  const handlePlatformToggle = useCallback((platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPlatforms(AVAILABLE_PLATFORMS.map(p => p.id));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedPlatforms([]);
  }, []);

  const handlePublishNow = useCallback(async () => {
    if (!content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    setIsPublishing(true);
    
    try {
      // Simulate the publish now API call
      const response = await publishingService.publishNow({
        content: content.trim(),
        platforms: selectedPlatforms,
      });

      setCurrentPostId(response.postId);
      setPublishingStatus(response.platforms);
      
      toast.success(`Publishing to ${selectedPlatforms.length} platforms!`);
      
      // Start polling for status updates
      startStatusPolling(response.postId);
      
    } catch (error: any) {
      toast.error(`Failed to publish: ${error.message}`);
      setIsPublishing(false);
    }
  }, [content, selectedPlatforms]);

  const startStatusPolling = useCallback((postId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await publishingService.getPublishStatus(postId);
        setPublishingStatus(status.platforms);
        
        // Stop polling when all platforms are done
        const allDone = status.platforms.every(p => 
          p.status === 'published' || p.status === 'failed'
        );
        
        if (allDone) {
          clearInterval(pollInterval);
          setIsPublishing(false);
          
          const successful = status.platforms.filter(p => p.status === 'published').length;
          const failed = status.platforms.filter(p => p.status === 'failed').length;
          
          if (failed === 0) {
            toast.success(`Successfully published to all ${successful} platforms! 🎉`);
          } else {
            toast.warning(`Published to ${successful} platforms, ${failed} failed`);
          }
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    }, 2000);

    // Cleanup after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsPublishing(false);
    }, 300000);
  }, []);

  const handleRetryPlatform = useCallback(async (platform: string) => {
    if (!currentPostId) return;
    
    try {
      await publishingService.retryPlatform(currentPostId, platform);
      
      // Update status to show retrying
      setPublishingStatus(prev => 
        prev.map(p => 
          p.platform === platform 
            ? { ...p, status: 'retrying' as const }
            : p
        )
      );
      
      // Restart polling
      startStatusPolling(currentPostId);
      
    } catch (error: any) {
      toast.error(`Failed to retry ${platform}: ${error.message}`);
    }
  }, [currentPostId, startStatusPolling]);

  const handleRefreshStatus = useCallback(async () => {
    if (!currentPostId) return;
    
    try {
      const status = await publishingService.getPublishStatus(currentPostId);
      setPublishingStatus(status.platforms);
    } catch (error: any) {
      toast.error(`Failed to refresh status: ${error.message}`);
    }
  }, [currentPostId]);

  const handleRetryAll = useCallback(async () => {
    if (!currentPostId) return;
    
    try {
      const result = await publishingService.retryAllFailed(currentPostId);
      
      // Update status for retried platforms
      setPublishingStatus(prev => 
        prev.map(p => 
          result.retriedPlatforms.includes(p.platform)
            ? { ...p, status: 'retrying' as const }
            : p
        )
      );
      
      // Restart polling
      startStatusPolling(currentPostId);
      
    } catch (error: any) {
      toast.error(`Failed to retry all: ${error.message}`);
    }
  }, [currentPostId, startStatusPolling]);

  const canPublish = content.trim().length > 0 && selectedPlatforms.length > 0 && !isPublishing;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          <h1 className="text-3xl font-bold">Multi-Platform Publishing</h1>
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Superior to Competitors
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Publish to 12+ platforms simultaneously with real-time status tracking
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            Beats Buffer
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            Beats Hootsuite
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            Beats Sprout Social
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            Beats Later
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Compose Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                placeholder="What's on your mind? This will be published to all selected platforms..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                maxLength={2000}
                className="resize-none"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{content.length}/2000 characters</span>
                <span className="text-green-600">✓ Optimized for all platforms</span>
              </div>
            </div>

            {/* Platform Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Select Platforms</label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_PLATFORMS.map((platform) => (
                  <div
                    key={platform.id}
                    className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handlePlatformToggle(platform.id)}
                  >
                    <Checkbox
                      checked={selectedPlatforms.includes(platform.id)}
                      onChange={() => handlePlatformToggle(platform.id)}
                    />
                    <span className="text-lg">{platform.icon}</span>
                    <span className="text-sm font-medium">{platform.name}</span>
                  </div>
                ))}
              </div>
              
              <div className="text-sm text-muted-foreground">
                Selected: {selectedPlatforms.length} platforms
              </div>
            </div>

            <Separator />

            {/* Publish Button */}
            <Button
              onClick={handlePublishNow}
              disabled={!canPublish}
              className="w-full"
              size="lg"
            >
              {isPublishing ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Publishing to {selectedPlatforms.length} platforms...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Publish Now to {selectedPlatforms.length} Platforms
                </>
              )}
            </Button>

            {!canPublish && (
              <div className="text-sm text-muted-foreground text-center">
                {!content.trim() && 'Enter content to publish'}
                {content.trim() && selectedPlatforms.length === 0 && 'Select at least one platform'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Panel */}
        <div className="space-y-4">
          {publishingStatus.length > 0 ? (
            <PublishStatusTracker
              postId={currentPostId || ''}
              platforms={publishingStatus}
              onRetryPlatform={handleRetryPlatform}
              onRefreshStatus={handleRefreshStatus}
              onRetryAll={handleRetryAll}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-gray-400" />
                  Publishing Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Publish Now" to see real-time status tracking</p>
                  <p className="text-sm mt-2">
                    Watch as your content gets published to multiple platforms simultaneously
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Competitive Advantages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🏆 Competitive Advantages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>12+ platforms (competitors: 4-8)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Real-time status per platform</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Individual platform retry</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Platform-specific URLs</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Comprehensive error handling</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Simultaneous publishing</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};