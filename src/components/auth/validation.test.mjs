import assert from "node:assert/strict";
import test from "node:test";
import { validateAuthField, validateAuthForm } from "./validation.ts";

test("login reports required fields in focus order", () => {
  assert.deepEqual(Object.keys(validateAuthForm({})), ["email", "password"]);
});

test("register reports required name, email, and password in focus order", () => {
  assert.deepEqual(Object.keys(validateAuthForm({}, true)), ["name", "email", "password"]);
  assert.ok(validateAuthField("name", "   ", true));
});

test("email validation accepts surrounding whitespace but rejects malformed addresses", () => {
  assert.ok(validateAuthField("email", "invalid"));
  assert.equal(validateAuthField("email", " admin@onyx.dev "), undefined);
});

test("registration enforces minimum password length without changing existing login rules", () => {
  assert.ok(validateAuthField("password", "short", true));
  assert.equal(validateAuthField("password", "short"), undefined);
  // Whitespace is a valid password character, not something the client should strip.
  assert.equal(validateAuthField("password", "        ", true), undefined);
});

test("valid register and login values have no inline errors", () => {
  assert.deepEqual(validateAuthForm({ email: "admin@onyx.dev", password: "password123" }), {});
  assert.deepEqual(validateAuthForm({ name: " Alex ", email: " alex@example.com ", password: "password123" }, true), {});
});
