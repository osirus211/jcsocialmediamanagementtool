/**
 * AI Image Generation Component
 * DALL-E 3 integration - Superior to all competitors!
 * Buffer, Hootsuite, Sprout Social, Later don't have this feature
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Wand2, Download, Plus, RefreshCw, Copy, Sparkles, Image as ImageIcon, History } from 'lucide-react';
import { toast } from 'sonner';
import { aiService, ImageGenerationInput, ImageGenerationOutput, ImageGenerationHistory } from '@/services/ai.service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AIImageGenProps {
  onImageGenerated?: (result: ImageGenerationOutput) => void;
  onAddToComposer?: (imageUrl: string, mediaId: string) => void;
  onSaveToLibrary?: (imageUrl: string, mediaId: string) => void;
}

// Prompt suggestions for different styles
const PROMPT_SUGGESTIONS = {
  photorealistic: [
    'A professional headshot of a confident business person in modern office',
    'High-quality product photography of a smartphone on white background',
    'Portrait of a chef in a modern kitchen, natural lighting',
    'Lifestyle photo of people using laptops in a coffee shop',
  ],
  illustration: [
    'Minimalist illustration of a rocket launching into space',
    'Flat design illustration of a team collaborating around a table',
    'Vector-style illustration of a city skyline at sunset',
    'Modern illustration of a person meditating in nature',
  ],
  '3d': [
    '3D render of a futuristic car in a neon-lit garage',
    '3D isometric illustration of a smart home with IoT devices',
    'Stylized 3D character of a friendly robot assistant',
    '3D architectural visualization of a modern office building',
  ],
  cartoon: [
    'Cartoon mascot character for a tech startup, friendly and approachable',
    'Animated-style illustration of animals having a picnic',
    'Comic book style superhero character in action pose',
    'Cute cartoon food characters with happy expressions',
  ],
  abstract: [
    'Abstract geometric pattern in vibrant colors for social media',
    'Flowing abstract shapes representing data and connectivity',
    'Minimalist abstract composition with gradients and shapes',
    'Dynamic abstract background with energy and movement',
  ],
};

// Platform-specific size presets
const PLATFORM_PRESETS = {
  'Instagram Post': { size: '1024x1024' as const, description: 'Square format' },
  'Instagram Story': { size: '1024x1792' as const, description: 'Vertical format' },
  'Facebook Post': { size: '1024x1024' as const, description: 'Square format' },
  'LinkedIn Post': { size: '1024x1024' as const, description: 'Square format' },
  'Twitter Header': { size: '1792x1024' as const, description: 'Horizontal format' },
  'Blog Header': { size: '1792x1024' as const, description: 'Horizontal format' },
};

// Cost calculator
const calculateCost = (size: string, quality: string): number => {
  const pricing = {
    '1024x1024': { standard: 0.040, hd: 0.080 },
    '1024x1792': { standard: 0.080, hd: 0.120 },
    '1792x1024': { standard: 0.080, hd: 0.120 },
  };
  return pricing[size as keyof typeof pricing]?.[quality as 'standard' | 'hd'] || 0.040;
};

export const AIImageGen: React.FC<AIImageGenProps> = ({
  onImageGenerated,
  onAddToComposer,
  onSaveToLibrary,
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<keyof typeof PROMPT_SUGGESTIONS>('photorealistic');
  const [size, setSize] = useState<'1024x1024' | '1024x1792' | '1792x1024'>('1024x1024');
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
  const [style, setStyle] = useState<'vivid' | 'natural'>('vivid');
  const [generatedImage, setGeneratedImage] = useState<ImageGenerationOutput | null>(null);
  const [activeTab, setActiveTab] = useState('generate');

  const queryClient = useQueryClient();

  // Fetch generation history
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['ai-image-history'],
    queryFn: () => aiService.getImageHistory(10),
    enabled: activeTab === 'history',
  });

  // Generate image mutation
  const generateMutation = useMutation({
    mutationFn: (input: ImageGenerationInput) => aiService.generateImage(input),
    onSuccess: (result) => {
      setGeneratedImage(result);
      onImageGenerated?.(result);
      queryClient.invalidateQueries({ queryKey: ['ai-image-history'] });
      toast.success('Image generated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate image');
    },
  });

  // Generate variation mutation
  const variationMutation = useMutation({
    mutationFn: (imageUrl: string) => aiService.generateImageVariation({ imageUrl, size }),
    onSuccess: (result) => {
      setGeneratedImage({
        ...result,
        revisedPrompt: 'Image variation',
        quality: 'standard',
        style: 'natural',
      } as ImageGenerationOutput);
      queryClient.invalidateQueries({ queryKey: ['ai-image-history'] });
      toast.success('Image variation generated!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate variation');
    },
  });

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (prompt.length > 500) {
      toast.error('Prompt must be 500 characters or less');
      return;
    }

    generateMutation.mutate({
      prompt: prompt.trim(),
      size,
      quality,
      style,
    });
  }, [prompt, size, quality, style, generateMutation]);

  const handleVariation = useCallback(() => {
    if (!generatedImage?.imageUrl) {
      toast.error('No image to create variation from');
      return;
    }

    variationMutation.mutate(generatedImage.imageUrl);
  }, [generatedImage, variationMutation]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setPrompt(suggestion);
  }, []);

  const handlePresetClick = useCallback((preset: typeof PLATFORM_PRESETS[keyof typeof PLATFORM_PRESETS]) => {
    setSize(preset.size);
  }, []);

  const handleCopyPrompt = useCallback(() => {
    if (generatedImage?.revisedPrompt) {
      navigator.clipboard.writeText(generatedImage.revisedPrompt);
      toast.success('Prompt copied to clipboard');
    }
  }, [generatedImage]);

  const handleAddToComposer = useCallback(() => {
    if (generatedImage) {
      onAddToComposer?.(generatedImage.imageUrl, generatedImage.mediaId);
      toast.success('Image added to composer');
    }
  }, [generatedImage, onAddToComposer]);

  const handleSaveToLibrary = useCallback(() => {
    if (generatedImage) {
      onSaveToLibrary?.(generatedImage.imageUrl, generatedImage.mediaId);
      toast.success('Image saved to media library');
    }
  }, [generatedImage, onSaveToLibrary]);

  const isGenerating = generateMutation.isPending || variationMutation.isPending;
  const estimatedCost = calculateCost(size, quality);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          <h1 className="text-2xl font-bold">AI Image Generator</h1>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
            DALL-E 3
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Generate stunning images with AI - A feature our competitors don't have!
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Image Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prompt Input */}
                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the image you want to generate..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="resize-none"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{prompt.length}/500 characters</span>
                    <span className="font-medium">Cost: ${estimatedCost.toFixed(3)}</span>
                  </div>
                </div>

                {/* Style Selection */}
                <div className="space-y-2">
                  <Label>Style Category</Label>
                  <Select value={selectedStyle} onValueChange={(value: keyof typeof PROMPT_SUGGESTIONS) => setSelectedStyle(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="photorealistic">📸 Photorealistic</SelectItem>
                      <SelectItem value="illustration">🎨 Illustration</SelectItem>
                      <SelectItem value="3d">🎯 3D Render</SelectItem>
                      <SelectItem value="cartoon">🎭 Cartoon</SelectItem>
                      <SelectItem value="abstract">🌈 Abstract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Prompt Suggestions */}
                <div className="space-y-2">
                  <Label>Prompt Examples</Label>
                  <div className="grid gap-2 max-h-32 overflow-y-auto">
                    {PROMPT_SUGGESTIONS[selectedStyle].map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="text-left h-auto p-2 whitespace-normal"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Platform Presets */}
                <div className="space-y-2">
                  <Label>Platform Presets</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PLATFORM_PRESETS).map(([name, preset]) => (
                      <Button
                        key={name}
                        variant={size === preset.size ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePresetClick(preset)}
                        className="flex flex-col h-auto p-2"
                      >
                        <span className="font-medium">{name}</span>
                        <span className="text-xs opacity-70">{preset.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aspect Ratio</Label>
                    <Select value={size} onValueChange={(value: typeof size) => setSize(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1024x1024">Square (1:1)</SelectItem>
                        <SelectItem value="1024x1792">Portrait (9:16)</SelectItem>
                        <SelectItem value="1792x1024">Landscape (16:9)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Quality</Label>
                    <Select value={quality} onValueChange={(value: typeof quality) => setQuality(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="hd">HD (+2x cost)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Style</Label>
                  <Select value={style} onValueChange={(value: typeof style) => setStyle(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vivid">Vivid (More dramatic)</SelectItem>
                      <SelectItem value="natural">Natural (More realistic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Image
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Preview Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Generated Image</CardTitle>
              </CardHeader>
              <CardContent>
                {generatedImage ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <img
                        src={generatedImage.imageUrl}
                        alt="Generated image"
                        className="w-full rounded-lg shadow-lg"
                      />
                    </div>

                    {/* Image Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Size:</span>
                        <span>{generatedImage.size}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Quality:</span>
                        <span className="capitalize">{generatedImage.quality}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Style:</span>
                        <span className="capitalize">{generatedImage.style}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cost:</span>
                        <span>${generatedImage.cost.toFixed(3)}</span>
                      </div>
                    </div>

                    {/* Revised Prompt */}
                    {generatedImage.revisedPrompt && generatedImage.revisedPrompt !== prompt && (
                      <div className="space-y-2">
                        <Label>AI-Revised Prompt</Label>
                        <div className="relative">
                          <Textarea
                            value={generatedImage.revisedPrompt}
                            readOnly
                            rows={2}
                            className="resize-none pr-10"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-2 right-2 h-6 w-6 p-0"
                            onClick={handleCopyPrompt}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={handleVariation}
                        disabled={isGenerating}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => window.open(generatedImage.imageUrl, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>

                    {/* Integration Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={handleAddToComposer}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add to Composer
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleSaveToLibrary}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Save to Library
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                    <p>Generated image will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generation History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : history.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {history.map((item) => (
                    <Card key={item._id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <img
                          src={item.imageUrl}
                          alt={item.prompt}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                        <p className="text-sm font-medium line-clamp-2 mb-2">
                          {item.prompt}
                        </p>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{item.size}</span>
                          <span>${item.cost.toFixed(3)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <History className="h-12 w-12 mb-4 opacity-50" />
                  <p>No generation history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};