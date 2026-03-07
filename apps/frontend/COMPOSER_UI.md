# Composer Frontend UI

A comprehensive React-based composer interface for creating, editing, and publishing social media posts across multiple platforms.

## Features

- **Multi-Platform Support**: Create posts for Twitter, LinkedIn, Facebook, and Instagram
- **Platform-Specific Content**: Customize content for each platform with character limit enforcement
- **Auto-Save**: Automatic draft saving with 3-second debounce
- **Media Upload**: Drag-and-drop file upload with progress tracking
- **Three Publish Modes**:
  - Post Now: Publish immediately
  - Schedule: Choose a specific date and time
  - Add to Queue: Post at next available queue slot
- **Real-Time Preview**: See how your post will look on each platform
- **Multi-Account Selection**: Select multiple accounts across different platforms

## Architecture

### Component Hierarchy

```
ComposerContainer (Main orchestrator)
├── StatusBar (Auto-save status)
├── AccountSelector (Multi-select accounts)
├── ContentSection
│   ├── PlatformTabs (Platform-specific content)
│   └── AI Assistant (Content generation)
├── MediaUploadSection
│   └── MediaItem (Individual media with progress)
├── PublishModeSelector
│   ├── SchedulePicker (Date/time selection)
│   └── QueueSlotSelector (Queue slot selection)
├── PreviewSection
│   └── PlatformPreview (Platform-specific preview)
└── ComposerActions (Save, Publish, Cancel buttons)
```

### State Management

**Zustand Store** (`composer.store.ts`):
- Manages local composer state
- Handles auto-save logic with debouncing
- Coordinates media uploads
- Tracks save status and errors

**Key State**:
- `mainContent`: Main post content
- `platformContent`: Platform-specific content overrides
- `selectedAccounts`: Array of selected account IDs
- `media`: Array of uploaded media files
- `publishMode`: NOW, SCHEDULE, or QUEUE
- `saveStatus`: idle, saving, saved, or error

### Services

**Composer Service** (`composer.service.ts`):
- `createDraft()`: Create new draft
- `updateDraft()`: Update existing draft
- `publishPost()`: Publish with mode (NOW/SCHEDULE/QUEUE)
- `uploadMedia()`: Upload media files with progress
- `getQueueSlots()`: Fetch available queue slots

## Usage

### Basic Usage

```tsx
import { ComposerContainer } from '@/components/composer/ComposerContainer';

function CreatePostPage() {
  const navigate = useNavigate();

  return (
    <ComposerContainer
      onSuccess={(postId) => navigate('/posts')}
      onCancel={() => navigate('/posts')}
    />
  );
}
```

### Edit Existing Draft

```tsx
<ComposerContainer
  draftId="draft-id-here"
  onSuccess={(postId) => navigate('/posts')}
  onCancel={() => navigate('/posts')}
/>
```

## Auto-Save

The composer automatically saves drafts:
- Debounced with 3-second delay after content changes
- Creates new draft on first save
- Updates existing draft on subsequent saves
- Retries automatically on failure (5-second delay)
- Shows save status in StatusBar component

## Media Upload

Supports drag-and-drop and click-to-browse:
- **Images**: JPG, PNG, GIF, WebP (max 10MB)
- **Videos**: MP4, MOV, AVI (max 100MB)
- Parallel uploads with progress tracking
- Retry on failure
- Thumbnail previews

## Platform-Specific Content

Users can customize content for each platform:
- Click platform tabs to switch between platforms
- Content defaults to main content if not customized
- Character limits enforced per platform:
  - Twitter: 280 characters
  - LinkedIn: 3,000 characters
  - Facebook: 63,206 characters
  - Instagram: 2,200 characters

## Publish Modes

### Post Now
Publishes immediately to all selected accounts.

### Schedule
Choose a specific date and time for publishing.
- Date must be in the future
- Uses datetime-local input

### Add to Queue
Posts at the next available queue slot.
- Default slots: 9 AM, 11 AM, 1 PM, 3 PM, 5 PM
- Shows occupied vs available slots
- Auto-selects next available slot

## Validation

Before publishing, the composer validates:
- At least one account selected
- Content exists (main or platform-specific)
- Character limits not exceeded for any platform
- Scheduled date is in future (if schedule mode)
- Queue slot selected (if queue mode)

## Error Handling

- **Network Errors**: Auto-retry with exponential backoff
- **Validation Errors**: Display inline near relevant fields
- **Upload Errors**: Show error message with retry button
- **API Errors**: Display user-friendly error messages

## Troubleshooting

### Auto-save not working
- Check browser console for errors
- Ensure content is not empty
- Verify backend API is accessible

### Media upload fails
- Check file size and type
- Verify backend media upload endpoint
- Check network connection

### Publish fails
- Review validation errors
- Check selected accounts are active
- Verify backend publish endpoint

## Development

### Adding New Platform

1. Add platform to `SocialPlatform` type in `composer.types.ts`
2. Add character limit to `PLATFORM_LIMITS`
3. Add platform icon to `PlatformTabs.tsx`
4. Add platform preview to `PlatformPreview.tsx`

### Customizing Auto-Save

Edit the debounce timeout in `ComposerContainer.tsx`:

```tsx
// Change from 3000ms to desired value
autoSaveTimerRef.current = setTimeout(() => {
  saveDraft();
}, 3000); // <-- Change this value
```

## API Integration

The composer integrates with these backend endpoints:

- `POST /composer/drafts` - Create draft
- `PATCH /composer/drafts/:id` - Update draft
- `GET /composer/drafts/:id` - Get draft
- `POST /composer/posts/:id/publish` - Publish post
- `POST /composer/media/upload` - Upload media
- `GET /composer/queue-slots` - Get queue slots

## Future Enhancements

- AI-powered content generation
- Hashtag suggestions
- Best time to post recommendations
- Multi-image carousel support
- Video thumbnail generation
- Draft templates
- Collaborative editing
