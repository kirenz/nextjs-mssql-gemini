# backend/app/services/query_processor.py
from typing import Dict, Any, Optional
import pandas as pd
from ..database.connection import DatabaseConnection
from ..cache.cache_manager import CacheManager
from ..ai_providers.base import AIProvider
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QueryProcessor:
    def __init__(self, db: DatabaseConnection, cache: CacheManager, ai_provider: AIProvider):
        self.db = db
        self.cache = cache
        self.ai_provider = ai_provider

    def _clean_sql(self, raw_sql: str) -> str:
        if not raw_sql:
            return ""

        cleaned = raw_sql.strip()

        if cleaned.startswith("```"):
            lines = [
                line
                for line in cleaned.splitlines()
                if not line.strip().startswith("```")
                and line.strip().lower() != "sql"
            ]
            cleaned = "\n".join(lines).strip()

        return cleaned

    async def execute_sql_query(self, sql_query: str) -> Dict[str, Any]:
        try:
            logger.info(f"Executing SQL query: {sql_query}")
            
            with self.db.engine.connect() as connection:
                df = pd.read_sql(sql_query, connection)
                logger.info(f"Query returned {len(df)} rows")
                return {
                    "data": df.to_dict(orient='records'),
                    "columns": df.columns.tolist()
                }
        except Exception as e:
            logger.error(f"SQL Error: {str(e)}")
            return {"error": f"SQL Error: {str(e)}"}

    async def determine_visualization(self, data: Dict[str, Any], question: str) -> Dict[str, Any]:
        viz_prompt = f"""
        Given this question: "{question}"
        And this data with columns: {', '.join(data['columns'])}
        Sample data: {json.dumps(data['data'][:2])}

        Determine the most appropriate visualization approach. Consider:
        - bar: for categorical comparisons
        - line: for time series or trends
        - multiple: when comparing different scales
        - scatter: for relationships between variables
        - pie: for part-to-whole (only if 5 or fewer categories)

        Return a JSON object with these fields only:
        {{
            "type": "bar|line|multiple|scatter|pie",
            "x_axis": "column_name",
            "y_axis": ["column_name1", "column_name2"],
            "split": true/false,
            "format": {{"prefix": "€", "suffix": ""}}
        }}
        """

        try:
            viz_response = await self.ai_provider.process_query(viz_prompt)
            return json.loads(viz_response.get("response", "{}"))
        except:
            # Default visualization if AI fails
            return {
                "type": "bar",
                "x_axis": data['columns'][0],
                "y_axis": data['columns'][1:],
                "split": False,
                "format": {"prefix": "€", "suffix": ""}
            }

    async def process_query(self, query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            logger.info(f"Processing query: {query}")
            
            # Get SQL query from AI
            sql_response = await self.ai_provider.process_query(
                f"Based on this schema, generate a SQL query for: {query}. "
                "Tables: DataSet_Monthly_Sales_and_Quota. "
                "Return only the raw SQL query.",
                context
            )

            if "error" in sql_response:
                logger.error(f"AI provider error during SQL generation: {sql_response['error']}")
                return {"error": f"AI Error: {sql_response['error']}"}

            raw_sql = sql_response.get("response", "")
            sql_query = self._clean_sql(raw_sql)

            if not sql_query:
                logger.error(f"Failed to generate SQL query from AI response: {raw_sql!r}")
                return {"error": "Failed to generate a SQL query from the AI response."}

            normalized = sql_query.lstrip().lower()
            if not (normalized.startswith("select") or normalized.startswith("with")):
                logger.error(f"Unexpected SQL output: {sql_query}")
                return {"error": "Generated SQL query is not a SELECT statement. Please refine your question."}

            logger.info(f"Generated SQL query: {sql_query}")
            
            # Execute SQL query
            query_result = await self.execute_sql_query(sql_query)
            
            if "error" in query_result:
                return query_result

            # Get visualization recommendation
            viz_config = await self.determine_visualization(query_result, query)
            logger.info(f"Visualization config: {viz_config}")

            # Get analysis from AI
            analysis_response = await self.ai_provider.process_query(
                f"Analyze this data and answer the original question: {query}\n\n"
                f"Data: {json.dumps(query_result['data'][:5])}",
                context
            )

            if "error" in analysis_response:
                logger.error(f"AI provider error during analysis: {analysis_response['error']}")
                return {
                    "response": "",
                    "data": query_result["data"],
                    "columns": query_result["columns"],
                    "sql_query": sql_query,
                    "visualization": viz_config,
                    "error": analysis_response["error"],
                }

            return {
                "response": analysis_response.get("response", ""),
                "data": query_result["data"],
                "columns": query_result["columns"],
                "sql_query": sql_query,
                "visualization": viz_config
            }

        except Exception as e:
            logger.error(f"Processing Error: {str(e)}")
            return {"error": f"Processing Error: {str(e)}"}
