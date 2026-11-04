import type { ParsedArtifact } from '../artifact'

export interface CheckCsvSchemaSpec {
  required_headers?: string[]
  min_columns?: number
  delimiter?: string
}

export function checkCsvSchema(
  artifact: ParsedArtifact,
  spec: CheckCsvSchemaSpec
): { status: 'pass' | 'fail'; observed: unknown; expected: unknown; message: string } {
  const content = (artifact.text || '').trim()
  if (!content) {
    return {
      status: 'fail',
      observed: 'empty',
      expected: 'non-empty CSV content',
      message: 'Deliverable content is empty; cannot evaluate CSV schema.',
    }
  }

  const delimiter = spec.delimiter || ','
  const lines = content.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
  if (lines.length === 0) {
    return {
      status: 'fail',
      observed: 0,
      expected: '>= 1 header row',
      message: 'No CSV rows found.',
    }
  }

  const headerLine = lines[0]!
  const observedHeaders = headerLine.split(delimiter).map((h: string) => h.trim().replace(/^["']|["']$/g, ''))

  if (spec.min_columns !== undefined && observedHeaders.length < spec.min_columns) {
    return {
      status: 'fail',
      observed: observedHeaders.length,
      expected: `>= ${spec.min_columns}`,
      message: `CSV contains ${observedHeaders.length} columns, expected at least ${spec.min_columns}.`,
    }
  }

  if (spec.required_headers && spec.required_headers.length > 0) {
    const missing = spec.required_headers.filter((rh: string) => !observedHeaders.includes(rh))
    if (missing.length > 0) {
      return {
        status: 'fail',
        observed: observedHeaders,
        expected: spec.required_headers,
        message: `Missing required CSV headers: ${missing.join(', ')}.`,
      }
    }
  }

  return {
    status: 'pass',
    observed: observedHeaders,
    expected: spec.required_headers || `min ${spec.min_columns ?? 1} columns`,
    message: `CSV schema valid with ${observedHeaders.length} columns and all required headers present.`,
  }
}
