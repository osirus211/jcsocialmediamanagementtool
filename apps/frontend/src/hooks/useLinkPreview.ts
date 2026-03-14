import { useState, useEffect, useCallback } from 'react';
import { LinkPreview } from '@/components/composer/LinkPreviewCard';
import { apiClient } from '@/lib/api-client';

interface UseLinkPreviewProps {
  content: string;
  enabled?: boolean;
}

// Real link preview service using backend API
const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  try {
    const response = await apiClient.post('/link-preview', { url });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch link preview:', error);
    
    // Fallback preview on error
    return {
      url,
      title: new URL(url).hostname,
      description: 'Unable to fetch preview',
      siteName: new URL(url).hostname,
    };
  }
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

  // Update URL with UTM parameters
  const updateUrl = useCallback((oldUrl: string, newUrl: string) => {
    setLinkPreviews(prev => {
      if (!prev[oldUrl]) return prev;
      
      const newPreviews = { ...prev };
      const preview = newPreviews[oldUrl];
      delete newPreviews[oldUrl];
      newPreviews[newUrl] = { ...preview, url: newUrl };
      
      return newPreviews;
    });
    
    // Remove old URL from removed set if it exists
    setRemovedUrls(prev => {
      const newSet = new Set(prev);
      newSet.delete(oldUrl);
      return newSet;
    });
  }, []);

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
    updateUrl,
  };
}