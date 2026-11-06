import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let reportData: any = null

    // Check size cap (max 64 KiB)
    const rawText = await req.text()
    if (rawText.length > 64 * 1024) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    try {
      reportData = JSON.parse(rawText)
    } catch {
      reportData = { raw: rawText }
    }

    const report = reportData['csp-report'] || reportData

    // Security logging (anonymized, no private credentials)
    console.warn('[CSP Violation Reported]', {
      blockedUri: report['blocked-uri'] || report.blockedUri,
      violatedDirective: report['violated-directive'] || report.violatedDirective,
      originalPolicy: report['original-policy'] ? '[PRESENT]' : '[NONE]',
      disposition: report['disposition'] || 'enforce',
    })

    return NextResponse.json({ received: true }, { status: 204 })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to process report' }, { status: 400 })
  }
}
