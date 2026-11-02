'use client'

/**
 * SubmissionStepper Component — visual verification pipeline progress.
 * Steps: Received → Checks → AI Review → Policy Decision → Settlement.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4 (S5).
 */
import React from 'react'
import { Check, Loader2, X, AlertTriangle, ShieldCheck } from 'lucide-react'
import type { MilestoneStatus, VerificationView } from '@/shared/types'

export interface SubmissionStepperProps {
  milestoneStatus: MilestoneStatus
  verification?: VerificationView | null
  className?: string
}

export function SubmissionStepper({
  milestoneStatus,
  verification,
  className = '',
}: SubmissionStepperProps) {
  const isVerifying = milestoneStatus === 'VERIFYING' || verification?.status === 'RUNNING'
  const isReleased = milestoneStatus === 'RELEASED'
  const isPassed = milestoneStatus === 'PASSED'
  const isRejected = milestoneStatus === 'REJECTED' || verification?.decision === 'REJECT'
  const isEscalated = milestoneStatus === 'ESCALATED' || verification?.decision === 'ESCALATE'
  const isReleasing = milestoneStatus === 'RELEASING'
  const isReleaseFailed = milestoneStatus === 'RELEASE_FAILED'

  type StepState = 'completed' | 'active' | 'pending' | 'failed' | 'warn'

  // Step 1: Received
  const step1State: StepState = verification || milestoneStatus !== 'PENDING' ? 'completed' : 'pending'

  // Step 2: Deterministic Checks
  let step2State: StepState = 'pending'
  if (isVerifying) {
    step2State = 'active'
  } else if (verification) {
    const criteriaList = verification.criteria || (verification as any).stage1 || []
    const hasFailingS1 = criteriaList.some((c: any) => c.type === 'deterministic' && (c.status === 'fail' || c.passed === false))
    step2State = hasFailingS1 ? 'failed' : 'completed'
  }

  // Step 3: AI Review
  let step3State: StepState = 'pending'
  if (step2State === 'completed') {
    if (isVerifying) {
      step3State = 'active'
    } else if (verification) {
      step3State = 'completed'
    }
  }

  // Step 4: Policy Decision
  let step4State: StepState = 'pending'
  if (verification && verification.status === 'COMPLETE') {
    if (isRejected) step4State = 'failed'
    else if (isEscalated) step4State = 'warn'
    else step4State = 'completed'
  }

  // Step 5: Settlement / Release
  let step5State: StepState = 'pending'
  if (isReleased) step5State = 'completed'
  else if (isReleasing) step5State = 'active'
  else if (isReleaseFailed) step5State = 'failed'

  const steps = [
    { label: 'Received', state: step1State, desc: 'Deliverable hashed' },
    { label: 'Checks', state: step2State, desc: 'Deterministic schemas' },
    { label: 'AI Review', state: step3State, desc: 'Rubric & evidence' },
    { label: 'Policy Decision', state: step4State, desc: 'Rule verification' },
    { label: 'Settlement', state: step5State, desc: 'PayPal capture' },
  ]

  const renderIcon = (state: StepState, idx: number) => {
    switch (state) {
      case 'completed':
        return <Check className="w-4 h-4 text-white" />
      case 'active':
        return <Loader2 className="w-4 h-4 text-white animate-spin" />
      case 'failed':
        return <X className="w-4 h-4 text-white" />
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-white" />
      default:
        return <span className="text-xs font-mono font-semibold text-muted">{idx + 1}</span>
    }
  }

  const getStepBg = (state: StepState) => {
    switch (state) {
      case 'completed':
        return 'bg-ok border-ok ring-2 ring-ok/20'
      case 'active':
        return 'bg-brand border-brand ring-4 ring-brand/20 animate-pulse'
      case 'failed':
        return 'bg-bad border-bad ring-2 ring-bad/20'
      case 'warn':
        return 'bg-warn border-warn ring-2 ring-warn/20'
      default:
        return 'bg-surface-2 border-border text-muted'
    }
  }

  return (
    <div className={`p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <ShieldCheck className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-semibold text-text">Automated Verification Pipeline</h3>
      </div>

      <div className="relative">
        {/* Connecting line */}
        <div className="hidden sm:block absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 bg-border -z-0" />

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative z-10">
          {steps.map((step, idx) => (
            <div
              key={step.label}
              className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2"
            >
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${getStepBg(
                  step.state
                )}`}
              >
                {renderIcon(step.state, idx)}
              </div>

              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-text block">{step.label}</span>
                <span className="text-[11px] text-muted block">{step.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
