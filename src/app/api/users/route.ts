import { NextRequest } from "next/server";
import {
  getSessionUser,
  hashPassword,
  isValidEmail,
  newUserId,
  toSessionUser,
  type UserRow,
} from "@/lib/auth";
import { query } from "@/lib/db";

export const ROLES = ["Admin", "Editor", "Member"] as const;
export const TEAMS = ["Design", "Engineering", "Marketing", "Operations", "General"] as const;

/** Shape consumed by the users directory table (users-view.tsx). */
interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  team: string;
  joined: string;
}

async function listDirectoryUsers(): Promise<DirectoryUser[]> {
  const result = await query(
    `SELECT id, name, email, role, status, team, created_at
     FROM users
     ORDER BY created_at ASC, id ASC`
  );
  return result.rows.map((row, index) => ({
    id: `USR-${String(index + 1).padStart(3, "0")}`,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    team: row.team,
    joined: new Date(row.created_at).toISOString().slice(0, 10),
  }));
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    const users = await listDirectoryUsers();
    return Response.json({ users });
  } catch (error) {
    console.error("list users failed:", error);
    return Response.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const role = ROLES.includes(body?.role) ? body.role : "Member";
    const team = TEAMS.includes(body?.team) ? body.team : "General";

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
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const result = await query<UserRow>(
      `INSERT INTO users (id, name, email, password_hash, role, team, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Active')
       RETURNING id, name, email, password_hash, role, team, status, created_at`,
      [newUserId(), name, email, hashPassword(password), role, team]
    );

    const users = await listDirectoryUsers();
    const created = toSessionUser(result.rows[0]);
    return Response.json({ user: created, users }, { status: 201 });
  } catch (error) {
    console.error("add user failed:", error);
    return Response.json({ error: "Failed to add user" }, { status: 500 });
  }
}
