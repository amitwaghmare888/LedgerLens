"use client"

import { useEffect, useState } from "react"

export function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    // Simulate progressive loading stages
    const stages = [
      { delay: 0, progress: 0, status: "Initializing workspace..." },
      { delay: 100, progress: 20, status: "Initializing workspace..." },
      { delay: 300, progress: 45, status: "Loading resources..." },
      { delay: 500, progress: 70, status: "Loading resources..." },
      { delay: 700, progress: 90, status: "Preparing interface..." },
      { delay: 900, progress: 100, status: "Ready" },
    ]

    let currentStage = 0
    let timeoutId: NodeJS.Timeout

    const runNextStage = () => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage]
        timeoutId = setTimeout(() => {
          setProgress(stage.progress)
          if (stage.progress === 100) {
            // Wait a bit at 100% before fading out
            setTimeout(() => setIsComplete(true), 200)
          }
          currentStage++
          runNextStage()
        }, stage.delay)
      }
    }

    runNextStage()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  if (isComplete) {
    return null
  }

  const statusText = 
    progress === 0 ? "Initializing workspace..." :
    progress < 70 ? "Loading resources..." :
    progress < 100 ? "Preparing interface..." :
    "Ready"

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--surface)]"
      style={{
        opacity: progress === 100 ? 0 : 1,
        transition: "opacity 400ms ease-out",
      }}
      role="status"
      aria-live="polite"
      aria-label={`Loading LedgerLens: ${progress}%`}
    >
      <div className="flex flex-col items-center gap-8">
        {/* Logo/Wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--color-primary)]">
            <span
              className="material-symbols-outlined text-[var(--color-on-primary)]"
              style={{ fontSize: "28px", fontWeight: 500 }}
              aria-hidden="true"
            >
              account_balance
            </span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-[var(--color-on-surface)] tracking-tight">
              LedgerLens
            </h1>
            <p className="text-xs text-[var(--color-on-surface-variant)] font-medium">
              Financial Reconciliation
            </p>
          </div>
        </div>

        {/* Progress Circle */}
        <div className="relative flex items-center justify-center">
          {/* Background circle */}
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            className="transform -rotate-90"
          >
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--outline-variant)"
              strokeWidth="4"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 54}`}
              strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
              style={{
                transition: "stroke-dashoffset 300ms ease-out",
              }}
            />
          </svg>

          {/* Percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-2xl font-bold text-[var(--color-on-surface)] tabular-nums"
              aria-hidden="true"
            >
              {progress}%
            </span>
          </div>
        </div>

        {/* Status text */}
        <p
          className="text-sm text-[var(--color-on-surface-variant)] font-medium"
          aria-live="polite"
        >
          {statusText}
        </p>
      </div>
    </div>
  )
}
