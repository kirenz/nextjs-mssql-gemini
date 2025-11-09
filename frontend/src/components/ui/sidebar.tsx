// src/components/ui/sidebar.tsx
import { BarChart2, Database, Network, FileText } from "lucide-react";
import Link from "next/link";

export function Sidebar() {
  return (
    <div className="w-64 bg-gray-900 text-white p-4">
      <nav className="space-y-4">
        <Link 
          href="/analytics"
          className="flex items-center space-x-2 p-2 hover:bg-gray-800 rounded"
        >
          <BarChart2 className="h-5 w-5" />
          <span>Analytics</span>
        </Link>
        <Link 
          href="/graph"
          className="flex items-center space-x-2 p-2 hover:bg-gray-800 rounded"
        >
          <Network className="h-5 w-5" />
          <span>Knowledge Graph</span>
        </Link>
        <Link
          href="/procedures"
          className="flex items-center space-x-2 p-2 hover:bg-gray-800 rounded"
        >
          <Database className="h-5 w-5" />
          <span>Stored Procedures</span>
        </Link>
        <Link
          href="/reports"
          className="flex items-center space-x-2 p-2 hover:bg-gray-800 rounded"
        >
          <FileText className="h-5 w-5" />
          <span>Reports</span>
        </Link>
      </nav>
    </div>
  );
}
