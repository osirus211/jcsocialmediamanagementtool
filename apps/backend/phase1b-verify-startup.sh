#!/bin/bash
# Phase 1B: Backend Startup Verification Script (Bash)
# Captures first 40 lines of backend startup logs and verifies component initialization

echo "═══════════════════════════════════════════════════════════"
echo "PHASE 1B: BACKEND STARTUP VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Objective: Verify all Phase 1B components initialize at startup"
echo ""

# Check if backend is already running
echo "STEP 1: Check if backend is already running"
echo "─────────────────────────────────────────────────────────"
echo ""

if pgrep -f "node.*server" > /dev/null; then
    echo "⚠️  Backend appears to be running"
    echo "   To capture fresh startup logs, stop the backend first:"
    echo ""
    echo "   1. Press Ctrl+C in the backend terminal"
    echo "   2. Or run: pkill -f 'node.*server'"
    echo ""
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 0
    fi
fi

echo ""
echo "STEP 2: Start backend and capture startup logs"
echo "─────────────────────────────────────────────────────────"
echo ""

echo "Instructions:"
echo "1. Open a NEW terminal window"
echo "2. Navigate to: cd apps/backend"
echo "3. Run: npm run dev"
echo "4. Copy the FIRST 40 LINES of output"
echo "5. Return here and paste them"
echo ""

echo "Waiting for startup logs..."
echo "(Paste logs below and press Ctrl+D when done)"
echo ""

# Collect multi-line input
logs=$(cat)

if [ -z "$logs" ]; then
    echo ""
    echo "❌ No logs provided. Exiting."
    echo ""
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "ANALYZING STARTUP LOGS"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Component checklist
declare -A components
components=(
    ["Redis Connection"]="Redis connected|Redis client connected"
    ["MongoDB Connection"]="MongoDB connected|Database connected"
    ["BullMQ Queue Initialization"]="QueueManager initialized|Queue initialized"
    ["Token Refresh Scheduler"]="Token refresh scheduler started|scheduler started"
    ["Token Refresh Worker"]="Distributed token refresh worker started|token refresh worker started"
    ["Worker Concurrency"]="concurrency: 5|concurrency=5"
    ["Publishing Worker"]="Publishing worker started"
    ["Server Listening"]="Server running on port|listening on port"
)

# Analyze logs
declare -A results
all_passed=true

echo "Component Initialization Status:"
echo ""

for component in "${!components[@]}"; do
    pattern="${components[$component]}"
    if echo "$logs" | grep -qE "$pattern"; then
        echo "   ✅ $component"
        results[$component]=1
    else
        echo "   ❌ $component"
        results[$component]=0
        all_passed=false
    fi
done

echo ""

# Summary
if [ "$all_passed" = true ]; then
    echo "═══════════════════════════════════════════════════════════"
    echo "✅ ALL COMPONENTS INITIALIZED SUCCESSFULLY"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    
    echo "Backend is ready for Phase 1B validation!"
    echo ""
    
    echo "Next Steps:"
    echo "1. Run infrastructure audit: node phase1b-infrastructure-audit.js"
    echo "2. Verify Redis keys: redis-cli keys \"bull:*\""
    echo "3. Proceed to validation tests"
    echo ""
else
    echo "═══════════════════════════════════════════════════════════"
    echo "❌ SOME COMPONENTS FAILED TO INITIALIZE"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    
    echo "Missing Components:"
    for component in "${!results[@]}"; do
        if [ "${results[$component]}" -eq 0 ]; then
            echo "   - $component"
        fi
    done
    
    echo ""
    echo "Troubleshooting:"
    echo "1. Check backend logs for errors"
    echo "2. Verify Redis is running: redis-cli ping"
    echo "3. Verify MongoDB is running"
    echo "4. Check .env file configuration"
    echo ""
fi

echo "═══════════════════════════════════════════════════════════"
echo ""
