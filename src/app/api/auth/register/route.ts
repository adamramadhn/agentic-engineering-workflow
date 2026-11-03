import { NextRequest } from "next/server";
import {
  hashPassword,
  createSession,
  isValidEmail,
  newUserId,
  toSessionUser,
  type UserRow,
} from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return Response.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return Response.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // The very first account becomes the Admin.
    const countResult = await query(`SELECT count(*)::int AS count FROM users`);
    const isFirstUser = countResult.rows[0].count === 0;

    const result = await query<UserRow>(
      `INSERT INTO users (id, name, email, password_hash, role, team, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Active')
       RETURNING id, name, email, password_hash, role, team, status, created_at`,
      [
        newUserId(),
        name,
        email,
        hashPassword(password),
        isFirstUser ? "Admin" : "Member",
        "General",
      ]
    );
    const user = toSessionUser(result.rows[0]);

    await createSession(user.id);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    console.error("register failed:", error);
    return Response.json({ error: "Failed to create account" }, { status: 500 });
  }
}
