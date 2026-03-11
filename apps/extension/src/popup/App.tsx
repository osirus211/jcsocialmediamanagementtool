import React, { useState, useEffect } from 'react'
import { testConnection, getPlatforms, createPost, getApiKey, setApiKey, clearApiKey } from './api'

interface PageInfo {
  title: string
  url: string
  description?: string
  imageUrl?: string
  selectedText?: string
}

interface SocialAccount {
  _id: string
  platform: string
  username: string
  isConnected: boolean
}

interface WorkspaceInfo {
  name: string
  user: { name: string }
}

type Screen = 'setup' | 'main' | 'settings'

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('setup')
  const [apiKey, setApiKeyState] = useState('')
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [platforms, setPlatforms] = useState<SocialAccount[]>([])
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null)
  const [content, setContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [scheduleType, setScheduleType] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    const storedApiKey = await getApiKey()
    if (storedApiKey) {
      const workspaceData = await testConnection(storedApiKey)
      if (workspaceData) {
        setApiKeyState(storedApiKey)
        setWorkspace(workspaceData)
        setScreen('main')
        await loadPlatforms(storedApiKey)
        await loadPageInfo()
      } else {
        await clearApiKey()
      }
    }
  }

  const loadPlatforms = async (key: string) => {
    try {
      const platformData = await getPlatforms(key)
      setPlatforms(platformData)
      
      // Load default platforms from storage
      const result = await chrome.storage.local.get(['defaultPlatforms'])
      if (result.defaultPlatforms) {
        setSelectedPlatforms(result.defaultPlatforms)
      }
    } catch (err) {
      console.error('Failed to load platforms:', err)
    }
  }

  const loadPageInfo = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' })
        setPageInfo(response)
        
        // Pre-fill content with page title and URL
        const initialContent = response.selectedText || 
          `${response.title}\n\n${response.url}`
        setContent(initialContent)
      }
    } catch (err) {
      console.error('Failed to load page info:', err)
      // Fallback to basic tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      setPageInfo({
        title: tab.title || 'Untitled',
        url: tab.url || ''
      })
      setContent(`${tab.title || 'Untitled'}\n\n${tab.url || ''}`)
    }
  }

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key')
      return
    }

    setLoading(true)
    setError('')

    try {
      const workspaceData = await testConnection(apiKey)
      if (workspaceData) {
        await setApiKey(apiKey)
        setWorkspace(workspaceData)
        setScreen('main')
        await loadPlatforms(apiKey)
        await loadPageInfo()
      } else {
        setError('Invalid API key or connection failed')
      }
    } catch (err) {
      setError('Failed to connect. Please check your API key.')
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (!content.trim()) {
      setError('Please enter some content to share')
      return
    }

    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const postData = {
        platforms: selectedPlatforms,
        content: content.trim(),
        scheduledAt: scheduleType === 'schedule' ? scheduledAt : undefined
      }

      const result = await createPost(apiKey, postData)
      setSuccess('Posted successfully!')
      
      // Show success for 2 seconds then close
      setTimeout(() => {
        window.close()
      }, 2000)
    } catch (err) {
      setError('Failed to create post. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    await clearApiKey()
    setApiKeyState('')
    setWorkspace(null)
    setPlatforms([])
    setScreen('setup')
  }

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    )
  }

  const saveDefaultPlatforms = async () => {
    await chrome.storage.local.set({ defaultPlatforms: selectedPlatforms })
  }

  if (screen === 'setup') {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2>🚀 Social Media Manager</h2>
          <p>Connect your account to start sharing</p>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyState(e.target.value)}
            placeholder="sk_..."
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px', fontSize: '12px', color: '#666' }}>
          Get your API key from Settings → API Keys in the main app
        </div>

        {error && (
          <div style={{ color: 'red', fontSize: '12px', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#007cba',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    )
  }

  if (screen === 'settings') {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => setScreen('main')}
            style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
          >
            ←
          </button>
          <h3 style={{ margin: '0 0 0 10px' }}>Settings</h3>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Connected Workspace</h4>
          <p>{workspace?.name}</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            {workspace?.user.name}
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>API Key</h4>
          <p style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            {apiKey.substring(0, 15)}...
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Default Platforms</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {platforms.filter(p => p.isConnected).map(platform => (
              <label key={platform._id} style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes(platform._id)}
                  onChange={() => togglePlatform(platform._id)}
                  style={{ marginRight: '5px' }}
                />
                {platform.platform} ({platform.username})
              </label>
            ))}
          </div>
          <button
            onClick={saveDefaultPlatforms}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Save Defaults
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <a
            href="#"
            onClick={() => chrome.tabs.create({ url: 'http://localhost:3000' })}
            style={{ color: '#007cba', textDecoration: 'none', fontSize: '14px' }}
          >
            Open full app →
          </a>
        </div>

        <button
          onClick={handleDisconnect}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0 }}>🚀 Quick Share</h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
            {workspace?.name}
          </p>
        </div>
        <button
          onClick={() => setScreen('settings')}
          style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
        >
          ⚙️
        </button>
      </div>

      {/* Page Info */}
      {pageInfo && (
        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
            {pageInfo.title}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {pageInfo.url.length > 50 ? pageInfo.url.substring(0, 50) + '...' : pageInfo.url}
          </div>
          {pageInfo.selectedText && (
            <div style={{ fontSize: '12px', color: '#007cba', marginTop: '5px' }}>
              Selected text: "{pageInfo.selectedText.substring(0, 100)}..."
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What would you like to share?"
          style={{
            width: '100%',
            height: '100px',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            resize: 'vertical'
          }}
        />
        <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>
          {content.length}/5000
        </div>
      </div>

      {/* Platform Selection */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Platforms
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {platforms.filter(p => p.isConnected).map(platform => (
            <button
              key={platform._id}
              onClick={() => togglePlatform(platform._id)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                backgroundColor: selectedPlatforms.includes(platform._id) ? '#007cba' : '#f0f0f0',
                color: selectedPlatforms.includes(platform._id) ? 'white' : 'black',
                border: '1px solid #ddd',
                borderRadius: '15px',
                cursor: 'pointer'
              }}
            >
              {platform.platform}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Options */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Schedule
        </label>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
            <input
              type="radio"
              name="schedule"
              checked={scheduleType === 'now'}
              onChange={() => setScheduleType('now')}
              style={{ marginRight: '5px' }}
            />
            Post Now
          </label>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
            <input
              type="radio"
              name="schedule"
              checked={scheduleType === 'schedule'}
              onChange={() => setScheduleType('schedule')}
              style={{ marginRight: '5px' }}
            />
            Schedule
          </label>
        </div>
        
        {scheduleType === 'schedule' && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{ color: 'red', fontSize: '12px', marginBottom: '15px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ color: 'green', fontSize: '12px', marginBottom: '15px', textAlign: 'center' }}>
          ✅ {success}
        </div>
      )}

      {/* Share Button */}
      <button
        onClick={handleShare}
        disabled={loading || !content.trim() || selectedPlatforms.length === 0}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: loading ? '#ccc' : '#007cba',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Sharing...' : 'Share'}
      </button>
    </div>
  )
}