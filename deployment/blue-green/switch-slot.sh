#!/bin/bash

# Blue-Green Deployment Slot Switcher
# Usage: ./switch-slot.sh blue|green

set -e

SLOT=$1
NGINX_CONF="/etc/nginx/conf.d/blue-green.conf"
BACKUP_CONF="/etc/nginx/conf.d/blue-green.conf.backup"

# Validate input
if [ "$SLOT" != "blue" ] && [ "$SLOT" != "green" ]; then
    echo "❌ Usage: $0 blue|green"
    echo "   Example: $0 blue"
    exit 1
fi

# Determine ports based on slot
if [ "$SLOT" = "blue" ]; then
    BACKEND_PORT=3001
    FRONTEND_PORT=4001
    echo "🔵 Switching to BLUE slot"
else
    BACKEND_PORT=3002
    FRONTEND_PORT=4002
    echo "🟢 Switching to GREEN slot"
fi

echo "📋 Configuration:"
echo "   Backend port: $BACKEND_PORT"
echo "   Frontend port: $FRONTEND_PORT"
echo "   Nginx config: $NGINX_CONF"

# Check if nginx config exists
if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ Nginx configuration not found: $NGINX_CONF"
    echo "   Please ensure nginx-blue-green.conf is installed at $NGINX_CONF"
    exit 1
fi

# Create backup of current configuration
echo "💾 Creating backup of current nginx configuration..."
cp "$NGINX_CONF" "$BACKUP_CONF"

# Update backend upstream
echo "🔄 Updating backend upstream to port $BACKEND_PORT..."
sed -i "s/server localhost:[0-9]*; # Default to [a-z]* slot (port [0-9]*)/server localhost:$BACKEND_PORT; # Default to $SLOT slot (port $BACKEND_PORT)/" "$NGINX_CONF"

# Update frontend upstream  
echo "🔄 Updating frontend upstream to port $FRONTEND_PORT..."
sed -i "s/server localhost:[0-9]*; # Default to [a-z]* slot (port [0-9]*)/server localhost:$FRONTEND_PORT; # Default to $SLOT slot (port $FRONTEND_PORT)/" "$NGINX_CONF"

# Alternative approach using more specific patterns
sed -i "/upstream backend_active/,/}/ s/server localhost:[0-9]*/server localhost:$BACKEND_PORT/" "$NGINX_CONF"
sed -i "/upstream frontend_active/,/}/ s/server localhost:[0-9]*/server localhost:$FRONTEND_PORT/" "$NGINX_CONF"

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if ! nginx -t; then
    echo "❌ Nginx configuration test failed!"
    echo "🔄 Restoring backup configuration..."
    cp "$BACKUP_CONF" "$NGINX_CONF"
    exit 1
fi

# Reload nginx
echo "🔄 Reloading nginx..."
if ! nginx -s reload; then
    echo "❌ Nginx reload failed!"
    echo "🔄 Restoring backup configuration..."
    cp "$BACKUP_CONF" "$NGINX_CONF"
    nginx -s reload
    exit 1
fi

# Verify the switch worked
echo "✅ Verifying slot switch..."
sleep 2

# Test health endpoint
if command -v curl >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -sf localhost/api/v1/health 2>/dev/null || echo "")
    if [ -n "$HEALTH_RESPONSE" ]; then
        ACTIVE_SLOT=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('slot','unknown'))" 2>/dev/null || echo "unknown")
        if [ "$ACTIVE_SLOT" = "$SLOT" ]; then
            echo "✅ Successfully switched to $SLOT slot"
            echo "📊 Health check response: $HEALTH_RESPONSE"
        else
            echo "⚠️  Switch completed but health check shows slot: $ACTIVE_SLOT (expected: $SLOT)"
        fi
    else
        echo "⚠️  Switch completed but health check failed"
    fi
else
    echo "✅ Switch completed (curl not available for verification)"
fi

# Log the switch
echo "$(date): Switched to $SLOT slot (backend:$BACKEND_PORT, frontend:$FRONTEND_PORT)" >> /var/log/blue-green-switches.log

echo "🎉 Slot switch to $SLOT completed successfully!"
echo "   Backend: localhost:$BACKEND_PORT"
echo "   Frontend: localhost:$FRONTEND_PORT"
echo "   Backup config saved at: $BACKUP_CONF"