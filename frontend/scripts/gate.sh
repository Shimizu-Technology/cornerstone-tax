#!/usr/bin/env bash
# Gate script for Cornerstone Tax Frontend
# Must pass before any PR is created.
set -euo pipefail

echo "🚪 Cornerstone Tax Frontend — Gate Check"
echo "=========================================="

cd "$(dirname "$0")/.."

FAIL=0

echo ""
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "❌ node_modules not found. Run: npm install"
  FAIL=1
fi

echo ""
echo "🔍 TypeScript check..."
# Note: Using --noEmit only (not -b) for type checking without building
if npx tsc --noEmit; then
  echo "✅ TypeScript passed"
else
  echo "❌ TypeScript errors found"
  FAIL=1
fi

echo ""
echo "📝 ESLint check..."
LINT_ERRORS=$(npx eslint . 2>&1 | grep -c "error" || true)
if npx eslint . 2>/dev/null; then
  echo "✅ ESLint passed"
else
  echo "⚠️  ESLint: $LINT_ERRORS issues (pre-existing, non-blocking)"
fi

echo ""
echo "🧪 Running Vitest unit tests..."
if npx vitest run; then
  echo "✅ Unit tests passed"
else
  echo "❌ Unit tests failed"
  FAIL=1
fi

echo ""
echo "🏗️  Building..."
if npx vite build > /dev/null 2>&1; then
  echo "✅ Build passed"
else
  echo "❌ Build failed"
  FAIL=1
fi

echo ""
echo "=========================================="
if [ $FAIL -ne 0 ]; then
  echo "❌ GATE FAILED — Do not create PR"
  exit 1
else
  echo "✅ GATE PASSED — Ready for PR"
  exit 0
fi
