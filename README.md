# Analytics Platform (Next.js 16 + FastAPI + Gemini)

Business analytics application with a FastAPI backend, SQL Server connectivity, and a Next.js 16.0.1 frontend that communicates with the Gemini API for natural-language insights, SQL generation, and visualization guidance.

## Stack

- **Frontend:** Next.js 16.0.1, React 18, Tailwind CSS, Recharts, force-graph visualizations
- **Backend:** FastAPI, SQLAlchemy, pandas, Microsoft SQL Server via `pyodbc`
- **AI Provider:** Google Gemini (via `google-generativeai`)

## Prerequisites

You should have [`uv`](https://docs.astral.sh/uv/getting-started/installation/) installed and an ODBC driver for Microsoft SQL Server.

## Quick Start

1. Install Node.js 20+. For Node.js we recommend using [`nvm`](https://github.com/nvm-sh/nvm):

   Install or update `nvm` (macOS/Linux):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   ```
   Reload your shell, then install Node.js 20:
   ```bash
   nvm install 20
   ```

   Activate Node.js 20 for the current shell:
   ```bash
   nvm use 20
   ```

   Windows users can install [`nvm-windows`](https://github.com/coreybutler/nvm-windows) or download Node.js 20 from the [official installer](https://nodejs.org/en/download/prebuilt-installer).
   
2. Clone the repository:
   Fetch the project sources:
   ```bash
   git clone https://github.com/kirenz/nextjs-mssql-gemini.git
   ```
3. Enter the project directory:
   Move into the cloned folder:
   ```bash
   cd nextjs-mssql-gemini
   ```
4. Set up the backend environment:
   Switch to the backend workspace:
   ```bash
   cd backend
   ```
   Install Python dependencies with `uv`:
   ```bash
   uv sync
   ```
   Create your environment file from the template:
   ```bash
   cp app/.env.example app/.env
   ```
5. Edit `backend/app/.env` with your SQL Server credentials and `GEMINI_API_KEY`.
6. Start the FastAPI backend (leave this terminal running):
   Launch the development API server:
   ```bash
   uv run uvicorn app.api.main:app --reload --port 8000
   ```
7. In a new terminal, install frontend dependencies and launch Next.js:
   Return to the project root:
   ```bash
   cd nextjs-mssql-gemini
   ```
   Enter the frontend workspace:
   ```bash
   cd frontend
   ```
   Install Node.js dependencies:
   ```bash
   npm install
   ```
   Start the Next.js development server:
   ```bash
   npm run dev
   ```
8. Open http://localhost:3000 in your browser to use the analytics UI.

## Prerequisites
- Python 3.11 with [`uv`](https://docs.astral.sh/uv/getting-started/installation/) for backend dependency management
- Node.js 20+ and npm (or an alternative package manager) for the frontend
- Google Gemini API key with access to current `models/gemini-*` endpoints
- Access credentials for the *AdventureBikes Sales DataMart* SQL Server instance

## Backend Setup

Change to the `backend` directory:

```bash
cd backend
```

Install dependencies using `uv`:

```bash
uv sync
```

Rename `app/.env.example` to `app/.env` and enter the SQL Server credentials and your Gemini key:

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

Start the FastAPI server:

```bash
uv run uvicorn app.api.main:app --reload --port 8000
```

Let this run in the background. Dont close the terminal window/tab.

Endpoints:
- `POST /api/query` – generate SQL, execute it, and return analysis + visualization metadata
- `GET /api/graph/sales-organization` – hierarchical sales organization graph
- `GET /api/graph/node/{id}` – drill into a specific node’s metrics
- `GET /api/health` – service health check

## Frontend Setup

Open a new terminal window/tab.

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
