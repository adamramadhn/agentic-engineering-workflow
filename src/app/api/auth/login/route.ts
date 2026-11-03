import { NextRequest } from "next/server";
import { createSession, toSessionUser, verifyPassword, type UserRow } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const result = await query<UserRow>(
      `SELECT id, name, email, password_hash, role, team, status, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    const row = result.rows[0];

    if (!row || !verifyPassword(password, row.password_hash)) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (row.status !== "Active") {
      return Response.json(
        { error: "This account is not active. Contact an administrator." },
        { status: 403 }
      );
    }

    await createSession(row.id);
    return Response.json({ user: toSessionUser(row) });
  } catch (error) {
    console.error("login failed:", error);
    return Response.json({ error: "Failed to sign in" }, { status: 500 });
  }
}
