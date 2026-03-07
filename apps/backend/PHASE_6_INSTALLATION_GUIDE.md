# Phase 6: Installation and Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd apps/backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Configure Environment Variables
Add to `.env`:
```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=social-media-scheduler

# Optional: S3-Compatible Service (MinIO, DigitalOcean Spaces, etc.)
# S3_ENDPOINT=https://nyc3.digitaloceanspaces.com

# Optional: CDN for public URLs
# CDN_URL=https://cdn.example.com
```

### 3. Register Media Routes
Add to `src/server.ts`:
```typescript
import mediaRoutes from './routes/v1/media.routes';

// After other v1 routes
app.use('/api/v1/media', mediaRoutes);
```

### 4. Create S3 Bucket
Using AWS CLI:
```bash
aws s3 mb s3://social-media-scheduler --region us-east-1
```

### 5. Configure Bucket Policy
Create `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::social-media-scheduler/*"
    }
  ]
}
```

Apply policy:
```bash
aws s3api put-bucket-policy \
  --bucket social-media-scheduler \
  --policy file://bucket-policy.json
```

### 6. Configure CORS
Create `cors-config.json`:
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "POST", "GET"],
      "AllowedOrigins": ["http://localhost:5173", "https://app.example.com"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

Apply CORS:
```bash
aws s3api put-bucket-cors \
  --bucket social-media-scheduler \
  --cors-configuration file://cors-config.json
```

### 7. Test Upload Flow
```bash
# 1. Generate upload URL
curl -X POST http://localhost:3000/api/v1/media/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace_id",
    "filename": "test.jpg",
    "mimeType": "image/jpeg",
    "size": 1048576
  }'

# 2. Upload to S3 (use uploadUrl from response)
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test.jpg

# 3. Confirm upload
curl -X POST http://localhost:3000/api/v1/media/$MEDIA_ID/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace_id",
    "width": 1920,
    "height": 1080
  }'
```

---

## Alternative: MinIO (Local Development)

### 1. Run MinIO with Docker
```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

### 2. Configure Environment
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=social-media-scheduler
S3_ENDPOINT=http://localhost:9000
```

### 3. Create Bucket
Access MinIO Console at http://localhost:9001
- Login with minioadmin/minioadmin
- Create bucket: social-media-scheduler
- Set access policy to public

---

## Alternative: DigitalOcean Spaces

### 1. Create Space
- Go to DigitalOcean Spaces
- Create new Space
- Choose region (e.g., nyc3)
- Name: social-media-scheduler

### 2. Generate API Keys
- Go to API → Spaces Keys
- Generate new key pair
- Save Access Key and Secret Key

### 3. Configure Environment
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_spaces_key
AWS_SECRET_ACCESS_KEY=your_spaces_secret
S3_BUCKET_NAME=social-media-scheduler
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
CDN_URL=https://social-media-scheduler.nyc3.cdn.digitaloceanspaces.com
```

### 4. Configure CORS
In Spaces settings:
- Add CORS rule
- Allowed Origins: http://localhost:5173, https://app.example.com
- Allowed Methods: GET, PUT, POST
- Allowed Headers: *

---

## Troubleshooting

### Issue: "Cannot find module '@aws-sdk/client-s3'"
**Solution**: Install AWS SDK dependencies
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Issue: "Access Denied" when uploading to S3
**Solution**: Check bucket policy allows public uploads
```bash
aws s3api get-bucket-policy --bucket social-media-scheduler
```

### Issue: CORS errors in browser
**Solution**: Configure CORS on S3 bucket
```bash
aws s3api get-bucket-cors --bucket social-media-scheduler
```

### Issue: Signed URL expired
**Solution**: URLs expire after 15 minutes. Generate new URL if needed.

### Issue: "Media not found" when creating post
**Solution**: Ensure media status is 'uploaded' before creating post
```bash
curl http://localhost:3000/api/v1/media/$MEDIA_ID?workspaceId=$WORKSPACE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## Production Checklist

- [ ] Install AWS SDK dependencies
- [ ] Configure production S3 bucket
- [ ] Set up bucket policy for public read
- [ ] Configure CORS for production domain
- [ ] Add environment variables to production
- [ ] Set up CDN (CloudFront, DigitalOcean CDN, etc.)
- [ ] Configure CDN_URL environment variable
- [ ] Test upload flow end-to-end
- [ ] Monitor media_uploads_total metric
- [ ] Set up alerts for upload failures
- [ ] Configure storage quota limits (optional)
- [ ] Set up automatic cleanup of failed uploads (optional)

---

## Monitoring

### Key Metrics
```promql
# Upload success rate
rate(media_uploads_total{status="success"}[5m]) / rate(media_uploads_total[5m])

# Average upload duration
avg(media_upload_duration_ms) by (media_type)

# Storage usage by workspace
media_storage_usage_bytes

# Failed uploads
rate(media_upload_failures_total[5m])
```

### Alerts
```yaml
- alert: HighMediaUploadFailureRate
  expr: rate(media_upload_failures_total[5m]) > 0.1
  for: 5m
  annotations:
    summary: High media upload failure rate

- alert: LargeStorageUsage
  expr: media_storage_usage_bytes > 10737418240  # 10GB
  annotations:
    summary: Workspace storage exceeds 10GB
```

---

## Next Steps

1. Install dependencies
2. Configure S3 or S3-compatible service
3. Register routes in server.ts
4. Test upload flow
5. Integrate with frontend
6. Monitor metrics
7. Set up production CDN

---

**Status**: Ready for installation  
**Dependencies**: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner  
**Configuration**: S3 bucket, environment variables, CORS
