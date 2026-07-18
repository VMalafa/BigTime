"use client";

// PROTOTYPE HARNESS — shared floating variant switcher (throwaway; see
// .claude/skills/prototype). Rendered only when a prototype gate mounts it,
// i.e. when the page URL carries ?variant=. Never part of a real design.

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface Props {
  variants: string[];
  labels?: Record<string, string>;
}

export function PrototypeSwitcher({ variants, labels = {} }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("variant") ?? variants[0];
  const idx = Math.max(0, variants.indexOf(current));

  const go = useCallback(
    (delta: number) => {
      const next = variants[(idx + delta + variants.length) % variants.length];
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [idx, variants, router, pathname, searchParams]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full bg-neutral-900 px-4 py-2 text-white shadow-xl">
        <button
          aria-label="Previous variant"
          onClick={() => go(-1)}
          className="text-lg leading-none px-1 hover:text-amber-300"
        >
          ←
        </button>
        <span className="text-xs font-mono whitespace-nowrap">
          {current}
          {labels[current] ? ` — ${labels[current]}` : ""}
        </span>
        <button
          aria-label="Next variant"
          onClick={() => go(1)}
          className="text-lg leading-none px-1 hover:text-amber-300"
        >
          →
        </button>
      </div>
    </div>
  );
}
