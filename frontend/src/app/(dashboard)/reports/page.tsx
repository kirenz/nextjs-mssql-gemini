// src/app/(dashboard)/reports/page.tsx
import { ReportBuilder } from "@/components/reports/report-builder";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-slate-600">
          Create on-demand forecasting reports by slicing the AdventureBikes
          dataset with the dropdowns below.
        </p>
      </div>
      <ReportBuilder />
    </div>
  );
}
