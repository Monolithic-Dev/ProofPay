-- Initialize test database for integration testing
SELECT 'CREATE DATABASE proofpay_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'proofpay_test')\gexec

GRANT ALL PRIVILEGES ON DATABASE proofpay_test TO proofpay;
