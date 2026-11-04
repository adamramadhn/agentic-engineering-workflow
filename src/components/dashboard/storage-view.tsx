"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Database, Info, RefreshCw, TriangleAlert } from "@/components/icons";
import { usePermission } from "@/components/dashboard/permission-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button-clean";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { MAX_UPLOAD_MB_CEILING } from "@/lib/storage-settings";

/**
 * /storage — the admin S3 configuration form.
 *
 * The secret is write-only: the API never returns it, so the field renders a
 * masked placeholder and stays empty. Submitting it empty means "keep the
 * stored one" — the only way a masked form can round-trip.
 */

interface StorageForm {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  publicPrefix: string;
  privatePrefix: string;
  maxUploadMb: string;
}

const EMPTY_FORM: StorageForm = {
  endpoint: "",
  region: "",
  bucket: "",
  accessKeyId: "",
  secretAccessKey: "",
  publicBaseUrl: "",
  publicPrefix: "wiki-public",
  privatePrefix: "wiki-private",
  maxUploadMb: "10",
};

export interface StorageSettingsViewShape {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  hasSecret: boolean;
  publicBaseUrl: string;
  publicPrefix: string;
  privatePrefix: string;
  maxUploadMb: number;
  configured: boolean;
}

function fieldErrorsOf(data: Record<string, unknown>): Record<string, string> {
  const errors = data.errors;
  return errors && typeof errors === "object" ? (errors as Record<string, string>) : {};
}

export function StorageView({ initialSettings }: { initialSettings: StorageSettingsViewShape | null }) {
  const { can } = usePermission();
  const canManage = can("storage.manage");

  const [form, setForm] = useState<StorageForm>(() =>
    initialSettings
      ? {
          endpoint: initialSettings.endpoint,
          region: initialSettings.region,
          bucket: initialSettings.bucket,
          accessKeyId: initialSettings.accessKeyId,
          secretAccessKey: "",
          publicBaseUrl: initialSettings.publicBaseUrl,
          publicPrefix: initialSettings.publicPrefix,
          privatePrefix: initialSettings.privatePrefix,
          maxUploadMb: String(initialSettings.maxUploadMb),
        }
      : { ...EMPTY_FORM }
  );
  const [hasSecret, setHasSecret] = useState(initialSettings?.hasSecret ?? false);
  const [configured, setConfigured] = useState(initialSettings?.configured ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function set<K extends keyof StorageForm>(key: K, value: string): void {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function reload(): Promise<void> {
    try {
      const response = await apiFetch("/api/storage/settings");
      if (!response.ok) return;
      const data = (await response.json()) as { settings?: StorageSettingsViewShape | null };
      if (!data.settings) return;
      setForm((previous) => ({
        ...previous,
        endpoint: data.settings!.endpoint,
        region: data.settings!.region,
        bucket: data.settings!.bucket,
        accessKeyId: data.settings!.accessKeyId,
        secretAccessKey: "",
        publicBaseUrl: data.settings!.publicBaseUrl,
        publicPrefix: data.settings!.publicPrefix,
        privatePrefix: data.settings!.privatePrefix,
        maxUploadMb: String(data.settings!.maxUploadMb),
      }));
      setHasSecret(data.settings.hasSecret);
      setConfigured(data.settings.configured);
    } catch {
      /* transient */
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const response = await apiFetch("/api/storage/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // An empty secret means "keep the stored one" — see the field note below.
        body: JSON.stringify({
          endpoint: form.endpoint,
          region: form.region,
          bucket: form.bucket,
          accessKeyId: form.accessKeyId,
          ...(form.secretAccessKey ? { secretAccessKey: form.secretAccessKey } : {}),
          publicBaseUrl: form.publicBaseUrl,
          publicPrefix: form.publicPrefix,
          privatePrefix: form.privatePrefix,
          maxUploadMb: form.maxUploadMb,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        setErrors(fieldErrorsOf(data));
        toast.error((data.error as string) || "Could not save the settings");
        return;
      }
      toast.success("Storage settings saved");
      setForm((previous) => ({ ...previous, secretAccessKey: "" }));
      await reload();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(): Promise<void> {
    setTesting(true);
    try {
      const response = await apiFetch("/api/storage/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: form.endpoint,
          region: form.region,
          bucket: form.bucket,
          accessKeyId: form.accessKeyId,
          ...(form.secretAccessKey ? { secretAccessKey: form.secretAccessKey } : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.status === 503) {
        toast.error("Storage is not configured — complete the connection fields first");
        return;
      }
      if (!response.ok) {
        toast.error((data.error as string) || "Connection failed");
        return;
      }
      toast.success("Connection succeeded — bucket reachable");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section aria-label="Storage settings" className="flex min-w-0 flex-col gap-4">
      <h1 className="sr-only">Storage</h1>

      <section className="task-sheet min-w-0" aria-labelledby="storage-title">
        <div className="task-sheet-toolbar flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Database className="size-4" aria-hidden="true" />
            <h2 id="storage-title">Storage connection</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={configured ? "secondary" : "outline"}>
              {configured ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                  Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <TriangleAlert className="size-3" aria-hidden="true" />
                  Not configured
                </span>
              )}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw />}
              aria-label="Reload storage settings"
              onClick={() => void reload()}
            >
              Reload
            </Button>
          </div>
        </div>

        <form onSubmit={save} className="grid gap-5 p-3">
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Credentials are stored in the application database, not in a <code>.env</code> file.
              The secret access key is write-only — it is never returned by the API, so leaving it
              blank keeps the stored one.
            </span>
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="storage-endpoint"
              label="Endpoint (optional)"
              hint="S3-compatible base URL, e.g. http://localhost:9000. Leave blank for AWS."
              value={form.endpoint}
              error={errors.endpoint}
              disabled={!canManage}
              onChange={(value) => set("endpoint", value)}
            />
            <Field
              id="storage-region"
              label="Region"
              hint="e.g. us-east-1"
              value={form.region}
              error={errors.region}
              disabled={!canManage}
              required
              onChange={(value) => set("region", value)}
            />
            <Field
              id="storage-bucket"
              label="Bucket"
              value={form.bucket}
              error={errors.bucket}
              disabled={!canManage}
              required
              onChange={(value) => set("bucket", value)}
            />
            <Field
              id="storage-access-key"
              label="Access key id"
              value={form.accessKeyId}
              error={errors.accessKeyId}
              disabled={!canManage}
              required
              onChange={(value) => set("accessKeyId", value)}
            />
            <Field
              id="storage-secret"
              label="Secret access key"
              hint={hasSecret ? "A secret is stored. Leave blank to keep it." : undefined}
              value={form.secretAccessKey}
              error={errors.secretAccessKey}
              disabled={!canManage}
              type="password"
              placeholder={hasSecret ? "••••••••" : undefined}
              autoComplete="new-password"
              onChange={(value) => set("secretAccessKey", value)}
            />
            <Field
              id="storage-public-base"
              label="Public base URL (optional)"
              hint="Where public objects are served from, e.g. https://cdn.example.com"
              value={form.publicBaseUrl}
              error={errors.publicBaseUrl}
              disabled={!canManage}
              onChange={(value) => set("publicBaseUrl", value)}
            />
            <Field
              id="storage-public-prefix"
              label="Public prefix"
              value={form.publicPrefix}
              error={errors.publicPrefix}
              disabled={!canManage}
              onChange={(value) => set("publicPrefix", value)}
            />
            <Field
              id="storage-private-prefix"
              label="Private prefix"
              value={form.privatePrefix}
              error={errors.privatePrefix}
              disabled={!canManage}
              onChange={(value) => set("privatePrefix", value)}
            />
            <Field
              id="storage-max-upload"
              label="Max upload (MB)"
              hint={`1–${MAX_UPLOAD_MB_CEILING}. The app caps uploads at ${MAX_UPLOAD_MB_CEILING} MB.`}
              value={form.maxUploadMb}
              error={errors.maxUploadMb}
              disabled={!canManage}
              type="number"
              min={1}
              max={MAX_UPLOAD_MB_CEILING}
              onChange={(value) => set("maxUploadMb", value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              size="lg"
              variant="secondary"
              loading={testing}
              disabled={!canManage}
              onClick={() => void testConnection()}
            >
              Test connection
            </Button>
            <Button type="submit" size="lg" loading={saving} disabled={!canManage}>
              Save settings
            </Button>
          </div>

          {!canManage && (
            <p className="text-xs text-muted-foreground">
              You can view these settings but not change them — the{" "}
              <span className="font-mono">storage.manage</span> permission is required.
            </p>
          )}
        </form>
      </section>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  error,
  onChange,
  disabled,
  type = "text",
  placeholder,
  required,
  min,
  max,
  autoComplete,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  autoComplete?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
