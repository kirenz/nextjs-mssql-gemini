# backend/app/ai_providers/gemini_provider.py
import asyncio
import os
from typing import Any, Dict, Optional

import google.generativeai as genai
from dotenv import load_dotenv

from .base import AIProvider

load_dotenv()

SQL_SYSTEM_PROMPT = """You are a SQL Server expert helping to analyze sales data.
Generate T-SQL queries for the DataSet_Monthly_Sales_and_Quota table only.

The table has these main columns:
- [Calendar Year] (char(4))
- [Calendar Month] (nvarchar(15))
- [Calendar Month ISO] (char(7))
- [Sales Country] (nvarchar(50))
- [Product Line] (nvarchar(50))
- [Product Category] (nvarchar(50))
- [Revenue EUR] (money)
- [Sales Amount] (numeric)
- [Gross Profit EUR] (money)

Rules:
1. Use ONLY the DataSet_Monthly_Sales_and_Quota table.
2. Return just the raw SQL query – no commentary, no markdown fences.
3. Use square brackets around column names that contain spaces.
4. Apply GROUP BY when aggregating columns.
"""


class GeminiProvider(AIProvider):
    def __init__(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")

        genai.configure(api_key=api_key)

        analysis_model_id = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash-lite")
        sql_model_id = os.getenv("GEMINI_SQL_MODEL", analysis_model_id)

        analysis_model_id = self._normalize_model_id(analysis_model_id)
        sql_model_id = self._normalize_model_id(sql_model_id)

        self.analysis_model = genai.GenerativeModel(analysis_model_id)
        self.sql_model = genai.GenerativeModel(sql_model_id)

    @staticmethod
    def _normalize_model_id(model_id: str) -> str:
        if not model_id:
            return "models/gemini-2.5-flash-lite"
        model_id = model_id.strip()
        if not model_id.startswith("models/"):
            model_id = f"models/{model_id}"
        return model_id

    async def _generate_text(self, prompt: str, *, use_sql_model: bool = False) -> str:
        model = self.sql_model if use_sql_model else self.analysis_model

        def _generate() -> str:
            response = model.generate_content(prompt)
            if getattr(response, "prompt_feedback", None) and response.prompt_feedback.block_reason:
                raise ValueError(
                    f"Gemini blocked the prompt: {response.prompt_feedback.block_reason}"
                )

            if hasattr(response, "text") and response.text:
                return response.text.strip()

            # Fall back to concatenating parts if text is empty.
            parts = []
            for candidate in getattr(response, "candidates", []) or []:
                content = getattr(candidate, "content", None)
                content_parts = getattr(content, "parts", None) if content else None
                if not content_parts:
                    continue
                for part in content_parts:
                    if getattr(part, "text", None):
                        parts.append(part.text)
            return "\n".join(parts).strip()

        return await asyncio.to_thread(_generate)

    async def process_query(
        self, query: str, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            prompt = query
            use_sql_model = False

            sql_markers = [
                "SQL query",
                "raw SQL",
                "generate a SQL",
                "return only the raw sql",
            ]
            if any(marker.lower() in query.lower() for marker in sql_markers):
                prompt = f"{SQL_SYSTEM_PROMPT}\nRequested query:\n{query}"
                use_sql_model = True

            text = await self._generate_text(prompt, use_sql_model=use_sql_model)
            return {"response": text}
        except Exception as exc:
            return {"error": str(exc)}

    async def refine_query(
        self,
        original_query: str,
        follow_up: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        try:
            previous_answer = ""
            if context:
                previous_answer = context.get("previous_response", "")

            prompt = (
                "You are assisting with business analytics follow-up questions.\n"
                f"Original request: {original_query}\n"
                f"Previous answer: {previous_answer}\n"
                f"Follow-up question: {follow_up}\n\n"
                "Provide a concise, business-focused response that references the data when helpful."
            )

            text = await self._generate_text(prompt)
            return {"response": text}
        except Exception as exc:
            return {"error": str(exc)}

    async def generate_analysis(self, prompt: str) -> str:
        """
        Helper for callers that just need a plain-text response from the analysis model.
        """
        return await self._generate_text(prompt, use_sql_model=False)
