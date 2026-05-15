import { chatCompletion } from './client';
import { hostname } from '@/lib/favicon';
import type { Category } from '@/stores/bookmarkClassification';

/**
 * Classification flow optimized for token cost:
 *
 *   Input:  numbered list of `i:N t:Title d:domain` (no full URLs)
 *   Output: `{"groups":[{"name":"Tools","ids":[1,3,5]}]}` (just indices)
 *
 * The AI never echoes URLs back — we reconstruct the items by index. For
 * 200 bookmarks this typically cuts response tokens by 60-70% vs the old
 * "AI returns full title+url" approach.
 */
const SYSTEM_PROMPT = `You organize browser bookmarks into a flat list of categories.

Input: a numbered list of bookmarks, one per line, formatted as:
  N. <title> | <domain>

Output ONLY a minified JSON object in this exact shape:
{"groups":[{"name":"...","ids":[N,N,N]}]}

Rules:
- 5 to 12 groups total.
- Every input number appears in exactly ONE group.
- Use Chinese names if titles are mostly Chinese, otherwise English.
- Conceptual names ("Work", "Tools", "AI", "Learning", "News") — never site-specific.
- Aim for 5-30 items per group; avoid singleton groups.
- "ids" contains the integer line numbers from the input — DO NOT echo titles or URLs.`;

function extractJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    /* fall through */
  }
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {
      /* fall through */
    }
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  throw new Error('Could not parse AI response as JSON');
}

const MAX_BOOKMARKS_PER_BATCH = 500;
const MAX_TITLE_LEN = 60;

export type ClassifyCallbacks = {
  onReasoning?: (totalReasoning: string) => void;
  onContent?: (totalContent: string) => void;
};

/**
 * Compact a bookmark into the line we send to the AI. Strips noise:
 * - drops the path/query (only domain kept)
 * - clips long titles
 * - collapses whitespace
 * - removes Chrome's "Welcome to" / domain-suffixed redundancy
 */
function compactLine(index: number, title: string, url: string): string {
  const domain = hostname(url).replace(/^www\./, '');
  const cleaned = title
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LEN);
  // If the title is just the domain, omit it — the domain is already present.
  if (cleaned === domain) return `${index}. | ${domain}`;
  return `${index}. ${cleaned} | ${domain}`;
}

export async function classifyBookmarks(
  bookmarks: Array<{ url: string; title: string }>,
  callbacks?: ClassifyCallbacks,
  signal?: AbortSignal
): Promise<Category[]> {
  if (bookmarks.length === 0) return [];

  // Deduplicate by URL to avoid wasting tokens on duplicates.
  const seen = new Set<string>();
  const unique: Array<{ url: string; title: string }> = [];
  for (const b of bookmarks) {
    if (seen.has(b.url)) continue;
    seen.add(b.url);
    unique.push(b);
  }

  const truncated = unique.slice(0, MAX_BOOKMARKS_PER_BATCH);
  const lines = truncated.map((b, i) => compactLine(i + 1, b.title, b.url));
  const list = lines.join('\n');

  const { content } = await chatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Classify these ${truncated.length} bookmarks. Output the JSON now (ids only, no titles or urls).\n\nBookmarks:\n${list}`,
      },
    ],
    temperature: 0.3,
    responseFormat: 'json_object',
    signal,
    onReasoning: callbacks?.onReasoning
      ? (_d, total) => callbacks.onReasoning!(total)
      : undefined,
    onContent: callbacks?.onContent
      ? (_d, total) => callbacks.onContent!(total)
      : undefined,
  });

  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI returned an unexpected format');
  }
  const obj = parsed as { groups?: unknown; categories?: unknown };
  // Accept both `groups` (new) and `categories` (old) for compatibility.
  const rawGroups = Array.isArray(obj.groups)
    ? obj.groups
    : Array.isArray(obj.categories)
      ? obj.categories
      : null;
  if (!rawGroups) {
    throw new Error('AI returned an unexpected format');
  }

  const result: Category[] = [];
  for (let idx = 0; idx < rawGroups.length; idx++) {
    const g = rawGroups[idx] as {
      name?: unknown;
      ids?: unknown;
      items?: unknown;
    };
    const name = String(g.name ?? `Group ${idx + 1}`).slice(0, 50);

    let items: Array<{ url: string; title: string }> = [];

    if (Array.isArray(g.ids)) {
      // New index-based output.
      for (const id of g.ids) {
        const i = typeof id === 'number' ? id - 1 : NaN;
        if (Number.isInteger(i) && i >= 0 && i < truncated.length) {
          items.push(truncated[i]);
        }
      }
    } else if (Array.isArray(g.items)) {
      // Backwards-compatible "items: [{url, title}]" output.
      for (const it of g.items) {
        const o = (it ?? {}) as { url?: unknown; title?: unknown };
        const url = String(o.url ?? '');
        if (!url) continue;
        const original = truncated.find(b => b.url === url);
        items.push(original ?? { url, title: String(o.title ?? '') });
      }
    }

    if (items.length > 0) {
      result.push({
        id: `ai-${idx}-${Date.now()}`,
        name,
        items,
      });
    }
  }

  // Catch any bookmarks the AI dropped — bucket them into "Other".
  const used = new Set<string>();
  for (const cat of result) for (const it of cat.items) used.add(it.url);
  const missing = truncated.filter(b => !used.has(b.url));
  if (missing.length > 0) {
    result.push({
      id: `ai-other-${Date.now()}`,
      name: 'Other',
      items: missing,
    });
  }

  return result;
}
