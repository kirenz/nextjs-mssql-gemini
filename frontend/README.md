## Frontend (Next.js 16.0.1)

This folder contains the Next.js 16.0.1 analytics UI. It relies on the FastAPI backend (running on `http://localhost:8000`) for Gemini-powered query generation and SQL execution.

### Requirements
- Node.js 20+
- npm (or pnpm/yarn/bun)  
The repository does not bundle Node; install it locally or via a version manager.

### Install & Run
```bash
npm install
npm run dev
```

The development server runs on [http://localhost:3000](http://localhost:3000). API routes under `src/app/api` proxy requests to the backend (`http://localhost:8000`). Update these URLs if you deploy the backend to a different origin.

### Production Build
```bash
npm run build
npm run start
```

### Notable Dependencies
- `recharts` for standard charting
- `react-force-graph-2d` for network visualizations of the sales organization
- `react-markdown` to render Gemini-generated analysis
- Shadcn UI primitives (`card`, `button`, `input`, etc.)

### Pages & Features
- `/analytics` – natural-language analytics console backed by Gemini and SQL Server.
- `/graph` – knowledge-graph view of the AdventureBikes sales hierarchy.
- `/procedures` – stored procedure explorer/execution workbench.
- `/reports` – cascading dropdowns + SARIMAX forecasting with summary cards, charts, CSV export, and PPTX slide deck downloads.

### Suggested Enhancements
- Centralize API URLs via environment variables (e.g., `process.env.NEXT_PUBLIC_API_URL`)
- Add Suspense or skeleton states for long-running Gemini requests
- Extend the analytics dashboard with saved query history
