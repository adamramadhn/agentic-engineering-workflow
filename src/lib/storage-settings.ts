/**
 * The pure half of storage configuration — types, defaults, and manual
 * validation, with zero imports. `./storage` (server-only: pg + the AWS SDK)
 * re-exports everything here so route handlers have one import path, while the
 * /storage client island imports THIS file for the constants it renders —
 * importing `./storage` from a client component would drag `pg` into the
 * browser bundle.
 */

/** The one `app_settings` row this module owns. */
export const STORAGE_SETTINGS_KEY = "storage";

/** The app caps uploads at 10 MB (the attachments route's file.size check) —
 *  the admin may only tune the ceiling DOWN from here. */
export const MAX_UPLOAD_MB_CEILING = 10;
export const DEFAULT_MAX_UPLOAD_MB = 10;

/** What is actually stored in `app_settings.value`. */
export interface StorageSettings {
  /** Custom S3-compatible endpoint (MinIO, R2, …). Empty string = AWS proper. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base URL public objects are served from. Empty = no public serving. */
  publicBaseUrl: string;
  publicPrefix: string;
  privatePrefix: string;
  maxUploadMb: number;
}

/** What any read endpoint may return — the secret never leaves this module. */
export interface StorageSettingsView {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  /** True when a secret is stored; the value itself is never serialized. */
  hasSecret: boolean;
  publicBaseUrl: string;
  publicPrefix: string;
  privatePrefix: string;
  maxUploadMb: number;
  /** True when the stored row is complete enough to attempt an S3 call. */
  configured: boolean;
}

const DEFAULT_PREFIX_PUBLIC = "wiki-public";
const DEFAULT_PREFIX_PRIVATE = "wiki-private";

/** JSONB is `unknown`; anything missing or malformed degrades to the default. */
export function toStorageSettings(value: unknown): StorageSettings {
  const raw = (value ?? {}) as Record<string, unknown>;
  const str = (key: string, fallback = ""): string =>
    typeof raw[key] === "string" ? (raw[key] as string) : fallback;
  const maxUploadMb = Number(raw.maxUploadMb);
  return {
    endpoint: str("endpoint"),
    region: str("region"),
    bucket: str("bucket"),
    accessKeyId: str("accessKeyId"),
    secretAccessKey: str("secretAccessKey"),
    publicBaseUrl: str("publicBaseUrl"),
    publicPrefix: str("publicPrefix", DEFAULT_PREFIX_PUBLIC) || DEFAULT_PREFIX_PUBLIC,
    privatePrefix: str("privatePrefix", DEFAULT_PREFIX_PRIVATE) || DEFAULT_PREFIX_PRIVATE,
    maxUploadMb: Number.isFinite(maxUploadMb) && maxUploadMb >= 1
      ? Math.min(Math.floor(maxUploadMb), MAX_UPLOAD_MB_CEILING)
      : DEFAULT_MAX_UPLOAD_MB,
  };
}

/** All four connection fields present — the minimum for any S3 call. */
export function isConfigured(settings: StorageSettings): boolean {
  return Boolean(
    settings.region &&
      settings.bucket &&
      settings.accessKeyId &&
      settings.secretAccessKey
  );
}

/** Strip the secret. This is the only shape a read endpoint may serialize. */
export function toStorageView(settings: StorageSettings): StorageSettingsView {
  return {
    endpoint: settings.endpoint,
    region: settings.region,
    bucket: settings.bucket,
    accessKeyId: settings.accessKeyId,
    hasSecret: settings.secretAccessKey.length > 0,
    publicBaseUrl: settings.publicBaseUrl,
    publicPrefix: settings.publicPrefix,
    privatePrefix: settings.privatePrefix,
    maxUploadMb: settings.maxUploadMb,
    configured: isConfigured(settings),
  };
}

export interface ParsedSettings {
  settings: StorageSettings;
  /** Field → message; non-empty means the caller must answer 400. */
  errors: Record<string, string>;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

/** `[^a-zA-Z0-9._-]` → `_`, per the plan's key rule. */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
  return cleaned.slice(-120) || "file";
}

/**
 * The plan's golden key shape. The page id in the middle is what makes page
 * deletion a single prefix delete rather than a per-attachment hunt.
 * Pure on purpose (it lives here, not in the server-only ./storage) so the key
 * contract is unit-testable without pg or the AWS SDK in the test process.
 */
export function buildObjectKey(
  prefix: string,
  pageId: string,
  fileName: string
): string {
  return `${trimSlashes(prefix)}/${pageId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

/**
 * Validate a PUT body into storable settings. `previous` supplies the values a
 * write-only field may omit: an absent/empty `secretAccessKey` means "keep the
 * stored one", which is how the masked form round-trips without ever echoing
 * the secret back to the browser.
 */
export function parseStorageSettings(
  body: unknown,
  previous: StorageSettings | null
): ParsedSettings {
  const raw = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const stringOf = (key: string): string =>
    typeof raw[key] === "string" ? (raw[key] as string).trim() : "";

  const endpoint = stringOf("endpoint");
  const region = stringOf("region");
  const bucket = stringOf("bucket");
  const accessKeyId = stringOf("accessKeyId");
  const publicBaseUrl = stringOf("publicBaseUrl");
  const publicPrefixRaw = stringOf("publicPrefix");
  const privatePrefixRaw = stringOf("privatePrefix");
  const secretProvided = stringOf("secretAccessKey");

  if (!region) errors.region = "Region is required";
  if (!bucket) {
    errors.bucket = "Bucket is required";
  } else if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    errors.bucket = "Bucket must be a valid S3 bucket name";
  }
  if (!accessKeyId) errors.accessKeyId = "Access key id is required";

  if (endpoint && !/^https?:\/\//i.test(endpoint)) {
    errors.endpoint = "Endpoint must be an http(s):// URL";
  }
  if (publicBaseUrl && !/^https?:\/\//i.test(publicBaseUrl)) {
    errors.publicBaseUrl = "Public base URL must be an http(s):// URL";
  }

  // Write-only: an empty secret keeps the stored one. Refusing an empty secret
  // would make it impossible to edit any other field without re-typing it.
  const secretAccessKey = secretProvided || previous?.secretAccessKey || "";
  if (!secretAccessKey) {
    errors.secretAccessKey = "Secret access key is required";
  }

  let maxUploadMb = DEFAULT_MAX_UPLOAD_MB;
  if (raw.maxUploadMb !== undefined && raw.maxUploadMb !== null && raw.maxUploadMb !== "") {
    const parsed = Number(raw.maxUploadMb);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_UPLOAD_MB_CEILING) {
      errors.maxUploadMb = `Max upload must be a whole number between 1 and ${MAX_UPLOAD_MB_CEILING}`;
    } else {
      maxUploadMb = parsed;
    }
  }

  return {
    settings: {
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
      publicPrefix: trimSlashes(publicPrefixRaw) || DEFAULT_PREFIX_PUBLIC,
      privatePrefix: trimSlashes(privatePrefixRaw) || DEFAULT_PREFIX_PRIVATE,
      maxUploadMb,
    },
    errors,
  };
}
