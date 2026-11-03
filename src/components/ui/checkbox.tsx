"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "@/components/icons";
import { cn } from "cn";

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-[#d4d4d8] dark:border-neutral-700 bg-white dark:bg-[#18181b] outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-neutral-900 dark:data-[checked]:bg-white data-[checked]:text-white dark:data-[checked]:text-neutral-900 data-[checked]:border-neutral-900 dark:data-[checked]:border-white transition-all flex items-center justify-center cursor-pointer select-none",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3 stroke-[2.8]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
