#!/bin/bash

# Blue-Green Deployment Rollback Script
# Automatically switches back to the previous slot

set -e

echo "🔄 Initiating blue-green deployment rollback..."

# Determine current active slot
echo "🔍 Determining current active slot..."

CURRENT_SLOT=""
if command -v curl >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -sf localhost/api/v1/health 2>/dev/null || echo "")
    if [ -n "$HEALTH_RESPONSE" ]; then
        CURRENT_SLOT=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('slot',''))" 2>/dev/null || echo "")
    fi
fi

# Fallback: check nginx configuration to determine current slot
if [ -z "$CURRENT_SLOT" ]; then
    echo "⚠️  Could not determine current slot from health endpoint, checking nginx config..."
    
    NGINX_CONF="/etc/nginx/conf.d/blue-green.conf"
    if [ -f "$NGINX_CONF" ]; then
        if grep -q "server localhost:3001" "$NGINX_CONF"; then
            CURRENT_SLOT="blue"
        elif grep -q "server localhost:3002" "$NGINX_CONF"; then
            CURRENT_SLOT="green"
        fi
    fi
fi

# Default to blue if still unknown
if [ -z "$CURRENT_SLOT" ]; then
    echo "⚠️  Could not determine current slot, defaulting to 'blue'"
    CURRENT_SLOT="blue"
fi

# Determine rollback target
if [ "$CURRENT_SLOT" = "blue" ]; then
    ROLLBACK_SLOT="green"
else
    ROLLBACK_SLOT="blue"
fi

echo "📋 Rollback Plan:"
echo "   Current slot: $CURRENT_SLOT"
echo "   Rolling back to: $ROLLBACK_SLOT"

# Check if rollback target is available
echo "🔍 Checking if $ROLLBACK_SLOT slot is available..."

if [ "$ROLLBACK_SLOT" = "blue" ]; then
    ROLLBACK_PORT=3001
else
    ROLLBACK_PORT=3002
fi

# Test if rollback target is healthy
echo "🏥 Testing health of $ROLLBACK_SLOT slot (port $ROLLBACK_PORT)..."

ROLLBACK_HEALTHY=false
if command -v curl >/dev/null 2>&1; then
    ROLLBACK_RESPONSE=$(curl -sf --max-time 5 "localhost:$ROLLBACK_PORT/api/v1/health" 2>/dev/null || echo "")
    if [ -n "$ROLLBACK_RESPONSE" ]; then
        ROLLBACK_STATUS=$(echo "$ROLLBACK_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
        if [ "$ROLLBACK_STATUS" = "ok" ]; then
            ROLLBACK_HEALTHY=true
            echo "✅ $ROLLBACK_SLOT slot is healthy and ready for rollback"
        else
            echo "⚠️  $ROLLBACK_SLOT slot responded but status is: '$ROLLBACK_STATUS'"
        fi
    else
        echo "❌ $ROLLBACK_SLOT slot is not responding"
    fi
else
    echo "⚠️  Cannot verify $ROLLBACK_SLOT slot health (curl not available)"
fi

# Proceed with rollback
if [ "$ROLLBACK_HEALTHY" = "true" ] || [ "$1" = "--force" ]; then
    if [ "$ROLLBACK_HEALTHY" = "false" ]; then
        echo "⚠️  Forcing rollback despite unhealthy target slot..."
    fi
    
    echo "🔄 Executing rollback to $ROLLBACK_SLOT slot..."
    
    # Use the switch-slot script
    if [ -f "./switch-slot.sh" ]; then
        ./switch-slot.sh "$ROLLBACK_SLOT"
    else
        echo "❌ switch-slot.sh not found in current directory"
        echo "🔧 Attempting manual nginx configuration update..."
        
        # Manual rollback
        NGINX_CONF="/etc/nginx/conf.d/blue-green.conf"
        if [ -f "$NGINX_CONF" ]; then
            if [ "$ROLLBACK_SLOT" = "blue" ]; then
                sed -i 's/server localhost:3002/server localhost:3001/g' "$NGINX_CONF"
                sed -i 's/server localhost:4002/server localhost:4001/g' "$NGINX_CONF"
            else
                sed -i 's/server localhost:3001/server localhost:3002/g' "$NGINX_CONF"
                sed -i 's/server localhost:4001/server localhost:4002/g' "$NGINX_CONF"
            fi
            
            # Test and reload nginx
            if nginx -t; then
                nginx -s reload
                echo "✅ Manual rollback completed"
            else
                echo "❌ Nginx configuration test failed during manual rollback"
                exit 1
            fi
        else
            echo "❌ Nginx configuration file not found: $NGINX_CONF"
            exit 1
        fi
    fi
    
    # Verify rollback
    echo "✅ Verifying rollback..."
    sleep 3
    
    if command -v curl >/dev/null 2>&1; then
        VERIFY_RESPONSE=$(curl -sf localhost/api/v1/health 2>/dev/null || echo "")
        if [ -n "$VERIFY_RESPONSE" ]; then
            VERIFY_SLOT=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('slot','unknown'))" 2>/dev/null || echo "unknown")
            VERIFY_STATUS=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
            
            if [ "$VERIFY_SLOT" = "$ROLLBACK_SLOT" ] && [ "$VERIFY_STATUS" = "ok" ]; then
                echo "✅ Rollback verification PASSED"
                echo "📊 Current status:"
                echo "   Active slot: $VERIFY_SLOT"
                echo "   Health status: $VERIFY_STATUS"
            else
                echo "⚠️  Rollback verification FAILED"
                echo "   Expected slot: $ROLLBACK_SLOT, Got: $VERIFY_SLOT"
                echo "   Expected status: ok, Got: $VERIFY_STATUS"
            fi
        else
            echo "⚠️  Could not verify rollback (no response from health endpoint)"
        fi
    fi
    
    # Log the rollback
    echo "$(date): Rollback from $CURRENT_SLOT to $ROLLBACK_SLOT completed" >> /var/log/blue-green-rollbacks.log
    
    echo "🎉 Rollback completed successfully!"
    echo "   Previous slot: $CURRENT_SLOT"
    echo "   Current slot: $ROLLBACK_SLOT"
    
else
    echo "❌ Rollback aborted - target slot ($ROLLBACK_SLOT) is not healthy"
    echo "🔧 Options:"
    echo "   1. Check $ROLLBACK_SLOT slot logs: docker logs api-$ROLLBACK_SLOT"
    echo "   2. Start $ROLLBACK_SLOT slot: docker-compose -f docker-compose.$ROLLBACK_SLOT.yml up -d"
    echo "   3. Force rollback anyway: $0 --force"
    exit 1
fi