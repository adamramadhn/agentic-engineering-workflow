import { destroySession } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("logout failed:", error);
    return Response.json({ error: "Failed to sign out" }, { status: 500 });
  }
}
