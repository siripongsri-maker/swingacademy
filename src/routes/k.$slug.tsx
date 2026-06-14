import { createFileRoute, redirect } from "@tanstack/react-router";

// Backward-compatible redirect: legacy /k/:slug links → /knowledge/:slug
export const Route = createFileRoute("/k/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/knowledge/$slug",
      params: { slug: params.slug },
      replace: true,
    });
  },
  component: () => null,
});
