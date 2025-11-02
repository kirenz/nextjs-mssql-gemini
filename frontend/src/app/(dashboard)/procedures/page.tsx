// src/app/(dashboard)/procedures/page.tsx
import { ProcedureExplorer } from "@/components/procedures/procedure-explorer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProceduresPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stored Procedures</h1>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Need a quick guide?</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <details className="group rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 transition-colors open:border-blue-200 open:bg-blue-50">
            <summary className="cursor-pointer font-medium text-slate-800 outline-none transition-colors group-open:text-blue-700">
              How to use the Stored Procedures workbench
            </summary>
            <div className="mt-3 space-y-2 leading-relaxed">
              <p>
                Browse the stored procedures from SQL Server, inspect their metadata, and execute them with parameters—all without leaving the dashboard.
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-slate-600">
                <li>
                  For an instant demo, hit <span className="font-semibold text-slate-800">Try sample</span> to load and run <code>sys.sp_help</code>.
                </li>
                <li>Select a procedure in the list to load its definition and parameters.</li>
                <li>Review the definition snippet to confirm you&apos;ve picked the right routine.</li>
                <li>Fill in parameter values as needed—required ones are labeled, optional values can stay blank.</li>
                <li>Choose <span className="font-semibold text-slate-800">Run procedure</span> to execute against the database.</li>
                <li>Inspect the results table and metadata (duration, rows affected, parameters used) that appear beneath the form.</li>
              </ol>
              <p className="text-slate-600">
                Tip: Refresh the list if new procedures are added to the database, and keep an eye on the results pane for any execution errors returned from SQL Server.
              </p>
            </div>
          </details>
        </CardContent>
      </Card>
      <ProcedureExplorer />
    </div>
  );
}
