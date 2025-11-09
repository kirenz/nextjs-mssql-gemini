// src/components/analytics/visualization-panel.tsx
'use client';

import { useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface VisualizationConfig {
  type: 'bar' | 'line' | 'multiple' | 'scatter' | 'pie';
  x_axis: string;
  y_axis: string[];
  split: boolean;
  format?: {
    prefix?: string;
    suffix?: string;
  };
}

interface VisualizationPanelProps {
  data: any[];
  columns: string[];
  config?: VisualizationConfig;
}

const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];

interface AngledTickProps {
  x: number;
  y: number;
  payload?: {
    value: string | number;
  };
}

const renderAngledTick = ({ x, y, payload }: AngledTickProps): JSX.Element => {
  const value = payload?.value;

  return (
    <text
      x={x}
      y={y}
      dy={16}
      textAnchor="end"
      transform={`rotate(-35 ${x} ${y})`}
    >
      {value != null ? String(value) : ''}
    </text>
  );
};

const normalizeKey = (key: string) => {
  if (!key) return "";
  return key
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
};

const simplifyKey = (key: string) => key.replace(/[_\s]/g, "").toLowerCase();

const coerceNumeric = (value: unknown) => {
  if (typeof value === "number" || value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const stripped = value.replace(/[, ]+/g, "").trim();
    if (!stripped) return value;
    const parsed = Number(stripped);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return value;
};

export function VisualizationPanel({ data, columns, config }: VisualizationPanelProps) {
  // Default config if none provided
  const defaultConfig: VisualizationConfig = {
    type: 'bar',
    x_axis: columns[0],
    y_axis: columns.slice(1),
    split: false,
    format: { prefix: '', suffix: '' }
  };

  const vizConfig = config || defaultConfig;
  const primaryYAxis = vizConfig.y_axis[0] || columns[1];

  const columnKeyMap = useMemo(() => {
    const map: Record<string, string> = {};

    columns.forEach((rawColumn) => {
      const column = rawColumn?.trim();
      if (!column) return;
      const normalized = normalizeKey(column);
      if (!normalized) return;

      const aliases = new Set<string>([
        column,
        column.toLowerCase(),
        column.replace(/[^\w]/g, "").toLowerCase(),
        normalized,
        simplifyKey(normalized),
      ]);

      if (rawColumn && rawColumn !== column) {
        aliases.add(rawColumn);
        aliases.add(rawColumn.toLowerCase());
        aliases.add(rawColumn.replace(/[^\w]/g, "").toLowerCase());
      }

      aliases.forEach((alias) => {
        if (alias) {
          map[alias] = normalized;
        }
      });
    });

    return map;
  }, [columns]);

  const normalizedData = useMemo(() => {
    if (!data) return [];
    return data.map((row) => {
      const normalizedRow: Record<string, unknown> = {};
      Object.entries(row || {}).forEach(([rawKey, value]) => {
        const key = rawKey.trim();
        const lowerKey = key.toLowerCase();
        const compactKey = key.replace(/[^\w]/g, "").toLowerCase();
        const normalizedKeyCandidate = normalizeKey(key);
        const simplifiedKey = normalizedKeyCandidate
          ? simplifyKey(normalizedKeyCandidate)
          : "";

        const normalizedKey =
          columnKeyMap[key] ||
          columnKeyMap[lowerKey] ||
          columnKeyMap[compactKey] ||
          (normalizedKeyCandidate ? columnKeyMap[normalizedKeyCandidate] : undefined) ||
          (simplifiedKey ? columnKeyMap[simplifiedKey] : undefined) ||
          normalizedKeyCandidate;
        if (normalizedKey) {
          normalizedRow[normalizedKey] = coerceNumeric(value);
        }
      });
      return normalizedRow;
    });
  }, [data, columnKeyMap]);

  const getDataKey = useCallback(
    (key?: string | null) => {
      if (!key) return undefined;
      const trimmed = key.trim();
      const lowerCased = trimmed.toLowerCase();
      const normalized = normalizeKey(trimmed);
      const simplified = normalized ? simplifyKey(normalized) : "";
      const compact = trimmed.replace(/[^\w]/g, "").toLowerCase();

      return (
        columnKeyMap[trimmed] ||
        columnKeyMap[lowerCased] ||
        columnKeyMap[compact] ||
        (normalized ? columnKeyMap[normalized] : undefined) ||
        (simplified ? columnKeyMap[simplified] : undefined) ||
        normalized ||
        undefined
      );
    },
    [columnKeyMap]
  );

  const safeXAxisKey = getDataKey(vizConfig.x_axis);
  const safePrimaryYAxis = getDataKey(primaryYAxis);
  const safeYAxis = useMemo(
    () =>
      vizConfig.y_axis
        .map((axis) => ({
          original: axis,
          key: getDataKey(axis),
        }))
        .filter((item): item is { original: string; key: string } => Boolean(item.key)),
    [vizConfig.y_axis, getDataKey]
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('VisualizationPanel', {
        vizConfig,
        safeXAxisKey,
        safePrimaryYAxis,
        safeYAxis,
        columns,
        normalizedDataLength: normalizedData.length,
        sampleRow: normalizedData[0] ?? null,
      });
    }
  }, [
    vizConfig,
    safeXAxisKey,
    safePrimaryYAxis,
    safeYAxis,
    columns,
    normalizedData,
  ]);

  const formatValue = (value: number) => {
    if (typeof value !== 'number') return value;
    
    let formatted = value;
    if (value >= 1000000) {
      formatted = value / 1000000;
      return `${vizConfig.format?.prefix || ''}${formatted.toFixed(1)}M${vizConfig.format?.suffix || ''}`;
    }
    if (value >= 1000) {
      formatted = value / 1000;
      return `${vizConfig.format?.prefix || ''}${formatted.toFixed(1)}K${vizConfig.format?.suffix || ''}`;
    }
    return `${vizConfig.format?.prefix || ''}${value.toFixed(0)}${vizConfig.format?.suffix || ''}`;
  };

  const renderChart = () => {
    if (!data || data.length === 0) {
      return <div className="flex h-full items-center justify-center">No data available</div>;
    }

    const estimatedWidth = Math.max(640, normalizedData.length * 160);

    switch (vizConfig.type) {
      case 'bar':
        if (!safeXAxisKey || safeYAxis.length === 0) {
          return <div className="flex h-full items-center justify-center">No numeric fields available for bar chart</div>;
        }
        return (
          <div className="overflow-x-auto">
            <div style={{ minWidth: estimatedWidth, height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={normalizedData}
                  margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey={safeXAxisKey}
                    interval={0}
                    tickFormatter={(value) => String(value)}
                    tick={renderAngledTick}
                    height={80}
                  />
                  <YAxis tickFormatter={formatValue} />
                  <Tooltip formatter={(value: number) => formatValue(value)} />
                  <Legend formatter={(value) => value.replace(/_/g, ' ')} />
                  {safeYAxis.map(({ key: axisKey, original }, index) => (
                    <Bar 
                      key={axisKey}
                      dataKey={axisKey}
                      name={original.replace(/_/g, ' ')}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'line':
        if (!safeXAxisKey || safeYAxis.length === 0) {
          return <div className="flex h-full items-center justify-center">No numeric fields available for line chart</div>;
        }
        return (
          <div className="overflow-x-auto">
            <div style={{ minWidth: estimatedWidth, height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={normalizedData}
                  margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey={safeXAxisKey}
                    interval={0}
                    tickFormatter={(value) => String(value)}
                    tick={renderAngledTick}
                    height={80}
                  />
                  <YAxis tickFormatter={formatValue} />
                  <Tooltip
                    formatter={formatValue}
                    labelFormatter={(label) => vizConfig.x_axis + ': ' + label}
                  />
                  <Legend />
                  {safeYAxis.map(({ key: axisKey, original }, index) => (
                    <Line
                      key={axisKey}
                      type="monotone"
                      dataKey={axisKey}
                      name={original.replace(/_/g, ' ')}
                      stroke={COLORS[index % COLORS.length]}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'scatter':
        if (!safeXAxisKey || !safePrimaryYAxis) {
          return <div className="flex h-full items-center justify-center">No numeric field available for scatter plot</div>;
        }
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart
              margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={safeXAxisKey}
                name={vizConfig.x_axis.replace(/_/g, ' ')}
              />
              <YAxis
                dataKey={safePrimaryYAxis}
                name={primaryYAxis.replace(/_/g, ' ')}
                tickFormatter={formatValue}
              />
              <Tooltip formatter={formatValue} />
              <Legend />
              <Scatter
                name={primaryYAxis.replace(/_/g, ' ')}
                data={normalizedData}
                fill={COLORS[0]}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'pie':
        if (!safeXAxisKey || !safePrimaryYAxis) {
          return <div className="flex h-full items-center justify-center">No metric available for pie chart</div>;
        }
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={normalizedData}
                dataKey={safePrimaryYAxis}
                nameKey={safeXAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={150}
                label={({name, value}) => `${name}: ${formatValue(value)}`}
              >
                {normalizedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={formatValue} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="flex h-full items-center justify-center">Unsupported chart type</div>;
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h3 className="font-semibold">Data Visualization</h3>
        <div className="h-[400px] w-full">
          {renderChart()}
        </div>
      </div>
    </Card>
  );
}
