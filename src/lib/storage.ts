/**
 * Everything S3 lives here — the single server-side module that knows how
 * storage is read from the database and talked to. The pure types, defaults
 * and validation live in `./storage-settings` (importable from client
 * components); this file re-exports them so route handlers have one import
 * path: `@/lib/storage`.
 *
 * The connection settings are DATABASE rows (`app_settings` key `storage`), not
 * environment variables: that is the requester's explicit decision, accepted in
 * the plan with the tradeoff that `secretAccessKey` sits in JSONB plaintext.
 * Mitigations: the secret is write-only at the API surface (readStorageView
 * strips it, exposes only `hasSecret`) and the whole surface is RBAC-gated on
 * `storage.manage` / `storage.view`.
 */
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { query } from "./db";
import {
  STORAGE_SETTINGS_KEY,
  toStorageSettings,
  toStorageView,
  type StorageSettings,
  type StorageSettingsView,
} from "./storage-settings";

// The pure surface, re-exported: one import path for every route handler.
export {
  DEFAULT_MAX_UPLOAD_MB,
  MAX_UPLOAD_MB_CEILING,
  STORAGE_SETTINGS_KEY,
  buildObjectKey,
  isConfigured,
  parseStorageSettings,
  sanitizeFileName,
  toStorageSettings,
  toStorageView,
  type ParsedSettings,
  type StorageSettings,
  type StorageSettingsView,
} from "./storage-settings";

/** app_settings row shape for the storage key. */
interface SettingsRow {
  value: unknown;
  updated_at: Date;
}

/** `null` when no row exists yet — the caller answers 503 on that. */
export async function readStorageSettings(): Promise<StorageSettings | null> {
  const result = await query<SettingsRow>(
    `SELECT value, updated_at FROM app_settings WHERE key = $1`,
    [STORAGE_SETTINGS_KEY]
  );
  const row = result.rows[0];
  return row ? toStorageSettings(row.value) : null;
}

export async function readStorageView(): Promise<StorageSettingsView | null> {
  const settings = await readStorageSettings();
  return settings ? toStorageView(settings) : null;
}

// --- persistence -------------------------------------------------------------

/** Upsert the row. `updated_by` is the mutating actor, for the audit + the form. */
export async function saveStorageSettings(
  settings: StorageSettings,
  actorId: string
): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2::jsonb, now(), $3)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [STORAGE_SETTINGS_KEY, JSON.stringify(settings), actorId]
  );
}

// --- S3 ---------------------------------------------------------------------

/**
 * A client per call, built from the CURRENT settings row — never cached. A
 * cached client would keep serving the previous bucket/credentials for up to a
 * process lifetime after an admin changes them, which is exactly the bug the
 * per-use build avoids. Traffic is far below caring about handshake cost.
 */
export function getS3Client(settings: StorageSettings): S3Client {
  return new S3Client({
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    ...(settings.endpoint ? { endpoint: settings.endpoint, forcePathStyle: true } : {}),
  });
}

/** Short-lived presigned GET for private objects. */
export async function presignGetUrl(
  settings: StorageSettings,
  key: string,
  expiresInMilliseconds = 300_000
): Promise<string> {
  const client = getS3Client(settings);
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: settings.bucket, Key: key }),
    { expiresIn: Math.floor(expiresInMilliseconds / 1000) }
  );
}

/** The anonymous URL for a public object — no signing, no expiry. */
export function publicObjectUrl(settings: StorageSettings, key: string): string {
  const base = settings.publicBaseUrl.replace(/\/+$/, "");
  return `${base}/${key}`;
}

export async function putObject(
  settings: StorageSettings,
  key: string,
  body: Uint8Array | Buffer,
  contentType: string
): Promise<void> {
  const client = getS3Client(settings);
  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Best-effort prefix wipe (page delete). Returns how many objects it removed. */
export async function deletePrefix(
  settings: StorageSettings,
  prefix: string
): Promise<number> {
  const client = getS3Client(settings);
  let removed = 0;
  let continuationToken: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: settings.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const objects = (listed.Contents ?? []).filter((item) => item.Key);
    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: settings.bucket,
          Delete: {
            Objects: objects.map((item) => ({ Key: item.Key as string })),
            Quiet: true,
          },
        })
      );
      removed += objects.length;
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
  return removed;
}

export interface ConnectionTestResult {
  ok: boolean;
  /** Human-readable failure reason; empty when ok. */
  error?: string;
}

/** HeadBucket against the given settings — the /storage "Test connection" button. */
export async function testConnection(
  settings: StorageSettings
): Promise<ConnectionTestResult> {
  try {
    await getS3Client(settings).send(
      new HeadBucketCommand({ Bucket: settings.bucket })
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
