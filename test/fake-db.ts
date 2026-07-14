/**
 * Minimal fake for the supabase-js client, just enough for route handler tests.
 * Seed per-table / per-rpc results as FIFO queues; every terminal await
 * (maybeSingle / single / awaiting the chain) consumes the next result.
 * Missing seeds resolve to { data: null, error: null, count: 0 }.
 * Mutations (update / insert) are recorded on `_updates` / `_inserts` for asserts.
 * Note: no `ilike` on the builder — a route regression back to ilike throws here.
 */
type Result = { data?: unknown; error?: unknown; count?: number | null };

export function makeDb(opts: {
  tables?: Record<string, Result[]>;
  rpcs?: Record<string, Result[]>;
} = {}) {
  const _updates: Array<{ table: string; values: Record<string, unknown>; eq: unknown[][] }> = [];
  const _inserts: Array<{ table: string; values: unknown }> = [];

  function builder(table: string) {
    let update: Record<string, unknown> | null = null;
    let insert: unknown = null;
    const eq: unknown[][] = [];
    const next = (): Result => opts.tables?.[table]?.shift() ?? { data: null, error: null, count: 0 };
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const b: any = {};
    for (const m of ["select", "order", "limit", "in", "lt"]) b[m] = () => b;
    b.update = (values: Record<string, unknown>) => ((update = values), b);
    b.insert = (values: unknown) => ((insert = values), b);
    b.eq = (...args: unknown[]) => (eq.push(args), b);
    b.maybeSingle = async () => next();
    b.single = async () => next();
    b.then = (onFulfilled: any, onRejected: any) => {
      if (update) _updates.push({ table, values: update, eq });
      if (insert) _inserts.push({ table, values: insert });
      return Promise.resolve(next()).then(onFulfilled, onRejected);
    };
    return b;
  }

  return {
    from: (table: string) => builder(table),
    rpc: async (name: string) => opts.rpcs?.[name]?.shift() ?? { data: null, error: null },
    _updates,
    _inserts,
  };
}
