"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LogsTabs({ currentTab }: { currentTab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    // When changing tabs, we might want to clear other filters because they are tab-specific
    params.delete("entity_id");
    params.delete("action");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-4 md:w-[400px]">
        <TabsTrigger value="candidate">Candidates</TabsTrigger>
        <TabsTrigger value="requirement">Requirements</TabsTrigger>
        <TabsTrigger value="submission">Submissions</TabsTrigger>
        <TabsTrigger value="vendor">Vendors</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function LogsFilters({
  entities,
  actions,
  entityLabel,
}: {
  entities: { id: string; name: string }[];
  actions: string[];
  entityLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all" || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // ensure tab is preserved
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = () => {
    const params = new URLSearchParams();
    const tab = searchParams.get("tab");
    if (tab) params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {entityLabel}
        </label>
        <Select
          value={searchParams.get("entity_id") || "all"}
          onValueChange={(val) => handleFilter("entity_id", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`All ${entityLabel.toLowerCase()}s`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {entityLabel.toLowerCase()}s</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Action
        </label>
        <Select
          value={searchParams.get("action") || "all"}
          onValueChange={(val) => handleFilter("action", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          From Date
        </label>
        <Input
          type="date"
          value={searchParams.get("from") || ""}
          onChange={(e) => handleFilter("from", e.target.value)}
        />
      </div>

      <div className="flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          To Date
        </label>
        <Input
          type="date"
          value={searchParams.get("to") || ""}
          onChange={(e) => handleFilter("to", e.target.value)}
        />
      </div>

      <div className="pb-[1px]">
        <Button variant="outline" onClick={handleClear} className="w-full sm:w-auto">
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
