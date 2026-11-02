import { describe, it, expect } from 'vitest'
import {
  AppError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
  httpStatusFor,
} from '@/server/util/errors'

describe('Error handling & mapping', () => {
  it('maps AppError to standard response shape', () => {
    const err = new NotFoundError('Contract', { contractId: 'c123' })
    const res = toErrorResponse(err, 'req_12345')

    expect(res).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Contract not found',
        details: { contractId: 'c123' },
        request_id: 'req_12345',
      },
    })
    expect(httpStatusFor(err)).toBe(404)
  })

  it('hides internal error messages for unknown errors', () => {
    const secretSqlError = new Error('DATABASE CONNECTION FAILED: password=supersecret')
    const res = toErrorResponse(secretSqlError, 'req_67890')

    expect(res).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
        request_id: 'req_67890',
      },
    })
    expect(res.error.message).not.toContain('supersecret')
    expect(httpStatusFor(secretSqlError)).toBe(500)
  })

  it('maps ValidationError with status 422', () => {
    const err = new ValidationError('Invalid deliverable', [{ path: 'sku', message: 'required' }])
    const res = toErrorResponse(err, 'req_abc')

    expect(res.error.code).toBe('VALIDATION_ERROR')
    expect(res.error.details).toEqual([{ path: 'sku', message: 'required' }])
    expect(httpStatusFor(err)).toBe(422)
  })
})
