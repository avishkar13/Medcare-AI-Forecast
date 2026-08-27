"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForecastSkus } from "@/hooks/use-forecast";
import type { ForecastTableItem } from "@/types/forecast";
import { Search, TrendingUp, TrendingDown, Minus, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useForecastScope } from "@/store/filters.store";
import { QueryError } from "@/components/ui/query-state";

export function ForecastSkuTable() {
  const scope = useForecastScope();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all categories");
  const [trend, setTrend] = useState("all trends");
  const [risk, setRisk] = useState("all risks");

  const { data, isPending, isError } = useForecastSkus(scope);

  // per-sku accuracy, confidence and trend are not broken out by the api
  const items = (data?.items ?? []).map((row) => ({
    id: row.sku,
    product: row.name,
    category: row.category,
    currentDemand: 0,
    forecastDemand: row.forecastDemand,
    growth: 0,
    accuracy: 0,
    confidence: 0,
    trend: "stable" as ForecastTableItem["trend"],
    risk: (row.criticality === "CRITICAL"
      ? "critical"
      : row.criticality === "HIGH"
        ? "high"
        : "low") as ForecastTableItem["risk"],
  }));

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search || item.product.toLowerCase().includes(search.toLowerCase()) || item.id.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "all categories" || item.category === category;
      const matchTrend = trend === "all trends" || item.trend === trend;
      const matchRisk = risk === "all risks" || item.risk === risk;
      return matchSearch && matchCategory && matchTrend && matchRisk;
    });
  }, [items, search, category, trend, risk]);

  if (isPending) return null;
  if (isError) return <QueryError label="the SKU forecast" />;

  const resetFilters = () => {
    setSearch("");
    setCategory("all categories");
    setTrend("all trends");
    setRisk("all risks");
  };

  const getTrendIcon = (t: string) => {
    if (t === "Growing") return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (t === "Declining") return <TrendingDown className="h-4 w-4 text-ai" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getRiskBadge = (r: string) => {
    switch (r) {
      case "Critical": return <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs rounded-full font-medium">Critical</span>;
      case "High": return <span className="px-2 py-1 bg-warning/20 text-warning text-xs rounded-full font-medium">High</span>;
      case "Medium": return <span className="px-2 py-1 bg-muted text-foreground text-xs rounded-full font-medium">Medium</span>;
      case "Low": return <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-full font-medium">Low</span>;
      default: return null;
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Forecast by SKU</CardTitle>
        <CardDescription>Detailed prediction breakdown for all monitored products</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by SKU or product name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <div className="flex gap-2">
            <Select value={category} onValueChange={(val) => setCategory(val as string)}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Cardiovascular">Cardiovascular</SelectItem>
                <SelectItem value="Gastrointestinal">Gastrointestinal</SelectItem>
                <SelectItem value="Analgesics">Analgesics</SelectItem>
                <SelectItem value="Antihistamines">Antihistamines</SelectItem>
                <SelectItem value="Antibiotics">Antibiotics</SelectItem>
              </SelectContent>
            </Select>
            <Select value={trend} onValueChange={(val) => setTrend(val as string)}>
              <SelectTrigger className="w-[120px] bg-background">
                <SelectValue placeholder="Trend" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trends</SelectItem>
                <SelectItem value="Growing">Growing</SelectItem>
                <SelectItem value="Stable">Stable</SelectItem>
                <SelectItem value="Declining">Declining</SelectItem>
              </SelectContent>
            </Select>
            <Select value={risk} onValueChange={(val) => setRisk(val as string)}>
              <SelectTrigger className="w-[120px] bg-background">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            {(search || category !== "all" || trend !== "all" || risk !== "all") && (
              <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset filters">
                <FilterX className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Product / SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Current Demand</TableHead>
                <TableHead className="text-right">Forecast Demand</TableHead>
                <TableHead className="text-right">Growth</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
                <TableHead className="text-center">Trend</TableHead>
                <TableHead className="text-center">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No matching products found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="font-medium">{item.product}</p>
                      <p className="text-xs text-muted-foreground">{item.id}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-right font-medium">{item.currentDemand}</TableCell>
                    <TableCell className="text-right font-medium text-ai">{item.forecastDemand}</TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-medium ${item.growth > 0 ? 'text-destructive' : item.growth < 0 ? 'text-ai' : 'text-muted-foreground'}`}>
                        {item.growth > 0 ? '+' : ''}{item.growth}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium">{item.accuracy}%</span>
                        <span className="text-xs text-muted-foreground text-nowrap">Conf: {item.confidence}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center" title={item.trend}>
                        {getTrendIcon(item.trend)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getRiskBadge(item.risk)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
