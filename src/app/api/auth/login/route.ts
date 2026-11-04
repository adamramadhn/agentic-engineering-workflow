import { NextRequest } from "next/server";
import {
  issueTokenPair,
  toSessionUser,
  verifyDummyPassword,
  verifyPassword,
  type UserRow,
} from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    // The roles join carries the role's grants so the {user} payload resolves
    // permissions (COALESCE → [] = deny-all when the role row is missing).
    const result = await query<UserRow>(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.team, u.status, u.created_at,
              COALESCE(r.permissions, '[]'::jsonb) AS role_permissions
       FROM users u LEFT JOIN roles r ON r.key = u.role
       WHERE u.email = $1`,
      [email]
    );
    const row = result.rows[0];

    if (!row) {
      // Unknown email: still run a bcrypt compare against the dummy hash so the
      // response time matches the known-email path (timing-safe).
      await verifyDummyPassword(password);
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const passwordMatches = await verifyPassword(password, row.password_hash);
    if (!passwordMatches) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (row.status !== "Active") {
      return Response.json(
        { error: "This account is not active. Contact an administrator." },
        { status: 403 }
      );
    }

    await issueTokenPair(toSessionUser(row));
    return Response.json({ user: toSessionUser(row) });
  } catch (error) {
    console.error("login failed:", error);
    return Response.json({ error: "Failed to sign in" }, { status: 500 });
  }
}
