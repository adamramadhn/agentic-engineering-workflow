export type AuthFieldName = "name" | "email" | "password";
export type AuthErrors = Partial<Record<AuthFieldName, string>>;

export function validateAuthField(
  field: AuthFieldName,
  value: string,
  registering = false,
): string | undefined {
  if (field === "name" && !value.trim()) return "Enter your full name.";
  if (field === "email") {
    if (!value.trim()) return "Enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return "Enter a valid email address, such as name@company.com.";
    }
  }
  // Password whitespace is intentional: never trim a password.
  if (field === "password") {
    if (!value) return "Enter your password.";
    if (registering && value.length < 8) return "Use at least 8 characters for your password.";
  }
}

export function validateAuthForm(
  values: Partial<Record<AuthFieldName, string>>,
  registering = false,
): AuthErrors {
  const errors: AuthErrors = {};
  for (const field of ["name", "email", "password"] as const) {
    if (field === "name" && !registering) continue;
    const error = validateAuthField(field, values[field] ?? "", registering);
    if (error) errors[field] = error;
  }
  return errors;
}

export function focusAuthField(form: HTMLFormElement, field: string): void {
  // Wait for React to attach the error description before announcing the field.
  requestAnimationFrame(() => {
    const input = form.elements.namedItem(field);
    if (input instanceof HTMLInputElement) input.focus();
  });
}
