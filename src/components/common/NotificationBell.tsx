'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, Sparkles, CreditCard, CheckCircle2, MessageSquare, Info, ShieldAlert } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { relativeTime } from '@/lib/format'

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/v1/notifications')
      if (!res.ok) return { notifications: [], unread_count: 0 }
      return res.json()
    },
    refetchInterval: 15000, // Refetch every 15s
  })

  const markReadMutation = useMutation({
    mutationFn: async (ids?: string[]) => {
      await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const notifications = data?.notifications || []
  const unreadCount = data?.unread_count || 0

  const getIcon = (type: string) => {
    switch (type) {
      case 'PAYPAL_CONNECTED':
      case 'PAYPAL_HOLD_AUTHORIZED':
        return <CreditCard className="w-4 h-4 text-blue-400" />
      case 'VERIFICATION_PASSED':
      case 'MILESTONE_RELEASED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-4 h-4 text-purple-400" />
      case 'WARNING':
        return <ShieldAlert className="w-4 h-4 text-amber-400" />
      default:
        return <Sparkles className="w-4 h-4 text-brand" />
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors focus:outline-none"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-surface border border-border shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
          <div className="p-4 border-b border-border/60 flex items-center justify-between bg-surface-subtle/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markReadMutation.mutate(undefined)}
                className="text-xs text-brand hover:underline font-medium inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.read_at) {
                      markReadMutation.mutate([n.id])
                    }
                    if (n.link) {
                      setIsOpen(false)
                      router.push(n.link)
                    }
                  }}
                  className={`p-3.5 hover:bg-surface-2/60 transition-colors cursor-pointer flex gap-3 items-start ${
                    !n.read_at ? 'bg-brand/5' : ''
                  }`}
                >
                  <div className="p-2 rounded-xl bg-surface-2 border border-border/60 shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-text truncate">{n.title}</h4>
                      <span className="text-[10px] text-muted whitespace-nowrap">
                        {relativeTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed line-clamp-2">{n.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
