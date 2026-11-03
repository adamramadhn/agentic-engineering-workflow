"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthField, authInputClass } from "./auth-field";
import { PasswordInput } from "./password-input";
import { SocialAuthButtons } from "./social-auth-buttons";
import { focusAuthField, validateAuthField, validateAuthForm, type AuthErrors, type AuthFieldName } from "./validation";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [formError, setFormError] = useState("");

  const updateField = (field: AuthFieldName, value: string) => {
    if (field === "name") setName(value);
    else if (field === "email") setEmail(value);
    else setPassword(value);
    setFormError("");
    if (errors[field]) setErrors((current) => ({ ...current, [field]: validateAuthField(field, value, true) }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    const form = e.currentTarget;
    const nextErrors = validateAuthForm({ name, email, password }, true);
    setErrors(nextErrors);
    setFormError("");
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      focusAuthField(form, firstInvalid);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ email: data.error || "An account with this email already exists." });
          focusAuthField(form, "email");
        } else {
          setFormError(data.error || "Failed to create account. Please try again.");
        }
        return;
      }
      toast.success("Account created successfully");
      router.push("/");
      router.refresh();
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

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
          Create an account
        </h1>
        <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
          Start your 14-day trial. No credit card required.
        </p>
      </div>

      {/* Social OAuth */}
      <div className="mt-6">
        <SocialAuthButtons />
      </div>

      {/* Divider */}
      <div className="relative my-5 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
        </div>
        <span className="relative bg-white px-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:bg-[#121215] dark:text-neutral-500">
          or
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        <p role="alert" className="empty:hidden text-xs text-red-700 dark:text-red-300">{formError}</p>
        <AuthField label="Full name" htmlFor="name" error={errors.name}>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => updateField("name", e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
            placeholder="Alex Morgan"
            required
            className={authInputClass}
          />
        </AuthField>

        <AuthField label="Work email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => updateField("email", e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            spellCheck={false}
            placeholder="name@company.com"
            required
            className={authInputClass}
          />
        </AuthField>

        <AuthField
          label="Password"
          htmlFor="password"
          hint="Must be at least 8 characters"
          error={errors.password}
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => updateField("password", e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error password-hint" : "password-hint"}
            placeholder="••••••••"
            minLength={8}
            required
          />
        </AuthField>

        <button
          type="submit"
          aria-disabled={loading}
          aria-busy={loading}
          className="mt-1 flex h-[36px] w-full items-center justify-center rounded-lg bg-neutral-900 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 active:bg-neutral-950 aria-disabled:opacity-60 aria-disabled:cursor-wait dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 cursor-pointer shadow-2xs"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">
        By signing up, you agree to our{" "}
        <a href="#" className="underline hover:text-neutral-700 dark:hover:text-neutral-300">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="underline hover:text-neutral-700 dark:hover:text-neutral-300">
          Privacy Policy
        </a>
        .
      </p>

      {/* Sign in switch */}
      <p className="mt-5 text-center text-[12.5px] text-neutral-500 dark:text-neutral-400">
        Already have an account?{" "}
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
