/**
 * Health check route — GET /api/v1/health
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env['RENDER_GIT_COMMIT'] ?? 'dev',
  })
}
