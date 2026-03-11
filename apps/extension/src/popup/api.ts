// API client for Chrome extension - uses native fetch, no axios

interface WorkspaceInfo {
  name: string
  user: { name: string }
}

interface SocialAccount {
  _id: string
  platform: string
  username: string
  isConnected: boolean
}

interface CreatePostData {
  platforms: string[]
  content: string
  scheduledAt?: string
}

interface Post {
  _id: string
  content: string
  status: string
  scheduledAt: string
}

// Get base URL from storage or default
async function getBaseUrl(): Promise<string> {
  const result = await chrome.storage.local.get(['baseUrl'])
  return result.baseUrl || 'http://localhost:5000'
}

// Get API key from chrome storage
export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(['apiKey'])
  return result.apiKey || null
}

// Set API key in chrome storage
export async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ apiKey })
}

// Clear API key from chrome storage
export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove(['apiKey'])
}

// Make authenticated API request
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = await getBaseUrl()
  const apiKey = await getApiKey()
  
  if (!apiKey) {
    throw new Error('No API key found')
  }
  
  const url = `${baseUrl}${endpoint}`
  
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    ...options.headers
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} ${errorText}`)
  }
  
  return response
}

// Test API connection and get workspace info
export async function testConnection(apiKey: string): Promise<WorkspaceInfo | null> {
  try {
    // Temporarily store API key for the test
    const originalKey = await getApiKey()
    await setApiKey(apiKey)
    
    const response = await apiRequest('/api/v2/zapier/auth/test')
    const data = await response.json()
    
    // Restore original key if test failed
    if (!data.workspace) {
      if (originalKey) {
        await setApiKey(originalKey)
      } else {
        await clearApiKey()
      }
      return null
    }
    
    return {
      name: data.workspace.name,
      user: { name: data.user.name }
    }
  } catch (error) {
    console.error('Connection test failed:', error)
    return null
  }
}

// Get connected social platforms
export async function getPlatforms(apiKey: string): Promise<SocialAccount[]> {
  try {
    const response = await apiRequest('/api/v2/social-accounts')
    const data = await response.json()
    
    return data.data.map((account: any) => ({
      _id: account._id,
      platform: account.platform,
      username: account.username || account.name,
      isConnected: account.isConnected !== false
    }))
  } catch (error) {
    console.error('Failed to get platforms:', error)
    return []
  }
}

// Create a new post
export async function createPost(apiKey: string, postData: CreatePostData): Promise<Post> {
  try {
    // For each platform, create a separate post
    const posts = []
    
    for (const platformId of postData.platforms) {
      const payload = {
        socialAccountId: platformId,
        platform: 'auto', // Let backend determine from social account
        content: postData.content,
        scheduledAt: postData.scheduledAt,
        contentType: 'post'
      }
      
      const response = await apiRequest('/api/v2/posts', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      const data = await response.json()
      posts.push(data.data)
    }
    
    // Return the first post (they should all be similar)
    return posts[0]
  } catch (error) {
    console.error('Failed to create post:', error)
    throw error
  }
}

// Get posts (for potential future use)
export async function getPosts(limit: number = 10): Promise<Post[]> {
  try {
    const response = await apiRequest(`/api/v2/posts?limit=${limit}`)
    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Failed to get posts:', error)
    return []
  }
}

// Set base URL (for configuration)
export async function setBaseUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ baseUrl: url })
}

// Get base URL (for configuration)
export async function getStoredBaseUrl(): Promise<string> {
  const result = await chrome.storage.local.get(['baseUrl'])
  return result.baseUrl || 'http://localhost:5000'
}