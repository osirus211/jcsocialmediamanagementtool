# Manual Audit Guide

## Project Status

All Docker services are running and the application is ready for manual audit.

## Service Status

| Service | Status | Port | URL |
|---------|--------|------|-----|
| Frontend | ✅ Running | 5173 | http://localhost:5173 |
| Backend API | ✅ Running | 5000 | http://localhost:5000 |
| MongoDB | ✅ Healthy | 27017 | localhost:27017 |
| Redis | ✅ Healthy | 6380 | localhost:6380 |

## Recent Changes

### Fixed Issues
1. **TwoFactorService** - Fixed otplib import issue by using namespace import
2. **date-fns dependency** - Installed missing date-fns package
3. **ReconnectService** - Changed Redis client initialization to lazy getter to avoid initialization errors

### New Features Added
- BlueskyPublisherWorker
- MastodonPublisherWorker
- PinterestPublisherWorker
- RedditPublisherWorker
- ThreadsPublisherWorker
- YouTubePublisherWorker

### Updated Services
- OAuth services with improved error handling
- Publisher base class enhancements
- Email notification service updates

## Testing Checklist

### 1. Frontend Access
- [ ] Open http://localhost:5173 in browser
- [ ] Verify login page loads
- [ ] Check console for errors
- [ ] Test responsive design

### 2. Backend API
- [ ] Health check: http://localhost:5000/health
- [ ] API documentation: http://localhost:5000/api-docs (if available)
- [ ] Metrics endpoint: http://localhost:5000/metrics
- [ ] Test authentication endpoints

### 3. OAuth Flows
- [ ] Facebook OAuth
- [ ] Instagram OAuth
- [ ] Twitter OAuth
- [ ] LinkedIn OAuth
- [ ] Threads OAuth
- [ ] Bluesky OAuth
- [ ] Mastodon OAuth
- [ ] Pinterest OAuth
- [ ] Reddit OAuth
- [ ] YouTube OAuth

### 4. Publisher Workers
Test each publisher worker:
- [ ] Bluesky publishing
- [ ] Mastodon publishing
- [ ] Pinterest publishing
- [ ] Reddit publishing
- [ ] Threads publishing
- [ ] YouTube publishing

### 5. Database Connectivity
- [ ] MongoDB connection working
- [ ] Data persistence
- [ ] Query performance

### 6. Redis Functionality
- [ ] Session management
- [ ] Rate limiting
- [ ] Caching

## Known Issues

1. **Backend Health Status**: Shows "unhealthy" - may need database connection verification
2. **Redis Warning**: "Redis unavailable, using memory store with fail-closed behavior" - Redis is running but backend may need reconnection logic check

## Logs Access

View real-time logs:
```bash
# Backend logs
docker logs -f sms-backend

# Frontend logs
docker logs -f sms-frontend

# MongoDB logs
docker logs -f sms-mongodb

# Redis logs
docker logs -f sms-redis

# All services
docker-compose logs -f
```

## Stopping Services

```bash
# Stop all services
docker-compose down

# Stop specific service
docker-compose stop backend
```

## Restarting Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

## Environment Variables

Ensure all required environment variables are set in:
- `.env` (root)
- `apps/backend/.env`
- `apps/frontend/.env`

## Next Steps

1. Verify all OAuth credentials are configured
2. Test end-to-end posting workflow
3. Check error handling and logging
4. Verify rate limiting
5. Test concurrent operations
6. Review security configurations
