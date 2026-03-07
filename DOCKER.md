# Docker Development Guide

## Overview

This project uses Docker Compose to orchestrate all services required for development:
- **MongoDB**: Primary database
- **Redis**: Caching and queue management
- **Backend**: Express API server
- **Frontend**: React application

## Quick Start

```bash
# Start all services
docker compose up

# Start in detached mode (background)
docker compose up -d

# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# Rebuild containers
docker compose up --build
```

## Services

### MongoDB
- **Port**: 27017
- **Username**: admin
- **Password**: password123
- **Database**: social-media-scheduler
- **Connection String**: `mongodb://admin:password123@localhost:27017/social-media-scheduler?authSource=admin`

### Redis
- **Port**: 6379
- **Persistence**: Enabled (AOF)
- **Data**: Stored in `redis_data` volume

### Backend
- **Port**: 5000
- **Hot Reload**: ✅ Enabled
- **Logs**: Stored in `backend_logs` volume
- **Health Check**: http://localhost:5000/health

### Frontend
- **Port**: 5173
- **Hot Reload**: ✅ Enabled
- **Proxy**: API requests proxied to backend

## Development Workflow

### 1. Start Services
```bash
docker compose up
```

### 2. View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb
docker compose logs -f redis
```

### 3. Execute Commands in Containers

**Backend:**
```bash
# Open shell
docker compose exec backend sh

# Run npm commands
docker compose exec backend npm run lint
docker compose exec backend npm test

# View logs directory
docker compose exec backend ls -la logs/
```

**Frontend:**
```bash
# Open shell
docker compose exec frontend sh

# Run npm commands
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

**MongoDB:**
```bash
# Open MongoDB shell
docker compose exec mongodb mongosh -u admin -p password123

# Backup database
docker compose exec mongodb mongodump --out /data/backup

# Restore database
docker compose exec mongodb mongorestore /data/backup
```

**Redis:**
```bash
# Open Redis CLI
docker compose exec redis redis-cli

# Monitor Redis commands
docker compose exec redis redis-cli MONITOR

# Get all keys
docker compose exec redis redis-cli KEYS '*'
```

### 4. Install New Dependencies

**Backend:**
```bash
# Install package
docker compose exec backend npm install <package-name>

# Rebuild container to persist
docker compose up --build backend
```

**Frontend:**
```bash
# Install package
docker compose exec frontend npm install <package-name>

# Rebuild container to persist
docker compose up --build frontend
```

### 5. Database Management

**View MongoDB Data:**
```bash
docker compose exec mongodb mongosh -u admin -p password123 social-media-scheduler
```

**Clear Redis Cache:**
```bash
docker compose exec redis redis-cli FLUSHALL
```

## Volume Management

### List Volumes
```bash
docker volume ls | grep sms
```

### Inspect Volume
```bash
docker volume inspect social-media-scheduler_mongodb_data
```

### Backup Volumes
```bash
# MongoDB
docker run --rm -v social-media-scheduler_mongodb_data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb-backup.tar.gz /data

# Redis
docker run --rm -v social-media-scheduler_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data
```

### Restore Volumes
```bash
# MongoDB
docker run --rm -v social-media-scheduler_mongodb_data:/data -v $(pwd):/backup alpine tar xzf /backup/mongodb-backup.tar.gz -C /

# Redis
docker run --rm -v social-media-scheduler_redis_data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :5000  # Backend
lsof -i :5173  # Frontend
lsof -i :27017 # MongoDB
lsof -i :6379  # Redis

# Kill process
kill -9 <PID>
```

### Container Won't Start
```bash
# Check logs
docker compose logs <service-name>

# Rebuild container
docker compose up --build <service-name>

# Remove and recreate
docker compose rm -f <service-name>
docker compose up <service-name>
```

### Database Connection Issues
```bash
# Check MongoDB health
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis health
docker compose exec redis redis-cli ping
```

### Hot Reload Not Working
```bash
# Ensure volumes are mounted correctly
docker compose config

# Restart service
docker compose restart backend
docker compose restart frontend
```

### Clean Everything
```bash
# Stop all containers
docker compose down

# Remove all volumes
docker compose down -v

# Remove all images
docker compose down --rmi all

# Start fresh
docker compose up --build
```

## Performance Optimization

### Reduce Build Time
```bash
# Use BuildKit
DOCKER_BUILDKIT=1 docker compose build

# Build specific service
docker compose build backend
```

### Reduce Container Size
- Multi-stage builds (production)
- Alpine base images
- .dockerignore file

### Speed Up npm install
```bash
# Use npm ci instead of npm install in Dockerfile
RUN npm ci --only=production
```

## Production Considerations

For production deployment, create separate:
- `Dockerfile.prod` for optimized builds
- `docker-compose.prod.yml` for production configuration
- Environment-specific `.env` files
- Health checks and restart policies
- Resource limits (CPU, memory)
- Security hardening (non-root users, read-only filesystems)

## Network

All services run on the `sms-network` bridge network, allowing:
- Service-to-service communication by name
- Isolated from other Docker networks
- Custom DNS resolution

## Health Checks

Services include health checks:
- **MongoDB**: Ping command every 10s
- **Redis**: Ping command every 10s
- **Backend**: Depends on healthy MongoDB and Redis
- **Frontend**: Depends on backend

## Environment Variables

Environment variables are set in `docker-compose.yml` for development.

For production:
- Use `.env` file with `docker compose --env-file .env.prod up`
- Use Docker secrets for sensitive data
- Use external configuration management (Consul, etcd)

## Useful Commands

```bash
# View running containers
docker compose ps

# View resource usage
docker compose stats

# Restart specific service
docker compose restart backend

# Scale service (if applicable)
docker compose up --scale backend=3

# View container details
docker compose inspect backend

# Export logs
docker compose logs backend > backend.log

# Prune unused resources
docker system prune -a --volumes
```

## Next Steps

1. Start services: `docker compose up`
2. Access frontend: http://localhost:5173
3. Access backend: http://localhost:5000
4. Begin development with hot reload enabled
5. Use `docker compose logs -f` to monitor all services

For local development without Docker, see README.md.
