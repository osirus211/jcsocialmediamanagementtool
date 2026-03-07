# Server Start Guide

## Current Status: ⚠️ Server Starting (Waiting for MongoDB)

The server is currently starting but waiting for MongoDB connection.

---

## Quick Fix: Test Without Database

The server requires MongoDB and Redis to fully start. You have 2 options:

### Option 1: Test Health Endpoints (Recommended for Quick Testing)

The health endpoints are designed to work even if databases are unavailable. Once the server starts, you can test:

**URLs to test:**
```
http://localhost:5000/health
http://localhost:5000/health/live  
http://localhost:5000/health/ready
http://localhost:5000/
```

**Current Issue:** Server is waiting for MongoDB connection at `mongodb://localhost:27017/social-media-scheduler`

---

### Option 2: Start Required Services

**Start MongoDB:**
```bash
# If you have MongoDB installed locally:
mongod

# Or use Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Start Redis:**
```bash
# If you have Redis installed locally:
redis-server

# Or use Docker:
docker run -d -p 6379:6379 --name redis redis:latest
```

Then the server will fully start and you'll see:
```
🚀 Server running on port 5000
📍 Environment: development
🔗 Health check: http://localhost:5000/health
📚 API v1: http://localhost:5000/api/v1
```

---

### Option 3: Use MongoDB Atlas (Cloud Database)

1. Create free account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string
4. Update `.env` file:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/social-scheduler
   ```
5. Restart server

---

## Current Server Status

**Process:** Running (Process ID: 4)
**Port:** 5000
**Status:** Waiting for MongoDB connection
**Warnings:** Redis unavailable (using memory store for rate limiting)

---

## What's Happening?

The server is trying to connect to:
- **MongoDB:** `mongodb://localhost:27017/social-media-scheduler` ❌ Not connected
- **Redis:** `localhost:6379` ❌ Not connected (fallback to memory)

The server will wait indefinitely for MongoDB to connect. You need to either:
1. Start MongoDB locally
2. Use MongoDB Atlas (cloud)
3. Comment out database connection temporarily

---

## Testing URLs (Once Server Starts)

### Health Check Endpoints
- http://localhost:5000/health - Basic health
- http://localhost:5000/health/live - Liveness probe
- http://localhost:5000/health/ready - Readiness probe

### API Endpoints
- http://localhost:5000/ - API root
- http://localhost:5000/api/v1 - API v1 info

### Expected Response (Health Check):
```json
{
  "status": "degraded",
  "uptime": 120,
  "timestamp": "2026-02-15T10:30:45.123Z",
  "memory": {
    "used": 256,
    "total": 512,
    "percentage": 50.0
  },
  "dependencies": {
    "db": "fail",
    "redis": "fail",
    "queue": "fail",
    "worker": "fail"
  }
}
```

Status will be "degraded" because databases aren't connected, but the endpoint will still respond!

---

## Recommended Next Steps

1. **Install MongoDB** (if not installed):
   - Windows: https://www.mongodb.com/try/download/community
   - Or use Docker: `docker run -d -p 27017:27017 mongo`

2. **Install Redis** (optional, server works without it):
   - Windows: https://github.com/microsoftarchive/redis/releases
   - Or use Docker: `docker run -d -p 6379:6379 redis`

3. **Wait for server to connect** (it will auto-connect once MongoDB is available)

4. **Test the URLs** above in your browser

---

## Stop Server

To stop the server:
```bash
# Press Ctrl+C in the terminal where server is running
# Or kill the process
```

---

**Current Time:** Server started and waiting for MongoDB connection
**Next:** Start MongoDB or use MongoDB Atlas to proceed
