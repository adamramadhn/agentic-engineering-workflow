"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthField, authInputClass } from "./auth-field";
import { Check } from "@/components/icons";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSent(true);
      toast.success("Reset link sent");
    }, 400);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center py-2">
        <div className="mb-3.5 flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
          <Check className="size-5" />
        </div>
        <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-neutral-900 dark:text-neutral-100">
          Check your email
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          We&apos;ve sent a password reset link to{" "}
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            {email}
          </span>
          .
        </p>

        <div className="mt-6 w-full space-y-2.5">
          <Link
            href="/login"
            className="flex h-[36px] w-full items-center justify-center rounded-lg bg-neutral-900 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-2xs"
          >
            Back to sign in
          </Link>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-[12px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
          >
            Didn&apos;t receive it? Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-2xs dark:bg-white dark:text-neutral-900">
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-4">
            <path d="M8 1.8a.9.9 0 0 1 .9.9v2.25l1.95-1.12a.9.9 0 0 1 .9 1.56l-1.95 1.12 1.95 1.13a.9.9 0 0 1-.9 1.56L8.9 7.2v2.25a.9.9 0 0 1-1.8 0V7.2l-1.95 1.13a.9.9 0 0 1-.9-1.56l1.95-1.13-1.95-1.12a.9.9 0 0 1 .9-1.56L7.1 4.95V2.7a.9.9 0 0 1 .9-.9z" />
          </svg>
        </div>
        <h1 className="text-[19px] font-semibold tracking-[-0.015em] text-neutral-900 dark:text-neutral-100">
          Reset password
        </h1>
        <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
          Enter your email and we&apos;ll send you a recovery link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
        <AuthField label="Email address" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
            className={authInputClass}
          />
        </AuthField>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex h-[36px] w-full items-center justify-center rounded-lg bg-neutral-900 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-950 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 cursor-pointer shadow-2xs"
        >
          {loading ? "Sending link..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-neutral-500 dark:text-neutral-400">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-medium text-neutral-900 hover:underline underline-offset-4 dark:text-neutral-100"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
