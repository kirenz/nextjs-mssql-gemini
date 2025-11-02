// src/components/analytics/query-input.tsx
'use client';

import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from 'react-markdown';
import { VisualizationPanel } from './visualization-panel';
import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const exampleQuestions = [
  "What is the total revenue by country in 2022?",
  "Show me the trend of gross profit by month in 2022",
  "Which product categories generate the highest revenue?",
  "Compare sales across different product lines",
  "What are the monthly sales trends for each product category?"
];

interface QueryResponse {
  response: string;
  data: any[];
  columns: string[];
  sql_query: string;
  visualization?: {
    type: 'bar' | 'line' | 'multiple' | 'scatter' | 'pie';
    x_axis: string;
    y_axis: string[];
    split: boolean;
    format?: {
      prefix?: string;
      suffix?: string;
    };
  };
  error?: string;
}

export function QueryInput() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        let message = 'Failed to process query';

        try {
          const errorData = await res.json();
          message =
            errorData.error ||
            errorData.detail ||
            `Request failed with status ${res.status}`;
        } catch (_err) {
          message = `Request failed with status ${res.status}`;
        }

        setError(message);
        return;
      }

      const data = await res.json();
      setResponse(data);
      
    } catch (error) {
      console.error('Error processing query:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (question: string) => {
    setQuery(question);
  };

  const visualizationConfig = useMemo(() => {
    if (!response || !response.visualization) {
      return undefined;
    }

    const { type, x_axis, y_axis, split, format } = response.visualization;
    const safeYAxis = Array.isArray(y_axis) ? y_axis.filter(Boolean) : [];

    return {
      type: type ?? 'bar',
      x_axis: x_axis ?? response.columns[0] ?? '',
      y_axis: safeYAxis.length > 0 ? safeYAxis : response.columns.slice(1),
      split: Boolean(split),
      format,
    };
  }, [response]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your data..."
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Processing..." : "Ask"}
            </Button>
          </div>
        </form>
        <div className="mt-4">
          <p className="text-sm text-slate-500 mb-2">Example questions:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(question)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-3 py-1 rounded-full"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-red-50">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {response && (
        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Analysis</h3>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{response.response}</ReactMarkdown>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">SQL Query</h3>
            <pre className="bg-slate-100 p-3 rounded-md overflow-x-auto">
              {response.sql_query}
            </pre>
          </Card>

          {response.data && response.data.length > 0 && (
            <>
              <VisualizationPanel 
                data={response.data}
                columns={response.columns}
                config={visualizationConfig}
              />

              <Card className="p-4">
                <h3 className="font-semibold mb-2">Data Table</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {response.columns.map((column) => (
                          <TableHead key={column} className="font-semibold">
                            {column}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {response.data.map((row, i) => (
                        <TableRow key={i}>
                          {response.columns.map((column) => (
                            <TableCell key={column}>
                              {typeof row[column] === 'number' 
                                ? row[column].toLocaleString()
                                : row[column]?.toString()}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Total rows: {response.data.length}
                </p>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
