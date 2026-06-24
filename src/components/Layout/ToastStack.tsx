export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "error";
}

const toneClasses: Record<NonNullable<ToastItem["tone"]>, string> = {
  neutral: "sw-toast",
  success: "sw-toast sw-toast-success",
  error: "sw-toast sw-toast-error",
};

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={toneClasses[toast.tone ?? "neutral"]}>
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-xs leading-5 opacity-80">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
