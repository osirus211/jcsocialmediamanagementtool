# Storage Abstraction Layer

This module provides a pluggable storage abstraction layer for file uploads, supporting multiple storage backends.

## Architecture

```
StorageProvider (interface)
    ├── LocalStorageProvider (filesystem)
    └── S3StorageProvider (S3-compatible: AWS S3, Cloudflare R2, MinIO)
```

## Features

- **Pluggable**: Switch between storage providers via configuration
- **S3-Compatible**: Works with AWS S3, Cloudflare R2, MinIO, and other S3-compatible services
- **Type-Safe**: Full TypeScript support with interfaces
- **Streaming**: Efficient buffer-based uploads
- **Public URLs**: Generate public URLs for uploaded files
- **CDN Support**: Configure custom CDN URLs for S3 providers

## Storage Providers

### LocalStorageProvider

Stores files on the local filesystem. Suitable for development and testing.

**Configuration:**
```env
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
LOCAL_STORAGE_URL=http://localhost:3000/uploads
```

**Pros:**
- Simple setup
- No external dependencies
- Fast for development

**Cons:**
- Not suitable for production
- No redundancy
- Doesn't scale horizontally

### S3StorageProvider

Stores files in S3-compatible object storage. Recommended for production.

**Configuration:**
```env
STORAGE_TYPE=s3
S3_BUCKET=your-bucket-name
S3_REGION=auto
S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_PUBLIC_URL=https://cdn.example.com
```

**Pros:**
- Production-ready
- Highly available and durable
- Scales automatically
- CDN integration
- Cost-effective (especially R2)

**Cons:**
- Requires external service
- Network latency
- Requires AWS SDK dependency

## Usage

### Basic Usage

```typescript
import { createStorageProvider } from './storage';

// Create provider based on environment config
const storage = await createStorageProvider();

// Upload file
const result = await storage.upload(buffer, 'workspace-id/file.jpg', {
  contentType: 'image/jpeg',
  metadata: { userId: '123' }
});

console.log(result.url); // Public URL

// Get public URL
const url = storage.getPublicUrl('workspace-id/file.jpg');

// Delete file
await storage.delete('workspace-id/file.jpg');
```

### Direct Provider Usage

```typescript
import { LocalStorageProvider } from './storage/LocalStorageProvider';
import { S3StorageProvider } from './storage/S3StorageProvider';

// Local storage
const localStorage = new LocalStorageProvider({
  basePath: './uploads',
  baseUrl: 'http://localhost:3000/uploads'
});

// S3 storage
const s3Storage = new S3StorageProvider({
  bucket: 'my-bucket',
  region: 'us-east-1',
  accessKeyId: 'xxx',
  secretAccessKey: 'xxx',
  publicUrl: 'https://cdn.example.com'
});
```

## Integration with MediaUploadService

The storage layer is designed to be integrated into `MediaUploadService`:

```typescript
// Before (direct local storage)
const url = await this.uploadToStorage(buffer, filename, workspaceId);

// After (pluggable storage)
const storage = await createStorageProvider();
const result = await storage.upload(buffer, `${workspaceId}/${filename}`, {
  contentType: file.mimetype
});
const url = result.url;
```

## Cloudflare R2 Setup

Cloudflare R2 is recommended for production due to:
- Zero egress fees
- S3-compatible API
- Global edge network
- Competitive pricing

**Setup Steps:**

1. Create R2 bucket in Cloudflare dashboard
2. Generate API tokens (R2 > Manage R2 API Tokens)
3. Get your Account ID from dashboard
4. Configure environment:
   ```env
   STORAGE_TYPE=s3
   S3_BUCKET=my-bucket
   S3_REGION=auto
   S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
   S3_ACCESS_KEY=your-r2-access-key
   S3_SECRET_KEY=your-r2-secret-key
   S3_PUBLIC_URL=https://pub-[hash].r2.dev  # Or custom domain
   ```

## AWS S3 Setup

For AWS S3:

1. Create S3 bucket
2. Configure bucket policy for public read (if needed)
3. Create IAM user with S3 permissions
4. Generate access keys
5. Configure environment:
   ```env
   STORAGE_TYPE=s3
   S3_BUCKET=my-bucket
   S3_REGION=us-east-1
   S3_ACCESS_KEY=your-aws-access-key
   S3_SECRET_KEY=your-aws-secret-key
   S3_PUBLIC_URL=https://cdn.example.com  # Optional: CloudFront URL
   ```

## Testing

```typescript
import { LocalStorageProvider } from './storage/LocalStorageProvider';

describe('StorageProvider', () => {
  it('should upload and retrieve file', async () => {
    const storage = new LocalStorageProvider({
      basePath: './test-uploads',
      baseUrl: 'http://localhost:3000/test-uploads'
    });

    const buffer = Buffer.from('test content');
    const result = await storage.upload(buffer, 'test.txt');

    expect(result.key).toBe('test.txt');
    expect(result.url).toContain('test.txt');
    expect(result.size).toBe(buffer.length);

    await storage.delete('test.txt');
  });
});
```

## Migration Path

Phase 1 (Current):
- ✅ Storage abstraction layer created
- ✅ LocalStorageProvider implemented
- ✅ S3StorageProvider implemented
- ⏳ MediaUploadService still uses direct local storage

Phase 2 (Next):
- Integrate storage providers into MediaUploadService
- Add storage provider selection logic
- Test with both local and S3 providers

Phase 3 (Future):
- Remove direct local storage code
- Make S3 the default for production
- Add storage migration utilities

## Security Considerations

- **Access Keys**: Never commit access keys to version control
- **Bucket Policies**: Configure appropriate bucket policies
- **Public Access**: Only enable public read if needed
- **CDN**: Use CDN for public files to reduce direct bucket access
- **Encryption**: Enable server-side encryption for sensitive files
- **CORS**: Configure CORS policies if accessing from browser

## Performance

- **Upload**: Streaming uploads for efficient memory usage
- **CDN**: Use CDN URLs to reduce latency and bandwidth costs
- **Compression**: Consider compressing files before upload
- **Thumbnails**: Generate thumbnails asynchronously
- **Caching**: Implement caching layer for frequently accessed files
