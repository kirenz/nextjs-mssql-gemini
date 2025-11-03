"""
Service for working with SQL Server stored procedures.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
import re
import time

from sqlalchemy import text

from ..database.connection import DatabaseConnection

logger = logging.getLogger(__name__)


class ProcedureService:
    """
    Encapsulates common operations around SQL Server stored procedures such as
    listing available procedures, inspecting their metadata, and executing them
    with user supplied parameters.
    """

    _IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

    def __init__(self, db: DatabaseConnection) -> None:
        self.db = db

    def list_stored_procedures(self) -> List[Dict[str, Any]]:
        """
        Return a summary list of stored procedures available in the database.
        """
        query = text(
            """
            SELECT
                s.name AS schema_name,
                p.name AS procedure_name,
                p.create_date AS create_date,
                p.modify_date AS modify_date,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM sys.parameters pa
                        WHERE pa.object_id = p.object_id
                          AND pa.is_output = 0
                    )
                    THEN 1 ELSE 0
                END AS has_parameters,
                LEFT(ISNULL(m.definition, ''), 200) AS definition_snippet
            FROM sys.procedures p
            INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
            LEFT JOIN sys.sql_modules m ON p.object_id = m.object_id
            ORDER BY s.name, p.name
            """
        )

        with self.db.engine.connect() as connection:
            result = connection.execute(query)
            procedures: List[Dict[str, Any]] = []
            for row in result.mappings():
                procedures.append(
                    {
                        "schema": row["schema_name"],
                        "name": row["procedure_name"],
                        "has_parameters": bool(row["has_parameters"]),
                        "created_at": row["create_date"].isoformat()
                        if row["create_date"]
                        else None,
                        "updated_at": row["modify_date"].isoformat()
                        if row["modify_date"]
                        else None,
                        "definition_snippet": row["definition_snippet"].strip(),
                    }
                )

        logger.info("Listed %d stored procedures", len(procedures))
        return procedures

    def get_procedure_details(self, schema: str, name: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve metadata (definition and parameters) for a specific stored procedure.
        """
        safe_schema = self._normalize_identifier(schema)
        safe_name = self._normalize_identifier(name)

        definition_query = text(
            """
            SELECT
                s.name AS schema_name,
                o.name AS procedure_name,
                o.object_id AS object_id,
                COALESCE(m.definition, OBJECT_DEFINITION(o.object_id)) AS definition
            FROM sys.all_objects o
            INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
            LEFT JOIN sys.sql_modules m ON o.object_id = m.object_id
            WHERE s.name = :schema
              AND o.name = :name
              AND o.type IN ('P', 'X')
            """
        )

        params_query = text(
            """
            SELECT
                p.name AS parameter_name,
                TYPE_NAME(p.system_type_id) AS data_type,
                p.max_length AS max_length,
                p.precision AS numeric_precision,
                p.scale AS numeric_scale,
                CASE WHEN p.is_output = 1 THEN 'OUT' ELSE 'IN' END AS parameter_mode,
                p.is_output AS is_output,
                p.has_default_value AS has_default_value,
                p.parameter_id AS ordinal_position
            FROM sys.all_parameters p
            WHERE p.object_id = :object_id
            ORDER BY p.parameter_id
            """
        )

        with self.db.engine.connect() as connection:
            definition_result = connection.execute(
                definition_query, {"schema": safe_schema, "name": safe_name}
            ).mappings().first()

            if not definition_result:
                return None

            object_id = definition_result["object_id"]
            params_result = connection.execute(
                params_query, {"object_id": object_id}
            ).mappings()

            parameters: List[Dict[str, Any]] = []
            for row in params_result:
                param_name = row["parameter_name"]
                is_output = bool(row["is_output"])
                has_default = bool(row["has_default_value"])
                parameters.append(
                    {
                        "name": param_name,
                        "short_name": param_name.lstrip("@"),
                        "data_type": row["data_type"],
                        "max_length": row["max_length"],
                        "numeric_precision": row["numeric_precision"],
                        "numeric_scale": row["numeric_scale"],
                        "mode": row["parameter_mode"],
                        "is_result": False,
                        "is_required": not is_output and not has_default,
                        "ordinal_position": row["ordinal_position"],
                    }
                )

        return {
            "schema": safe_schema,
            "name": safe_name,
            "definition": (definition_result["definition"] or "").strip(),
            "parameters": parameters,
        }

    def execute_procedure(
        self,
        schema: str,
        name: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute the specified stored procedure with the provided parameters.
        """
        parameters = parameters or {}
        safe_schema = self._normalize_identifier(schema)
        safe_name = self._normalize_identifier(name)

        metadata = self.get_procedure_details(safe_schema, safe_name)
        if not metadata:
            raise ValueError("Stored procedure not found.")

        param_definitions = {
            entry["short_name"]: entry for entry in metadata.get("parameters", [])
        }

        bound_parameters: Dict[str, Any] = {}
        assignments: List[str] = []

        for short_name, details in param_definitions.items():
            original_name = details["name"]
            placeholder = self._sanitize_identifier(short_name)
            provided_value = self._pick_parameter_value(parameters, short_name)

            if provided_value in ("", None) and details["is_required"]:
                raise ValueError(f"Parameter '{original_name}' is required.")

            if provided_value in ("", None):
                # Skip optional parameters that were not supplied
                continue

            bound_parameters[placeholder] = self._coerce_parameter_value(
                provided_value, details["data_type"]
            )
            assignments.append(f"{original_name} = :{placeholder}")

        sql = (
            "SET NOCOUNT ON; EXEC "
            f"{self._quote_identifier(safe_schema)}."
            f"{self._quote_identifier(safe_name)}"
        )
        if assignments:
            sql = f"{sql} {', '.join(assignments)}"

        start_time = time.perf_counter()
        with self.db.engine.connect() as connection:
            logger.info(
                "Executing stored procedure %s.%s with parameters %s",
                safe_schema,
                safe_name,
                list(bound_parameters.keys()),
            )
            result = connection.execute(text(sql), bound_parameters)

            data: List[Dict[str, Any]] = []
            columns: List[str] = []

            if result.returns_rows:
                columns = list(result.keys())
                data = [dict(row) for row in result.mappings().all()]

            rowcount = result.rowcount if result.rowcount is not None else None

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "schema": safe_schema,
            "name": safe_name,
            "columns": columns,
            "data": data,
            "row_count": rowcount,
            "duration_ms": duration_ms,
            "parameters_used": bound_parameters,
        }

    def _sanitize_identifier(self, value: str) -> str:
        if not value:
            raise ValueError("Identifier cannot be empty.")

        if not self._IDENTIFIER_PATTERN.match(value):
            raise ValueError(f"Invalid identifier: {value}")

        return value

    @staticmethod
    def _normalize_identifier(value: str) -> str:
        """
        Normalize identifiers by trimming whitespace and ensuring they are non-empty.
        """
        if value is None:
            raise ValueError("Identifier cannot be empty.")

        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Identifier cannot be empty.")

        return trimmed

    @staticmethod
    def _quote_identifier(value: str) -> str:
        """
        Safely quote identifiers for inclusion in EXEC statements.
        """
        normalized = ProcedureService._normalize_identifier(value)
        escaped = normalized.replace("]", "]]")
        return f"[{escaped}]"

    @staticmethod
    def _pick_parameter_value(
        provided: Dict[str, Any], short_name: str
    ) -> Optional[Any]:
        """
        Allow clients to provide parameters either with or without the leading '@'.
        """
        if short_name in provided:
            return provided[short_name]

        with_at = f"@{short_name}"
        if with_at in provided:
            return provided[with_at]

        # Handle case-sensitivity by trying case insensitive search
        lowered = short_name.lower()
        for key, value in provided.items():
            normalized_key = key.lstrip("@").lower()
            if normalized_key == lowered:
                return value

        return None

    @staticmethod
    def _coerce_parameter_value(value: Any, data_type: Optional[str]) -> Any:
        """
        Convert string inputs into the appropriate Python type based on SQL data type.
        """
        if value is None:
            return None

        if isinstance(value, (int, float, bool)):
            return value

        if not isinstance(value, str):
            return value

        stripped = value.strip()
        if stripped == "":
            return None

        sql_type = (data_type or "").lower()

        if sql_type in {"int", "smallint", "tinyint", "bigint"}:
            return int(stripped)
        if sql_type in {"decimal", "numeric", "money", "smallmoney", "float", "real"}:
            return float(stripped)
        if sql_type in {"bit"}:
            if stripped.lower() in {"1", "true", "yes", "on"}:
                return True
            if stripped.lower() in {"0", "false", "no", "off"}:
                return False
            raise ValueError(f"Cannot convert '{value}' to BIT.")

        return value
