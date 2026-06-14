// Map of legacy knowledge slugs → current slug in `knowledge_products`.
// Add entries here when a knowledge item's slug changes, so previously
// shared links keep working via redirect.
export const KNOWLEDGE_SLUG_ALIASES: Record<string, string> = {
  "community-led-health-work-swing": "hivst-community-led-model",
};

export function resolveKnowledgeSlug(slug: string): string {
  return KNOWLEDGE_SLUG_ALIASES[slug] ?? slug;
}
