# Storage Provider Installation

## Required Dependencies

To use the S3-compatible storage provider, you need to install the AWS SDK v3:

```bash
npm install @aws-sdk/client-s3
```

Or with yarn:

```bash
yarn add @aws-sdk/client-s3
```

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# S3-Compatible Storage Configuration
S3_BUCKET=your-bucket-name
S3_REGION=auto                                    # For R2, use 'auto'
S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com  # For R2
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_PUBLIC_URL=https://cdn.example.com            # Optional: CDN URL
```

## Cloudflare R2 Configuration

For Cloudflare R2:

1. Get your Account ID from Cloudflare dashboard
2. Create an R2 bucket
3. Generate API tokens (Access Key ID and Secret Access Key)
4. Set endpoint: `https://[account-id].r2.cloudflarestorage.com`
5. Set region: `auto`
6. (Optional) Configure custom domain for public access

## AWS S3 Configuration

For AWS S3:

1. Create an S3 bucket
2. Create IAM user with S3 permissions
3. Generate access keys
4. Set region to your bucket's region (e.g., `us-east-1`)
5. Leave endpoint empty (uses default AWS S3 endpoint)

## Usage

```typescript
import { createS3StorageFromEnv } from './storage/S3StorageProvider';

// Initialize storage provider
const storage = createS3StorageFromEnv();

// Upload file
const result = await storage.upload(buffer, 'path/to/file.jpg', {
  contentType: 'image/jpeg',
  metadata: { userId: '123' }
});

// Get public URL
const url = storage.getPublicUrl('path/to/file.jpg');

// Delete file
await storage.delete('path/to/file.jpg');
```
