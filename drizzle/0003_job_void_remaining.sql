-- Custom migration C-5: add VOID_REMAINING to job_type enum
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'VOID_REMAINING';
