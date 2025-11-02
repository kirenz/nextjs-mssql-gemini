# File: backend/app/api/routes/procedures.py

from typing import Any, Dict, List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...services.procedure_service import ProcedureService
from ..dependencies import get_procedure_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/procedures", tags=["procedures"])


class ProcedureExecutionRequest(BaseModel):
    parameters: Optional[Dict[str, Any]] = None


@router.get("/")
def list_procedures(
    procedure_service: ProcedureService = Depends(get_procedure_service),
) -> List[Dict[str, Any]]:
    """
    List stored procedures available in the connected database.
    """
    try:
        procedures = procedure_service.list_stored_procedures()
        logger.info("Returned %d stored procedures", len(procedures))
        return procedures
    except Exception as exc:
        logger.exception("Failed to list stored procedures")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{schema}/{name}")
def get_procedure_details(
    schema: str,
    name: str,
    procedure_service: ProcedureService = Depends(get_procedure_service),
) -> Dict[str, Any]:
    """
    Retrieve metadata for a specific stored procedure.
    """
    try:
        details = procedure_service.get_procedure_details(schema, name)
        if not details:
            raise HTTPException(status_code=404, detail="Stored procedure not found")
        return details
    except HTTPException:
        raise
    except ValueError as exc:
        logger.warning(
            "Invalid stored procedure identifier requested: %s.%s", schema, name
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to retrieve stored procedure %s.%s", schema, name)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/{schema}/{name}/execute")
def execute_procedure(
    schema: str,
    name: str,
    request: ProcedureExecutionRequest,
    procedure_service: ProcedureService = Depends(get_procedure_service),
) -> Dict[str, Any]:
    """
    Execute a stored procedure with optional parameters.
    """
    parameters = request.parameters or {}
    try:
        result = procedure_service.execute_procedure(schema, name, parameters)
        logger.info(
            "Executed stored procedure %s.%s in %.2fms",
            schema,
            name,
            result.get("duration_ms", 0.0),
        )
        return result
    except ValueError as exc:
        logger.warning(
            "Invalid stored procedure request for %s.%s: %s", schema, name, str(exc)
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to execute stored procedure %s.%s", schema, name)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
