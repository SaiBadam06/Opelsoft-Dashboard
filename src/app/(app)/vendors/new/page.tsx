import { VendorForm } from "@/app/(app)/vendors/vendor-form";

export default function NewVendorPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">New vendor</h1>
        <p className="text-sm text-muted-foreground">
          Add a vendor that provides your job requirements.
        </p>
      </div>
      <VendorForm />
    </div>
  );
}
