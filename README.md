# COMSOL AI Results Explorer

A full-stack scientific workspace for uploading COMSOL CSV exports, reconstructing original FEM topology when connectivity is present, exploring arbitrary detected scalar fields in 2D or 3D, running deterministic numerical analysis, and controlling existing tools with natural-language commands.

The project is an MVP monorepo with no database and no authentication. Uploaded datasets are cached in backend memory and copied to `backend/temp/datasets`; they disappear from the application registry whenever FastAPI restarts.

## Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS, vtk.js, Canvas, SVG, Zod
- Backend: FastAPI, Pydantic, Pandas, NumPy, SciPy, Uvicorn
- AI command interpreter: OpenRouter with GLM-5.2, called only from a Next.js server route

Python remains the source of truth for all numerical results. The language model can only return a validated set of visualization and analysis actions; it cannot execute code or calculate simulation values.

The assistant receives the active dataset ID, exact detected field names, coordinate axes, bounds, current visualization state, recent conversation history, and—when applicable—verified FastAPI results. OpenRouter is constrained by a strict JSON schema, and the same response is validated again with Zod and dataset-aware field, axis, value, and coordinate checks before the centralized action executor runs it.

## Original COMSOL mesh reconstruction

The mesh pipeline never infers connectivity from spatial proximity. When node IDs and element connectivity are available, FastAPI reconstructs tetrahedral, triangular, hexahedral, quadrilateral, wedge/prism, pyramid, and line topology. Exterior volume faces are extracted by retaining faces with exactly one owner, then sent to a dedicated indexed vtk.js renderer.

The viewer provides surface, wireframe, volume-edge, mesh-plus-field, marching-tetra isosurfaces, sampled vector fields, and true element-intersection slice views (XY/XZ/YZ/custom); smooth point-field interpolation; optional element coloring; nodes and internal edges; GPU clipping planes; mesh opacity/edge/node controls; perspective and orthographic cameras; LOD-oriented quality modes; verified mesh statistics; and node/element picking. Every exact mesh is labeled **Original COMSOL mesh**. Coordinate-only datasets continue to use the point renderer and explicitly report that connectivity is unavailable.

Mesh inputs can be one combined CSV or a simultaneous selection of separate files:

```text
nodes.csv:    node_id, x, y, z
elements.csv: element_id, element_type, node_1 ... node_8, domain_id, boundary_id
results.csv:  node_id, temperature, pressure, velocity_x, velocity_y, velocity_z
```

Column matching is case- and punctuation-insensitive and accepts common variants such as `nodeId`, `elementId`, `vertex1`, and a delimited `connectivity` column. Select the three `examples/comsol-mesh-*.csv` files together for a quick mesh demo.

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

Extrema are calculated before the viewer changes state, then their verified row/location drives the selection marker and camera focus. AI `filter` actions are evaluated by FastAPI over the complete dataset. Point-cloud datasets return verified rows for the current visual sample. Real mesh datasets instead return point/cell association, matching original IDs, exact serialized mesh indexes, and selection bounds; vtk.js renders those cells in a separate highlight actor while leaving the base mesh visible. Chat results are formatted from returned backend counts, not model-generated numbers.

For point-associated mesh fields, the default nodal-to-cell selection mode is `average`: the predicate is applied to the mean of every cell's finite nodal values. This avoids expanding a region merely because one corner crosses the threshold. The execute endpoint also accepts `selectionMode: "any"` and `selectionMode: "all"`. Cell-associated fields are tested directly against their original element values. Metadata exposes the native associations as `mesh.pointFields` and `mesh.cellFields`; projected cell values in `mesh.nodeFields` exist only for optional smooth rendering and are never used in place of exact cell data during filtering.

The chat panel has a bounded height, retains its full visible conversation, scrolls messages internally, and automatically follows new user, loading, result, and error messages without scrolling the page.

## CSV expectations

- A numeric X and Y coordinate column is required; Z is optional.
- Coordinate names are detected case-insensitively and support forms such as `x`, `X [m]`, `x_coordinate`, and `position x`.
- Remaining numeric columns become scalar fields automatically.
- Text columns are ignored for scientific calculations.
- Common comma, semicolon, and tab delimiters are detected.
- Upload size is limited to 50 MB.

COMSOL-style leading `%` or `#` metadata lines are ignored. A commented coordinate header is recovered when possible.

For a quick point-data demo, upload `examples/comsol-sample.csv` (3D) or `examples/comsol-2d-sample.csv` (2D). For an original-topology demo, select the three `examples/comsol-mesh-*.csv` files together.

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

### Upload separate mesh tables

```text
POST /datasets/upload-mesh
Content-Type: multipart/form-data
```

Append each CSV under the `files` form field. The combined mesh limit defaults to 512 MB and can be changed with `MAX_MESH_UPLOAD_MB`; ordinary single-table uploads remain limited to 50 MB. Node-associated results are joined by normalized node ID.

### Visualization points

```text
GET /datasets/{datasetId}/points?max_points=50000
```

The response is columnar for efficient browser transfer. Large datasets are deterministically sampled for visualization only.

### Original mesh topology

```text
GET /datasets/{datasetId}/mesh
```

Returns node coordinates and fields, compact element offsets/connectivity, element metadata and fields, exterior triangles with owner indexes, surface/internal edges, and mesh statistics. It returns an error rather than fabricating a mesh when connectivity is absent.

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

A mesh threshold request uses the same endpoint:

```json
{
  "action": "filter",
  "params": {
    "field": "Temperature [K]",
    "operator": ">",
    "value": 300,
    "selectionMode": "average"
  }
}
```

The response includes `association`, `matchedPointCount`, `matchedCellCount`, `matchedPointIds`, `matchedCellIds`, `matchedPointIndexes`, `matchedCellIndexes`, and `bounds`. Indexes refer exactly to the arrays returned by `GET /datasets/{datasetId}/mesh`; the original COMSOL IDs are included alongside them for provenance checks. The AI action intentionally contains none of these calculated IDs.

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
