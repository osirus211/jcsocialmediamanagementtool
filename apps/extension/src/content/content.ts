// Content script for extracting page metadata and selected text

interface PageInfo {
  title: string
  url: string
  description?: string
  imageUrl?: string
  selectedText?: string
}

// Extract page metadata
function extractPageMetadata(): PageInfo {
  const title = document.title || ''
  const url = window.location.href
  
  // Get meta description
  const descriptionMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement
  const ogDescriptionMeta = document.querySelector('meta[property="og:description"]') as HTMLMetaElement
  const description = descriptionMeta?.content || ogDescriptionMeta?.content || ''
  
  // Get Open Graph image or first image
  const ogImageMeta = document.querySelector('meta[property="og:image"]') as HTMLMetaElement
  const twitterImageMeta = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement
  const firstImg = document.querySelector('img') as HTMLImageElement
  
  let imageUrl = ogImageMeta?.content || twitterImageMeta?.content || ''
  
  // If no meta image, try to get first meaningful image
  if (!imageUrl && firstImg && firstImg.src) {
    // Only use images that are reasonably sized (likely not icons)
    if (firstImg.width >= 200 && firstImg.height >= 200) {
      imageUrl = firstImg.src
    }
  }
  
  // Get selected text
  const selection = window.getSelection()
  const selectedText = selection ? selection.toString().trim() : ''
  
  return {
    title,
    url,
    description,
    imageUrl,
    selectedText: selectedText.length > 0 ? selectedText : undefined
  }
}

// Get canonical URL if available
function getCanonicalUrl(): string {
  const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
  return canonicalLink?.href || window.location.href
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageInfo') {
    const pageInfo = extractPageMetadata()
    
    // Use canonical URL if available
    pageInfo.url = getCanonicalUrl()
    
    sendResponse(pageInfo)
    return true
  }
  
  if (request.action === 'getSelectedText') {
    const selection = window.getSelection()
    const selectedText = selection ? selection.toString().trim() : ''
    sendResponse({ selectedText })
    return true
  }
})

// Optional: Listen for selection changes to update popup in real-time
let selectionTimeout: NodeJS.Timeout
document.addEventListener('selectionchange', () => {
  // Debounce selection changes
  clearTimeout(selectionTimeout)
  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection()
    const selectedText = selection ? selection.toString().trim() : ''
    
    // Could send message to background script to update badge or popup
    if (selectedText.length > 0) {
      chrome.runtime.sendMessage({
        action: 'selectionChanged',
        selectedText: selectedText.substring(0, 100) // Limit length
      })
    }
  }, 500)
})

// Initialize content script
console.log('Social Media Manager content script loaded')