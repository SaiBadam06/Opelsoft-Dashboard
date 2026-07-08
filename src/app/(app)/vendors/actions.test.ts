import { beforeEach, describe, expect, it, vi } from "vitest";

import { createVendorForCombobox } from "./actions";

type VendorRow = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone?: string | null;
  created_by?: string;
};

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentProfile: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentProfile: mocks.getCurrentProfile,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

class VendorsQuery {
  private filters: Array<(row: VendorRow) => boolean> = [];
  private insertRecord: Omit<VendorRow, "id"> | null = null;

  constructor(private rows: VendorRow[]) {}

  select() {
    return this;
  }

  eq(column: keyof VendorRow, value: string) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: keyof VendorRow, value: null) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  limit() {
    return this;
  }

  insert(record: Omit<VendorRow, "id">) {
    this.insertRecord = record;
    return this;
  }

  maybeSingle() {
    return Promise.resolve({
      data: this.rows.find((row) => this.filters.every((filter) => filter(row))) ?? null,
      error: null,
    });
  }

  single() {
    if (!this.insertRecord) {
      return Promise.resolve({ data: null, error: new Error("Missing insert") });
    }

    const row = {
      id: `vendor-${this.rows.length + 1}`,
      ...this.insertRecord,
    };
    this.rows.push(row);

    return Promise.resolve({ data: row, error: null });
  }
}

function mockSupabase(rows: VendorRow[]) {
  mocks.createClient.mockResolvedValue({
    from: (table: string) => {
      expect(table).toBe("vendors");
      return new VendorsQuery(rows);
    },
  });
}

describe("createVendorForCombobox duplicate detection", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.getCurrentProfile.mockResolvedValue({ id: "user-1" });
    mocks.revalidatePath.mockReset();
  });

  it("returns an existing vendor when email exactly matches", async () => {
    const rows: VendorRow[] = [
      {
        id: "existing",
        name: "Acme",
        contact_name: "Sam",
        email: "sam@acme.test",
      },
    ];
    mockSupabase(rows);

    const result = await createVendorForCombobox({
      name: "Different Company",
      contactName: "Different Contact",
      email: "sam@acme.test",
      phone: "",
    });

    expect(result).toEqual({
      vendor: rows[0],
      duplicate: true,
    });
    expect(rows).toHaveLength(1);
  });

  it("returns an existing vendor when name and contact name exactly match", async () => {
    const rows: VendorRow[] = [
      {
        id: "existing",
        name: "Acme",
        contact_name: "Sam",
        email: null,
      },
    ];
    mockSupabase(rows);

    const result = await createVendorForCombobox({
      name: "Acme",
      contactName: "Sam",
      email: "",
      phone: "",
    });

    expect(result).toEqual({
      vendor: rows[0],
      duplicate: true,
    });
    expect(rows).toHaveLength(1);
  });

  it("creates a vendor for a different contact under the same company", async () => {
    const rows: VendorRow[] = [
      {
        id: "existing",
        name: "Acme",
        contact_name: "Sam",
        email: null,
      },
    ];
    mockSupabase(rows);

    const result = await createVendorForCombobox({
      name: "Acme",
      contactName: "Alex",
      email: "",
      phone: "555-0100",
    });

    expect(result.duplicate).toBeUndefined();
    expect(result.vendor).toMatchObject({
      id: "vendor-2",
      name: "Acme",
      contact_name: "Alex",
      email: null,
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      name: "Acme",
      contact_name: "Alex",
      phone: "555-0100",
    });
  });

  it("creates a vendor for the same contact under a different company", async () => {
    const rows: VendorRow[] = [
      {
        id: "existing",
        name: "Acme",
        contact_name: "Sam",
        email: null,
      },
    ];
    mockSupabase(rows);

    const result = await createVendorForCombobox({
      name: "Globex",
      contactName: "Sam",
      email: "",
      phone: "",
    });

    expect(result.duplicate).toBeUndefined();
    expect(result.vendor).toMatchObject({
      id: "vendor-2",
      name: "Globex",
      contact_name: "Sam",
      email: null,
    });
    expect(rows).toHaveLength(2);
  });
});
