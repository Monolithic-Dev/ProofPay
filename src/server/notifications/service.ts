import { getDb } from '@/server/db/client'
import { notifications } from '@/server/db/schema'
import { eq, and, desc, isNull } from 'drizzle-orm'

export interface CreateNotificationParams {
  userId: string
  orgId?: string
  title: string
  body: string
  link?: string
  type: string
}

export async function createNotification(params: CreateNotificationParams) {
  const db = getDb()
  const [created] = await db
    .insert(notifications)
    .values({
      user_id: params.userId,
      org_id: params.orgId,
      title: params.title,
      body: params.body,
      link: params.link,
      type: params.type,
    })
    .returning()

  return created
}

export async function listUserNotifications(userId: string, limit = 20) {
  const db = getDb()

  const list = await db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId))
    .orderBy(desc(notifications.created_at))
    .limit(limit)

  const unreadCountRes = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)))

  return {
    notifications: list,
    unread_count: unreadCountRes.length,
  }
}

export async function markNotificationsAsRead(userId: string, notificationIds?: string[]) {
  const db = getDb()
  const now = new Date()

  if (notificationIds && notificationIds.length > 0) {
    for (const id of notificationIds) {
      await db
        .update(notifications)
        .set({ read_at: now })
        .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)))
    }
  } else {
    // Mark all as read
    await db
      .update(notifications)
      .set({ read_at: now })
      .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)))
  }

  return { ok: true }
}
