# Phase 4 Quick Start Guide

Get the social media posting engine up and running in minutes.

---

## Prerequisites

- Node.js 18+
- MongoDB running
- Redis running
- Environment variables configured

---

## 1. Install Dependencies

```bash
# Backend
cd apps/backend
npm install

# Frontend
cd apps/frontend
npm install
```

---

## 2. Configure Environment

### Backend (.env)
```env
# Database
MONGODB_URI=mongodb://localhost:27017/sms
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
ENCRYPTION_KEY=your-32-byte-hex-encryption-key

# Server
PORT=5000
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

## 3. Start Services

### Terminal 1: MongoDB
```bash
mongod
```

### Terminal 2: Redis
```bash
redis-server
```

### Terminal 3: Backend API
```bash
cd apps/backend
npm run dev
```

### Terminal 4: Publishing Worker
```bash
cd apps/backend
npm run worker
```

### Terminal 5: Frontend
```bash
cd apps/frontend
npm run dev
```

---

## 4. Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

---

## 5. First Steps

### 1. Register an Account
- Navigate to `/auth/register`
- Create your account

### 2. Create a Workspace
- Navigate to `/workspaces/create`
- Enter workspace name
- Workspace is auto-selected

### 3. Connect Social Account
- Navigate to `/social/accounts`
- Click "Connect Account"
- Choose platform (mock OAuth for now)
- Enter account name

### 4. Create Your First Post
- Navigate to `/posts/create`
- Select connected account
- Write content
- Choose "Post Now" or "Schedule for Later"
- Click "Save as Draft" or "Schedule Post"

### 5. View Posts
- Navigate to `/posts`
- See all posts with filters
- View stats by status
- Filter by status, account, date

### 6. View Calendar
- Navigate to `/posts/calendar`
- See scheduled posts in calendar view
- Navigate between months

---

## API Endpoints

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password
```

### Workspaces
```
GET    /api/v1/workspaces
POST   /api/v1/workspaces
GET    /api/v1/workspaces/:id
PATCH  /api/v1/workspaces/:id
DELETE /api/v1/workspaces/:id
GET    /api/v1/workspaces/:id/members
POST   /api/v1/workspaces/:id/members
DELETE /api/v1/workspaces/:id/members/:userId
PATCH  /api/v1/workspaces/:id/members/:userId
POST   /api/v1/workspaces/:id/transfer-ownership
POST   /api/v1/workspaces/:id/leave
```

### Social Accounts
```
GET    /api/v1/social/accounts
POST   /api/v1/social/accounts
GET    /api/v1/social/accounts/:id
DELETE /api/v1/social/accounts/:id
POST   /api/v1/social/accounts/:id/sync
POST   /api/v1/social/accounts/:id/refresh-token
```

### Posts
```
GET    /api/v1/posts
POST   /api/v1/posts
GET    /api/v1/posts/stats
GET    /api/v1/posts/calendar
GET    /api/v1/posts/:id
PATCH  /api/v1/posts/:id
DELETE /api/v1/posts/:id
POST   /api/v1/posts/:id/retry
```

---

## Troubleshooting

### Backend won't start
- Check MongoDB is running: `mongosh`
- Check Redis is running: `redis-cli ping`
- Check environment variables are set
- Check port 5000 is available

### Frontend won't start
- Check backend is running
- Check VITE_API_URL is correct
- Check port 5173 is available
- Clear node_modules and reinstall

### Posts not publishing
- Check publishing worker is running
- Check Redis connection
- Check scheduler service logs
- Check queue jobs: `redis-cli KEYS bull:*`

### Workspace data not clearing
- Check browser console for errors
- Check workspace store is imported correctly
- Check API client workspace header

---

## Development Tips

### Hot Reload
- Backend: Uses nodemon for auto-restart
- Frontend: Uses Vite HMR for instant updates

### Debugging
- Backend: Use VS Code debugger or `console.log`
- Frontend: Use React DevTools and browser console

### Database Inspection
```bash
# MongoDB
mongosh
use sms
db.posts.find()
db.socialaccounts.find()

# Redis
redis-cli
KEYS *
GET key_name
```

### Queue Inspection
```bash
# View queue jobs
redis-cli KEYS bull:postingQueue:*

# View job data
redis-cli GET bull:postingQueue:job_id
```

---

## Testing

### Backend Tests
```bash
cd apps/backend
npm test
```

### Frontend Tests
```bash
cd apps/frontend
npm test
```

### E2E Tests
```bash
npm run test:e2e
```

---

## Production Deployment

### Build Frontend
```bash
cd apps/frontend
npm run build
```

### Build Backend
```bash
cd apps/backend
npm run build
```

### Start Production
```bash
# Backend
cd apps/backend
npm start

# Worker
cd apps/backend
npm run worker:prod

# Frontend (serve with nginx or similar)
cd apps/frontend/dist
```

---

## Next Steps

1. **Implement Real OAuth** - Replace mock OAuth with real platform credentials
2. **Add Media Upload** - Implement file upload and storage
3. **Add Analytics** - Track post performance
4. **Add Team Features** - Approval workflows, comments
5. **Add Bulk Operations** - Bulk schedule, delete, retry

---

## Support

For issues or questions:
- Check documentation in `.kiro/specs/social-media-scheduler/`
- Review PHASE4_COMPLETE.md for architecture details
- Check PHASE4_IMPLEMENTATION_SUMMARY.md for technical details

---

**Status:** ✅ Ready to Use  
**Version:** 1.0.0  
**Last Updated:** February 9, 2026
