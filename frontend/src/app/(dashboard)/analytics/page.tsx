// src/app/(dashboard)/analytics/page.tsx
import { QueryInput } from "@/components/analytics/query-input";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
      <QueryInput />
    </div>
  );
}