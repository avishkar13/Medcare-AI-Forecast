"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FilterX, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
// import { RecommendationPriority, RecommendationActionType, RecommendationStatus } from "@/types/recommendation";

interface RecommendationsFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;
  actionType: string;
  setActionType: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
}

export function RecommendationsFilters({
  search, setSearch, priority, setPriority, actionType, setActionType, 
  location, setLocation, status, setStatus, sortBy, setSortBy
}: RecommendationsFiltersProps) {

  const hasFilters = search || priority !== "all priority" || actionType !== "all actions" || location !== "all locations" || status !== "Pending";

  const resetFilters = () => {
    setSearch("");
    setPriority("all priority");
    setActionType("all actions");
    setLocation("all locations");
    setStatus("Pending");
    setSortBy("priority");
  };

  return (
    <div className="flex flex-col xl:flex-row gap-3 mb-6 p-3 bg-background border border-border/50 rounded-xl shadow-sm">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search recommendations..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-ai text-sm transition-colors"
        />
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        <Select value={priority} onValueChange={(val) => setPriority(val as string)}>
          <SelectTrigger className={`w-[130px] h-9 text-xs font-medium border-border/50 ${priority !== "all priority" ? "bg-ai/10 border-ai/20 text-ai" : "bg-background hover:bg-muted/50"}`}>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all priority">All Priorities</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={actionType} onValueChange={(val) => setActionType(val as string)}>
          <SelectTrigger className={`w-[130px] h-9 text-xs font-medium border-border/50 ${actionType !== "all actions" ? "bg-ai/10 border-ai/20 text-ai" : "bg-background hover:bg-muted/50"}`}>
            <SelectValue placeholder="Action Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all actions">All Actions</SelectItem>
            <SelectItem value="Replenish">Replenish</SelectItem>
            <SelectItem value="Transfer">Transfer</SelectItem>
            <SelectItem value="Reduce">Reduce</SelectItem>
            <SelectItem value="Prioritize">Prioritize</SelectItem>
          </SelectContent>
        </Select>

        <Select value={location} onValueChange={(val) => setLocation(val as string)}>
          <SelectTrigger className={`w-[140px] h-9 text-xs font-medium border-border/50 ${location !== "all locations" ? "bg-ai/10 border-ai/20 text-ai" : "bg-background hover:bg-muted/50"}`}>
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all locations">All Locations</SelectItem>
            <SelectItem value="Northeast DC">Northeast DC</SelectItem>
            <SelectItem value="South DC">South DC</SelectItem>
            <SelectItem value="West Coast DC">West Coast DC</SelectItem>
            <SelectItem value="Midwest DC">Midwest DC</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(val) => setStatus(val as string)}>
          <SelectTrigger className={`w-[120px] h-9 text-xs font-medium border-border/50 ${status !== "all statuses" ? "bg-ai/10 border-ai/20 text-ai" : "bg-background hover:bg-muted/50"}`}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Executed">Executed</SelectItem>
            <SelectItem value="Dismissed">Dismissed</SelectItem>
            <SelectItem value="all statuses">All Statuses</SelectItem>
          </SelectContent>
        </Select>

        <div className="h-5 w-px bg-border hidden sm:block mx-0.5"></div>

        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
          <Select value={sortBy} onValueChange={(val) => setSortBy(val as string)}>
            <SelectTrigger className="w-[140px] h-9 text-xs font-semibold bg-background border-border/50 hover:bg-muted/50 transition-colors">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Sort by Priority</SelectItem>
              <SelectItem value="confidence">Sort by Confidence</SelectItem>
              <SelectItem value="impact">Sort by Impact</SelectItem>
              <SelectItem value="newest">Sort by Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-2 text-muted-foreground hover:text-foreground shrink-0 transition-colors" title="Clear filters">
            <FilterX className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline text-xs font-medium">Clear</span>
          </Button>
        )}
      </div>
    </div>
  );
}
