#!/bin/bash

set -e

echo "=========================================="
echo "Chaos + Load Testing Harness"
echo "=========================================="
echo ""

# Default configuration
export ACCOUNTS=${ACCOUNTS:-1000}
export POSTS=${POSTS:-5000}
export PUBLISH_RATE=${PUBLISH_RATE:-5}
export REFRESH_EXPIRY_BURST=${REFRESH_EXPIRY_BURST:-500}
export FAILURE_RATE=${FAILURE_RATE:-0.1}
export DURATION_MINUTES=${DURATION_MINUTES:-30}

export CHAOS_ENABLED=${CHAOS_ENABLED:-true}
export PUBLISHING_WORKER_REPLICAS=${PUBLISHING_WORKER_REPLICAS:-3}
export REFRESH_WORKER_REPLICAS=${REFRESH_WORKER_REPLICAS:-2}

echo "Configuration:"
echo "  Accounts: $ACCOUNTS"
echo "  Posts: $POSTS"
echo "  Publish Rate: $PUBLISH_RATE/sec"
echo "  Duration: $DURATION_MINUTES minutes"
echo "  Chaos Enabled: $CHAOS_ENABLED"
echo ""

# Create reports directory
mkdir -p reports

# Clean up any existing containers
echo "Cleaning up existing containers..."
docker-compose -f docker-compose.chaos.yml down -v 2>/dev/null || true

# Build images
echo "Building Docker images..."
docker-compose -f docker-compose.chaos.yml build

# Start infrastructure (MongoDB, Redis)
echo "Starting infrastructure..."
docker-compose -f docker-compose.chaos.yml up -d mongodb redis

# Wait for infrastructure to be ready
echo "Waiting for infrastructure to be ready..."
sleep 10

# Check MongoDB health
echo "Checking MongoDB health..."
until docker exec chaos-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  echo "  Waiting for MongoDB..."
  sleep 2
done
echo "  MongoDB is ready"

# Check Redis health
echo "Checking Redis health..."
until docker exec chaos-redis redis-cli ping > /dev/null 2>&1; do
  echo "  Waiting for Redis..."
  sleep 2
done
echo "  Redis is ready"

# Start API
echo "Starting API..."
docker-compose -f docker-compose.chaos.yml up -d api

# Wait for API to be ready
echo "Waiting for API to be ready..."
sleep 5
until curl -s http://localhost:3000/health > /dev/null 2>&1; do
  echo "  Waiting for API..."
  sleep 2
done
echo "  API is ready"

# Start workers
echo "Starting workers..."
docker-compose -f docker-compose.chaos.yml up -d --scale publishing-worker=$PUBLISHING_WORKER_REPLICAS --scale refresh-worker=$REFRESH_WORKER_REPLICAS publishing-worker refresh-worker

# Wait for workers to be ready
echo "Waiting for workers to be ready..."
sleep 5

# Start metrics exporter
echo "Starting metrics exporter..."
docker-compose -f docker-compose.chaos.yml up -d metrics-exporter

# Wait for metrics exporter to be ready
echo "Waiting for metrics exporter to be ready..."
sleep 3
until curl -s http://localhost:9090/health > /dev/null 2>&1; do
  echo "  Waiting for metrics exporter..."
  sleep 2
done
echo "  Metrics exporter is ready"

# Start load simulator
echo ""
echo "=========================================="
echo "Starting Chaos Load Simulation"
echo "=========================================="
echo ""
echo "Monitor metrics at: http://localhost:9090/metrics"
echo "View logs: docker-compose -f docker-compose.chaos.yml logs -f load-simulator"
echo ""

docker-compose -f docker-compose.chaos.yml up load-simulator

# Check exit code
EXIT_CODE=$?

echo ""
echo "=========================================="
echo "Simulation Complete"
echo "=========================================="
echo ""

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ PASSED - All validation checks passed"
else
  echo "❌ FAILED - Some validation checks failed"
fi

echo ""
echo "Reports generated in ./reports/"
echo "  - chaos-test-report.json"
echo "  - chaos-test-report.md"
echo "  - SUMMARY.txt"
echo "  - chaos-test.log"
echo ""

# Show summary
if [ -f reports/SUMMARY.txt ]; then
  cat reports/SUMMARY.txt
fi

echo ""
echo "To cleanup: ./scripts/cleanup.sh"
echo ""

exit $EXIT_CODE
