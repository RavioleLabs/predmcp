// src/tools/with-timestamp.ts
//
// Wraps any MCP tool handler to automatically inject temporal context into
// the JSON output. Three fields:
//   - detected_at          : ISO timestamp when this response was computed
//   - active_since         : ISO timestamp when the underlying state became true
//                            (defaults to detected_at when the handler can't
//                            distinguish — overridden by the tool when possible)
//   - half_life_minutes    : indicative decay rate so agents can prioritize
//                            fresh signals over stale ones
//
// If the handler's output already contains any of these fields, we leave them
// untouched. The wrapper only ADDS missing ones.

type ToolResponse = { content: Array<{ type: 'text'; text: string }> };

export function withTimestamp<T extends (input: any) => Promise<ToolResponse> | ToolResponse>(
  handler: T,
  halfLifeMinutes?: number,
): T {
  return (async (input: unknown) => {
    const result = await handler(input);
    if (!result?.content?.length) return result;
    const first = result.content[0];
    if (!first || first.type !== 'text') return result;
    try {
      const parsed = JSON.parse(first.text);
      // Only inject if it's a plain object (not array). Don't overwrite existing fields.
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const nowIso = new Date().toISOString();
        if (!parsed.detected_at) parsed.detected_at = nowIso;
        if (!parsed.active_since) parsed.active_since = parsed.detected_at ?? nowIso;
        if (halfLifeMinutes && !parsed.half_life_minutes) parsed.half_life_minutes = halfLifeMinutes;
        return { ...result, content: [{ type: 'text', text: JSON.stringify(parsed) }, ...result.content.slice(1)] } as ReturnType<T>;
      }
    } catch {
      /* not JSON — leave it as is */
    }
    return result;
  }) as T;
}
