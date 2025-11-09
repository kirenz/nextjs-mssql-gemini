// src/app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarChart2, Network, FileText } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Business Analytics Platform
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl">
                Analyze your business data with natural language queries and advanced visualizations.
              </p>
              <Link href="/analytics">
                <Button className="mt-4">Get Started</Button>
              </Link>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 pt-12 md:grid-cols-3 md:gap-8">
              <Card className="p-6">
                <BarChart2 className="h-12 w-12 mb-4" />
                <h3 className="text-lg font-bold">Analytics</h3>
                <p className="text-sm text-gray-500">
                  Analyze sales data and trends using natural language queries.
                </p>
              </Card>
              <Card className="p-6">
                <Network className="h-12 w-12 mb-4" />
                <h3 className="text-lg font-bold">Knowledge Graph</h3>
                <p className="text-sm text-gray-500">
                  Visualize relationships in your business data.
                </p>
              </Card>
              <Card className="p-6">
                <FileText className="h-12 w-12 mb-4" />
                <h3 className="text-lg font-bold">Reports</h3>
                <p className="text-sm text-gray-500">
                  Build guided forecasting packs with reusable filters and downloads.
                </p>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
