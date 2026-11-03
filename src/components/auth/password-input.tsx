"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@/components/icons";
import { cn } from "cn";
import { authInputClass } from "./auth-field";

interface PasswordInputProps extends React.ComponentProps<"input"> {
  className?: string;
}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={cn(authInputClass, "pr-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={props.id}
      >
        {visible ? (
          <EyeOff className="size-3.5" aria-hidden="true" />
        ) : (
          <Eye className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
