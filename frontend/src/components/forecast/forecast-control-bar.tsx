"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, BrainCircuit, Activity, LineChart, TrendingUp } from "lucide-react";

export function ForecastControlBar() {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <span className="text-sm font-medium hidden sm:block mr-2">Filters:</span>
          </div>
          
          <Select defaultValue="All Products">
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Select SKU" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all Products">All Products</SelectItem>
              <SelectItem value="SKU-LIS-10">Lisinopril 10mg</SelectItem>
              <SelectItem value="SKU-OME-20">Omeprazole 20mg</SelectItem>
              <SelectItem value="SKU-AMX-500">Amoxicillin 500mg</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="All Categories">
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="cardio">Cardiovascular</SelectItem>
              <SelectItem value="gi">Gastrointestinal</SelectItem>
              <SelectItem value="anti">Antibiotics</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="All DCs">
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Distribution Center" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All DCs (Network)</SelectItem>
              <SelectItem value="dc1">Northeast DC</SelectItem>
              <SelectItem value="dc2">South DC</SelectItem>
              <SelectItem value="dc3">West Coast DC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-border">
          <span className="text-sm font-medium hidden lg:block text-muted-foreground mr-1">Model:</span>
          <Select defaultValue="ai">
            <SelectTrigger className="w-[180px] h-9 font-medium text-ai border-ai/30 bg-ai/5">
              <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ai">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  <span>AI Ensemble</span>
                </div>
              </SelectItem>
              <SelectItem value="seasonal">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Seasonal Forecast</span>
                </div>
              </SelectItem>
              <SelectItem value="ma">
                <div className="flex items-center gap-2">
                  <LineChart className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Moving Average</span>
                </div>
              </SelectItem>
              <SelectItem value="exp">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Exponential Smoothing</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9 w-full md:w-auto">
            Generate Forecast
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
