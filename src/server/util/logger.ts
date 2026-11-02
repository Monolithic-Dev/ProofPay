import pino from 'pino'

// Lazy import env to avoid circular deps during testing
function getLogLevel(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require('../config/env') as { env: { LOG_LEVEL: string; NODE_ENV: string } }
    return env.LOG_LEVEL
  } catch {
    return 'info'
  }
}

function isProduction(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require('../config/env') as { env: { NODE_ENV: string } }
    return env.NODE_ENV === 'production'
  } catch {
    return process.env['NODE_ENV'] === 'production'
  }
}

// Paths that contain secrets — never log their values
const REDACT_PATHS = [
  '*.password',
  '*.secret',
  '*.authorization',
  '*.api_key',
  '*.key_hash',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
]

export const logger = pino({
  level: getLogLevel(),
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  transport: isProduction()
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
})

// ---------------------------------------------------------------------------
// Child logger factories
// ---------------------------------------------------------------------------
interface LogContext {
  request_id?: string
  contract_id?: string
  milestone_key?: string
  user_id?: string
  job_id?: string
  [key: string]: unknown
}

export function childLogger(context: LogContext) {
  return logger.child(context)
}

export type Logger = ReturnType<typeof childLogger>
