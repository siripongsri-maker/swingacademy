import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveKnowledgeSlug } from "@/lib/knowledge-slug-aliases";

// Backward-compatible redirect: legacy /k/:slug links → /knowledge/:slug
// Resolves slug aliases in the same hop so old links don't double-redirect.
export const Route = createFileRoute("/k/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/knowledge/$slug",
      params: { slug: resolveKnowledgeSlug(params.slug) },
      replace: true,
    });
  },
  component: () => null,
});
