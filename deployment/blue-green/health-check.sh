#!/bin/bash

# Blue-Green Deployment Health Check Script
# Usage: ./health-check.sh <HOST> [MAX_RETRIES] [WAIT_SECONDS]
# Example: ./health-check.sh http://localhost:3001 30 10

set -e

HOST=$1
MAX_RETRIES=${2:-30}
WAIT=${3:-10}

# Validate input
if [ -z "$HOST" ]; then
    echo "❌ Usage: $0 <HOST> [MAX_RETRIES] [WAIT_SECONDS]"
    echo "   Example: $0 http://localhost:3001 30 10"
    echo "   Example: $0 https://api.example.com"
    exit 1
fi

# Remove trailing slash from HOST
HOST=${HOST%/}

echo "🏥 Health Check Configuration:"
echo "   Host: $HOST"
echo "   Max retries: $MAX_RETRIES"
echo "   Wait between attempts: ${WAIT}s"
echo "   Health endpoint: $HOST/api/v1/health"
echo ""

echo "🔍 Starting health check for $HOST..."

# Track timing
START_TIME=$(date +%s)

for i in $(seq 1 $MAX_RETRIES); do
    echo "🔄 Attempt $i/$MAX_RETRIES..."
    
    # Perform health check
    if command -v curl >/dev/null 2>&1; then
        # Use curl if available
        RESPONSE=$(curl -sf --max-time 10 "$HOST/api/v1/health" 2>/dev/null || echo "")
        
        if [ -n "$RESPONSE" ]; then
            # Try to parse JSON response
            STATUS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
            SLOT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('slot','unknown'))" 2>/dev/null || echo "unknown")
            VERSION=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','unknown'))" 2>/dev/null || echo "unknown")
            
            if [ "$STATUS" = "ok" ]; then
                END_TIME=$(date +%s)
                DURATION=$((END_TIME - START_TIME))
                
                echo "✅ Health check PASSED after $i attempts (${DURATION}s total)"
                echo "📊 Service Details:"
                echo "   Status: $STATUS"
                echo "   Slot: $SLOT"
                echo "   Version: $VERSION"
                echo "   Response: $RESPONSE"
                exit 0
            else
                echo "   ⚠️  Service responded but status is: '$STATUS' (expected: 'ok')"
            fi
        else
            echo "   ❌ No response from health endpoint"
        fi
    elif command -v wget >/dev/null 2>&1; then
        # Fallback to wget
        if wget -q --timeout=10 --tries=1 -O- "$HOST/api/v1/health" >/dev/null 2>&1; then
            echo "✅ Health check PASSED after $i attempts (using wget)"
            exit 0
        else
            echo "   ❌ Health check failed (using wget)"
        fi
    else
        echo "   ❌ Neither curl nor wget available for health check"
        exit 1
    fi
    
    # Show progress
    if [ $i -lt $MAX_RETRIES ]; then
        echo "   ⏳ Waiting ${WAIT}s before next attempt..."
        sleep $WAIT
    fi
done

# Health check failed
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "❌ Health check FAILED after $MAX_RETRIES attempts (${DURATION}s total)"
echo "🔍 Troubleshooting tips:"
echo "   1. Check if the service is running: docker ps"
echo "   2. Check service logs: docker logs <container_name>"
echo "   3. Verify the health endpoint manually: curl $HOST/api/v1/health"
echo "   4. Check network connectivity and firewall rules"
echo "   5. Verify the service is listening on the expected port"

exit 1