import React from 'react'
import { useUi } from '../store/useUi'
import { Printer, AlertCircle, CheckCircle2 } from 'lucide-react'

interface PrintTipDialogProps {
  onConfirm: () => void
}

export const PrintTipDialog: React.FC<PrintTipDialogProps> = ({ onConfirm }) => {
  const isPrintTipDialogOpen = useUi((state) => state.isPrintTipDialogOpen)
  const setPrintTipDialogOpen = useUi((state) => state.setPrintTipDialogOpen)

  if (!isPrintTipDialogOpen) return null

  const handleProceed = () => {
    localStorage.setItem('sheetfit:print_tip_seen', 'true')
    setPrintTipDialogOpen(false)
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Printer className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
            Printing at Exact Size
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Local print shops and standard PDF viewer print dialogs often default to "Fit to Page", which shrinks your document by 3-6% and ruins exact photo sizes.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Rule of thumb:</strong> Always specify <span className="underline font-bold">"Actual Size"</span> or <span className="underline font-bold">"100%"</span>. Measure the 100 mm scale bar with a physical ruler to verify.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs font-medium">
          <button
            onClick={() => setPrintTipDialogOpen(false)}
            className="px-4 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Understood, Continue</span>
          </button>
        </div>
      </div>
    </div>
  )
}
