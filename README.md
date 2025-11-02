# Analytics Platform (Next.js 16 + FastAPI + Gemini)

Business analytics application with a FastAPI backend, SQL Server connectivity, and a Next.js 16.0.1 frontend that communicates with the Gemini API for natural-language insights, SQL generation, and visualization guidance.

## Stack

- **Frontend:** Next.js 16.0.1, React 18, Tailwind CSS, Recharts, force-graph visualizations
- **Backend:** FastAPI, SQLAlchemy, pandas, Microsoft SQL Server via `pyodbc`
- **AI Provider:** Google Gemini (via `google-generativeai`)

## Prerequisites
- Python 3.11 with [`uv`](https://docs.astral.sh/uv/getting-started/installation/) for backend dependency management
- Node.js 20+ and npm (or an alternative package manager) for the frontend
- Google Gemini API key with access to current `models/gemini-*` endpoints
- Access credentials for the *AdventureBikes Sales DataMart* SQL Server instance

## Backend Setup

```bash
cd backend
uv sync
```

Update `app/.env.example` (or `app/.env`) with the SQL Server credentials and your Gemini key:

```
DB_SERVER=text
DB_NAME=text
DB_USER=text
DB_PASSWORD=text
GEMINI_API_KEY=text
```

Then launch the API from the `backend` directory:

```bash
cd backend
```

```bash
uv run uvicorn app.api.main:app --reload --port 8000
```

Endpoints:
- `POST /api/query` – generate SQL, execute it, and return analysis + visualization metadata
- `GET /api/graph/sales-organization` – hierarchical sales organization graph
- `GET /api/graph/node/{id}` – drill into a specific node’s metrics
- `GET /api/health` – service health check

## Frontend Setup

Change to the `frontend` directory and install dependencies:

```bash
cd frontend
```

Initialize the project and install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The development UI runs on [http://localhost:3000](http://localhost:3000) and proxies API calls to the FastAPI service at `http://localhost:8000`. Adjust the proxy URL in `src/app/api/*/route.ts` if you host the backend elsewhere.

## Development Notes

- The backend now uses `models/gemini-2.5-pro` by default (configurable via `GEMINI_MODEL`) for analytical responses and the same model for SQL generation. Override with `GEMINI_SQL_MODEL` if you prefer a different model; the `models/` prefix is added automatically when omitted.

- The SQL generation prompt is locked to the `DataSet_Monthly_Sales_and_Quota` table; extend it if more tables become available.
- `CacheManager` is prepared for future caching work but is not yet wired into request handling.

## Scripts
- `uv run uvicorn app.api.main:app --reload --port 8000`
- `npm run dev` (frontend development server)
- `npm run build && npm run start` for a production-ready frontend build
