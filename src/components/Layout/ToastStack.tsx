export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "error";
}

const toneClasses: Record<NonNullable<ToastItem["tone"]>, string> = {
  neutral: "border-white/60 bg-white/85 text-slate-700",
  success: "border-emerald-200 bg-emerald-50/95 text-emerald-900",
  error: "border-rose-200 bg-rose-50/95 text-rose-900",
};

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-4 py-3 shadow-soft backdrop-blur ${toneClasses[toast.tone ?? "neutral"]}`}
        >
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-xs leading-5 opacity-80">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
