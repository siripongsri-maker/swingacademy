// Mermaid renderer — lazy initializes mermaid and renders SVG inline.
import { useEffect, useId, useRef, useState } from "react";

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      const mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
        fontFamily: "inherit",
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export function MermaidBlock({ code }: { code: string }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render(`mmd-${id}`, code.trim());
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Mermaid error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="overflow-auto rounded-md border border-warm-200 bg-warm-50 p-3 text-[11px] text-warm-700">
        {code}
        <div className="mt-2 text-destructive">⚠ {error}</div>
      </pre>
    );
  }
  return (
    <div
      ref={ref}
      className="my-3 flex justify-center overflow-x-auto rounded-md border border-warm-200 bg-white p-3"
    />
  );
}
