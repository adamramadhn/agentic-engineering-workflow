import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const alertVariants = cva(
  "relative w-full rounded-xl border p-3.5 text-[12px] flex items-start gap-3 transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-white dark:bg-[#16161a] border-[#e2e2e5] dark:border-neutral-800 text-neutral-900 dark:text-neutral-100",
        info: "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/50 text-blue-900 dark:text-blue-300",
        success:
          "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-300",
        warning:
          "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50 text-amber-900 dark:text-amber-300",
        destructive:
          "bg-red-50/70 dark:bg-red-950/20 border-red-200/80 dark:border-red-900/50 text-red-900 dark:text-red-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<"h5">) {
  return (
    <h5
      className={cn(
        "font-semibold leading-none tracking-[-0.011em] text-[12.5px]",
        className
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-1 text-[11.5px] leading-relaxed text-[#71717a] dark:text-neutral-400 tracking-[-0.011em]",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
