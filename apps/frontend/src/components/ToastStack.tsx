export interface ToastItem {
  id: string;
  message: string;
  tone?: 'success' | 'error' | 'info';
}

interface ToastStackProps {
  toasts: ToastItem[];
}

function toneClass(tone: ToastItem['tone']) {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'error') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function ToastStack({ toasts }: ToastStackProps) {
  if (!toasts.length) return null;

  return (
    <div className="space-y-2">
      {toasts.map((toast) => (
        <p key={toast.id} className={`rounded-lg border px-3 py-2 text-xs ${toneClass(toast.tone)}`}>
          {toast.message}
        </p>
      ))}
    </div>
  );
}
