# backend/app/database/connection.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from functools import lru_cache
import urllib.parse
from typing import Generator
import os

class DatabaseConnection:
    def __init__(self):
        self.server = 'dwh.hdm-server.eu'
        self.database = 'AdventureBikes Sales DataMart'
        self.username = os.getenv('DB_USERNAME', 'mike.farmer')
        self.password = urllib.parse.quote_plus(os.getenv('DB_PASSWORD', 'password123'))
        self._engine = None
        self.SessionLocal = None

    @property
    def engine(self):
        if self._engine is None:
            conn_str = (
                'mssql+pyodbc://'
                f'{self.username}:{self.password}@{self.server}/{self.database}'
                '?driver=/opt/homebrew/lib/libmsodbcsql.17.dylib'
            )
            self._engine = create_engine(conn_str, pool_pre_ping=True)
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self._engine)
        return self._engine

    def get_session(self) -> Generator:
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()