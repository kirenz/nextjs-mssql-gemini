# File: backend/app/api/dependencies.py

from ..services.graph_service import GraphService
from ..services.procedure_service import ProcedureService
from ..services.report_service import ReportService
from ..database.connection import DatabaseConnection
from ..ai_providers.gemini_provider import GeminiProvider

# Use the same database connection instance
db = DatabaseConnection()
ai_provider = GeminiProvider()

def get_graph_service() -> GraphService:
    """
    Dependency injection for GraphService.
    """
    return GraphService(db)

def get_procedure_service() -> ProcedureService:
    """
    Dependency injection for ProcedureService.
    """
    return ProcedureService(db)

def get_report_service() -> ReportService:
    """
    Dependency injection for ReportService.
    """
    return ReportService(db, ai_provider=ai_provider)
