#!/bin/bash

# Server Infrastructure Verification Script
# Task 3.1 STEP 1 — Server Infrastructure Verification
#
# This script runs the comprehensive infrastructure verification
# for the email-password-login-security-fix spec.

set -e

echo "🔍 Starting Server Infrastructure Verification..."
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the backend directory (apps/backend)"
    exit 1
fi

# Check if tsx is available
if ! command -v tsx &> /dev/null; then
    echo "📦 Installing tsx globally..."
    npm install -g tsx
fi

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "📋 Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run the verification script
echo "🚀 Running infrastructure verification..."
tsx src/scripts/server-infrastructure-verification.ts

echo "✅ Infrastructure verification completed!"