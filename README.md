# Analytics AI Platform (Next.js 16 + FastAPI + Gemini)

Business analytics application with a FastAPI backend, SQL Server connectivity, and a Next.js 16.0.1 frontend that communicates with the Gemini API for natural-language insights, SQL generation, and visualization guidance.

## Stack

- **Frontend:** Next.js 16.0.1, React 18, Tailwind CSS, Recharts, force-graph visualizations
- **Backend:** FastAPI, SQLAlchemy, pandas, Microsoft SQL Server via `pyodbc`
- **AI Provider:** Google Gemini (via `google-generativeai`)

## Prerequisites

- You should have [`uv`](https://docs.astral.sh/uv/getting-started/installation/) installed and an ODBC driver for Microsoft SQL Server.

- Google Gemini API key with access to current `models/gemini-*` endpoints
- Access credentials for the *AdventureBikes Sales DataMart* SQL Server instance

## Setup Instructions

> [!NOTE]
> We use nvm for Node.js version management so you can easily switch between projects.


1. Install Node.js 20 with[`nvm`](https://github.com/nvm-sh/nvm):

   **MacOS/Linux:**

   Install or update `nvm` (macOS/Linux):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   ```
   Reload your shell, then install Node.js 20:
   ```bash
   nvm install 20
   ```

   Activate Node.js 20 for the current shell:
   ```bash
   nvm use 20
   ```

   **Windows** 
   
   - Install [`nvm-windows`](https://github.com/coreybutler/nvm-windows) or download Node.js 20 from the [official installer](https://nodejs.org/en/download/prebuilt-installer).
   


2. Clone the repository:
   Fetch the project sources:
   ```bash
   git clone https://github.com/kirenz/nextjs-mssql-gemini.git
   ```

 3.  Move into the cloned folder:
   
   ```bash
   cd nextjs-mssql-gemini
   ```

4. Set up the **backend environment**:
   
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


6. Install **frontend dependencies** and launch Next.js:

   Return to the project root:
   ```bash
   cd ..
   ```
   Enter the frontend workspace:
   ```bash
   cd frontend
   ```
   Install Node.js dependencies:
   ```bash
   npm install
   ```


## How to Run the Application

Change to the `backend` directory:

```bash
cd backend
```

Start the FastAPI backend (leave this terminal running):

```bash
uv run uvicorn app.api.main:app --reload --port 8000
```

Let this run in the background. Dont close the terminal window/tab.

Open a new terminal window/tab.

Change to the `frontend` directory:

```bash
cd frontend
```

Start the Next.js development server:

```bash
npm run dev
```

The development UI runs on [http://localhost:3000](http://localhost:3000) and proxies API calls to the FastAPI service at `http://localhost:8000`. Adjust the proxy URL in `src/app/api/*/route.ts` if you host the backend elsewhere.

## Dashboard Modules

- **Analytics** — Chat with the AdventureBikes data mart, auto-generate SQL through Gemini, and view suggested charts.
- **Knowledge Graph** — Explore the sales hierarchy at a glance via the force-directed graph and drill into node metrics.
- **Stored Procedures** — Discover and execute SQL Server stored procedures with friendly parameter forms.
- **Reports (Forecasting)** — New report builder at `/reports` that offers cascading dropdown filters, SARIMAX forecasts with confidence bounds, charts, CSV exports, and downloadable PPTX slide decks powered by the `/api/reports/*` FastAPI endpoints.

## Development Notes

- The backend uses `models/gemini-2.5-flash-lite` by default (configurable via `GEMINI_MODEL`) for analytical responses and the same model for SQL generation. Override with `GEMINI_SQL_MODEL` if you prefer a different model; the `models/` prefix is added automatically when omitted.

- The SQL generation prompt is locked to the `DataSet_Monthly_Sales_and_Quota` table; extend it if more tables become available.
