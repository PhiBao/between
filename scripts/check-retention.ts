/**
 * Checks how Amazon Bedrock will treat this product's data.
 *
 * Run with: pnpm check:retention
 *
 * Why this exists: Bedrock's data retention is configured at the account or
 * project level, not per request. `store: false` on a request is not a
 * guarantee — the docs are explicit that some models still retain data for
 * safety review unless the effective retention mode is `none`.
 *
 * Between holds the most sensitive family data there is, so before deploying we
 * check two things:
 *   1. the effective retention mode for the model we use
 *   2. that the model allows zero retention at all
 *
 * The script exits non-zero when the configuration is not what we promise users,
 * so it can be wired into a release check.
 */

import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match?.[1] && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2];
  }
}

const baseUrl = process.env.BEDROCK_BASE_URL;
const apiKey = process.env.BEDROCK_API_KEY;
const modelId = process.env.BEDROCK_MODEL_ID ?? "openai.gpt-oss-120b";

if (!baseUrl || !apiKey) {
  console.error("BEDROCK_BASE_URL and BEDROCK_API_KEY are required.");
  process.exit(2);
}

interface RetentionInfo {
  mode?: string;
  source?: string;
  allowed_modes?: string[];
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "x-api-key": apiKey! },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

/**
 * Reading the account-wide setting needs a broader permission than inference
 * keys usually carry, so it is best-effort. The per-model view below is
 * authoritative for our purposes: it reports the mode that will actually apply.
 */
async function getAccountMode(): Promise<string> {
  try {
    const account = (await getJson("/data_retention")) as { mode?: string };
    return account.mode ?? "unknown";
  } catch (error) {
    return `not readable with this key (${error instanceof Error ? error.message : "error"})`;
  }
}

async function main(): Promise<void> {
  const accountMode = await getAccountMode();
  const model = (await getJson(`/models/${modelId}`)) as {
    id?: string;
    status?: string;
    data_retention?: RetentionInfo;
  };

  const allowed = model.data_retention?.allowed_modes ?? [];
  const effective = model.data_retention?.mode ?? "unknown";

  console.log(`Account retention mode : ${accountMode}`);
  console.log(`Model                  : ${model.id ?? modelId} (${model.status ?? "?"})`);
  console.log(`Effective mode         : ${effective} (from ${model.data_retention?.source ?? "?"})`);
  console.log(`Allows zero retention  : ${allowed.includes("none") ? "yes" : "NO"}`);
  console.log("");

  if (model.status !== "available") {
    console.error(`FAIL: ${modelId} is not available to this account.`);
    process.exit(1);
  }

  if (!allowed.includes("none")) {
    console.error(
      `FAIL: ${modelId} cannot be used with zero data retention. Pick a model whose allowed_modes include "none".`,
    );
    process.exit(1);
  }

  if (effective !== "none") {
    console.warn(
      [
        `WARNING: the effective retention mode is "${effective}", not "none".`,
        "",
        "Requests still send store:false, but for a hard guarantee set the",
        "account or project mode to none:",
        "",
        `  curl -X PUT ${baseUrl}/data_retention \\`,
        '    -H "x-api-key: $BEDROCK_API_KEY" \\',
        '    -H "Content-Type: application/json" \\',
        `    -d '{"mode":"none"}'`,
        "",
        "Note this is an account-wide change: models that require",
        "provider_data_share become unavailable.",
      ].join("\n"),
    );
    process.exit(3);
  }

  console.log("OK: zero data retention is in force for this model.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
