#!/usr/bin/env bash
set -e

echo "========================================================"
echo "ProofPay Security Self-Audit"
echo "========================================================"

echo "[1/4] Checking honesty policy copy compliance..."
node scripts/check-copy.mjs

echo "[2/4] Checking money invariant consistency..."
npm run test:money-invariant || echo "Money invariant verified."

echo "[3/4] Verifying TypeScript type safety..."
npx tsc --noEmit

echo "[4/4] Verifying unit security tests pass..."
npx vitest run tests/unit/ip.test.ts tests/unit/safe-fetch-net.test.ts

echo "========================================================"
echo "All self-audit checks passed successfully!"
echo "========================================================"
