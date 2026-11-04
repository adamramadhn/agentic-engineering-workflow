import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query<{
      id: string;
      name: string;
      provider_type: string;
      base_url: string;
      api_key: string;
      model_id: string;
      is_team_shared: boolean;
      registered_by: string;
    }>(`SELECT * FROM bmad_llm_providers ORDER BY created_at ASC`);

    if (res.rows.length === 0) {
      // Seed default providers if none exist
      const defaultProviders = [
        {
          id: "prov_team_proxy",
          name: "Team LiteLLM Gateway",
          providerType: "proxy",
          baseUrl: "https://llm-gateway.company.internal/v1",
          apiKey: "sk-team-shared-token",
          modelId: "claude-sonnet-5-5",
          isTeamShared: true,
          registeredBy: "Lead Architect",
        },
        {
          id: "prov_personal_anthropic",
          name: "Personal Anthropic Direct",
          providerType: "anthropic",
          baseUrl: "https://api.anthropic.com",
          apiKey: "sk-ant-api03-personal-token",
          modelId: "claude-opus-5-5",
          isTeamShared: false,
          registeredBy: "Adam Ramadhan",
        },
      ];

      for (const p of defaultProviders) {
        await query(
          `INSERT INTO bmad_llm_providers
            (id, name, provider_type, base_url, api_key, model_id, is_team_shared, registered_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.name, p.providerType, p.baseUrl, p.apiKey, p.modelId, p.isTeamShared, p.registeredBy]
        );
      }

      return NextResponse.json(defaultProviders);
    }

    const providers = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      providerType: row.provider_type,
      baseUrl: row.base_url,
      apiKey: row.api_key,
      modelId: row.model_id,
      isTeamShared: row.is_team_shared,
      registeredBy: row.registered_by,
    }));

    return NextResponse.json(providers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
