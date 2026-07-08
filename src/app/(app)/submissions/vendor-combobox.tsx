"use client";

import { useMemo, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import type { VendorOption } from "@/lib/vendors";
import { cn } from "@/lib/utils";
import { createVendorForCombobox } from "@/app/(app)/vendors/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VendorFormErrors = Partial<{
  name: string;
  email: string;
  form: string;
}>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function vendorLabel(vendor: VendorOption): string {
  return vendor.contact_name || vendor.name;
}

function vendorMeta(vendor: VendorOption): string {
  return [vendor.name, vendor.email].filter(Boolean).join(" - ");
}

function normalized(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function mergeVendors(
  current: VendorOption[],
  incoming: VendorOption[],
): VendorOption[] {
  const byId = new Map(current.map((vendor) => [vendor.id, vendor]));
  for (const vendor of incoming) byId.set(vendor.id, vendor);
  return Array.from(byId.values());
}

function vendorMatchScore(vendor: VendorOption, query: string): number {
  const fields = [
    vendor.contact_name,
    vendor.name,
    vendor.email,
  ].map(normalized);

  if (fields.some((field) => field.startsWith(query))) return 0;
  if (fields.some((field) => field.includes(query))) return 1;
  return -1;
}

function hasExactVendorMatch(vendors: VendorOption[], query: string): boolean {
  return vendors.some((vendor) =>
    [vendorLabel(vendor), vendor.name].some(
      (field) => normalized(field) === query,
    ),
  );
}

export function VendorCombobox({
  vendors,
}: {
  vendors: VendorOption[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [knownVendors, setKnownVendors] = useState(vendors);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formErrors, setFormErrors] = useState<VendorFormErrors>({});
  const [pending, startTransition] = useTransition();

  const trimmedQuery = query.trim();
  const normalizedQuery = normalized(trimmedQuery);
  const canSearch = normalizedQuery.length > 0;
  const displayedResults = useMemo(() => {
    if (!canSearch) return knownVendors;

    return knownVendors
      .map((vendor) => ({
        score: vendorMatchScore(vendor, normalizedQuery),
        vendor,
      }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return vendorLabel(a.vendor).localeCompare(vendorLabel(b.vendor));
      })
      .map(({ vendor }) => vendor);
  }, [canSearch, knownVendors, normalizedQuery]);
  const selectedVendor = useMemo(
    () => knownVendors.find((vendor) => vendor.id === selectedId),
    [knownVendors, selectedId],
  );
  const showDropdown = open;
  const showAddVendorOption =
    canSearch && !hasExactVendorMatch(knownVendors, normalizedQuery);
  const addVendorOptionIndex = displayedResults.length;

  function selectVendor(vendor: VendorOption) {
    setSelectedId(vendor.id);
    setQuery(vendorLabel(vendor));
    setActiveIndex(0);
    setOpen(false);
  }

  function openAddVendor() {
    setName(trimmedQuery);
    setContactName("");
    setEmail("");
    setPhone("");
    setFormErrors({});
    setDialogOpen(true);
    setOpen(false);
  }

  function moveActiveIndex(direction: 1 | -1) {
    const optionCount = displayedResults.length + (showAddVendorOption ? 1 : 0);
    if (optionCount === 0) return;

    setActiveIndex(
      (current) => (current + direction + optionCount) % optionCount,
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      moveActiveIndex(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      moveActiveIndex(-1);
      return;
    }

    if (event.key === "Enter" && showDropdown) {
      event.preventDefault();
      const vendor = displayedResults[activeIndex];
      if (vendor) {
        selectVendor(vendor);
      } else if (showAddVendorOption && activeIndex === addVendorOptionIndex) {
        openAddVendor();
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function validateModal(): VendorFormErrors {
    const errors: VendorFormErrors = {};

    if (!name.trim()) {
      errors.name = "Name is required.";
    }
    if (email.trim() && !EMAIL_PATTERN.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    return errors;
  }

  function addVendor() {
    const errors = validateModal();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    startTransition(async () => {
      const res = await createVendorForCombobox({
        name,
        contactName,
        email,
        phone,
      });

      if (res.error || !res.vendor) {
        setFormErrors({ form: res.error ?? "Could not add vendor." });
        return;
      }

      const vendor = res.vendor;
      setKnownVendors((current) => mergeVendors(current, [vendor]));
      selectVendor(vendor);
      setDialogOpen(false);
      toast.success(
        res.duplicate
          ? "Existing vendor selected."
          : "Vendor added and selected.",
      );
    });
  }

  return (
    <>
      <input type="hidden" name="vendor_id" value={selectedId} />
      <div className="relative w-full">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="vendor_search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId("");
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder="Search vendor"
            autoComplete="off"
            className="pl-8"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="vendor-combobox-results"
            aria-activedescendant={
              showDropdown ? `vendor-combobox-option-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
          />
        </div>

        {showDropdown ? (
          <div
            id="vendor-combobox-results"
            role="listbox"
            className="absolute top-full right-0 left-0 z-30 mt-1 max-h-[280px] w-full overflow-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
          >
            {displayedResults.length > 0
              ? displayedResults.map((vendor, index) => {
                  const isActive = index === activeIndex;
                  const company = vendor.contact_name ? vendor.name : null;

                  return (
                    <button
                      id={`vendor-combobox-option-${index}`}
                      key={vendor.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={cn(
                        "flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none",
                        isActive && "bg-muted",
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectVendor(vendor);
                      }}
                    >
                      <span className="font-semibold">{vendorLabel(vendor)}</span>
                      {company ? (
                        <span className="text-xs text-muted-foreground">
                          {company}
                        </span>
                      ) : null}
                      {vendor.email ? (
                        <span className="text-xs text-muted-foreground/80">
                          {vendor.email}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              : null}

            {showAddVendorOption ? (
              <button
                id={`vendor-combobox-option-${addVendorOptionIndex}`}
                type="button"
                role="option"
                aria-selected={activeIndex === addVendorOptionIndex}
                className={cn(
                  "mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-medium hover:bg-muted focus:bg-muted focus:outline-none",
                  activeIndex === addVendorOptionIndex && "bg-muted",
                )}
                onMouseEnter={() => setActiveIndex(addVendorOptionIndex)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  openAddVendor();
                }}
              >
                <Plus className="size-4" />
                Add &quot;{trimmedQuery}&quot; as new vendor
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedVendor ? (
        <p className="text-xs text-muted-foreground">
          Selected {vendorMeta(selectedVendor)}
        </p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new_vendor_name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new_vendor_name"
                placeholder="Vendor name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormErrors((current) => ({
                    ...current,
                    name: undefined,
                    form: undefined,
                  }));
                }}
                disabled={pending}
                aria-invalid={Boolean(formErrors.name)}
              />
              {formErrors.name ? (
                <p className="text-xs text-destructive">
                  {formErrors.name}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new_vendor_contact_name">Contact Name</Label>
              <Input
                id="new_vendor_contact_name"
                placeholder="Contact name"
                value={contactName}
                onChange={(e) => {
                  setContactName(e.target.value);
                  setFormErrors((current) => ({
                    ...current,
                    form: undefined,
                  }));
                }}
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new_vendor_email">Email</Label>
              <Input
                id="new_vendor_email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormErrors((current) => ({
                    ...current,
                    email: undefined,
                    form: undefined,
                  }));
                }}
                disabled={pending}
                aria-invalid={Boolean(formErrors.email)}
              />
              {formErrors.email ? (
                <p className="text-xs text-destructive">
                  {formErrors.email}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new_vendor_phone">Phone</Label>
              <Input
                id="new_vendor_phone"
                placeholder="Phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setFormErrors((current) => ({
                    ...current,
                    form: undefined,
                  }));
                }}
                disabled={pending}
              />
            </div>
            {formErrors.form ? (
              <p className="text-sm text-destructive">{formErrors.form}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={addVendor}
            >
              {pending ? (
                <>
                  <Loader2 className={cn("animate-spin")} />
                  Saving...
                </>
              ) : (
                "Add Vendor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
