import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureInitialBMadData } from "@/lib/bmad";

export async function GET() {
  try {
    await ensureInitialBMadData("prj_default");
    const res = await query<{
      id: string;
      name: string;
      git_remote_url: string | null;
      workspace_path: string | null;
      owner_id: string | null;
      team_id: string | null;
      created_at: Date;
    }>(`SELECT * FROM bmad_projects ORDER BY created_at DESC`);

    const projects = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      gitRemoteUrl: row.git_remote_url,
      workspacePath: row.workspace_path,
      ownerId: row.owner_id,
      teamId: row.team_id,
      createdAt: row.created_at.toISOString(),
    }));

    return NextResponse.json(projects);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, gitRemoteUrl, workspacePath } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = `prj_${Date.now().toString(36)}`;
    const res = await query<{
      id: string;
      name: string;
      git_remote_url: string | null;
      workspace_path: string | null;
      owner_id: string | null;
      team_id: string | null;
      created_at: Date;
    }>(
      `INSERT INTO bmad_projects (id, name, git_remote_url, workspace_path)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, name, gitRemoteUrl || null, workspacePath || null]
    );

    const row = res.rows[0];
    return NextResponse.json(
      {
        id: row.id,
        name: row.name,
        gitRemoteUrl: row.git_remote_url,
        workspacePath: row.workspace_path,
        ownerId: row.owner_id,
        teamId: row.team_id,
        createdAt: row.created_at.toISOString(),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
