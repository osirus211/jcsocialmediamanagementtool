# Social Media Manager - Chrome Extension

A Chrome extension for quickly sharing any webpage or selected text to your social media accounts.

## Features

- **Quick Share**: Share any webpage with a single click
- **Selected Text**: Share highlighted text from any page
- **Multiple Platforms**: Post to all your connected social media accounts
- **Scheduling**: Post immediately or schedule for later
- **Context Menu**: Right-click to share from anywhere
- **Secure**: Uses API key authentication with your main app

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Chrome browser
- Running Social Media Manager backend (localhost:5000)

### Build the Extension

```bash
cd apps/extension
npm install
npm run build
```

### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `apps/extension/dist/` folder
5. The extension should now appear in your extensions list

### Get API Key

1. Open your Social Media Manager app (localhost:3000)
2. Go to Settings → API Keys
3. Create a new API key with `posts:write` scope
4. Copy the API key (starts with `sk_`)

### Connect the Extension

1. Click the extension icon in Chrome toolbar
2. Paste your API key in the setup screen
3. Click "Connect"
4. You're ready to start sharing!

## Usage

### Quick Share Popup

1. Click the extension icon while on any webpage
2. The popup will pre-fill with the page title and URL
3. Edit the content as needed
4. Select which platforms to post to
5. Choose "Post Now" or "Schedule" for later
6. Click "Share"

### Context Menu

1. Right-click anywhere on a webpage
2. Select "Share to Social Media"
3. The popup will open with page information

### Selected Text

1. Highlight text on any webpage
2. Open the extension popup
3. The selected text will be included in the content

## Configuration

### Change Backend URL

By default, the extension connects to `http://localhost:5000`. To change this:

1. Open the extension popup
2. Go to Settings (gear icon)
3. The base URL can be configured in the extension's storage

### Default Platforms

1. Open extension Settings
2. Select your preferred platforms under "Default Platforms"
3. Click "Save Defaults"
4. These platforms will be pre-selected for new posts

## Security

- API keys are stored securely in Chrome's local storage
- All requests use HTTPS in production
- API keys can be revoked from the main app at any time
- Extension only requests necessary permissions

## Permissions

The extension requests these permissions:

- `activeTab`: Read current page title and URL
- `storage`: Store API key and preferences
- `contextMenus`: Add right-click menu option
- `notifications`: Show success/error notifications
- `host_permissions`: Connect to your backend API

## Troubleshooting

### Connection Issues

1. Verify your backend is running on localhost:5000
2. Check that your API key is valid and has `posts:write` scope
3. Ensure CORS is configured to allow chrome-extension origins

### Extension Not Loading

1. Check the Chrome developer console for errors
2. Verify the manifest.json is valid
3. Try reloading the extension in chrome://extensions

### API Errors

1. Check that your social media accounts are connected
2. Verify the API key hasn't expired
3. Check the backend logs for detailed error messages

## Development

### File Structure

```
apps/extension/
├── manifest.json          # Extension manifest
├── popup.html            # Popup HTML
├── src/
│   ├── popup/
│   │   ├── main.tsx      # React entry point
│   │   ├── App.tsx       # Main popup component
│   │   └── api.ts        # API client
│   ├── background/
│   │   └── background.ts # Service worker
│   └── content/
│       └── content.ts    # Content script
├── vite.config.ts        # Build configuration
└── package.json          # Dependencies
```

### Build Commands

- `npm run dev`: Build with watch mode for development
- `npm run build`: Production build

### Extension ID

After publishing to Chrome Web Store, update the CORS configuration in `apps/backend/src/app.ts` with the actual extension ID:

```typescript
const allowedOrigins = [
  config.cors.origin,
  'chrome-extension://your-actual-extension-id-here'
];
```

## Publishing

1. Build the extension: `npm run build`
2. Zip the `dist/` folder
3. Upload to Chrome Web Store Developer Dashboard
4. Update backend CORS with the published extension ID