process.loadEnvFile?.('.env')
import { callTool } from '../src/server/ai/llm'

async function main() {
  console.log('Testing live AI inference via Groq provider...')
  const start = Date.now()
  const result = await callTool({
    purpose: 'test_live_groq',
    system: 'You are an escrow contract analyzer. Synthesize clear milestone agreements.',
    user: 'Draft a milestone contract for creating a payment webhook listener for $400.',
    tool: {
      name: 'create_contract',
      description: 'Creates escrow contract with milestones',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          milestones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                amount_cents: { type: 'number' },
                deliverables: { type: 'string' },
              },
              required: ['title', 'amount_cents', 'deliverables'],
            },
          },
        },
        required: ['title', 'milestones'],
      },
    },
  })

  const elapsed = Date.now() - start
  console.log(`\n✅ Live Groq Response received in ${elapsed}ms:`)
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Groq test failed:', err)
  process.exit(1)
})
