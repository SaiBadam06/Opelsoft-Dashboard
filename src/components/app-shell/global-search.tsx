"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, Loader2, Search, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const reqId = useRef(0);
  const openRef = useRef(open);
  const activeRef = useRef<HTMLButtonElement>(null);

  function setPaletteOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setHits([]);
      setLoading(false);
      setActive(0);
    }
  }

  // Track latest open state for the one-time keydown listener.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Cmd/Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!openRef.current);
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
      const res = await globalSearch(q);
      if (id === reqId.current) {
        setHits(res);
        setLoading(false);
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
    setPaletteOpen(false);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) go(hit);
    }
  }

  const trimmed = query.trim();
  let row = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Search candidates, requirements and vendors"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border bg-background px-1.5 font-mono text-[0.65rem] leading-5 sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setPaletteOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-2 border-b px-3">
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="size-4 shrink-0 text-muted-foreground" />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search candidates, requirements, vendors…"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {trimmed.length < 2 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
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
                          onClick={() => go(hit)}
                          onMouseMove={() => setActive(i)}
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

          <div className="flex items-center gap-4 border-t px-3 py-2 text-[0.7rem] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono leading-4">↑</kbd>
              <kbd className="rounded border bg-muted px-1 font-mono leading-4">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono leading-4">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono leading-4">esc</kbd>
              close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
