/**
 * Calendar Auto-Fill Modal
 * Multi-step wizard for AI-powered calendar content generation
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, Clock, Hash, X, CheckSquare, Square } from 'lucide-react';
import { aiService, GenerateCalendarInput, GeneratedPost } from '@/services/ai.service';
import { PostService, CreatePostInput } from '@/services/post.service';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

interface CalendarAutoFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedAccounts?: Array<{
    id: string;
    platform: string;
    username: string;
  }>;
}

type Step = 'configure' | 'review' | 'done';

export const CalendarAutoFillModal: React.FC<CalendarAutoFillModalProps> = ({
  isOpen,
  onClose,
  connectedAccounts = [],
}) => {
  const [step, setStep] = useState<Step>('configure');
  const [loading, setLoading] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());
  const [scheduledCount, setScheduledCount] = useState(0);

  // Configuration state
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    return format(tomorrow, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    const nextWeek = addDays(new Date(), 7);
    return format(nextWeek, 'yyyy-MM-dd');
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [postsPerDay, setPostsPerDay] = useState([1]);
  const [tone, setTone] = useState<string>('casual');
  const [topics, setTopics] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('configure');
      setGeneratedPosts([]);
      setSelectedPosts(new Set());
      setScheduledCount(0);
      // Auto-select platforms from connected accounts
      const platforms = new Set(connectedAccounts.map(acc => acc.platform));
      setSelectedPlatforms(platforms);
    }
  }, [isOpen, connectedAccounts]);

  const handleGenerate = async () => {
    if (selectedPlatforms.size === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    setLoading(true);
    try {
      const input: GenerateCalendarInput = {
        startDate,
        endDate,
        platforms: Array.from(selectedPlatforms),
        postsPerDay: postsPerDay[0],
        topics: topics.trim() ? topics.split(',').map(t => t.trim()) : undefined,
        tone: tone as any,
      };

      const result = await aiService.generateCalendarPosts(input);
      setGeneratedPosts(result.posts);
      
      // Select all posts by default
      const allIndices = new Set(result.posts.map((_, index) => index));
      setSelectedPosts(allIndices);
      
      setStep('review');
      toast.success(`Generated ${result.totalGenerated} posts!`);
    } catch (error) {
      console.error('Failed to generate calendar posts:', error);
      toast.error('Failed to generate posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePosts = async () => {
    const postsToSchedule = generatedPosts.filter((_, index) => selectedPosts.has(index));
    
    if (postsToSchedule.length === 0) {
      toast.error('Please select at least one post to schedule');
      return;
    }

    setLoading(true);
    try {
      // Find social account IDs for each platform
      const postInputs = postsToSchedule.map(post => {
        const account = connectedAccounts.find(acc => acc.platform === post.platform);
        if (!account) {
          throw new Error(`No connected account found for ${post.platform}`);
        }

        return {
          workspaceId: '', // Will be set by backend
          socialAccountId: account.id,
          platform: post.platform,
          content: `${post.content}\n\n${post.hashtags.join(' ')}`,
          scheduledAt: new Date(post.scheduledAt),
        } as CreatePostInput;
      });

      await PostService.bulkCreatePosts(postInputs);
      setScheduledCount(postsToSchedule.length);
      setStep('done');
      toast.success(`Successfully scheduled ${postsToSchedule.length} posts!`);
    } catch (error) {
      console.error('Failed to schedule posts:', error);
      toast.error('Failed to schedule posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePostSelection = (index: number) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedPosts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === generatedPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(generatedPosts.map((_, index) => index)));
    }
  };

  const updatePostContent = (index: number, content: string) => {
    const updated = [...generatedPosts];
    updated[index] = { ...updated[index], content };
    setGeneratedPosts(updated);
  };

  const updatePostHashtags = (index: number, hashtags: string[]) => {
    const updated = [...generatedPosts];
    updated[index] = { ...updated[index], hashtags };
    setGeneratedPosts(updated);
  };

  const removePost = (index: number) => {
    const updated = generatedPosts.filter((_, i) => i !== index);
    setGeneratedPosts(updated);
    
    // Update selected posts indices
    const newSelected = new Set<number>();
    selectedPosts.forEach(selectedIndex => {
      if (selectedIndex < index) {
        newSelected.add(selectedIndex);
      } else if (selectedIndex > index) {
        newSelected.add(selectedIndex - 1);
      }
    });
    setSelectedPosts(newSelected);
  };

  const renderConfigureStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Platforms</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {connectedAccounts.map((account) => (
            <div key={account.id} className="flex items-center space-x-2">
              <Checkbox
                id={account.platform}
                checked={selectedPlatforms.has(account.platform)}
                onCheckedChange={(checked) => {
                  const newPlatforms = new Set(selectedPlatforms);
                  if (checked) {
                    newPlatforms.add(account.platform);
                  } else {
                    newPlatforms.delete(account.platform);
                  }
                  setSelectedPlatforms(newPlatforms);
                }}
              />
              <Label htmlFor={account.platform} className="capitalize">
                {account.platform} (@{account.username})
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Posts per Day: {postsPerDay[0]}</Label>
        <Slider
          value={postsPerDay}
          onValueChange={setPostsPerDay}
          max={5}
          min={1}
          step={1}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="tone">Tone</Label>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
            <SelectItem value="humorous">Humorous</SelectItem>
            <SelectItem value="inspirational">Inspirational</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="topics">Topics (optional)</Label>
        <Textarea
          id="topics"
          placeholder="What topics should we cover? (comma-separated)"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          className="mt-1"
        />
      </div>

      <Button 
        onClick={handleGenerate} 
        disabled={loading || selectedPlatforms.size === 0}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ✨ Generating posts...
          </>
        ) : (
          '✨ Generate Posts'
        )}
      </Button>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
          >
            {selectedPosts.size === generatedPosts.length ? (
              <CheckSquare className="w-4 h-4 mr-1" />
            ) : (
              <Square className="w-4 h-4 mr-1" />
            )}
            {selectedPosts.size === generatedPosts.length ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedPosts.size} posts selected
          </span>
        </div>
        <Button onClick={() => setStep('configure')} variant="outline">
          Back
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-3">
        {generatedPosts.map((post, index) => (
          <Card key={index} className={`relative ${selectedPosts.has(index) ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedPosts.has(index)}
                    onCheckedChange={() => togglePostSelection(index)}
                  />
                  <Badge variant="outline" className="capitalize">
                    {post.platform}
                  </Badge>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(new Date(post.scheduledAt), 'MMM d')}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    {format(new Date(post.scheduledAt), 'h:mm a')}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePost(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={post.content}
                onChange={(e) => updatePostContent(index, e.target.value)}
                className="min-h-20"
              />
              <div className="flex items-center space-x-1 flex-wrap">
                <Hash className="w-3 h-3 text-muted-foreground" />
                {post.hashtags.map((hashtag, hashIndex) => (
                  <Badge key={hashIndex} variant="secondary" className="text-xs">
                    {hashtag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button 
        onClick={handleSchedulePosts}
        disabled={loading || selectedPosts.size === 0}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Scheduling posts...
          </>
        ) : (
          `Schedule ${selectedPosts.size} Selected Posts`
        )}
      </Button>
    </div>
  );

  const renderDoneStep = () => (
    <div className="text-center space-y-4">
      <div className="text-6xl">✅</div>
      <h3 className="text-lg font-semibold">
        {scheduledCount} posts scheduled!
      </h3>
      <p className="text-muted-foreground">
        Your posts have been added to the calendar and will be published at the scheduled times.
      </p>
      <div className="flex space-x-2">
        <Button onClick={onClose} className="flex-1">
          View in Calendar
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          Close
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            ✨ Auto-fill Calendar
            {step === 'configure' && ' - Configure'}
            {step === 'review' && ' - Review & Edit'}
            {step === 'done' && ' - Complete'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto">
          {step === 'configure' && renderConfigureStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'done' && renderDoneStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
};