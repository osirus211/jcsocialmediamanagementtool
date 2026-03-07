#!/bin/bash

set -e

echo "=========================================="
echo "Cleaning Up Chaos Test Environment"
echo "=========================================="
echo ""

# Stop and remove all containers
echo "Stopping containers..."
docker-compose -f docker-compose.chaos.yml down -v

# Remove dangling images
echo "Removing dangling images..."
docker image prune -f

# Remove volumes
echo "Removing volumes..."
docker volume prune -f

echo ""
echo "✅ Cleanup complete"
echo ""
echo "To run test again: ./scripts/run-chaos-test.sh"
echo ""
