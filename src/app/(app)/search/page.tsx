import { SearchClient } from "@/app/(app)/search/search-client";

export default function SearchPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Skill search</h1>
        <p className="text-sm text-muted-foreground">
          Enter a job title. We infer the skills it needs, you confirm them, then we rank the
          whole bench by their parsed skills.
        </p>
      </div>
      <SearchClient />
    </div>
  );
}
