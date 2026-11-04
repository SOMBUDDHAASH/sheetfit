import React from 'react'
import { useUi, Toast } from '../store/useUi'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export const Toasts: React.FC = () => {
  const toasts = useUi((state) => state.toasts)
  const removeToast = useUi((state) => state.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
      default:
        return <Info className="w-5 h-5 text-blue-500 shrink-0" />
    }
  }

  return (
    <div className="pointer-events-auto flex items-start gap-3 p-3.5 bg-neutral-900/95 dark:bg-neutral-800/95 text-neutral-100 rounded-lg shadow-xl border border-neutral-700/80 backdrop-blur-sm transition-all duration-150 animate-in fade-in slide-in-from-bottom-2">
      {getIcon()}
      <div className="flex-1 min-w-0 pr-1">
        <div className="text-sm font-medium leading-tight">{toast.title}</div>
        {toast.description && (
          <div className="text-xs text-neutral-400 mt-1 leading-normal break-words">
            {toast.description}
          </div>
        )}
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={() => {
              toast.onAction?.()
              onDismiss()
            }}
            className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 block"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-neutral-400 hover:text-neutral-200 transition-colors p-0.5 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
