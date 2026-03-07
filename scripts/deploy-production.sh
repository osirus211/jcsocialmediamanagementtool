#!/bin/bash
# Production Deployment Script
# 
# This script automates the production deployment process
#
# Usage: ./scripts/deploy-production.sh

set -e

echo "🚀 Social Media Scheduler - Production Deployment"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Do not run this script as root${NC}"
    exit 1
fi

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production not found${NC}"
    echo "Please create .env.production from .env.production.example"
    exit 1
fi

if [ ! -f apps/backend/.env.production ]; then
    echo -e "${RED}❌ apps/backend/.env.production not found${NC}"
    echo "Please create apps/backend/.env.production from apps/backend/.env.production.example"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

echo "📋 Pre-deployment Checklist"
echo "----------------------------"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker installed${NC}"

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose installed${NC}"

# Check disk space (minimum 10GB free)
FREE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$FREE_SPACE" -lt 10 ]; then
    echo -e "${YELLOW}⚠️  Warning: Low disk space (${FREE_SPACE}GB free)${NC}"
else
    echo -e "${GREEN}✅ Sufficient disk space (${FREE_SPACE}GB free)${NC}"
fi

echo ""
echo "🔧 Configuration Check"
echo "----------------------"

# Check critical environment variables
REQUIRED_VARS=(
    "MONGO_ROOT_USERNAME"
    "MONGO_ROOT_PASSWORD"
    "MONGO_DATABASE"
    "REDIS_PASSWORD"
)

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        echo -e "${RED}❌ Missing required variable: $VAR${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ $VAR is set${NC}"
done

echo ""
echo "📦 Building Docker Images"
echo "-------------------------"

# Build images
docker compose -f docker-compose.production.yml build --no-cache

echo ""
echo "🗄️  Starting Database Services"
echo "------------------------------"

# Start databases first
docker compose -f docker-compose.production.yml up -d mongodb redis

# Wait for databases to be healthy
echo "⏳ Waiting for databases to be ready..."
sleep 10

# Check MongoDB health
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec sms-mongodb-prod mongosh -u ${MONGO_ROOT_USERNAME} -p ${MONGO_ROOT_PASSWORD} --authenticationDatabase admin --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MongoDB is ready${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "⏳ Waiting for MongoDB... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ MongoDB failed to start${NC}"
    exit 1
fi

# Check Redis health
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec sms-redis-prod redis-cli -a ${REDIS_PASSWORD} PING > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is ready${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "⏳ Waiting for Redis... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Redis failed to start${NC}"
    exit 1
fi

echo ""
echo "🚀 Starting Application Services"
echo "--------------------------------"

# Start all services
docker compose -f docker-compose.production.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 15

# Check backend health
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is ready${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "⏳ Waiting for backend... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    echo "Check logs with: docker compose -f docker-compose.production.yml logs backend"
    exit 1
fi

# Check frontend health
if curl -f http://localhost:80/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is ready${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend health check failed (may be normal)${NC}"
fi

# Check worker
if docker ps | grep -q sms-worker-prod; then
    echo -e "${GREEN}✅ Worker is running${NC}"
else
    echo -e "${RED}❌ Worker is not running${NC}"
fi

echo ""
echo "📊 Deployment Status"
echo "-------------------"

docker compose -f docker-compose.production.yml ps

echo ""
echo "✅ Deployment Complete!"
echo "======================"
echo ""
echo "🔗 Service URLs:"
echo "  - Backend API: http://localhost:5000"
echo "  - Frontend: http://localhost:80"
echo "  - Health Check: http://localhost:5000/health"
echo ""
echo "📝 Next Steps:"
echo "  1. Configure your domain DNS to point to this server"
echo "  2. Set up SSL/TLS certificates (see DEPLOYMENT.md)"
echo "  3. Configure Nginx reverse proxy (see DEPLOYMENT.md)"
echo "  4. Set up automated backups (see DEPLOYMENT.md)"
echo "  5. Configure monitoring and alerting"
echo ""
echo "📚 Documentation: See DEPLOYMENT.md for detailed instructions"
echo ""
echo "🔍 View logs:"
echo "  docker compose -f docker-compose.production.yml logs -f"
echo ""
