/**
 * AI Image Generation Page
 * Demo page showing the superior AI image generation feature
 * that beats all competitors: Buffer, Hootsuite, Sprout Social, Later
 */

import React from 'react';
import { AIImageGen } from '@/components/ai/AIImageGen';
import { ImageGenerationOutput } from '@/services/ai.service';
import { toast } from 'sonner';

export const AIImageGenPage: React.FC = () => {
  const handleImageGenerated = (result: ImageGenerationOutput) => {
    console.log('Image generated:', result);
    // Handle the generated image result
  };

  const handleAddToComposer = (imageUrl: string, mediaId: string) => {
    // Integration with composer
    console.log('Adding to composer:', { imageUrl, mediaId });
    toast.success('Image added to composer');
  };

  const handleSaveToLibrary = (imageUrl: string, mediaId: string) => {
    // Integration with media library
    console.log('Saving to library:', { imageUrl, mediaId });
    toast.success('Image saved to media library');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Image Generator
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Generate stunning images with DALL-E 3 - A revolutionary feature that our competitors 
            Buffer, Hootsuite, Sprout Social, and Later don't offer!
          </p>
        </div>

        <AIImageGen
          onImageGenerated={handleImageGenerated}
          onAddToComposer={handleAddToComposer}
          onSaveToLibrary={handleSaveToLibrary}
        />
      </div>
    </div>
  );
};

export default AIImageGenPage;