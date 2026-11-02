import Link from 'next/link'
import { EmptyState } from '@/components/common/EmptyState'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20">
      <EmptyState
        icon={<FileQuestion className="w-6 h-6 text-muted" />}
        title="Page not found (404)"
        description="The contract, milestone, or page you requested does not exist or you do not have permission to access it."
        action={
          <div className="flex gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-brand text-white text-xs font-medium hover:opacity-95 transition-all"
            >
              Return Home
            </Link>
            <Link
              href="/studio"
              className="px-4 py-2 rounded-lg border border-border bg-surface text-text text-xs font-medium hover:bg-surface-2 transition-colors"
            >
              Go to Studio
            </Link>
          </div>
        }
      />
    </div>
  )
}
