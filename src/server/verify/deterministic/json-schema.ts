/**
 * JSON Schema deterministic check.
 * Implements phase-4-verification-engine.md §4.2 & ai-pipeline.md §3 Stage 1.
 */
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import productV1Schema from '../schemas/product_v1.json'
import type { ParsedArtifact } from '../artifact'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

const SCHEMAS: Record<string, object> = {
  product_v1: productV1Schema,
}

export interface CheckJsonSchemaSpec {
  schema_ref: string
}

export interface DetCheckResult {
  status: 'pass' | 'fail'
  observed: unknown
  expected: unknown
  message: string
}

export function checkJsonSchema(
  artifact: ParsedArtifact,
  spec: CheckJsonSchemaSpec
): DetCheckResult {
  const schema = SCHEMAS[spec.schema_ref]
  if (!schema) {
    return {
      status: 'fail',
      observed: spec.schema_ref,
      expected: Object.keys(SCHEMAS).join(', '),
      message: `Unknown schema reference: "${spec.schema_ref}"`,
    }
  }

  if (!artifact.rows) {
    return {
      status: 'fail',
      observed: 'non-json_records',
      expected: 'json_records array',
      message: 'Deliverable is not valid JSON array.',
    }
  }

  const validate = ajv.compile(schema)
  const valid = validate(artifact.rows)

  if (valid) {
    return {
      status: 'pass',
      observed: `${artifact.rows.length} valid records`,
      expected: `Complies with ${spec.schema_ref}`,
      message: `All ${artifact.rows.length} records comply with ${spec.schema_ref} schema.`,
    }
  }

  const errors = validate.errors ?? []
  const formattedErrors: string[] = []

  for (const err of errors.slice(0, 5)) {
    // Determine row index from instancePath (e.g., "/22/contact_email" -> row 22)
    const match = err.instancePath.match(/^\/(\d+)(?:\/(.*))?$/)
    if (match) {
      const rowIndex = match[1]
      const field = match[2] || err.params?.['missingProperty'] || 'field'
      formattedErrors.push(`Row ${rowIndex}: ${field} ${err.message}.`)
    } else if (err.keyword === 'required') {
      const field = err.params?.['missingProperty']
      formattedErrors.push(`Missing required property "${field}".`)
    } else {
      formattedErrors.push(`${err.instancePath} ${err.message}.`)
    }
  }

  return {
    status: 'fail',
    observed: `${errors.length} schema error(s)`,
    expected: `Compliant with ${spec.schema_ref}`,
    message: formattedErrors.join(' ') + (errors.length > 5 ? ` (and ${errors.length - 5} more)` : ''),
  }
}
