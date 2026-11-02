/**
 * Fake LLM Transport for hermetic testing and offline development.
 * Implements phase-3-auth-and-contracts.md §3.5 & task 4.1.
 */
import fs from 'fs'
import path from 'path'

export interface FakeLlmResponse<T> {
  data: T
  usage: {
    promptTokens: number
    completionTokens: number
    costMicroUsd: number
  }
}

export type LlmTransportFn = <T>(params: {
  purpose: string
  model: string
  system: string
  user: string
  tool: { name: string; input_schema: unknown }
  contractId?: string
}) => Promise<FakeLlmResponse<T>>

let _currentTransport: LlmTransportFn | null = null

export function setLlmTransport(transport: LlmTransportFn | null): void {
  _currentTransport = transport
}

export function getLlmTransport(): LlmTransportFn | null {
  return _currentTransport
}

/**
 * Default Fake LLM that returns fixture contract on compile and clean reviews on lint.
 */
export const defaultFakeLlm: LlmTransportFn = async <T>(params: {
  purpose: string
  model: string
  system: string
  user: string
  tool: { name: string; input_schema: unknown }
}): Promise<FakeLlmResponse<T>> => {
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/demo-contract.json')
  const demoContract = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

  if (params.purpose === 'compile_contract') {
    return {
      data: demoContract as T,
      usage: {
        promptTokens: 450,
        completionTokens: 600,
        costMicroUsd: 10350,
      },
    }
  }

  if (params.purpose === 'lint_contract') {
    return {
      data: { issues: [] } as T,
      usage: {
        promptTokens: 300,
        completionTokens: 80,
        costMicroUsd: 2100,
      },
    }
  }

  return {
    data: {} as T,
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      costMicroUsd: 1050,
    },
  }
}
