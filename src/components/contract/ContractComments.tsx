'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Send, User, Bot, Clock } from 'lucide-react'
import { useCurrentUser } from '@/lib/query'
import { relativeTime } from '@/lib/format'

interface CommentItem {
  id: string
  contract_id: string
  milestone_id: string | null
  user_id: string
  content: string
  created_at: string
  author_name: string
  author_email: string
  author_role: string
  is_agent: boolean
}

export function ContractComments({ contractId }: { contractId: string }) {
  const { data: currentUser } = useCurrentUser()
  const [comments, setComments] = useState<CommentItem[]>([])
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => {
    fetchComments()
    const timer = setInterval(fetchComments, 6000)
    return () => clearInterval(timer)
  }, [fetchComments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/contracts/${contractId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (res.ok) {
        setContent('')
        await fetchComments()
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand" />
          <span>Party Discussion &amp; Activity ({comments.length})</span>
        </h3>
        <span className="text-xs text-muted">Buyer and Seller messaging</span>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {loading && (
          <p className="text-xs text-muted py-2">Loading party messages...</p>
        )}

        {!loading && comments.length === 0 && (
          <div className="text-center py-6 text-xs text-muted border border-dashed border-border rounded-xl">
            No messages yet. Post questions, updates, or deliverable links here.
          </div>
        )}

        {comments.map((c) => {
          const isOwn = currentUser && c.user_id === currentUser.id
          return (
            <div
              key={c.id}
              className={`p-3 rounded-xl border text-xs space-y-1.5 transition-colors ${
                isOwn
                  ? 'bg-brand/5 border-brand/20 ml-4'
                  : 'bg-surface-2 border-border mr-4'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-muted">
                <div className="flex items-center gap-1.5 font-medium text-text">
                  {c.is_agent ? (
                    <Bot className="w-3.5 h-3.5 text-brand" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-muted" />
                  )}
                  <span>{c.author_name}</span>
                  <span className="text-[10px] text-brand uppercase font-semibold">
                    ({c.author_role})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted" />
                  <span>{relativeTime(c.created_at)}</span>
                </div>
              </div>
              <p className="text-text whitespace-pre-wrap leading-relaxed">{c.content}</p>
            </div>
          )
        })}
      </div>

      {/* Post Comment Input */}
      {currentUser && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2 border-t border-border">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Post a message or clarify milestone requirements..."
            disabled={submitting}
            className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs text-text focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      )}
    </div>
  )
}
