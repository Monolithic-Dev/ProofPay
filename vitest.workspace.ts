import { defineWorkspace } from 'vitest/config'
import path from 'path'

const testEnv = {
  NODE_ENV: 'test' as const,
  DATABASE_URL: process.env['DATABASE_URL'] || 'postgresql://proofpay:proofpay@localhost:5435/proofpay_test',
  PAYPAL_ENV: 'sandbox',
  PAYPAL_CLIENT_ID: 'mock_test_client_id',
  PAYPAL_CLIENT_SECRET: 'mock_test_client_secret',
  ANTHROPIC_API_KEY: 'mock_test_anthropic_key',
  SESSION_SECRET: 'mock_test_session_secret_min_32_characters_long',
  DEMO_MODE: 'true',
}

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
      globals: true,
      env: testEnv,
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
  {
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
      environment: 'node',
      globals: true,
      env: testEnv,
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  },
])
