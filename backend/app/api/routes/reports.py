# File: backend/app/api/routes/reports.py

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from ...services.report_service import ReportService
from ..dependencies import get_report_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ForecastRequest(BaseModel):
    sales_org: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    product_line: Optional[str] = None
    product_category: Optional[str] = None
    forecast_periods: int = Field(default=12, ge=1, le=24)
    confidence_interval: float = Field(default=0.95, ge=0.8, le=0.99)


@router.get("/filters")
def get_report_filters(
    sales_org: Optional[str] = None,
    country: Optional[str] = None,
    region: Optional[str] = None,
    state: Optional[str] = None,
    product_line: Optional[str] = None,
    report_service: ReportService = Depends(get_report_service),
):
    """
    Fetch dropdown options honoring the current selections.
    """
    try:
        return report_service.get_filter_options(
            sales_org=sales_org,
            country=country,
            region=region,
            state=state,
            product_line=product_line,
        )
    except ValueError as exc:
        logger.warning("Invalid filter request: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to load report filters")
        raise HTTPException(
            status_code=500, detail="Unable to load report filters."
        ) from exc


@router.post("/forecast")
def create_forecast(
    request: ForecastRequest,
    report_service: ReportService = Depends(get_report_service),
):
    """
    Build a forecasting report for the supplied filters.
    """
    try:
        return report_service.generate_forecast(
            sales_org=request.sales_org,
            country=request.country,
            region=request.region,
            state=request.state,
            city=request.city,
            product_line=request.product_line,
            product_category=request.product_category,
            forecast_periods=request.forecast_periods,
            confidence_interval=request.confidence_interval,
        )
    except ValueError as exc:
        logger.warning("Forecast validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to generate forecast")
        raise HTTPException(
            status_code=500, detail="Unable to generate forecast."
        ) from exc


@router.post("/pptx")
def download_pptx(
    request: ForecastRequest,
    report_service: ReportService = Depends(get_report_service),
):
    """
    Generate a PPTX report and return it as a downloadable file.
    """
    try:
        pptx_bytes, filename = report_service.generate_pptx(
            sales_org=request.sales_org,
            country=request.country,
            region=request.region,
            state=request.state,
            city=request.city,
            product_line=request.product_line,
            product_category=request.product_category,
            forecast_periods=request.forecast_periods,
            confidence_interval=request.confidence_interval,
        )
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers=headers,
        )
    except ValueError as exc:
        logger.warning("PPTX validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to generate PPTX")
        raise HTTPException(
            status_code=500, detail="Unable to generate PPTX report."
        ) from exc
