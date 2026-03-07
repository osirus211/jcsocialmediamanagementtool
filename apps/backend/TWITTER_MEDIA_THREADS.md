# Twitter Media Upload & Thread Posting

## Overview

TwitterProvider now supports:
1. **Media Upload** - Upload images to tweets
2. **Thread Posting** - Post multi-tweet chains

## 1. Media Upload

### API Endpoint
```
POST https://upload.twitter.com/1.1/media/upload.json
```

### Flow
```
1. Download media from mediaUrl
2. Validate size (max 5MB)
3. Upload binary to Twitter
4. Extract media_id_string
5. Attach to tweet request
```

### Implementation

**Upload Single Media**:
```typescript
private async uploadMedia(
  mediaUrl: string,
  accessToken: string,
  accountId: string
): Promise<string>
```

**Steps**:
1. Fetch media from URL
2. Convert to ArrayBuffer
3. Validate size ≤ 5MB
4. Create FormData with Blob
5. POST to upload endpoint
6. Return media_id_string

**Error Handling**:
- Network/timeout → retryable (statusCode=0)
- Size > 5MB → permanent (statusCode=400)
- 401/403 → permanent (invalid token/permission)
- 429/500/503 → retryable (rate limit/server error)

### Tweet Request with Media

**Without Media**:
```json
{
  "text": "Hello world!"
}
```

**With Media**:
```json
{
  "text": "Check out these images!",
  "media": {
    "media_ids": ["1234567890", "9876543210"]
  }
}
```

### Limits

| Limit | Value |
|-------|-------|
| Max media per tweet | 4 |
| Max image size | 5MB |
| Supported types | image/jpeg, image/png, image/gif |

### Example Usage

**Single Image**:
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Beautiful sunset!',
  mediaUrls: ['https://example.com/sunset.jpg']
});
```

**Multiple Images**:
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Photo gallery',
  mediaUrls: [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg',
    'https://example.com/photo3.jpg'
  ]
});
```

### Validation Errors (Permanent)

```typescript
// Too many media files
{
  success: false,
  retryable: false,
  errorCode: 'INVALID_REQUEST',
  errorMessage: 'Twitter allows maximum 4 media attachments per tweet'
}

// Image too large
{
  success: false,
  retryable: false,
  errorCode: 'INVALID_REQUEST',
  errorMessage: 'Media size 7.5MB exceeds 5MB limit'
}
```

### Retry Behavior

**Network Error During Upload**:
```
1. Worker calls provider.publishPost()
2. Provider downloads media → network timeout
3. Provider throws error with statusCode=0 (retryable)
4. Worker retries entire post (including media upload)
5. BullMQ exponential backoff: 5s → 25s → 125s
```

**Upload Success, Tweet Fails**:
```
1. Provider uploads media → success (media_ids obtained)
2. Provider posts tweet → rate limit (429)
3. Provider throws error with statusCode=429 (retryable)
4. Worker retries entire post
5. Media re-uploaded (idempotent - Twitter handles duplicates)
6. Tweet posted with media
```

## 2. Thread Posting

### Concept

A thread is a chain of tweets where each tweet replies to the previous one:
```
Tweet 1 (root)
  └─ Tweet 2 (reply to 1)
      └─ Tweet 3 (reply to 2)
          └─ Tweet 4 (reply to 3)
```

### API Structure

**Tweet with Reply**:
```json
{
  "text": "This is tweet 2",
  "reply": {
    "in_reply_to_tweet_id": "1234567890"
  }
}
```

### Implementation

**Post Thread**:
```typescript
private async postThread(
  accessToken: string,
  params: PublishPostParams,
  thread: string[]
): Promise<string>
```

**Flow**:
1. Post first tweet (root) with media if provided
2. For each thread message:
   - Post as reply to previous tweet
   - Track previous tweet ID
3. Return root tweet ID

### Example Usage

**Simple Thread**:
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Thread 1/4: Introduction',
  metadata: {
    thread: [
      'Thread 2/4: Main point',
      'Thread 3/4: Supporting evidence',
      'Thread 4/4: Conclusion'
    ]
  }
});
```

**Thread with Media** (media only on first tweet):
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Check out this analysis! 🧵',
  mediaUrls: ['https://example.com/chart.png'],
  metadata: {
    thread: [
      'First, let\'s look at the data...',
      'The trend shows...',
      'In conclusion...'
    ]
  }
});
```

### Limits

| Limit | Value |
|-------|-------|
| Max thread length | 25 tweets |
| Max chars per tweet | 280 |

### Validation Errors (Permanent)

```typescript
// Thread too long
{
  success: false,
  retryable: false,
  errorCode: 'INVALID_REQUEST',
  errorMessage: 'Twitter thread cannot exceed 25 tweets'
}

// Tweet in thread too long
{
  success: false,
  retryable: false,
  errorCode: 'INVALID_REQUEST',
  errorMessage: 'Thread message 3 exceeds 280 character limit'
}
```

### Thread Failure Scenarios

#### Scenario 1: Network Error on Tweet 3

```
Flow:
1. Post tweet 1 (root) → success (ID: 111)
2. Post tweet 2 (reply to 111) → success (ID: 222)
3. Post tweet 3 (reply to 222) → network timeout
4. Provider throws error with statusCode=0 (retryable)
5. Worker retries ENTIRE thread
6. Post tweet 1 (root) → success (ID: 333, NEW THREAD)
7. Post tweet 2 (reply to 333) → success (ID: 444)
8. Post tweet 3 (reply to 444) → success (ID: 555)
9. Result: Two partial threads exist (111→222 and 333→444→555)
```

**Note**: Partial threads are left on Twitter. This is expected behavior - Twitter has no transaction rollback.

#### Scenario 2: Rate Limit on Tweet 2

```
Flow:
1. Post tweet 1 (root) → success (ID: 111)
2. Post tweet 2 (reply to 111) → rate limit (429)
3. Provider throws error with statusCode=429 (retryable)
4. Worker waits 5 seconds (exponential backoff)
5. Worker retries ENTIRE thread
6. Post tweet 1 (root) → success (ID: 222, NEW THREAD)
7. Post tweet 2 (reply to 222) → success (ID: 333)
8. Post tweet 3 (reply to 333) → success (ID: 444)
9. Result: Two threads (111 standalone, 222→333→444 complete)
```

#### Scenario 3: Invalid Token (Permanent)

```
Flow:
1. Post tweet 1 (root) → success (ID: 111)
2. Post tweet 2 (reply to 111) → 401 unauthorized
3. Provider throws error with statusCode=401 (permanent)
4. Worker marks post as FAILED (no retry)
5. Result: Partial thread (111 standalone)
```

### Retry Behavior

**Key Point**: Worker retries the ENTIRE thread, not individual tweets.

**Retryable Error**:
- Network timeout
- Rate limit (429)
- Server error (500/503)
- Result: Entire thread re-posted (may create duplicate partial threads)

**Permanent Error**:
- Invalid token (401)
- Forbidden (403)
- Content rejected (400)
- Result: Post marked as FAILED, partial thread remains

### Logging

**Thread Start**:
```typescript
logger.info('Posting Twitter thread', {
  accountId: '507f1f77bcf86cd799439011',
  threadLength: 3
});
```

**Root Tweet Posted**:
```typescript
logger.info('Posted thread root tweet', {
  accountId: '507f1f77bcf86cd799439011',
  tweetId: '1234567890'
});
```

**Reply Posted**:
```typescript
logger.info('Posted thread reply', {
  accountId: '507f1f77bcf86cd799439011',
  tweetId: '9876543210',
  replyTo: '1234567890',
  position: 2
});
```

**Thread Complete**:
```typescript
logger.info('Thread posted successfully', {
  accountId: '507f1f77bcf86cd799439011',
  rootTweetId: '1234567890',
  totalTweets: 4
});
```

**Thread Failed**:
```typescript
logger.error('Thread posting failed', {
  accountId: '507f1f77bcf86cd799439011',
  rootTweetId: '1234567890',
  error: 'Rate limit exceeded',
  statusCode: 429
});
```

## Combined: Media + Thread

**Example**:
```typescript
await provider.publishPost({
  accountId: '507f1f77bcf86cd799439011',
  content: 'Product launch announcement! 🚀',
  mediaUrls: [
    'https://example.com/product1.jpg',
    'https://example.com/product2.jpg'
  ],
  metadata: {
    thread: [
      'Key features include...',
      'Pricing starts at...',
      'Available now at...'
    ]
  }
});
```

**Flow**:
1. Upload media1 → media_id_1
2. Upload media2 → media_id_2
3. Post tweet 1 with media_ids → root tweet
4. Post tweet 2 (reply to root)
5. Post tweet 3 (reply to tweet 2)
6. Post tweet 4 (reply to tweet 3)
7. Return root tweet ID

**Note**: Media only attached to first tweet (root). Subsequent tweets are text-only.

## Error Classification Summary

| Error Type | Example | Retryable | Worker Behavior |
|------------|---------|-----------|-----------------|
| Network timeout | Media download fails | Yes | Retry entire post |
| Rate limit | 429 on tweet 2 | Yes | Retry entire thread |
| Invalid token | 401 on media upload | No | Mark post as FAILED |
| Size limit | Image > 5MB | No | Mark post as FAILED |
| Thread too long | 30 tweets | No | Mark post as FAILED |
| Content rejected | 403 on tweet | No | Mark post as FAILED |
| Server error | 500 on upload | Yes | Retry entire post |

## Testing

### Test Media Upload
```typescript
const post = await Post.create({
  workspaceId: workspace._id,
  accountId: account._id,
  content: 'Test with image',
  mediaUrls: ['https://picsum.photos/800/600'],
  scheduledFor: new Date(Date.now() + 5000),
  status: 'scheduled'
});
```

### Test Thread
```typescript
const post = await Post.create({
  workspaceId: workspace._id,
  accountId: account._id,
  content: 'Thread 1/3',
  metadata: {
    thread: ['Thread 2/3', 'Thread 3/3']
  },
  scheduledFor: new Date(Date.now() + 5000),
  status: 'scheduled'
});
```

### Test Media + Thread
```typescript
const post = await Post.create({
  workspaceId: workspace._id,
  accountId: account._id,
  content: 'Announcement with images 🧵',
  mediaUrls: [
    'https://picsum.photos/800/600',
    'https://picsum.photos/800/601'
  ],
  metadata: {
    thread: ['More details...', 'Final thoughts...']
  },
  scheduledFor: new Date(Date.now() + 5000),
  status: 'scheduled'
});
```

## Monitoring

**Key Metrics**:
- Media upload failures (check for network issues)
- Thread partial completions (check logs for rootTweetId)
- Rate limit errors during threads (may need rate limiting)
- Size validation errors (educate users on limits)

**Log Queries**:
```
# Find partial threads
grep "Thread posting failed" logs | grep "rootTweetId"

# Find media upload failures
grep "Media upload failed" logs

# Find size validation errors
grep "exceeds 5MB limit" logs
```

## Future Enhancements

1. **Video Support**: Add video upload (different endpoint)
2. **Thread Rollback**: Delete partial threads on failure (requires delete API)
3. **Media Retry**: Cache uploaded media_ids to avoid re-upload
4. **Progress Tracking**: Store thread progress in metadata
5. **Alt Text**: Add alt text support for accessibility
