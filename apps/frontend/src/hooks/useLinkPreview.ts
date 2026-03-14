import { useState, useEffect, useCallback } from 'react';
import { LinkPreview } from '@/components/composer/LinkPreviewCard';

interface UseLinkPreviewProps {
  content: string;
  enabled?: boolean;
}

// Mock link preview service - in real app, this would call your backend
const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock data based on common domains
  const domain = new URL(url).hostname.toLowerCase();
  
  if (domain.includes('github.com')) {
    return {
      url,
      title: 'GitHub Repository',
      description: 'A great open source project with lots of stars and contributors.',
      image: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      siteName: 'GitHub',
    };
  }
  
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    return {
      url,
      title: 'Amazing Video Title',
      description: 'This video will change your life! Watch now to learn incredible tips and tricks.',
      image: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      siteName: 'YouTube',
    };
  }
  
  if (domain.includes('twitter.com') || domain.includes('x.com')) {
    return {
      url,
      title: 'Tweet from @username',
      description: 'An interesting tweet that sparked a lot of discussion in the community.',
      image: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png',
      siteName: 'Twitter',
    };
  }
  
  // Default preview
  return {
    url,
    title: 'Interesting Article Title',
    description: 'This is a fascinating article that covers important topics and provides valuable insights.',
    image: undefined,
    siteName: new URL(url).hostname,
  };
};

export function useLinkPreview({ content, enabled = true }: UseLinkPreviewProps) {
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreview>>({});
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());
  const [removedUrls, setRemovedUrls] = useState<Set<string>>(new Set());

  // Extract URLs from content
  const extractUrls = useCallback((text: string): string[] => {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return text.match(urlRegex) || [];
  }, []);

  // Fetch preview for a URL
  const fetchPreview = useCallback(async (url: string) => {
    if (!enabled || removedUrls.has(url) || linkPreviews[url] || loadingUrls.has(url)) {
      return;
    }

    setLoadingUrls(prev => new Set([...prev, url]));

    try {
      const preview = await fetchLinkPreview(url);
      setLinkPreviews(prev => ({
        ...prev,
        [url]: preview,
      }));
    } catch (error) {
      console.error('Failed to fetch link preview:', error);
    } finally {
      setLoadingUrls(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
    }
  }, [enabled, removedUrls, linkPreviews, loadingUrls]);

  // Process content for URLs
  useEffect(() => {
    if (!enabled) return;

    const urls = extractUrls(content);
    
    // Fetch previews for new URLs
    urls.forEach(url => {
      if (!linkPreviews[url] && !loadingUrls.has(url) && !removedUrls.has(url)) {
        fetchPreview(url);
      }
    });

    // Remove previews for URLs no longer in content
    Object.keys(linkPreviews).forEach(url => {
      if (!urls.includes(url)) {
        setLinkPreviews(prev => {
          const newPreviews = { ...prev };
          delete newPreviews[url];
          return newPreviews;
        });
      }
    });
  }, [content, enabled, extractUrls, fetchPreview, linkPreviews, loadingUrls, removedUrls]);

  // Remove a link preview
  const removePreview = useCallback((url: string) => {
    setRemovedUrls(prev => new Set([...prev, url]));
    setLinkPreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[url];
      return newPreviews;
    });
  }, []);

  // Refresh a link preview
  const refreshPreview = useCallback(async (url: string) => {
    // Remove from cache and refetch
    setLinkPreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[url];
      return newPreviews;
    });
    
    setRemovedUrls(prev => {
      const newSet = new Set(prev);
      newSet.delete(url);
      return newSet;
    });

    await fetchPreview(url);
  }, [fetchPreview]);

  // Upload custom image for preview
  const uploadCustomImage = useCallback(async (url: string, file: File): Promise<void> => {
    // In real app, upload file and get URL
    const imageUrl = URL.createObjectURL(file);
    
    setLinkPreviews(prev => ({
      ...prev,
      [url]: {
        ...prev[url],
        image: imageUrl,
      },
    }));
  }, []);

  // Get current URLs in content
  const currentUrls = extractUrls(content);
  
  // Get visible previews (not removed and in current content)
  const visiblePreviews = currentUrls
    .filter(url => !removedUrls.has(url))
    .map(url => ({
      url,
      preview: linkPreviews[url],
      isLoading: loadingUrls.has(url),
    }))
    .filter(item => item.preview || item.isLoading);

  return {
    previews: visiblePreviews,
    removePreview,
    refreshPreview,
    uploadCustomImage,
  };
}