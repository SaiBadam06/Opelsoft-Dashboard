"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, Loader2, Search, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  globalSearch,
  type GlobalSearchHit,
  type GlobalSearchType,
} from "@/app/(app)/search/global-search-actions";

const TYPE_META: Record<GlobalSearchType, { label: string; icon: typeof Users }> = {
  candidate: { label: "Candidates", icon: Users },
  requirement: { label: "Requirements", icon: Briefcase },
  vendor: { label: "Vendors", icon: Building2 },
};

const ORDER: GlobalSearchType[] = ["candidate", "requirement", "vendor"];

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Cmd/Ctrl+K focuses the search from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced server search; drops stale responses. Only runs for >= 2 chars;
  // shorter queries are cleared in onChange, so this effect never sets state synchronously.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await globalSearch(q);
        if (id === reqId.current) {
          setHits(res);
          setError(false);
        }
      } catch {
        if (id === reqId.current) {
          setHits([]);
          setError(true);
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Keep the highlighted row in view when navigating with the keyboard.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onQueryChange(value: string) {
    setQuery(value);
    setActive(0);
    setError(false);
    setOpen(true);
    const short = value.trim().length < 2;
    setLoading(!short);
    if (short) setHits([]);
  }

  // Grouped for display; flat mirrors the same order so `active` indexes both.
  const grouped = ORDER.map((type) => ({
    type,
    items: hits.filter((h) => h.type === type),
  })).filter((g) => g.items.length > 0);
  const flat = grouped.flatMap((g) => g.items);

  function go(hit: GlobalSearchHit) {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
    inputRef.current?.blur();
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) go(hit);
    }
  }

  const trimmed = query.trim();
  const showDropdown = open && trimmed.length >= 2;
  let row = -1;

  return (
    <div className="relative min-w-0 max-w-md flex-1">
      <div className="relative">
        {loading ? (
          <Loader2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Search candidates, requirements, vendors…"
          aria-label="Search candidates, requirements and vendors"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          className="h-9 w-full rounded-md border bg-muted/40 pl-8 pr-12 text-sm outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted focus:bg-background"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-background px-1.5 font-mono text-[0.65rem] leading-5 text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </div>

      {showDropdown ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 w-full overflow-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
        >
          {error ? (
            <p className="p-6 text-center text-sm text-destructive">
              Search failed. Please try again.
            </p>
          ) : loading && flat.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Searching…</p>
          ) : flat.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No results for “{trimmed}”.
            </p>
          ) : (
            grouped.map(({ type, items }) => {
              const { label, icon: Icon } = TYPE_META[type];
              return (
                <div key={type} className="mb-1">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{label}</p>
                  {items.map((hit) => {
                    row += 1;
                    const i = row;
                    return (
                      <button
                        key={hit.id}
                        ref={i === active ? activeRef : null}
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        onMouseMove={() => setActive(i)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          go(hit);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                          i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{hit.title}</span>
                        {hit.subtitle ? (
                          <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">
                            {hit.subtitle}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
