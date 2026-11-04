import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_MB_CEILING,
  buildObjectKey,
  isConfigured,
  parseStorageSettings,
  sanitizeFileName,
  toStorageSettings,
  toStorageView,
  type StorageSettings,
} from "./storage-settings";

/**
 * Unit coverage for the pure half of storage configuration — the key-shape
 * contract the upload route rests on (its S3 side cannot be exercised without
 * a bucket), plus the parse/mask rules the settings API answers by.
 */

const PAGE_ID = "7cfdf2bb-4a26-4b8f-8827-3f6f9a1c2d34";

function fullSettings(overrides: Partial<StorageSettings> = {}): StorageSettings {
  return {
    endpoint: "",
    region: "us-east-1",
    bucket: "team-wiki",
    accessKeyId: "AKIAEXAMPLE",
    secretAccessKey: "secret-value",
    publicBaseUrl: "https://cdn.example.test",
    publicPrefix: "wiki-public",
    privatePrefix: "wiki-private",
    maxUploadMb: 5,
    ...overrides,
  };
}

describe("buildObjectKey", () => {
  it("builds prefix/pageId/uuid-name — the page-scoped shape a prefix delete relies on", () => {
    const key = buildObjectKey("wiki-private", PAGE_ID, "runbook.md");
    expect(key).toMatch(
      new RegExp(`^wiki-private/${PAGE_ID}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-runbook\\.md$`)
    );
  });

  it("trims slashes off the prefix so an admin's leading/trailing '/' cannot split the prefix", () => {
    const key = buildObjectKey("/wiki/public/", PAGE_ID, "a.png");
    expect(key.startsWith(`wiki/public/${PAGE_ID}/`)).toBe(true);
  });

  it("sanitizes hostile filenames into the [a-zA-Z0-9._-] alphabet", () => {
    const key = buildObjectKey("p", PAGE_ID, "../../etc/passwd résumé.txt");
    const name = key.split("/").pop() ?? "";
    // uuid- prefix, then only safe characters remain
    expect(name.slice(37)).toMatch(/^[a-zA-Z0-9._-]+$/);
    // No "/" survives sanitization, so the filename can never add path
    // segments beyond its own — mid-key ".." is inert in a flat S3 key. The
    // leading dot run is collapsed so the name never starts hidden.
    expect(name).not.toContain("/");
    expect(name.slice(37)).not.toMatch(/^\./);
  });

  it("produces distinct keys for the same file (uuid namesake collisions)", () => {
    expect(buildObjectKey("p", PAGE_ID, "a.txt")).not.toBe(buildObjectKey("p", PAGE_ID, "a.txt"));
  });
});

describe("sanitizeFileName", () => {
  it("replaces everything outside [a-zA-Z0-9._-]", () => {
    expect(sanitizeFileName("a b:c*d?e")).toBe("a_b_c_d_e");
  });

  it("neutralizes leading dots (hidden/traversal files)", () => {
    expect(sanitizeFileName(".hidden")).toBe("_hidden");
    // a run of leading dots collapses to a single underscore
    expect(sanitizeFileName("..")).toBe("_");
    expect(sanitizeFileName("...")).toBe("_");
  });

  it("keeps only the last 120 characters and never returns empty", () => {
    expect(sanitizeFileName("x".repeat(200))).toHaveLength(120);
    expect(sanitizeFileName("!!!")).toBe("___"); // replaced, not emptied
    expect(sanitizeFileName("")).toBe("file");
  });
});

describe("parseStorageSettings", () => {
  it("accepts a complete body and normalizes prefixes", () => {
    const { settings, errors } = parseStorageSettings(
      {
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "team-wiki",
        accessKeyId: "key",
        secretAccessKey: "sec",
        publicBaseUrl: "https://cdn.example.test",
        publicPrefix: "/wiki public/", // only slashes are trimmed; inner characters pass through
        privatePrefix: "  ", // blank falls back to the default
        maxUploadMb: 3,
      },
      null
    );
    expect(errors).toEqual({});
    expect(settings.publicPrefix).toBe("wiki public");
    expect(settings.privatePrefix).toBe("wiki-private");
    expect(settings.maxUploadMb).toBe(3);
    expect(isConfigured(settings)).toBe(true);
  });

  it("keeps the stored secret when the body's is empty — the masked form round-trip", () => {
    const { settings, errors } = parseStorageSettings(
      { region: "eu-west-1", bucket: "team-wiki", accessKeyId: "k", secretAccessKey: "" },
      fullSettings()
    );
    expect(errors).toEqual({});
    expect(settings.secretAccessKey).toBe("secret-value");
  });

  it("names every missing required field", () => {
    const { errors } = parseStorageSettings({}, null);
    expect(Object.keys(errors).sort()).toEqual([
      "accessKeyId",
      "bucket",
      "region",
      "secretAccessKey",
    ]);
  });

  it("rejects a non-http endpoint, non-http publicBaseUrl, bad bucket name, and out-of-range maxUploadMb", () => {
    const { errors } = parseStorageSettings(
      {
        region: "r",
        bucket: "Bad_Bucket",
        accessKeyId: "k",
        secretAccessKey: "s",
        endpoint: "localhost:9000",
        publicBaseUrl: "ftp://x",
        maxUploadMb: MAX_UPLOAD_MB_CEILING + 1,
      },
      null
    );
    expect(errors.bucket).toContain("valid S3 bucket name");
    expect(errors.endpoint).toContain("http(s)");
    expect(errors.publicBaseUrl).toContain("http(s)");
    expect(errors.maxUploadMb).toContain(`between 1 and ${MAX_UPLOAD_MB_CEILING}`);
  });

  it("defaults maxUploadMb when the field is absent or malformed", () => {
    expect(parseStorageSettings({ region: "r", bucket: "b", accessKeyId: "k", secretAccessKey: "s" }, null).settings.maxUploadMb).toBe(10);
    expect(
      parseStorageSettings({ region: "r", bucket: "b", accessKeyId: "k", secretAccessKey: "s", maxUploadMb: "big" }, null).settings.maxUploadMb
    ).toBe(10);
  });
});

describe("toStorageSettings / toStorageView", () => {
  it("degrades malformed JSONB to the defaults", () => {
    const settings = toStorageSettings({ maxUploadMb: "nope", publicPrefix: "" });
    expect(settings.maxUploadMb).toBe(10);
    expect(settings.publicPrefix).toBe("wiki-public");
    expect(isConfigured(settings)).toBe(false);
  });

  it("never exposes the secret — hasSecret only", () => {
    const view = toStorageView(fullSettings());
    expect(view).not.toHaveProperty("secretAccessKey");
    expect(view.hasSecret).toBe(true);
    expect(JSON.stringify(view)).not.toContain("secret-value");
    expect(toStorageView(fullSettings({ secretAccessKey: "" })).hasSecret).toBe(false);
  });
});
