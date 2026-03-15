#!/bin/bash

# Run Single Authentication Test
# Runs a specific test file with proper cleanup

echo "🧪 Running single authentication test..."

cd "$(dirname "$0")"

# Set test environment
export NODE_ENV=test

# Run the specific test with Jest
npx jest src/__tests__/auth/login.test.ts \
  --runInBand \
  --detectOpenHandles \
  --forceExit \
  --verbose \
  --testTimeout=30000 \
  --maxWorkers=1

echo "🔚 Test completed"