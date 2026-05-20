import type { ReactElement } from 'react'

type PolishActionButtonProps = {
  label: string
  polishing: boolean
  disabled: boolean
  onClick: () => void
}

export function PolishActionButton({
  label,
  polishing,
  disabled,
  onClick,
}: PolishActionButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || polishing}
      className="px-4 py-2 min-h-[40px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium cursor-pointer transition-colors"
    >
      {polishing ? '润色中...' : label}
    </button>
  )
}
