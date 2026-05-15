import { useAiConfig, type EffectiveAiConfig } from '@/stores/aiConfig';

function normalizeBaseUrl(u: string): string {
  return u.replace(/\/+$/, '');
}

export function effectiveConfig(): EffectiveAiConfig {
  return useAiConfig.getState().getEffective();
}

/**
 * GET {baseUrl}/v1/models. OpenAI-compatible — returns the list of model ids.
 */
/**
 * Build request headers, omitting the Authorization header when no API key
 * is configured (built-in endpoint case — the proxy authenticates the
 * request by its Origin header instead of a Bearer key, so we never put a
 * real key on the wire).
 */
function buildHeaders(
  apiKey: string,
  extra: Record<string, string> = {}
): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

export async function listModels(
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const url = `${normalizeBaseUrl(baseUrl)}/v1/models`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(apiKey, { Accept: 'application/json' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }
  const data = await res.json();
  const items = Array.isArray(data?.data) ? data.data : [];
  return items
    .map((m: { id?: string }) => (typeof m.id === 'string' ? m.id : ''))
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b));
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatResult = { content: string; reasoning: string };

/**
 * Quick health-check: probe /v1/models with the effective config.
 */
export async function testConnection(): Promise<
  { ok: true; models: number } | { ok: false; error: string }
> {
  try {
    const cfg = effectiveConfig();
    const list = await listModels(cfg.baseUrl, cfg.apiKey);
    return { ok: true, models: list.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Streaming chat completion. Always uses SSE (`stream: true`) so long
 * generations don't hit gateway idle-timeouts (504). Reasoning-capable
 * models (o1, DeepSeek-R1, Qwen-thinking, ...) emit a separate
 * `reasoning_content` / `reasoning` / `thinking` delta — we surface that
 * via `onReasoning` so the UI can show the thinking process live.
 *
 * Returns the accumulated final content + reasoning when [DONE] arrives.
 */
export async function chatCompletion(opts: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  responseFormat?: 'json_object';
  signal?: AbortSignal;
  onContent?: (delta: string, total: string) => void;
  onReasoning?: (delta: string, total: string) => void;
}): Promise<ChatResult> {
  const cfg = effectiveConfig();
  const baseUrl = normalizeBaseUrl(opts.baseUrl ?? cfg.baseUrl);
  const apiKey = opts.apiKey ?? cfg.apiKey;
  const model = opts.model ?? cfg.model;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    stream: true,
  };
  if (opts.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey, {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }),
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }

  // Defensive fallback: some gateways downgrade `stream:true` to a single
  // JSON response. Detect by content-type and parse normally.
  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('text/event-stream') && !ctype.includes('text/plain')) {
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const reasoning =
      data?.choices?.[0]?.message?.reasoning_content ??
      data?.choices?.[0]?.message?.reasoning ??
      '';
    if (content) opts.onContent?.(content, content);
    if (reasoning) opts.onReasoning?.(reasoning, reasoning);
    return { content, reasoning };
  }

  if (!res.body) throw new Error('Response has no readable body');

  let content = '';
  let reasoning = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines (\n\n). Some servers use
      // \r\n line endings — normalize first.
      buffer = buffer.replace(/\r\n/g, '\n');

      let eventEnd: number;
      while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);

        // Each event may contain multiple "data: ..." lines (rare).
        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === '[DONE]') continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }

          const delta =
            (parsed as { choices?: Array<{ delta?: Record<string, unknown> }> })
              ?.choices?.[0]?.delta ?? {};

          const c = delta.content;
          if (typeof c === 'string' && c.length > 0) {
            content += c;
            opts.onContent?.(c, content);
          }
          // reasoning_content (OpenAI o1, DeepSeek-R1),
          // reasoning (some providers),
          // thinking (Qwen-thinking, Anthropic-via-proxy).
          const r =
            (delta.reasoning_content as string | undefined) ??
            (delta.reasoning as string | undefined) ??
            (delta.thinking as string | undefined);
          if (typeof r === 'string' && r.length > 0) {
            reasoning += r;
            opts.onReasoning?.(r, reasoning);
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }

  return { content, reasoning };
}
