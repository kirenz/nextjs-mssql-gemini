// File: src/app/(dashboard)/graph/page.tsx

import SalesOrganizationGraph from '@/components/graph/SalesOrganizationGraph';

export default function GraphPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Sales Organization Structure</h1>
      <SalesOrganizationGraph />
    </div>
  );
}
