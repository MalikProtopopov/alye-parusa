import type { LeadCreateDto, LeadCreatedDto } from "./dto";

/**
 * Browser-side lead submission — the ONE place the client talks to the API
 * directly (everything else flows through server-only apiFetch). Never throws:
 * the form turns the result into UI state.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SubmitLeadResult =
  | { ok: true; id: string }
  | { ok: false; error: "validation" | "network" | "server" };

export async function submitLead(lead: LeadCreateDto): Promise<SubmitLeadResult> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    if (res.ok) {
      const data = (await res.json()) as LeadCreatedDto;
      return { ok: true, id: data.id };
    }
    return { ok: false, error: res.status === 422 ? "validation" : "server" };
  } catch {
    return { ok: false, error: "network" };
  }
}
