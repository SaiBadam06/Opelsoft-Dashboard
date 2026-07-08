import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VendorOption } from "@/lib/vendors";
import { createVendorForCombobox } from "@/app/(app)/vendors/actions";
import { VendorCombobox } from "./vendor-combobox";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/app/(app)/vendors/actions", () => ({
  createVendorForCombobox: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

const vendors: VendorOption[] = [
  {
    id: "amazon",
    name: "Amazon",
    contact_name: null,
    email: "amazon@example.com",
  },
  {
    id: "amazon-india",
    name: "Amazon India",
    contact_name: null,
    email: "india@example.com",
  },
  {
    id: "john",
    name: "John",
    contact_name: null,
    email: "john@example.com",
  },
  {
    id: "johnny",
    name: "Johnny",
    contact_name: null,
    email: "johnny@example.com",
  },
  {
    id: "globex",
    name: "Globex",
    contact_name: "Johnson",
    email: "johnson@example.com",
  },
];

let root: Root;
let host: HTMLDivElement;

function renderCombobox(initialVendors: VendorOption[] = vendors) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);

  act(() => {
    root.render(<VendorCombobox vendors={initialVendors} />);
  });

  return {
    input: host.querySelector<HTMLInputElement>('input[role="combobox"]')!,
    hidden: host.querySelector<HTMLInputElement>('input[name="vendor_id"]')!,
  };
}

function optionTexts() {
  return Array.from(document.querySelectorAll('[role="option"]')).map((option) =>
    option.textContent?.replace(/\s+/g, " ").trim(),
  );
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  act(() => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function focusInput(input: HTMLInputElement) {
  act(() => {
    input.focus();
  });
}

function keyDown(input: HTMLInputElement, key: string) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

function mouseDown(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

describe("VendorCombobox", () => {
  beforeEach(() => {
    vi.mocked(createVendorForCombobox).mockReset();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    document.body.innerHTML = "";
  });

  it("displays existing vendors when focused with an empty query", () => {
    const { input } = renderCombobox();

    focusInput(input);

    expect(optionTexts()).toEqual([
      "Amazonamazon@example.com",
      "Amazon Indiaindia@example.com",
      "Johnjohn@example.com",
      "Johnnyjohnny@example.com",
      "JohnsonGlobexjohnson@example.com",
    ]);
  });

  it("filters vendors while typing", () => {
    const { input } = renderCombobox();

    setInputValue(input, "john");

    expect(optionTexts()).toEqual([
      "Johnjohn@example.com",
      "Johnnyjohnny@example.com",
      "JohnsonGlobexjohnson@example.com",
    ]);
  });

  it("hides the add option when the query exactly matches an existing vendor", () => {
    const { input } = renderCombobox();

    setInputValue(input, "Amazon");

    expect(optionTexts()).toEqual([
      "Amazonamazon@example.com",
      "Amazon Indiaindia@example.com",
    ]);
  });

  it("keeps the add option visible as the last item for a partial match", () => {
    const { input } = renderCombobox();

    setInputValue(input, "Amaz");

    expect(optionTexts()).toEqual([
      "Amazonamazon@example.com",
      "Amazon Indiaindia@example.com",
      'Add "Amaz" as new vendor',
    ]);
  });

  it("opens the add dialog from the add option and pre-fills the typed vendor", () => {
    const { input } = renderCombobox();

    setInputValue(input, "Joe");
    mouseDown(document.querySelector('[role="option"]')!);

    expect(document.body.textContent).toContain("Add New Vendor");
    expect(
      document.querySelector<HTMLInputElement>("#new_vendor_name")?.value,
    ).toBe("Joe");
  });

  it("selects a newly created vendor and keeps it searchable", async () => {
    vi.mocked(createVendorForCombobox).mockResolvedValue({
      vendor: {
        id: "joe",
        name: "Joe",
        contact_name: null,
        email: "joe@example.com",
      },
    });
    const { input, hidden } = renderCombobox();

    setInputValue(input, "Joe");
    mouseDown(document.querySelector('[role="option"]')!);
    await click(
      Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "Add Vendor",
      )!,
    );

    expect(hidden.value).toBe("joe");
    expect(input.value).toBe("Joe");

    setInputValue(input, "Jo");

    expect(optionTexts()).toContain("Joejoe@example.com");
  });

  it("selects a vendor with Enter", () => {
    const { input, hidden } = renderCombobox();

    focusInput(input);
    keyDown(input, "Enter");

    expect(hidden.value).toBe("amazon");
    expect(input.value).toBe("Amazon");
  });

  it("navigates with arrows and opens the add dialog with Enter on the add option", () => {
    const { input } = renderCombobox();

    setInputValue(input, "Amaz");
    keyDown(input, "ArrowDown");
    keyDown(input, "ArrowDown");
    keyDown(input, "Enter");

    expect(document.body.textContent).toContain("Add New Vendor");
    expect(
      document.querySelector<HTMLInputElement>("#new_vendor_name")?.value,
    ).toBe("Amaz");
  });
});
