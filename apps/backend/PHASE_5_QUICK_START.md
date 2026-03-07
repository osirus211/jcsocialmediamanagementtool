# Phase 5 Quick Start Guide

## Installation

### 1. Install Dependencies
```bash
cd apps/backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp
```

### 2. Configure Environment
```bash
# Add to .env file
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET=social-media-scheduler-media
AWS_S3_PUBLIC_URL=https://your-bucket.s3.amazonaws.com
```

### 3. Start Server
```bash
npm run dev
```

### 4. Verify
Check logs for:
```
✅ Phase 5 media processing system started
🎬 Media processing worker started
```

## Quick Reference

### Media Status Flow
```
pending → uploaded → processing → ready
                              ↓
                           failed
```

### Queue Name
```
media_processing_queue
```

### Worker Concurrency
```
5 workers
```

### Retry Strategy
```
3 attempts
Backoff: 2s → 4s → 8s
```

## Usage

### Upload Media
```typescript
import { mediaStorageService } from './services/MediaStorageService';

const result = await mediaStorageService.uploadToS3({
  buffer: fileBuffer,
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  workspaceId: 'workspace123',
});

console.log(result.publicUrl);
```

### Queue Processing
```typescript
import { MediaProcessingQueue } from './queue/MediaProcessingQueue';

const queue = new MediaProcessingQueue();

await queue.add({
  mediaId: 'media123',
  platform: 'facebook',
  mediaType: 'image',
  fileUrl: 'https://example.com/image.jpg',
  storageKey: 'workspace123/2026/03/uuid.jpg',
  workspaceId: 'workspace123',
});
```

### Check Status
```typescript
import { Media, MediaStatus } from './models/Media';

const media = await Media.findById('media123');

if (media.status === MediaStatus.READY) {
  console.log('Media ready for publishing');
}
```

## Platform Adapters

### Facebook
```typescript
import { FacebookMediaAdapter } from './adapters/media/FacebookMediaAdapter';

const adapter = new FacebookMediaAdapter();
const result = await adapter.uploadMedia(account, {
  fileUrl: 'https://example.com/image.jpg',
  mediaType: 'image',
});
```

### Instagram
```typescript
import { InstagramMediaAdapter } from './adapters/media/InstagramMediaAdapter';

const adapter = new InstagramMediaAdapter();
const result = await adapter.uploadMedia(account, {
  fileUrl: 'https://example.com/image.jpg',
  mediaType: 'image',
  caption: 'My post',
});
```

### Twitter
```typescript
import { TwitterMediaAdapter } from './adapters/media/TwitterMediaAdapter';

const adapter = new TwitterMediaAdapter();
const result = await adapter.uploadMedia(account, {
  fileUrl: 'https://example.com/image.jpg',
  mediaType: 'image',
});
```

## Monitoring

### Check Queue Stats
```bash
redis-cli KEYS "*media_processing_queue*"
redis-cli HGETALL "bull:media_processing_queue:active"
redis-cli LLEN "bull:media_processing_queue:wait"
redis-cli ZCARD "bull:media_processing_queue:failed"
```

### Check Metrics
```bash
curl http://localhost:3000/metrics | grep media_processing
```

### View Logs
```bash
tail -f logs/app.log | grep "media processing"
```

## Troubleshooting

### Queue Not Processing
```bash
# Check worker status
curl http://localhost:3000/health

# Check Redis connection
redis-cli PING

# Check queue depth
redis-cli LLEN "bull:media_processing_queue:wait"
```

### Processing Failures
```bash
# Check failed jobs
redis-cli ZRANGE "bull:media_processing_queue:failed" 0 10 WITHSCORES

# Check logs
tail -f logs/app.log | grep "ERROR.*media"
```

### S3 Upload Failures
```bash
# Check AWS credentials
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY

# Test S3 connection
aws s3 ls s3://your-bucket
```

## Common Issues

### Issue: "Cannot find module 'sharp'"
**Solution**:
```bash
npm install sharp
```

### Issue: "S3 upload failed"
**Solution**:
- Check AWS credentials in .env
- Verify bucket exists
- Check bucket permissions

### Issue: "Media stuck in processing"
**Solution**:
- Check worker logs
- Check Redis connection
- Restart worker

### Issue: "Image too large"
**Solution**:
- Max image size: 10 MB
- Max video size: 100 MB
- Images auto-resized to 2048x2048

## Performance Tips

### Optimize Image Processing
```typescript
// Use lower quality for thumbnails
const thumbnail = await sharp(buffer)
  .resize(200, 200)
  .jpeg({ quality: 80 })
  .toBuffer();
```

### Batch Processing
```typescript
// Process multiple media files
const jobs = mediaFiles.map(file => 
  queue.add({
    mediaId: file.id,
    platform: 'facebook',
    mediaType: 'image',
    fileUrl: file.url,
    storageKey: file.key,
    workspaceId,
  })
);

await Promise.all(jobs);
```

### Monitor Queue Depth
```typescript
const stats = await queue.getStats();

if (stats.waiting > 100) {
  console.warn('Queue backlog detected');
}
```

## Files Reference

### Services
- `src/services/MediaStorageService.ts`

### Queues
- `src/queue/MediaProcessingQueue.ts`

### Workers
- `src/workers/MediaProcessingWorker.ts`

### Adapters
- `src/adapters/media/IMediaAdapter.ts`
- `src/adapters/media/FacebookMediaAdapter.ts`
- `src/adapters/media/InstagramMediaAdapter.ts`
- `src/adapters/media/TwitterMediaAdapter.ts`
- `src/adapters/media/LinkedInMediaAdapter.ts`
- `src/adapters/media/TikTokMediaAdapter.ts`

### Models
- `src/models/Media.ts`

### Metrics
- `src/config/mediaMetrics.ts`

## Next Steps

1. Install dependencies
2. Configure AWS credentials
3. Start server
4. Test media upload
5. Monitor metrics
6. Set up alerts

## Support

For issues or questions:
1. Check logs: `tail -f logs/app.log`
2. Check metrics: `curl http://localhost:3000/metrics`
3. Check Redis: `redis-cli KEYS "*media*"`
4. Review documentation: `PHASE_5_MEDIA_UPLOAD_PIPELINE.md`
