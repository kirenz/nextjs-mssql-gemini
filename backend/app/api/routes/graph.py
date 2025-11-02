# File: backend/app/api/routes/graph.py

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict
import logging
from ...services.graph_service import GraphService
from ..dependencies import get_graph_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/graph", tags=["graph"])

@router.get("/sales-organization")
async def get_sales_organization_graph(
    graph_service: GraphService = Depends(get_graph_service)
) -> Dict:
    """Get the sales organization graph data."""
    try:
        logger.info("Fetching sales organization graph data")
        data = graph_service.get_sales_organization_graph()
        logger.info(f"Successfully retrieved graph with {len(data['nodes'])} nodes and {len(data['links'])} links")
        return data
    except Exception as e:
        logger.error(f"Failed to fetch graph data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/node/{node_id}")
async def get_node_details(
    node_id: int,
    graph_service: GraphService = Depends(get_graph_service)
) -> Dict:
    """
    Endpoint to get detailed information about a specific node.
    """
    details = graph_service.get_node_details(node_id)
    if not details:
        raise HTTPException(status_code=404, detail="Node not found")
    return details