import type { ReactNode } from "react";

export const authInputClass =
  "h-[36px] w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161a] px-3 text-[13px] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none transition-colors focus:border-neutral-900 dark:focus:border-neutral-200 focus:ring-1 focus:ring-neutral-900/15 dark:focus:ring-white/15";

interface AuthFieldProps {
  label: string;
  htmlFor?: string;
  action?: ReactNode;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function AuthField({
  label,
  htmlFor,
  action,
  hint,
  error,
  children,
}: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300"
        >
          {label}
        </label>
        {action}
      </div>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
}
