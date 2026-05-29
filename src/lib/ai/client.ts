import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

/**
 * Resolves the LLM client at call time so a script that loads .env.local
 * after import order can still pick up the key.
 */
export type ClientHandle =
  | { kind: "real"; client: Anthropic }
  | { kind: "mock"; reason: string };

export function getClient(): ClientHandle {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.trim() === "" || key.includes("PASTE-YOUR-KEY")) {
    return {
      kind: "mock",
      reason: "ANTHROPIC_API_KEY not set — using deterministic mock LLM.",
    };
  }
  return { kind: "real", client: new Anthropic({ apiKey: key }) };
}

export function isMock(): boolean {
  return getClient().kind === "mock";
}
