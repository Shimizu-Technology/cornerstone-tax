#!/usr/bin/env bash
# Gate script for Cornerstone Tax API
# Must pass before any PR is created.
set -euo pipefail

echo "🚪 Cornerstone Tax API — Gate Check"
echo "===================================="

cd "$(dirname "$0")/.."

FAIL=0

echo ""
echo "📦 Checking dependencies..."
bundle check > /dev/null 2>&1 || { echo "❌ Bundle not installed. Run: bundle install"; FAIL=1; }

echo ""
echo "🧪 Running RSpec tests..."
if bundle exec rspec --format progress; then
  echo "✅ Tests passed"
else
  echo "❌ Tests failed"
  FAIL=1
fi

echo ""
echo "🔍 Running RuboCop..."
if bundle exec rubocop --parallel 2>/dev/null; then
  echo "✅ RuboCop passed"
else
  echo "⚠️  RuboCop issues found (non-blocking for now)"
fi

echo ""
echo "🔒 Running Brakeman security scan..."
if bundle exec brakeman -q --no-pager 2>/dev/null; then
  echo "✅ Brakeman passed"
else
  echo "⚠️  Brakeman warnings found (review needed)"
fi

echo ""
echo "===================================="
if [ $FAIL -ne 0 ]; then
  echo "❌ GATE FAILED — Do not create PR"
  exit 1
else
  echo "✅ GATE PASSED — Ready for PR"
  exit 0
fi
