import { NextResponse } from 'next/server'
import { SYSTEM_TEMPLATES } from '@/server/templates/system'
import { getDb } from '@/server/db/client'
import { templates } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { eq, or, isNull } from 'drizzle-orm'

export async function GET(req: Request) {
  const user = await readSession(req)
  const db = getDb()

  let orgTemplates: any[] = []
  if (user?.org_id) {
    orgTemplates = await db
      .select()
      .from(templates)
      .where(or(isNull(templates.organization_id), eq(templates.organization_id, user.org_id)))
  }

  // Combine system templates with any DB templates
  const allTemplates = [
    ...SYSTEM_TEMPLATES.map((t) => ({
      id: `sys-${t.slug}`,
      slug: t.slug,
      name: t.name,
      category: t.category,
      description: t.description,
      contract_json: t.contract_json,
      variables: t.variables,
      is_system: true,
    })),
    ...orgTemplates.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      category: t.category,
      description: t.description,
      contract_json: t.contract_json,
      variables: t.variables,
      is_system: false,
    })),
  ]

  return NextResponse.json({ templates: allTemplates })
}
