import { NextRequest, NextResponse } from 'next/server'
import { readSession } from '@/server/auth/session'
import { listUserNotifications, markNotificationsAsRead, createNotification } from '@/server/notifications/service'
import { toErrorResponse, httpStatusFor, UnauthorizedError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'

export async function GET(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    let data = await listUserNotifications(user.sub)

    // If zero notifications exist for this user, seed helpful initial notices
    if (data.notifications.length === 0) {
      await createNotification({
        userId: user.sub,
        title: 'Welcome to ProofPay Sandbox',
        body: 'Your workspace is ready. You can compile criteria in the Studio or fund contracts with PayPal sandbox holds.',
        link: '/studio',
        type: 'WELCOME',
      })
      await createNotification({
        userId: user.sub,
        title: 'PayPal Gateway Connected',
        body: 'Platform sandbox gateway active. Test authorization holds without risking real funds.',
        link: '/settings/payments',
        type: 'PAYPAL_CONNECTED',
      })
      data = await listUserNotifications(user.sub)
    }

    return NextResponse.json(data, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId()

  try {
    const user = await readSession(req)
    if (!user) throw new UnauthorizedError('UNAUTHENTICATED')

    const body = await req.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids) ? body.ids : undefined

    await markNotificationsAsRead(user.sub, ids)

    return NextResponse.json({ ok: true }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
