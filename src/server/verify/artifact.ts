/**
 * Artifact parsing, validation, and sanitization.
 * Implements phase-4-verification-engine.md §4.1 & data-model.md §7 rules 3–5.
 */
import { sha256Hex } from '@/server/contracts/canonical'
import { ValidationError, AppError } from '@/server/util/errors'

export const MAX_ARTIFACT_BYTES = 1024 * 1024 // 1 MiB (1,048,576 bytes)
export const MAX_JSON_RECORDS = 5000
export const MAX_JSON_DEPTH = 20

export interface ParsedArtifact {
  text: string
  rows?: Record<string, unknown>[]
  sizeBytes: number
  sha256: string
}

/**
 * Calculate the maximum object nesting depth of any JSON value.
 */
export function jsonDepth(value: unknown, currentDepth = 0): number {
  if (value === null || typeof value !== 'object') {
    return currentDepth
  }

  let maxDepth = currentDepth + 1
  if (Array.isArray(value)) {
    for (const item of value) {
      const depth = jsonDepth(item, currentDepth + 1)
      if (depth > maxDepth) maxDepth = depth
    }
  } else {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const depth = jsonDepth((value as Record<string, unknown>)[key], currentDepth + 1)
      if (depth > maxDepth) maxDepth = depth
    }
  }

  return maxDepth
}

/**
 * Parse, validate, sanitize, and hash an incoming deliverable artifact.
 */
export function parseArtifact(
  contentType: 'json_records' | 'text',
  content: unknown
): ParsedArtifact {
  if (content === undefined || content === null) {
    throw new ValidationError('Artifact content cannot be empty')
  }

  let rawText = ''
  let rows: Record<string, unknown>[] | undefined

  if (contentType === 'text') {
    if (typeof content !== 'string') {
      throw new AppError(
        'CONTENT_TYPE_MISMATCH',
        `Expected text string for deliverable content, received ${typeof content}`,
        400
      )
    }
    rawText = content
  } else if (contentType === 'json_records') {
    let parsedJson: unknown

    if (typeof content === 'string') {
      rawText = content
      try {
        parsedJson = JSON.parse(content)
      } catch (err) {
        throw new AppError(
          'CONTENT_TYPE_MISMATCH',
          `Deliverable content is not valid JSON: ${String(err)}`,
          400
        )
      }
    } else if (Array.isArray(content) || (typeof content === 'object' && content !== null)) {
      parsedJson = content
      rawText = JSON.stringify(content)
    } else {
      throw new AppError(
        'CONTENT_TYPE_MISMATCH',
        'json_records content must be a JSON array or JSON string representation of an array',
        400
      )
    }

    if (!Array.isArray(parsedJson)) {
      throw new AppError(
        'CONTENT_TYPE_MISMATCH',
        'json_records deliverable must be a JSON array at top level',
        400
      )
    }

    if (parsedJson.length > MAX_JSON_RECORDS) {
      throw new ValidationError(
        `json_records exceeds maximum row limit of ${MAX_JSON_RECORDS} (found ${parsedJson.length})`
      )
    }

    const depth = jsonDepth(parsedJson)
    if (depth > MAX_JSON_DEPTH) {
      throw new ValidationError(
        `JSON object nesting depth exceeds maximum allowed depth of ${MAX_JSON_DEPTH} (found ${depth})`
      )
    }

    for (let idx = 0; idx < parsedJson.length; idx++) {
      const item = parsedJson[idx]
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new ValidationError(
          `Record at index ${idx} must be an object (found ${typeof item})`
        )
      }
    }

    rows = parsedJson as Record<string, unknown>[]
  } else {
    throw new ValidationError(`Unsupported content_type: ${String(contentType)}`)
  }

  // Strip null bytes (\u0000) while keeping zero-width/bidi characters for adversarial scan
  const sanitizedText = rawText.replace(/\0/g, '')

  const sizeBytes = Buffer.byteLength(sanitizedText, 'utf8')
  if (sizeBytes > MAX_ARTIFACT_BYTES) {
    throw new AppError(
      'ARTIFACT_TOO_LARGE',
      `Deliverable size (${sizeBytes} bytes) exceeds maximum limit of 1 MiB (${MAX_ARTIFACT_BYTES} bytes)`,
      400
    )
  }

  const hash = sha256Hex(sanitizedText)

  return {
    text: sanitizedText,
    rows,
    sizeBytes,
    sha256: hash,
  }
}
