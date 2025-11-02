# File: backend/app/services/graph_service.py

from typing import Dict, List, Optional
import logging
from sqlalchemy import text
from ..database.connection import DatabaseConnection

logger = logging.getLogger(__name__)

class GraphService:
    def __init__(self, db: DatabaseConnection):
        self.db = db

    def get_sales_organization_graph(self) -> Dict:
        """Generate the sales organization graph structure."""
        try:
            with self.db.engine.connect() as connection:
                # First get distinct countries (top level)
                countries = connection.execute(text("""
                    SELECT DISTINCT 
                        SUBSTRING(TRIM([Sales Country]), 1, 
                            CASE 
                                WHEN CHARINDEX(' ', TRIM([Sales Country])) > 0 
                                THEN CHARINDEX(' ', TRIM([Sales Country])) - 1
                                ELSE LEN(TRIM([Sales Country]))
                            END
                        ) as base_country
                    FROM DataSet_Monthly_Sales_and_Quota
                    WHERE [Sales Country] IS NOT NULL
                """)).fetchall()
                
                # Then get regions by country
                regions = connection.execute(text("""
                    SELECT DISTINCT 
                        SUBSTRING(TRIM([Sales Country]), 1, 
                            CASE 
                                WHEN CHARINDEX(' ', TRIM([Sales Country])) > 0 
                                THEN CHARINDEX(' ', TRIM([Sales Country])) - 1
                                ELSE LEN(TRIM([Sales Country]))
                            END
                        ) as base_country,
                        TRIM([Sales Region]) as region
                    FROM DataSet_Monthly_Sales_and_Quota
                    WHERE [Sales Region] IS NOT NULL
                    AND [Sales Country] IS NOT NULL
                """)).fetchall()
                
                # Finally get cities
                offices = connection.execute(text("""
                    SELECT DISTINCT 
                        TRIM([Sales City]) as office,
                        TRIM([Sales Region]) as region,
                        SUBSTRING(TRIM([Sales Country]), 1, 
                            CASE 
                                WHEN CHARINDEX(' ', TRIM([Sales Country])) > 0 
                                THEN CHARINDEX(' ', TRIM([Sales Country])) - 1
                                ELSE LEN(TRIM([Sales Country]))
                            END
                        ) as base_country
                    FROM DataSet_Monthly_Sales_and_Quota
                    WHERE [Sales City] IS NOT NULL
                    AND [Sales Region] IS NOT NULL
                    AND [Sales Country] IS NOT NULL
                """)).fetchall()

                logger.info(f"Found {len(countries)} countries, {len(regions)} regions, and {len(offices)} offices")

                # Create nodes and links
                nodes = []
                links = []
                node_id = 0

                # Add country nodes (top level)
                country_ids = {}
                for country in countries:
                    country_name = country[0]
                    country_ids[country_name] = node_id
                    nodes.append({
                        "id": node_id,
                        "name": country_name,
                        "level": 1,
                        "val": 15,
                        "color": "#ff7043",
                        "group": "country"
                    })
                    node_id += 1

                # Add region nodes (middle level)
                region_ids = {}
                for region in regions:
                    country_name, region_name = region[0], region[1]
                    if country_name in country_ids:
                        region_ids[f"{country_name}:{region_name}"] = node_id
                        nodes.append({
                            "id": node_id,
                            "name": region_name,
                            "level": 2,
                            "val": 10,
                            "color": "#42a5f5",
                            "group": "region",
                            "country": country_name
                        })
                        # Link region to country
                        links.append({
                            "source": country_ids[country_name],
                            "target": node_id,
                            "value": 1
                        })
                        node_id += 1

                # Add office nodes (bottom level)
                for office in offices:
                    office_name, region_name, country_name = office[0], office[1], office[2]
                    region_key = f"{country_name}:{region_name}"
                    if region_key in region_ids:
                        nodes.append({
                            "id": node_id,
                            "name": office_name,
                            "level": 3,
                            "val": 5,
                            "color": "#66bb6a",
                            "group": "office",
                            "region": region_name,
                            "country": country_name
                        })
                        # Link office to region
                        links.append({
                            "source": region_ids[region_key],
                            "target": node_id,
                            "value": 1
                        })
                        node_id += 1

                return {"nodes": nodes, "links": links}

        except Exception as e:
            logger.error(f"Error generating graph: {str(e)}")
            raise

    def get_node_details(self, node_id: int) -> Optional[Dict]:
        """Get detailed information about a specific node."""
        try:
            with self.db.engine.connect() as connection:
                # First get the node basic info from the graph
                graph_data = self.get_sales_organization_graph()
                node = next((n for n in graph_data["nodes"] if n["id"] == node_id), None)
                
                if not node:
                    return None

                # Query for additional metrics based on node type
                if node["group"] == "region":
                    where_clause = "[Sales Region] = :param"
                elif node["group"] == "country":
                    where_clause = "[Sales Country] = :param"
                else:  # office
                    where_clause = "[Sales City] = :param"

                metrics_query = text(f"""
                    SELECT 
                        SUM([Revenue EUR]) as total_revenue,
                        SUM([Sales Amount]) as total_sales,
                        COUNT(DISTINCT [Sales City]) as num_offices,
                        COUNT(DISTINCT [Sales Country]) as num_countries,
                        COUNT(DISTINCT [Sales Organisation]) as num_channels,
                        COUNT(DISTINCT [Product Line]) as num_product_lines,
                        AVG(CAST([Discount EUR] as float) / NULLIF(CAST([Revenue EUR] as float), 0) * 100) as avg_discount
                    FROM DataSet_Monthly_Sales_and_Quota
                    WHERE {where_clause}
                """)
                
                metrics_result = connection.execute(metrics_query, {"param": node["name"]}).fetchone()
                metrics = dict(zip(
                    ['total_revenue', 'total_sales', 'num_offices', 'num_countries', 
                     'num_channels', 'num_product_lines', 'avg_discount'],
                    metrics_result
                )) if metrics_result else {}

                # Get top products for this node
                products_query = text(f"""
                    SELECT 
                        [Product Line] as product_line,
                        SUM([Sales Amount]) as total_sales,
                        SUM([Revenue EUR]) as total_revenue
                    FROM DataSet_Monthly_Sales_and_Quota
                    WHERE {where_clause}
                    GROUP BY [Product Line]
                    ORDER BY SUM([Revenue EUR]) DESC
                    OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY
                """)
                
                products_result = connection.execute(products_query, {"param": node["name"]}).fetchall()
                top_products = [
                    {
                        "Product_Line": row[0],
                        "total_sales": row[1],
                        "total_revenue": row[2]
                    }
                    for row in products_result
                ]

                return {
                    "basic_info": node,
                    "sales_metrics": metrics,
                    "additional_info": {
                        "top_products": top_products
                    }
                }

        except Exception as e:
            logger.error(f"Error fetching node details: {str(e)}")
            raise