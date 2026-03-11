// Background service worker for Chrome extension

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'shareToSocialMedia',
    title: 'Share to Social Media',
    contexts: ['page', 'selection', 'link']
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'shareToSocialMedia') {
    // Open popup with page info
    chrome.action.openPopup()
  }
})

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    // Get current active tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          title: tabs[0].title,
          url: tabs[0].url,
          favIconUrl: tabs[0].favIconUrl
        })
      }
    })
    return true // Keep message channel open for async response
  }
  
  if (request.action === 'openFullApp') {
    chrome.tabs.create({ url: 'http://localhost:3000' })
  }
  
  if (request.action === 'showNotification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Social Media Manager',
      message: request.message
    })
  }
})

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.tabs.create({ url: 'http://localhost:3000' })
})

// Handle storage changes for API key validation
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.apiKey) {
    // API key changed, could trigger re-validation
    console.log('API key updated in storage')
  }
})

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This won't fire if popup is defined, but keeping for completeness
  chrome.action.openPopup()
})