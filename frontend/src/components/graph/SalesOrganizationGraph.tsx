"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from "lucide-react";

// Dynamically import ForceGraph2D with SSR disabled
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
});

interface Node {
  id: number;
  name: string;
  level: number;  // 0: worldwide, 1: country, 2: region, 3: office
  val: number;
  color: string;
  group: 'worldwide' | 'region' | 'country' | 'office';
  country?: string;
  region?: string;
  lat?: number;
  lng?: number;
  x?: number;
  y?: number;
}

interface Link {
  source: Node;
  target: Node;
  value: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface NodeDetails {
  basic_info: Node;
  sales_metrics: {
    total_revenue?: number;
    total_sales?: number;
    num_offices?: number;
    num_countries?: number;
    num_channels?: number;
    num_product_lines?: number;
    avg_discount?: number;
  };
  additional_info: {
    offices?: Array<{
      Sales_Office: string;
      GEO_Latitude: number;
      GEO_Longitude: number;
    }>;
    top_products?: Array<{
      Product_Line: string;
      total_sales: number;
      total_revenue: number;
    }>;
  };
}

const SalesOrganizationGraph = () => {
  const [graphData, setGraphData] = React.useState<GraphData | undefined>();
  const [error, setError] = React.useState<string | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<NodeDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const forceGraphRef = React.useRef<ForceGraphMethods | undefined>(undefined);

  React.useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/graph/sales-organization');
        if (!response.ok) {
          throw new Error('Failed to fetch graph data');
        }
        const data = await response.json();

        // Add worldwide node and adjust connections
        const worldwideNode = {
          id: 0,
          name: 'Worldwide',
          level: 0,
          val: 20,
          color: '#6366f1', // indigo color for worldwide node
          group: 'worldwide'
        };

        // Add worldwide node to nodes array
        const modifiedData = {
          nodes: [worldwideNode, ...data.nodes],
          links: [
            // Add links from worldwide to countries (level 1)
            ...data.nodes
              .filter((node: Node) => node.level === 1)
              .map((node: Node) => ({
                source: worldwideNode,
                target: node,
                value: 1
              })),
            ...data.links
          ]
        };

        setGraphData(modifiedData);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setError(errorMessage);
        console.error('Graph data fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
  }, []);

  React.useEffect(() => {
    if (!graphData || !forceGraphRef.current) {
      return;
    }

    const chargeForce = forceGraphRef.current.d3Force('charge') as
      | { strength?: (value: number) => unknown }
      | undefined;
    const linkForce = forceGraphRef.current.d3Force('link') as
      | { distance?: (value: number) => unknown }
      | undefined;

    if (chargeForce?.strength) {
      chargeForce.strength(-150);
    }

    if (linkForce?.distance) {
      linkForce.distance(80);
    }

    if (chargeForce?.strength || linkForce?.distance) {
      forceGraphRef.current.d3ReheatSimulation();
    }

    forceGraphRef.current.centerAt(0, 0);
    forceGraphRef.current.zoom(1.2);
  }, [graphData]);

  const handleNodeClick = React.useCallback(async (
    node: { id?: string | number } & Record<string, any>,
    event: MouseEvent
  ) => {
    if (node.id === undefined) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/graph/node/${node.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch node details');
      }
      const details = await response.json();
      setSelectedNode(details as NodeDetails);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setError(errorMessage);
      console.error('Node details fetch error:', error);
    }
  }, []);

  // Update node sizing to include worldwide node
  const getNodeSize = (node: Node) => {
    switch (node.level) {
      case 0: return 20; // worldwide
      case 1: return 15; // countries
      case 2: return 12; // regions
      case 3: return 8;  // offices
      default: return 8;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 relative">
        {graphData && (
          <ForceGraph2D
            ref={forceGraphRef}
            graphData={graphData}
            nodeLabel="name"
            nodeVal={(node) => {
              const n = node as Node;
              return getNodeSize(n);
            }}
            nodeColor={(node) => (node as Node).color}
            linkWidth={1.5}
            linkColor={() => "rgba(150,150,150,0.8)"}
            onNodeClick={handleNodeClick}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const typedNode = node as Node;
              const fontSize = Math.min(4, 2 * globalScale);
              
              const nodeSize = 
                typedNode.level === 0 ? 20 :
                typedNode.level === 1 ? 15 : 
                typedNode.level === 2 ? 12 : 8;
              
              // Draw circle with border
              ctx.beginPath();
              ctx.arc(node.x || 0, node.y || 0, nodeSize, 0, 2 * Math.PI);
              ctx.fillStyle = typedNode.color;
              ctx.fill();
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 0.5;
              ctx.stroke();
              
              // Draw text
              const label = typedNode.name;
              ctx.font = `${fontSize}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#fff';
              ctx.fillText(label, node.x || 0, node.y || 0);
            }}
            width={window.innerWidth - 100}  // Use almost full window width
            height={window.innerHeight - 200} // Use most of window height
            cooldownTicks={100}
            d3VelocityDecay={0.2}
            d3AlphaDecay={0.01}
            minZoom={0.5}
            maxZoom={8}
            enableNodeDrag={true}
            enableZoomInteraction={true}
          />
        )}
      </div>
      
      {selectedNode && (
        <Card className="absolute bottom-4 right-4 w-96">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">{selectedNode.basic_info.name}</h3>
            <div className="text-sm space-y-2">
              <p>Type: {selectedNode.basic_info.group}</p>
              {selectedNode.basic_info.country && (
                <p>Country: {selectedNode.basic_info.country}</p>
              )}
              {selectedNode.basic_info.region && (
                <p>Region: {selectedNode.basic_info.region}</p>
              )}
              
              {/* Sales Metrics */}
              {selectedNode.sales_metrics && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Sales Metrics</h4>
                  {selectedNode.sales_metrics.total_revenue && (
                    <p>Revenue: €{(selectedNode.sales_metrics.total_revenue / 1000000).toFixed(2)}M</p>
                  )}
                  {selectedNode.sales_metrics.total_sales && (
                    <p>Total Sales: {selectedNode.sales_metrics.total_sales.toLocaleString()}</p>
                  )}
                  {selectedNode.sales_metrics.num_offices && (
                    <p>Number of Offices: {selectedNode.sales_metrics.num_offices}</p>
                  )}
                </div>
              )}
              
              {/* Additional Info */}
              {selectedNode.additional_info.top_products && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Top Products</h4>
                  {selectedNode.additional_info.top_products.map((product, index) => (
                    <p key={index}>
                      {product.Product_Line}: €{(product.total_revenue / 1000000).toFixed(2)}M
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SalesOrganizationGraph;
