# COMSOL AI Results Explorer

A full-stack scientific workspace for uploading COMSOL CSV exports, exploring arbitrary detected scalar fields in 2D or 3D, running deterministic numerical analysis, and controlling existing tools with natural-language commands.

The project is an MVP monorepo with no database and no authentication. Uploaded datasets are cached in backend memory and copied to `backend/temp/datasets`; they disappear from the application registry whenever FastAPI restarts.

## Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS, vtk.js, Canvas, SVG, Zod
- Backend: FastAPI, Pydantic, Pandas, NumPy, SciPy, Uvicorn
- AI command interpreter: OpenRouter with GLM-5.2, called only from a Next.js server route

Python remains the source of truth for all numerical results. The language model can only return a validated set of visualization and analysis actions; it cannot execute code or calculate simulation values.

The assistant receives the active dataset ID, exact detected field names, coordinate axes, bounds, current visualization state, recent conversation history, and—when applicable—verified FastAPI results. OpenRouter is constrained by a strict JSON schema, and the same response is validated again with Zod and dataset-aware field, axis, value, and coordinate checks before the centralized action executor runs it.

## Project structure

```text
.
├── frontend/
│   ├── app/
│   │   └── api/chat/route.ts
│   ├── components/
│   │   ├── analysis/
│   │   ├── charts/
│   │   ├── chat/
│   │   ├── upload/
│   │   └── viewer/
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── action-executor.ts
│   │   │   ├── schema.ts
│   │   │   └── system-prompt.ts
│   │   └── api/
│   └── types/
└── backend/
    ├── app/
    │   ├── routers/
    │   ├── schemas/
    │   └── services/
    └── temp/datasets/
```

## Prerequisites

- Node.js 20 or newer and npm
- Python 3.10 or newer

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

FastAPI runs at `http://localhost:8000`. OpenAPI documentation is available at `http://localhost:8000/docs`.

The default CORS origins are `http://localhost:3000` and `http://127.0.0.1:3000`. Override them with a comma-separated environment variable when needed:

```bash
export FRONTEND_ORIGINS=http://localhost:3000
```

## Run the frontend

Open another terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

The minimum local frontend configuration is:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=z-ai/glm-5.2
# OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions
```

`OPENROUTER_API_KEY` is server-only and must never be prefixed with `NEXT_PUBLIC_`. The application remains fully usable without it; only the assistant returns a configuration message.

The AI control flow is:

```text
User chat -> Next.js server route -> GLM-5.2 structured JSON
          -> dataset-aware validation -> centralized action executor
          -> frontend viewer state and/or deterministic FastAPI calculation
          -> optional verified-result explanation
```

Extrema are calculated before the viewer changes state, then their verified row/location drives the selection marker and camera focus. AI `filter` actions are evaluated over the complete DataFrame; FastAPI also returns the verified matches for the current visual sample so Canvas and VTK can emphasize those points without hiding the surrounding simulation context. Chat results are formatted from the returned backend values, not model-generated numbers.

The chat panel has a bounded height, retains its full visible conversation, scrolls messages internally, and automatically follows new user, loading, result, and error messages without scrolling the page.

## CSV expectations

- A numeric X and Y coordinate column is required; Z is optional.
- Coordinate names are detected case-insensitively and support forms such as `x`, `X [m]`, `x_coordinate`, and `position x`.
- Remaining numeric columns become scalar fields automatically.
- Text columns are ignored for scientific calculations.
- Common comma, semicolon, and tab delimiters are detected.
- Upload size is limited to 50 MB.

COMSOL-style leading `%` or `#` metadata lines are ignored. A commented coordinate header is recovered when possible.

For a quick demo, upload `examples/comsol-sample.csv` (3D) or `examples/comsol-2d-sample.csv` (2D).

## API

### Health

```text
GET /health
GET /api/health
```

### Upload a dataset

```text
POST /datasets/upload
Content-Type: multipart/form-data
```

The form field is named `file`. The response contains the generated `datasetId`, detected dimension, coordinate columns, scalar fields, row count, and bounds.

### Visualization points

```text
GET /datasets/{datasetId}/points?max_points=50000
```

The response is columnar for efficient browser transfer. Large datasets are deterministically sampled for visualization only.

### Numerical actions

```text
POST /datasets/{datasetId}/execute
```

Request example:

```json
{
  "action": "statistics",
  "params": {
    "field": "Temperature [K]"
  }
}
```

Supported actions:

- `find_max`
- `find_min`
- `statistics`
- `filter`
- `profile`
- `nearest_point`

All actions use the complete cached DataFrame, including when the browser is displaying a downsampled point set.

## Validation commands

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
```

Backend:

```bash
cd backend
.venv/bin/python -m compileall app
```
