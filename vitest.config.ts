import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://proofpay:proofpay@localhost:5435/proofpay_test',
      PAYPAL_ENV: 'sandbox',
      PAYPAL_CLIENT_ID: 'mock_test_client_id',
      PAYPAL_CLIENT_SECRET: 'mock_test_client_secret',
      ANTHROPIC_API_KEY: 'mock_test_anthropic_key',
      SESSION_SECRET: 'mock_test_session_secret_min_32_characters_long',
      DEMO_MODE: 'true',
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
