# File: backend/app/api/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from .routes.graph import router as graph_router
from .routes.procedures import router as procedures_router
from .routes.reports import router as reports_router

from ..database.connection import DatabaseConnection
from ..cache.cache_manager import CacheManager
from ..ai_providers.gemini_provider import GeminiProvider
from ..services.query_processor import QueryProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QueryRequest(BaseModel):
    query: str

app = FastAPI(title="Business Analytics API")

# CORS middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
db = DatabaseConnection()
cache = CacheManager()
ai_provider = GeminiProvider()
query_processor = QueryProcessor(db, cache, ai_provider)

# Include routers
app.include_router(graph_router)
app.include_router(procedures_router)
app.include_router(reports_router)

@app.post("/api/query")
async def process_query(request: QueryRequest):
    try:
        logger.info(f"Received query request: {request.query}")
        result = await query_processor.process_query(request.query)
        
        if "error" in result:
            logger.error(f"Error processing query: {result['error']}")
            raise HTTPException(status_code=500, detail=result["error"])
            
        return result
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
