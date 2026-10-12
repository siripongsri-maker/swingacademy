import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyResearchAccess, type ResearchAccess } from "@/lib/research-access";

/** Research roles of the signed-in user, for menus and page gates. Null while loading or on error. */
export function useResearchAccess(): ResearchAccess | null {
  const fn = useServerFn(getMyResearchAccess);
  const q = useQuery({
    queryKey: ["research-access"],
    queryFn: () => fn(),
    staleTime: 60_000,
    retry: false,
  });
  return q.data ?? null;
}
