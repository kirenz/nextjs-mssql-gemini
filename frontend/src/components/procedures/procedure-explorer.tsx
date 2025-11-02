// src/components/procedures/procedure-explorer.tsx
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCcw, PlayCircle } from "lucide-react";

type ProcedureSummary = {
  schema: string;
  name: string;
  has_parameters: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  definition_snippet?: string | null;
};

type ProcedureParameter = {
  name: string;
  short_name: string;
  data_type?: string | null;
  max_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  mode?: string | null;
  is_result?: boolean;
  is_required?: boolean;
};

type ProcedureDetails = {
  schema: string;
  name: string;
  definition: string;
  parameters: ProcedureParameter[];
};

type ProcedureExecutionResult = {
  schema: string;
  name: string;
  columns: string[];
  data: Record<string, unknown>[];
  row_count: number | null;
  duration_ms: number;
  parameters_used: Record<string, unknown>;
};

const makeKey = (schema: string, name: string) => `${schema}.${name}`;

const QUICK_START_PROCEDURE: ProcedureSummary = {
  schema: "sys",
  name: "sp_help",
  has_parameters: false,
  definition_snippet: "Returns metadata about database objects in the current database.",
};

const QUICK_START_KEY = makeKey(
  QUICK_START_PROCEDURE.schema,
  QUICK_START_PROCEDURE.name,
);

export function ProcedureExplorer() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [procedures, setProcedures] = React.useState<ProcedureSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [selectedSummary, setSelectedSummary] =
    React.useState<ProcedureSummary | null>(null);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const [detailsCache, setDetailsCache] = React.useState<
    Record<string, ProcedureDetails>
  >({});
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [detailsError, setDetailsError] = React.useState<string | null>(null);

  const [parameterValues, setParameterValues] = React.useState<
    Record<string, string>
  >({});
  const parameterDraftsRef = React.useRef<
    Record<string, Record<string, string>>
  >({});

  const [isExecuting, setIsExecuting] = React.useState(false);
  const [executionError, setExecutionError] = React.useState<string | null>(
    null,
  );
  const [executionResult, setExecutionResult] =
    React.useState<ProcedureExecutionResult | null>(null);

  const fetchProcedures = React.useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const response = await fetch("/api/procedures", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        const message =
          data?.detail ||
          data?.error ||
          "Unable to load stored procedures from the server.";
        throw new Error(message);
      }

      const fetched = Array.isArray(data)
        ? (data as ProcedureSummary[])
        : [];
      const withoutQuickStart = fetched.filter(
        (procedure) => makeKey(procedure.schema, procedure.name) !== QUICK_START_KEY,
      );
      setProcedures([QUICK_START_PROCEDURE, ...withoutQuickStart]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load stored procedures.";
      setListError(message);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const fetchProcedureDetails = React.useCallback(
    async (summary: ProcedureSummary) => {
      const key = makeKey(summary.schema, summary.name);
      setDetailsLoading(true);
      setDetailsError(null);

      try {
        const response = await fetch(
          `/api/procedures/${encodeURIComponent(
            summary.schema,
          )}/${encodeURIComponent(summary.name)}`,
          {
            cache: "no-store",
          },
        );
        const data = await response.json();

        if (!response.ok) {
          const message =
            data?.detail ||
            data?.error ||
            `Unable to load stored procedure ${summary.schema}.${summary.name}.`;
          throw new Error(message);
        }

        const parsed = data as ProcedureDetails;
        setDetailsCache((prev) => ({
          ...prev,
          [key]: parsed,
        }));
        return parsed;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load stored procedure details.";
        setDetailsError(message);
        return undefined;
      } finally {
        setDetailsLoading(false);
      }
    },
    [setExecutionError, setExecutionResult, setIsExecuting],
  );

  React.useEffect(() => {
    fetchProcedures();
  }, [fetchProcedures]);

  React.useEffect(() => {
    if (!selectedKey) {
      setParameterValues({});
      return;
    }

    const cachedDraft = parameterDraftsRef.current[selectedKey];
    if (cachedDraft) {
      setParameterValues(cachedDraft);
      return;
    }

    const details = detailsCache[selectedKey];
    if (!details) {
      setParameterValues({});
      return;
    }

    const initialValues = details.parameters.reduce<Record<string, string>>(
      (acc, param) => {
        acc[param.short_name] = "";
        return acc;
      },
      {},
    );
    setParameterValues(initialValues);
  }, [selectedKey, detailsCache]);

  const filteredProcedures = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return procedures;
    }

    return procedures.filter((procedure) => {
      const identifier = `${procedure.schema}.${procedure.name}`.toLowerCase();
      const snippet = procedure.definition_snippet?.toLowerCase() ?? "";
      return identifier.includes(query) || snippet.includes(query);
    });
  }, [procedures, searchTerm]);

  const executeProcedure = React.useCallback(
    async (
      summary: ProcedureSummary,
      parameters: Record<string, string>,
    ) => {
      setIsExecuting(true);
      setExecutionError(null);
      setExecutionResult(null);

      const filteredParameters = Object.fromEntries(
        Object.entries(parameters).filter(
          ([, value]) => value !== undefined && value !== null && value !== "",
        ),
      );

      try {
        const response = await fetch(
          `/api/procedures/${encodeURIComponent(
            summary.schema,
          )}/${encodeURIComponent(summary.name)}/execute`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ parameters: filteredParameters }),
          },
        );

        const data = await response.json();
        if (!response.ok) {
          const message =
            data?.detail ||
            data?.error ||
            `Stored procedure ${summary.schema}.${summary.name} failed to execute.`;
          throw new Error(message);
        }

        setExecutionResult(data as ProcedureExecutionResult);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to execute stored procedure.";
        setExecutionError(message);
      } finally {
        setIsExecuting(false);
      }
    },
    [setExecutionError, setExecutionResult, setIsExecuting],
  );

  const handleSelect = React.useCallback(
    async (
      summary: ProcedureSummary,
      options?: { autoExecute?: boolean },
    ) => {
      if (selectedSummary && selectedKey) {
        parameterDraftsRef.current[selectedKey] = parameterValues;
      }

      const key = makeKey(summary.schema, summary.name);
      setSelectedSummary(summary);
      setSelectedKey(key);
      setDetailsError(null);
      setExecutionError(null);
      setExecutionResult(null);

      let details = detailsCache[key];
      if (!details) {
        details = await fetchProcedureDetails(summary);
      }

      if (!details) {
        return;
      }

      if (options?.autoExecute) {
        const hasRequired = details.parameters.some(
          (param) => param.is_required,
        );
        if (hasRequired) {
          return;
        }
        await executeProcedure(summary, {});
      }
    },
    [
      selectedSummary,
      selectedKey,
      parameterValues,
      detailsCache,
      fetchProcedureDetails,
      executeProcedure,
    ],
  );

  const handleRefresh = () => {
    fetchProcedures();
  };

  const handleQuickStart = () => {
    setSearchTerm("");
    void handleSelect(QUICK_START_PROCEDURE, { autoExecute: true });
  };

  const selectedDetails = selectedKey ? detailsCache[selectedKey] : undefined;

  const handleParameterChange = (name: string, value: string) => {
    setParameterValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResetParameters = () => {
    if (!selectedDetails) {
      setParameterValues({});
      return;
    }

    const resetValues = selectedDetails.parameters.reduce<
      Record<string, string>
    >((acc, param) => {
      acc[param.short_name] = "";
      return acc;
    }, {});
    setParameterValues(resetValues);
  };

  const handleExecute = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSummary || !selectedDetails) {
      return;
    }

    const hasMissingRequired = selectedDetails.parameters.some((param) => {
      if (!param.is_required) {
        return false;
      }
      const value = parameterValues[param.short_name];
      return value === undefined || value === null || value === "";
    });

    if (hasMissingRequired) {
      setExecutionError(
        "Please provide values for all required parameters before running this procedure.",
      );
      setExecutionResult(null);
      return;
    }

    await executeProcedure(selectedSummary, parameterValues);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardHeader className="pb-4">
          <CardTitle>Stored Procedures</CardTitle>
          <CardDescription>
            Browse available procedures and pick one to inspect or run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-blue-900">
                  Want to see it in action?
                </p>
                <p className="mt-1 text-sm text-blue-800">
                  Run the sample procedure <code>sys.sp_help</code> to fetch metadata about the current database. No parameters required.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleQuickStart}
                disabled={isLoadingList || isExecuting}
              >
                Try sample
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Filter by name or snippet..."
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoadingList}
            >
              {isLoadingList ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span className="sr-only">Refresh list</span>
            </Button>
          </div>

          {listError && (
            <Alert variant="destructive">
              <AlertTitle>Unable to load procedures</AlertTitle>
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          )}

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {isLoadingList && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading stored procedures...
              </div>
            )}
            {!isLoadingList && filteredProcedures.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No stored procedures match your search.
              </p>
            )}
            {!isLoadingList &&
              filteredProcedures.map((procedure) => {
                const key = makeKey(procedure.schema, procedure.name);
                const isActive = key === selectedKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      void handleSelect(procedure);
                    }}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      isActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">
                        {procedure.schema}.{procedure.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {key === QUICK_START_KEY && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase text-blue-700">
                            Sample
                          </span>
                        )}
                        {procedure.has_parameters && (
                          <span className="text-xs font-medium uppercase text-blue-600">
                            Params
                          </span>
                        )}
                      </div>
                    </div>
                    {procedure.definition_snippet && (
                      <p className="mt-2 text-xs text-slate-500">
                        {procedure.definition_snippet}
                      </p>
                    )}
                  </button>
                );
              })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6 lg:col-span-8">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>
              {selectedSummary
                ? `${selectedSummary.schema}.${selectedSummary.name}`
                : "Procedure details"}
            </CardTitle>
            <CardDescription>
              Review definition and parameters, then execute with custom input.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedSummary && (
              <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground">
                Select a stored procedure from the list to view its definition
                and parameters.
              </p>
            )}

            {selectedSummary && detailsLoading && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading procedure details...
              </div>
            )}

            {selectedSummary && detailsError && (
              <Alert variant="destructive">
                <AlertTitle>Failed to load details</AlertTitle>
                <AlertDescription>{detailsError}</AlertDescription>
              </Alert>
            )}

            {selectedSummary && selectedDetails && !detailsLoading && (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Definition
                  </h3>
                  <pre className="max-h-64 overflow-y-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                    {selectedDetails.definition || "No definition available."}
                  </pre>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Parameters
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetParameters}
                      disabled={
                        Object.values(parameterValues).every((value) => value === "")
                      }
                    >
                      Reset
                    </Button>
                  </div>

                  {selectedDetails.parameters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      This stored procedure does not require any input
                      parameters.
                    </p>
                  ) : (
                    <form className="space-y-4" onSubmit={handleExecute}>
                      {selectedDetails.parameters.map((param) => {
                        const inputId = `${selectedDetails.schema}-${selectedDetails.name}-${param.short_name}`;
                        const helperParts = [
                          param.data_type ? `Type: ${param.data_type}` : null,
                          typeof param.max_length === "number" &&
                          param.max_length > 0
                            ? `Max length: ${param.max_length}`
                            : null,
                          param.is_required ? "Required" : "Optional",
                        ].filter(Boolean);

                        return (
                          <div key={param.short_name} className="space-y-1.5">
                            <label
                              className="text-sm font-medium text-slate-700"
                              htmlFor={inputId}
                            >
                              {param.name}
                            </label>
                            <Input
                              id={inputId}
                              value={parameterValues[param.short_name] ?? ""}
                              onChange={(event) =>
                                handleParameterChange(
                                  param.short_name,
                                  event.target.value,
                                )
                              }
                              placeholder={`Enter ${param.data_type ?? "value"}`}
                              aria-required={Boolean(param.is_required)}
                            />
                            <p className="text-xs text-muted-foreground">
                              {helperParts.join(" · ")}
                            </p>
                          </div>
                        );
                      })}

                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={isExecuting}>
                          {isExecuting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Run procedure
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Empty values are ignored for optional parameters.
                        </p>
                      </div>
                    </form>
                  )}
                </section>
              </>
            )}
          </CardContent>
        </Card>

        {executionError && (
          <Alert variant="destructive">
            <AlertTitle>Execution failed</AlertTitle>
            <AlertDescription>{executionError}</AlertDescription>
          </Alert>
        )}

        {executionResult && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Execution results</CardTitle>
              <CardDescription>
                Duration: {executionResult.duration_ms} ms
                {typeof executionResult.row_count === "number" && (
                  <span className="ml-2">
                    · Rows affected: {executionResult.row_count}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(executionResult.parameters_used ?? {}).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Parameters used:&nbsp;
                  {Object.entries(executionResult.parameters_used)
                    .map(([key, value]) => `${key}=${String(value)}`)
                    .join(", ")}
                </p>
              )}

              {executionResult.columns.length > 0 &&
              executionResult.data.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {executionResult.columns.map((column) => (
                          <TableHead key={column} className="font-semibold">
                            {column}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executionResult.data.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {executionResult.columns.map((column) => {
                            const value = row[column];
                            return (
                              <TableCell key={column}>
                                {typeof value === "number"
                                  ? value.toLocaleString()
                                  : value !== null && value !== undefined
                                  ? String(value)
                                  : ""}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Stored procedure executed successfully but did not return a
                  result set.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
