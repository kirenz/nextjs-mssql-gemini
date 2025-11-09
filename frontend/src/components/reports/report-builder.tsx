'use client';

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ReactMarkdown from "react-markdown";

type FilterOptions = {
  sales_organisations: string[];
  countries: string[];
  regions: string[];
  states: string[];
  cities: string[];
  product_lines: string[];
  product_categories: string[];
};

type ForecastFilters = {
  sales_org: string;
  country: string;
  region: string;
  state: string;
  city: string;
  product_line: string;
  product_category: string;
};

type FilterKey = keyof ForecastFilters;

interface SeriesPoint {
  date: string;
  revenue: number;
  sales_amount: number;
}

interface ForecastPoint {
  date: string;
  forecast: number;
  lower: number;
  upper: number;
}

interface SeasonalityPoint {
  year: number;
  month: number;
  label: string;
  revenue: number;
}

interface ForecastResponse {
  summary: string;
  filters: Record<string, string>;
  metrics: {
    data_points: number;
    forecast_periods: number;
    confidence_interval: number;
    mape: number | null;
    latest_historical: number;
    latest_forecast: number | null;
  };
  historical_series: SeriesPoint[];
  forecast_series: ForecastPoint[];
  seasonality_series: SeasonalityPoint[];
  forecast_table: ForecastPoint[];
  charts?: {
    historical?: string | null;
    forecast?: string | null;
    seasonal?: string | null;
  };
  explanation?: string | null;
}

const DEFAULT_FILTERS: ForecastFilters = {
  sales_org: "All",
  country: "All",
  region: "All",
  state: "All",
  city: "All",
  product_line: "All",
  product_category: "All",
};

const EMPTY_OPTIONS: FilterOptions = {
  sales_organisations: ["All"],
  countries: ["All"],
  regions: ["All"],
  states: ["All"],
  cities: ["All"],
  product_lines: ["All"],
  product_categories: ["All"],
};

const OPTION_KEY_MAP: Record<FilterKey, keyof FilterOptions> = {
  sales_org: "sales_organisations",
  country: "countries",
  region: "regions",
  state: "states",
  city: "cities",
  product_line: "product_lines",
  product_category: "product_categories",
};

const DEPENDENT_FIELDS: FilterKey[] = [
  "sales_org",
  "country",
  "region",
  "state",
  "product_line",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return currencyFormatter.format(value);
};

const toDisplayDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: SelectFieldProps) {
  return (
    <label htmlFor={id} className="space-y-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select
        id={id}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReportBuilder() {
  const [filters, setFilters] = useState<ForecastFilters>({ ...DEFAULT_FILTERS });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_OPTIONS);
  const [forecastPeriods, setForecastPeriods] = useState(12);
  const [confidenceInterval, setConfidenceInterval] = useState(0.95);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingPptx, setIsDownloadingPptx] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ForecastResponse | null>(null);

  const sanitizeSelections = useCallback(
    (current: ForecastFilters, options: FilterOptions): ForecastFilters => {
      const next = { ...current };
      (Object.keys(current) as FilterKey[]).forEach((key) => {
        const optionKey = OPTION_KEY_MAP[key];
        const validOptions = options[optionKey] || [];
        if (!validOptions.includes(next[key])) {
          next[key] = "All";
        }
      });
      return next;
    },
    [],
  );

  const fetchFilters = useCallback(
    async (effectiveFilters: ForecastFilters) => {
      const params = new URLSearchParams();
      const appendParam = (field: FilterKey, paramName?: string) => {
        const value = effectiveFilters[field];
        if (value && value !== "All") {
          params.append(paramName ?? field, value);
        }
      };

      appendParam("sales_org");
      appendParam("country");
      appendParam("region");
      appendParam("state");
      appendParam("product_line");

      const query = params.toString();
      const url = query ? `/api/reports/filters?${query}` : "/api/reports/filters";

      try {
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          setError(
            data?.error || data?.detail || "Failed to load report filters",
          );
          return;
        }
        setFilterOptions(data);
        setFilters((current) => sanitizeSelections(current, data));
      } catch (err) {
        console.error("Failed to load filters", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load report filters",
        );
      }
    },
    [sanitizeSelections],
  );

  useEffect(() => {
    void fetchFilters(DEFAULT_FILTERS);
  }, [fetchFilters]);

  const cascadeFilters = (field: FilterKey, value: string): ForecastFilters => {
    const next = { ...filters, [field]: value };
    switch (field) {
      case "sales_org":
        next.country = "All";
        next.region = "All";
        next.state = "All";
        next.city = "All";
        break;
      case "country":
        next.region = "All";
        next.state = "All";
        next.city = "All";
        break;
      case "region":
        next.state = "All";
        next.city = "All";
        break;
      case "state":
        next.city = "All";
        break;
      case "product_line":
        next.product_category = "All";
        break;
      default:
        break;
    }
    return next;
  };

  const handleFilterChange = (field: FilterKey, value: string) => {
    const next = cascadeFilters(field, value);
    setFilters(next);
    if (DEPENDENT_FIELDS.includes(field)) {
      void fetchFilters(next);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    const payload = buildRequestPayload();

    try {
      const response = await fetch("/api/reports/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.detail || "Forecast failed");
      }
      setResult(data);
    } catch (err) {
      console.error("Failed to generate report", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate report",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result || result.forecast_table.length === 0) return;
    const header = "Date,Forecast,Lower,Upper";
    const rows = result.forecast_table.map(
      (row) =>
        `${row.date},${row.forecast.toFixed(2)},${row.lower.toFixed(2)},${row.upper.toFixed(2)}`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "forecast_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildRequestPayload = () => {
    const normalize = (value: string) => (value === "All" ? null : value);
    return {
      sales_org: normalize(filters.sales_org),
      country: normalize(filters.country),
      region: normalize(filters.region),
      state: normalize(filters.state),
      city: normalize(filters.city),
      product_line: normalize(filters.product_line),
      product_category: normalize(filters.product_category),
      forecast_periods: forecastPeriods,
      confidence_interval: confidenceInterval,
    };
  };

  const handleDownloadPptx = async () => {
    if (!result) {
      setError("Bitte zunächst eine Prognose erstellen, bevor Sie den Bericht herunterladen.");
      return;
    }
    setIsDownloadingPptx(true);
    setError(null);
    try {
      const response = await fetch("/api/reports/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload()),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || data.detail || "Failed to download PPTX report",
        );
      }

      const blob = await response.blob();
      const disposition =
        response.headers.get("Content-Disposition") ||
        response.headers.get("content-disposition");
      const match = disposition?.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] || "sales_forecast_report.pptx";

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to download PPTX report",
      );
    } finally {
      setIsDownloadingPptx(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Select filters</h2>
          <p className="text-sm text-slate-500">
            Choose the sales slice you want to analyse before generating the
            forecast.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            id="sales-org"
            label="Sales Organization"
            value={filters.sales_org}
            options={filterOptions.sales_organisations}
            onChange={(value) => handleFilterChange("sales_org", value)}
          />
          <SelectField
            id="country"
            label="Country"
            value={filters.country}
            options={filterOptions.countries}
            onChange={(value) => handleFilterChange("country", value)}
          />
          <SelectField
            id="region"
            label="Region"
            value={filters.region}
            options={filterOptions.regions}
            onChange={(value) => handleFilterChange("region", value)}
          />
          <SelectField
            id="state"
            label="State"
            value={filters.state}
            options={filterOptions.states}
            onChange={(value) => handleFilterChange("state", value)}
          />
          <SelectField
            id="city"
            label="City"
            value={filters.city}
            options={filterOptions.cities}
            onChange={(value) => handleFilterChange("city", value)}
          />
          <SelectField
            id="product-line"
            label="Product Line"
            value={filters.product_line}
            options={filterOptions.product_lines}
            onChange={(value) => handleFilterChange("product_line", value)}
          />
          <SelectField
            id="product-category"
            label="Product Category"
            value={filters.product_category}
            options={filterOptions.product_categories}
            onChange={(value) => handleFilterChange("product_category", value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Forecast Periods (months)</span>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={forecastPeriods}
                onChange={(event) => setForecastPeriods(Number(event.target.value))}
                className="w-full"
              />
              <span className="w-10 text-right text-sm font-semibold text-slate-700">
                {forecastPeriods}
              </span>
            </div>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Confidence Interval</span>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min={0.8}
                max={0.99}
                step={0.01}
                value={confidenceInterval}
                onChange={(event) =>
                  setConfidenceInterval(Number(event.target.value))
                }
                className="w-full"
              />
              <span className="w-14 text-right text-sm font-semibold text-slate-700">
                {(confidenceInterval * 100).toFixed(0)}%
              </span>
            </div>
          </label>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? "Building report..." : "Generate Report"}
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 text-red-700">
          <p>{error}</p>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          <Card className="p-5 space-y-3">
            <h3 className="text-lg font-semibold">Summary</h3>
            <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">
              {result.summary}
            </pre>
          </Card>

          {result.explanation && (
            <Card className="p-5 space-y-3">
              <h3 className="text-lg font-semibold">Gemini insights</h3>
              <div className="prose prose-sm max-w-none text-slate-800">
                <ReactMarkdown>{result.explanation}</ReactMarkdown>
              </div>
            </Card>
          )}

          {result.charts &&
            (result.charts.historical ||
              result.charts.forecast ||
              result.charts.seasonal) && (
              <div className="grid gap-4 lg:grid-cols-3">
                {result.charts.historical && (
                  <Card className="p-4 space-y-3">
                    <h3 className="text-base font-semibold">
                      Historical Sales
                    </h3>
                    <div className="rounded-md border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.charts.historical}
                        alt="Historical performance chart"
                        className="h-auto w-full rounded-md object-contain"
                      />
                    </div>
                  </Card>
                )}
                {result.charts.forecast && (
                  <Card className="p-4 space-y-3">
                    <h3 className="text-base font-semibold">Forecast</h3>
                    <div className="rounded-md border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.charts.forecast}
                        alt="Forecast chart"
                        className="h-auto w-full rounded-md object-contain"
                      />
                    </div>
                  </Card>
                )}
                {result.charts.seasonal && (
                  <Card className="p-4 space-y-3">
                    <h3 className="text-base font-semibold">
                      Seasonal Patterns
                    </h3>
                    <div className="rounded-md border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.charts.seasonal}
                        alt="Seasonality chart"
                        className="h-auto w-full rounded-md object-contain"
                      />
                    </div>
                  </Card>
                )}
              </div>
            )}

          <Card className="p-5 space-y-4">
            <h3 className="text-lg font-semibold">Key metrics</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-md border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Data points</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {result.metrics.data_points.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Forecast periods</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {result.metrics.forecast_periods}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Confidence interval</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {(result.metrics.confidence_interval * 100).toFixed(0)}%
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-4">
                <p className="text-sm text-slate-500">MAPE</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {result.metrics.mape !== null
                    ? `${result.metrics.mape.toFixed(2)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Latest actual</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {formatCurrency(result.metrics.latest_historical)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Latest forecast</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {formatCurrency(result.metrics.latest_forecast)}
                </p>
              </div>
            </div>
          </Card>

          {result.forecast_table.length > 0 && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Forecast table</h3>
                  <p className="text-sm text-slate-500">
                    Inspect the point forecast with lower/upper bounds.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleDownload}>
                    Download CSV
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleDownloadPptx}
                    disabled={isDownloadingPptx}
                  >
                    {isDownloadingPptx ? "Building PPTX..." : "Download PPTX"}
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Forecast</TableHead>
                      <TableHead>Lower</TableHead>
                      <TableHead>Upper</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.forecast_table.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{toDisplayDate(row.date)}</TableCell>
                        <TableCell>{formatCurrency(row.forecast)}</TableCell>
                        <TableCell>{formatCurrency(row.lower)}</TableCell>
                        <TableCell>{formatCurrency(row.upper)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
