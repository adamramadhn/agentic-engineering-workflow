import { NextResponse } from "next/server";
import { getBMadAgentTree } from "@/lib/bmad";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const tree = await getBMadAgentTree(projectId);
    return NextResponse.json(tree);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
