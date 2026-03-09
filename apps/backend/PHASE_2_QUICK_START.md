# Phase-2 Content Management - Quick Start Guide

**Quick reference for using the new Phase-2 features**

---

## 1. Asset Folders & Tagging

### Create a Folder
```bash
POST /api/v1/media/folders
Authorization: Bearer <token>
X-Workspace-Id: <workspace_id>

{
  "name": "Product Photos",
  "parentFolderId": null  # null for root level
}
```

### Create Nested Folder
```bash
POST /api/v1/media/folders

{
  "name": "Spring Collection",
  "parentFolderId": "507f1f77bcf86cd799439011"
}
```

### Move Media to Folder
```bash
PATCH /api/v1/media/:mediaId/folder

{
  "folderId": "507f1f77bcf86cd799439011"  # null to move to root
}
```

### Add Tags to Media
```bash
PATCH /api/v1/media/:mediaId/tags

{
  "tags": ["product", "spring", "featured"]
}
```

### Filter Media by Folder
```bash
GET /api/v1/media?folderId=507f1f77bcf86cd799439011
```

### Filter Media by Tags
```bash
GET /api/v1/media?tags=product,featured
```

### List Folders
```bash
GET /api/v1/media/folders?parentFolderId=null  # Root folders
GET /api/v1/media/folders?parentFolderId=xxx   # Subfolders
```

---

## 2. Saved Post Templates

### Create Template
```bash
POST /api/v1/templates
Authorization: Bearer <token>
X-Workspace-Id: <workspace_id>

{
  "name": "Weekly Newsletter",
  "content": "Check out our latest updates! #newsletter",
  "hashtags": ["newsletter", "updates"],
  "platforms": ["twitter", "linkedin"],
  "mediaIds": ["507f1f77bcf86cd799439011"]
}
```

### List Templates
```bash
GET /api/v1/templates
# Returns templates sorted by usage count (most used first)
```

### Get Template
```bash
GET /api/v1/templates/:templateId
```

### Update Template
```bash
PATCH /api/v1/templates/:templateId

{
  "name": "Updated Newsletter",
  "content": "New content here"
}
```

### Apply Template (Increment Usage)
```bash
POST /api/v1/templates/:templateId/apply
# Increments usageCount and updates lastUsedAt
```

### Delete Template
```bash
DELETE /api/v1/templates/:templateId
```

---

## 3. CSV Bulk Post Upload

### CSV Format
```csv
platform,text,scheduled_time,media_url
twitter,Hello world,2026-04-01T10:00:00Z,image1.jpg
linkedin,New blog post,2026-04-01T12:00:00Z,image2.jpg
facebook,Check this out,2026-04-02T14:00:00Z,
twitter,Multiple platforms,2026-04-03T10:00:00Z,image3.jpg
linkedin,Multiple platforms,2026-04-03T10:00:00Z,image3.jpg
```

**Field Descriptions**:
- `platform`: Comma-separated platforms (facebook, instagram, twitter, linkedin, tiktok, youtube, threads)
- `text`: Post content (required)
- `scheduled_time`: ISO 8601 format, must be in future (required)
- `media_url`: Comma-separated media filenames or URLs (optional)

### Upload CSV
```bash
POST /api/v1/posts/bulk-upload
Authorization: Bearer <token>
X-Workspace-Id: <workspace_id>
Content-Type: multipart/form-data

file: <csv_file>
```

**Constraints**:
- Max file size: 5MB
- Max rows: 500
- File must be CSV format

### Get Upload Job Status
```bash
GET /api/v1/posts/bulk-upload/:jobId

# Response:
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "filename": "posts.csv",
    "status": "completed",
    "totalRows": 100,
    "processedRows": 100,
    "successCount": 95,
    "failureCount": 5,
    "errors": [
      {
        "row": 10,
        "error": "Invalid platform: instgram",
        "data": { ... }
      }
    ],
    "startedAt": "2026-03-08T10:00:00Z",
    "completedAt": "2026-03-08T10:01:30Z"
  }
}
```

### List Upload Jobs
```bash
GET /api/v1/posts/bulk-upload
# Returns last 50 upload jobs for workspace
```

---

## Common Use Cases

### Use Case 1: Organize Media Library
```bash
# 1. Create folder structure
POST /api/v1/media/folders { "name": "Campaigns" }
POST /api/v1/media/folders { "name": "Q1 2026", "parentFolderId": "..." }

# 2. Move media to folders
PATCH /api/v1/media/:id/folder { "folderId": "..." }

# 3. Add tags for search
PATCH /api/v1/media/:id/tags { "tags": ["campaign", "q1", "product"] }

# 4. Find media
GET /api/v1/media?folderId=...&tags=campaign,product
```

### Use Case 2: Create Reusable Templates
```bash
# 1. Create template from successful post
POST /api/v1/templates {
  "name": "Product Launch",
  "content": "Exciting news! We're launching...",
  "platforms": ["twitter", "linkedin", "facebook"]
}

# 2. Reuse template
GET /api/v1/templates/:id
# Copy content to new post

# 3. Track usage
POST /api/v1/templates/:id/apply
```

### Use Case 3: Bulk Schedule Campaign
```bash
# 1. Prepare CSV file
# campaign.csv:
# platform,text,scheduled_time,media_url
# twitter,Day 1 announcement,2026-04-01T10:00:00Z,day1.jpg
# linkedin,Day 1 announcement,2026-04-01T10:00:00Z,day1.jpg
# twitter,Day 2 update,2026-04-02T10:00:00Z,day2.jpg
# ...

# 2. Upload CSV
POST /api/v1/posts/bulk-upload
file: campaign.csv

# 3. Monitor progress
GET /api/v1/posts/bulk-upload/:jobId

# 4. Check errors
# Review errors array in job status
# Fix issues and re-upload failed rows
```

---

## Error Handling

### Folder Errors
- **Duplicate name**: Folder with same name exists in same parent
- **Circular reference**: Cannot move folder into itself or descendant
- **Not empty**: Cannot delete folder with subfolders or media

### Template Errors
- **Duplicate name**: Template with same name exists in workspace
- **Not found**: Template ID doesn't exist

### CSV Upload Errors
- **File too large**: Max 5MB
- **Too many rows**: Max 500 rows
- **Invalid format**: Not a valid CSV file
- **Invalid platform**: Platform not in allowed list
- **Invalid date**: Scheduled time not ISO 8601 or in past
- **Missing fields**: Required fields (platform, text, scheduled_time) missing

---

## Tips & Best Practices

### Folders
- Use shallow hierarchy (max 2-3 levels)
- Name folders by campaign, date, or content type
- Don't delete folders with media (move media first)

### Tags
- Use lowercase tags for consistency
- Use specific tags (e.g., "spring-2026" not "spring")
- Combine folder + tags for powerful filtering

### Templates
- Create templates for recurring content types
- Include hashtags and media in templates
- Review usage count to identify popular templates

### CSV Upload
- Test with small CSV first (10-20 rows)
- Use ISO 8601 format for dates: `2026-04-01T10:00:00Z`
- Upload media files before CSV (reference by filename)
- Check job status for errors
- Fix errors and re-upload failed rows

---

## Validation Rules

### Folder Names
- Max length: 100 characters
- Must be unique within parent folder
- Cannot be empty

### Tags
- Automatically normalized (lowercase, trimmed)
- Duplicates automatically removed
- No length limit on array

### Template Names
- Max length: 200 characters
- Must be unique within workspace
- Cannot be empty

### CSV Rows
- Platform: Must be valid platform name
- Text: Max 10,000 characters
- Scheduled time: Must be ISO 8601 and future
- Media URL: Optional, comma-separated

---

## Next Steps

1. **Test in Development**: Try creating folders, templates, and uploading small CSV
2. **Migrate Existing Media**: Organize existing media into folders
3. **Create Templates**: Identify recurring post types and create templates
4. **Plan Campaigns**: Use CSV upload for bulk scheduling

---

**Need Help?**
- Check API docs: `http://localhost:3000/api-docs`
- Review implementation: `PHASE_2_IMPLEMENTATION_SUMMARY.md`
- Check audit report: `PHASE_2_CONTENT_MANAGEMENT_AUDIT.md`
