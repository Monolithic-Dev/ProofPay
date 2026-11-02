/**
 * Application error class and HTTP response mapping.
 * All errors in the application should extend AppError or use it directly.
 */

export class AppError extends Error {
  public readonly code: string
  public readonly httpStatus: number
  public readonly details?: unknown

  constructor(code: string, message: string, httpStatus = 500, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.httpStatus = httpStatus
    this.details = details
  }
}

// ---------------------------------------------------------------------------
// Well-known error codes
// ---------------------------------------------------------------------------
export class NotFoundError extends AppError {
  constructor(resource = 'Resource', details?: unknown) {
    super('NOT_FOUND', `${resource} not found`, 404, details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super('BAD_REQUEST', message, 400, details)
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string, entity = 'resource') {
    super(
      'INVALID_TRANSITION',
      `Cannot transition ${entity} from ${from} to ${to}`,
      409
    )
  }
}

export class BudgetExceededError extends AppError {
  constructor() {
    super('BUDGET_EXCEEDED', 'Daily LLM budget exceeded. Try again tomorrow.', 503)
  }
}

export class PayPalError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PAYPAL_ERROR', message, 502, details)
  }
}

// ---------------------------------------------------------------------------
// Response serializer
// ---------------------------------------------------------------------------
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
    request_id: string
  }
}

/**
 * Convert any thrown value into a safe error response.
 * Internal (non-AppError) details are hidden from the caller.
 */
export function toErrorResponse(err: unknown, requestId: string): ErrorResponse {
  if (err instanceof AppError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        request_id: requestId,
      },
    }
  }

  // Unknown errors — never leak internals
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      request_id: requestId,
    },
  }
}

export function httpStatusFor(err: unknown): number {
  if (err instanceof AppError) return err.httpStatus
  return 500
}
