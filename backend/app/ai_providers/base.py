# backend/app/ai_providers/base.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class AIProvider(ABC):
    @abstractmethod
    async def process_query(self, query: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def refine_query(self, original_query: str, follow_up: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        pass