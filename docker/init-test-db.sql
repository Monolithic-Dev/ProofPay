-- Creates the test database alongside the main proofpay DB
-- This runs automatically when the Docker container first starts
SELECT 'CREATE DATABASE proofpay_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'proofpay_test')\gexec

GRANT ALL PRIVILEGES ON DATABASE proofpay_test TO proofpay;
