// One place that talks to a language model, so the AI judge and the honest
// agent can run on whichever provider you have a key for:
//
//   NVIDIA_API_KEY set     -> NVIDIA's hosted models (free tier), default Nemotron 3 Ultra
//   else ANTHROPIC_API_KEY -> Claude
//
// Override the model with LLM_MODEL (for NVIDIA, any id from
// https://build.nvidia.com, e.g. moonshotai/kimi-k2.6).
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
// Kimi K2.6 is listed by NVIDIA but has no live deployment (404) as of Nov 2026,
// so the default is NVIDIA's own Nemotron 3 Ultra. Set LLM_MODEL to switch back.
const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";

export type Provider = "nvidia" | "anthropic";

export class LlmKeyError extends Error {}
export class LlmRateLimitError extends Error {}

export function provider(): Provider {
  if (process.env.NVIDIA_API_KEY) return "nvidia";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  throw new LlmKeyError("No model key set: add NVIDIA_API_KEY (or ANTHROPIC_API_KEY) to app/.env.local and app/.env.");
}

export function modelName(): string {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
  return provider() === "nvidia" ? NVIDIA_DEFAULT_MODEL : ANTHROPIC_DEFAULT_MODEL;
}

/** Send one system + user prompt and return the model's text reply. */
export async function chat(opts: { system: string; user: string; maxTokens?: number; fast?: boolean }): Promise<string> {
  const which = provider();
  const model = modelName();

  if (which === "nvidia") {
    const client = new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: NVIDIA_BASE_URL });
    try {
      const res = await client.chat.completions.create({
        model,
        temperature: 0.3,
        max_tokens: Math.max(opts.maxTokens ?? 1024, 2048),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        // fast: skip the model's hidden reasoning (about 4x fewer tokens, quicker replies).
        ...(opts.fast ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      } as Parameters<typeof client.chat.completions.create>[0] & { stream?: false });
      const text = res.choices[0]?.message?.content ?? "";
      return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    } catch (e) {
      if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError)
        throw new LlmKeyError("NVIDIA_API_KEY was rejected. Get a free key (it starts with nvapi-) at build.nvidia.com.");
      if (e instanceof OpenAI.NotFoundError)
        throw new LlmKeyError(`NVIDIA doesn't serve the model "${model}" for this key. Set LLM_MODEL to an id listed at build.nvidia.com.`);
      if (e instanceof OpenAI.RateLimitError) throw new LlmRateLimitError("NVIDIA's free tier is rate-limited right now. Wait a minute and retry.");
      throw e;
    }
  }

  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      output_config: { effort: "medium" },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      throw new LlmKeyError("ANTHROPIC_API_KEY was rejected (Anthropic keys start with sk-ant-).");
    if (e instanceof Anthropic.RateLimitError) throw new LlmRateLimitError("Anthropic rate limit hit. Wait a minute and retry.");
    throw e;
  }
}

/** Pull the first JSON object out of a reply (models sometimes wrap it in prose or fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model's reply had no JSON object in it.");
  return JSON.parse(body.slice(start, end + 1));
}
