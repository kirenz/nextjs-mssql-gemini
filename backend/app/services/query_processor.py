# backend/app/services/query_processor.py
from typing import Dict, Any, Optional, Tuple
import base64
import json
import logging

import altair as alt
import pandas as pd
import vl_convert as vlc

from ..database.connection import DatabaseConnection
from ..cache.cache_manager import CacheManager
from ..ai_providers.base import AIProvider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

alt.data_transformers.disable_max_rows()

class QueryProcessor:
    def __init__(self, db: DatabaseConnection, cache: CacheManager, ai_provider: AIProvider):
        self.db = db
        self.cache = cache
        self.ai_provider = ai_provider

    def _normalize_visualization_config(
        self, data: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        columns = data.get("columns", []) or []
        default_x_axis = columns[0] if columns else ""
        default_y_axis = columns[1:] if len(columns) > 1 else (columns[:1] if columns else [])

        safe_config = config if isinstance(config, dict) else {}
        raw_type = safe_config.get("type", "bar")
        raw_x_axis = safe_config.get("x_axis") or default_x_axis
        raw_y_axis = safe_config.get("y_axis", default_y_axis)

        if isinstance(raw_y_axis, str):
            y_axis = [raw_y_axis] if raw_y_axis else []
        elif isinstance(raw_y_axis, list):
            y_axis = [axis for axis in raw_y_axis if axis]
        else:
            y_axis = []

        if not y_axis:
            y_axis = default_y_axis

        format_config = safe_config.get("format") or {"prefix": "", "suffix": ""}

        return {
            "type": raw_type if raw_type in {"bar", "line", "multiple", "scatter", "pie"} else "bar",
            "x_axis": raw_x_axis,
            "y_axis": y_axis,
            "split": bool(safe_config.get("split", False)),
            "format": {
                "prefix": format_config.get("prefix", ""),
                "suffix": format_config.get("suffix", ""),
            },
        }

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

    async def execute_sql_query(self, sql_query: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        try:
            logger.info(f"Executing SQL query: {sql_query}")
            
            with self.db.engine.connect() as connection:
                df = pd.read_sql(sql_query, connection)
                logger.info(f"Query returned {len(df)} rows")
                payload = {
                    "data": df.to_dict(orient='records'),
                    "columns": df.columns.tolist()
                }
                return df, payload
        except Exception as e:
            logger.error(f"SQL Error: {str(e)}")
            return pd.DataFrame(), {"error": f"SQL Error: {str(e)}"}

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
            parsed_config = json.loads(viz_response.get("response", "{}"))
        except Exception:
            parsed_config = {}

        default_config = {
            "type": "bar",
            "x_axis": (data.get("columns") or [""])[0],
            "y_axis": (data.get("columns") or [])[1:],
            "split": False,
            "format": {"prefix": "€", "suffix": ""},
        }

        merged_config = {**default_config, **parsed_config}
        return self._normalize_visualization_config(data, merged_config)

    def _infer_altair_type(self, series: pd.Series) -> str:
        if pd.api.types.is_datetime64_any_dtype(series):
            return "T"
        if pd.api.types.is_numeric_dtype(series):
            return "Q"
        return "N"

    def _select_chart_fields(
        self, df: pd.DataFrame, viz_config: Dict[str, Any]
    ) -> Tuple[Optional[str], list[str]]:
        columns = list(df.columns)
        if not columns:
            return None, []

        x_field = viz_config.get("x_axis")
        if x_field not in columns:
            x_field = columns[0]

        requested_y = [
            y_field for y_field in viz_config.get("y_axis", []) if y_field in columns
        ]
        if not requested_y:
            requested_y = [col for col in columns if col != x_field][:2]

        return x_field, requested_y

    def _generate_altair_chart(
        self, df: pd.DataFrame, viz_config: Dict[str, Any]
    ) -> Optional[str]:
        if df.empty:
            return None

        chart_df = df.copy()
        x_field, y_fields = self._select_chart_fields(chart_df, viz_config)

        if not x_field or not y_fields:
            return None

        chart_type = viz_config.get("type", "bar")

        for field in y_fields:
            if field in chart_df:
                chart_df[field] = pd.to_numeric(chart_df[field], errors="coerce")

        x_type = self._infer_altair_type(chart_df[x_field]) if x_field in chart_df else "N"

        try:
            if chart_type == "pie":
                value_field = y_fields[0]
                pie_df = (
                    chart_df[[x_field, value_field]]
                    .groupby(x_field, dropna=False)
                    .sum(numeric_only=True)
                    .reset_index()
                )
                chart = (
                    alt.Chart(pie_df)
                    .mark_arc()
                    .encode(
                        theta=alt.Theta(f"{value_field}:Q"),
                        color=alt.Color(f"{x_field}:N", title=x_field),
                        tooltip=[x_field, value_field],
                    )
                )
            elif chart_type == "scatter":
                y_field = y_fields[0]
                y_type = self._infer_altair_type(chart_df[y_field])
                chart = (
                    alt.Chart(chart_df)
                    .mark_circle(size=80, opacity=0.8)
                    .encode(
                        x=alt.X(f"{x_field}:{x_type}", title=x_field),
                        y=alt.Y(f"{y_field}:{y_type}", title=y_field),
                        tooltip=[x_field, y_field],
                    )
                )
            else:
                if len(y_fields) > 1:
                    long_df = chart_df[[x_field] + y_fields].melt(
                        id_vars=[x_field], value_vars=y_fields, var_name="Metric", value_name="Value"
                    )
                    base_chart = alt.Chart(long_df)
                    if chart_type in {"line", "multiple"}:
                        chart = base_chart.mark_line(point=True)
                    else:
                        chart = base_chart.mark_bar()
                    chart = chart.encode(
                        x=alt.X(f"{x_field}:{x_type}", title=x_field),
                        y=alt.Y("Value:Q", title="Value"),
                        color=alt.Color("Metric:N", title="Metric"),
                        tooltip=[x_field, "Metric", "Value"],
                    )
                else:
                    y_field = y_fields[0]
                    y_type = self._infer_altair_type(chart_df[y_field])
                    base_chart = alt.Chart(chart_df)
                    if chart_type == "line":
                        chart = base_chart.mark_line(point=True)
                    else:
                        chart = base_chart.mark_bar()
                    chart = chart.encode(
                        x=alt.X(f"{x_field}:{x_type}", title=x_field),
                        y=alt.Y(f"{y_field}:{y_type}", title=y_field),
                        tooltip=[x_field, y_field],
                    )

            chart = chart.properties(width=720, height=400).configure_axis(
                labelFontSize=11, titleFontSize=12
            ).configure_legend(labelFontSize=11, titleFontSize=12)

            spec = chart.to_dict()
            png_bytes = vlc.vegalite_to_png(spec)
            encoded = base64.b64encode(png_bytes).decode("utf-8")
            return f"data:image/png;base64,{encoded}"
        except Exception as exc:
            logger.warning("Failed to generate Altair visualization: %s", exc)
            return None

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
            df, query_result = await self.execute_sql_query(sql_query)
            
            if "error" in query_result:
                return query_result

            # Get visualization recommendation
            viz_config = await self.determine_visualization(query_result, query)
            logger.info(f"Visualization config: {viz_config}")
            chart_image = self._generate_altair_chart(df, viz_config)

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
                    "chart_image": chart_image,
                    "error": analysis_response["error"],
                }

            return {
                "response": analysis_response.get("response", ""),
                "data": query_result["data"],
                "columns": query_result["columns"],
                "sql_query": sql_query,
                "visualization": viz_config,
                "chart_image": chart_image,
            }

        except Exception as e:
            logger.error(f"Processing Error: {str(e)}")
            return {"error": f"Processing Error: {str(e)}"}
