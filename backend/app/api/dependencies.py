# File: backend/app/api/dependencies.py

from ..services.graph_service import GraphService
from ..services.procedure_service import ProcedureService
from ..database.connection import DatabaseConnection

# Use the same database connection instance
db = DatabaseConnection()

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
