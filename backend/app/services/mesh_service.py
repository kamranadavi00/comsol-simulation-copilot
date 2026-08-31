from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any, Iterable

import numpy as np
import pandas as pd

from app.schemas.datasets import MeshCoordinates, MeshDataResponse, MeshMetadata
from app.services.exceptions import DatasetValidationError


NODE_ID_ALIASES = {"nodeid", "nodeindex", "pointid", "vertexid", "globalnodeid"}
ELEMENT_ID_ALIASES = {"elementid", "elementindex", "cellid", "globalelid", "elemid"}
ELEMENT_TYPE_ALIASES = {"elementtype", "celltype", "type", "shape", "elementshape"}
DOMAIN_ID_ALIASES = {"domainid", "domain", "subdomainid", "regionid", "materialdomain"}
BOUNDARY_ID_ALIASES = {"boundaryid", "boundary", "faceid", "boundarynumber"}
CONNECTIVITY_ALIASES = {"connectivity", "elementconnectivity", "nodes", "nodeids", "vertices"}
COORDINATE_ALIASES = {
    "x": {"x", "xcoord", "xcoordinate", "coordinatex", "positionx", "posx"},
    "y": {"y", "ycoord", "ycoordinate", "coordinatey", "positiony", "posy"},
    "z": {"z", "zcoord", "zcoordinate", "coordinatez", "positionz", "posz"},
}


@dataclass
class MeshElement:
    element_id: str
    element_type: str
    node_indices: list[int]
    domain_id: str | None
    boundary_id: str | None
    values: dict[str, float | None]


@dataclass
class MeshRecord:
    node_ids: list[str]
    elements: list[MeshElement]
    node_fields: list[str]
    element_fields: list[str]
    surface_triangles: list[int]
    surface_owners: list[int]
    surface_edges: list[int]
    all_edges: list[int]
    statistics: MeshMetadata


def normalized_name(value: object) -> str:
    without_units = re.sub(r"\[[^]]*]|\([^)]*\)", "", str(value).lower())
    return re.sub(r"[^a-z0-9]", "", without_units)


def _column(frame: pd.DataFrame, aliases: set[str]) -> str | None:
    return next((str(column) for column in frame.columns if normalized_name(column) in aliases), None)


def coordinate_columns(frame: pd.DataFrame) -> dict[str, str]:
    found: dict[str, str] = {}
    for axis, aliases in COORDINATE_ALIASES.items():
        match = _column(frame, aliases)
        if match and pd.api.types.is_numeric_dtype(frame[match]):
            found[axis] = match
    return found


def connectivity_columns(frame: pd.DataFrame) -> list[str]:
    matches: list[tuple[int, str]] = []
    for column in frame.columns:
        name = normalized_name(column)
        match = re.fullmatch(r"(?:n|node|vertex|point)(\d+)", name)
        if match:
            matches.append((int(match.group(1)), str(column)))
    return [column for _, column in sorted(matches)]


def has_mesh_connectivity(frame: pd.DataFrame) -> bool:
    return len(connectivity_columns(frame)) >= 2 or _column(frame, CONNECTIVITY_ALIASES) is not None


def has_node_table(frame: pd.DataFrame) -> bool:
    coordinates = coordinate_columns(frame)
    return "x" in coordinates and "y" in coordinates and _column(frame, NODE_ID_ALIASES) is not None


def _id_string(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, (int, np.integer)):
        return str(int(value))
    if isinstance(value, (float, np.floating)) and float(value).is_integer():
        return str(int(value))
    text = str(value).strip()
    return text or None


def _connectivity_values(row: pd.Series, columns: list[str], combined_column: str | None) -> list[str]:
    values: list[Any] = []
    if columns:
        values = [row[column] for column in columns]
    elif combined_column:
        raw = row[combined_column]
        if raw is not None and not pd.isna(raw):
            values = re.split(r"[\s,;|]+", str(raw).strip(" [](){}"))
    result: list[str] = []
    for value in values:
        node_id = _id_string(value)
        if node_id is not None:
            result.append(node_id)
    return result


def _element_type(value: Any, node_count: int, dimension: str) -> str:
    normalized = normalized_name(value) if value is not None and not pd.isna(value) else ""
    aliases = {
        "tetra": {"tet", "tetra", "tetrahedron", "tetrahedral", "tet4", "ctetra"},
        "triangle": {"tri", "tria", "triangle", "triangular", "tri3"},
        "hexahedron": {"hex", "hexa", "hexahedron", "hexahedral", "hex8", "brick"},
        "quadrilateral": {"quad", "quadrilateral", "quadrangle", "quad4"},
        "wedge": {"wedge", "prism", "triangularprism", "penta", "wedge6"},
        "pyramid": {"pyramid", "pyramid5"},
        "line": {"line", "edge", "segment", "bar", "line2"},
    }
    for canonical, names in aliases.items():
        if normalized in names:
            return canonical
    inferred = {
        2: "line",
        3: "triangle",
        5: "pyramid",
        6: "wedge",
        8: "hexahedron",
    }.get(node_count)
    if node_count == 4:
        inferred = "tetra" if dimension == "3D" else "quadrilateral"
    return inferred or normalized or f"{node_count}-node element"


def _faces(element_type: str, nodes: list[int]) -> list[tuple[int, ...]]:
    if element_type == "tetra" and len(nodes) >= 4:
        return [(nodes[0], nodes[2], nodes[1]), (nodes[0], nodes[1], nodes[3]), (nodes[1], nodes[2], nodes[3]), (nodes[2], nodes[0], nodes[3])]
    if element_type == "hexahedron" and len(nodes) >= 8:
        return [
            (nodes[0], nodes[3], nodes[2], nodes[1]),
            (nodes[4], nodes[5], nodes[6], nodes[7]),
            (nodes[0], nodes[1], nodes[5], nodes[4]),
            (nodes[1], nodes[2], nodes[6], nodes[5]),
            (nodes[2], nodes[3], nodes[7], nodes[6]),
            (nodes[3], nodes[0], nodes[4], nodes[7]),
        ]
    if element_type == "wedge" and len(nodes) >= 6:
        return [
            (nodes[0], nodes[2], nodes[1]),
            (nodes[3], nodes[4], nodes[5]),
            (nodes[0], nodes[1], nodes[4], nodes[3]),
            (nodes[1], nodes[2], nodes[5], nodes[4]),
            (nodes[2], nodes[0], nodes[3], nodes[5]),
        ]
    if element_type == "pyramid" and len(nodes) >= 5:
        return [
            (nodes[0], nodes[3], nodes[2], nodes[1]),
            (nodes[0], nodes[1], nodes[4]),
            (nodes[1], nodes[2], nodes[4]),
            (nodes[2], nodes[3], nodes[4]),
            (nodes[3], nodes[0], nodes[4]),
        ]
    if element_type == "triangle" and len(nodes) >= 3:
        return [tuple(nodes[:3])]
    if element_type == "quadrilateral" and len(nodes) >= 4:
        return [tuple(nodes[:4])]
    return []


def _edges(element_type: str, nodes: list[int]) -> list[tuple[int, int]]:
    local_edges = {
        "line": [(0, 1)],
        "triangle": [(0, 1), (1, 2), (2, 0)],
        "quadrilateral": [(0, 1), (1, 2), (2, 3), (3, 0)],
        "tetra": [(0, 1), (1, 2), (2, 0), (0, 3), (1, 3), (2, 3)],
        "hexahedron": [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)],
        "wedge": [(0, 1), (1, 2), (2, 0), (3, 4), (4, 5), (5, 3), (0, 3), (1, 4), (2, 5)],
        "pyramid": [(0, 1), (1, 2), (2, 3), (3, 0), (0, 4), (1, 4), (2, 4), (3, 4)],
    }.get(element_type, [])
    return [(nodes[a], nodes[b]) for a, b in local_edges if a < len(nodes) and b < len(nodes)]


def _triangulate(face: tuple[int, ...]) -> list[tuple[int, int, int]]:
    if len(face) < 3:
        return []
    return [(face[0], face[index], face[index + 1]) for index in range(1, len(face) - 1)]


def _surface_topology(elements: list[MeshElement]) -> tuple[list[int], list[int], list[int], list[int]]:
    volume_types = {"tetra", "hexahedron", "wedge", "pyramid"}
    face_uses: dict[tuple[int, ...], list[tuple[tuple[int, ...], int]]] = defaultdict(list)
    explicit_faces: dict[tuple[int, ...], tuple[tuple[int, ...], int]] = {}
    all_edge_set: set[tuple[int, int]] = set()

    for owner, element in enumerate(elements):
        for edge in _edges(element.element_type, element.node_indices):
            all_edge_set.add(tuple(sorted(edge)))
        faces = _faces(element.element_type, element.node_indices)
        if element.element_type in volume_types:
            for face in faces:
                face_uses[tuple(sorted(face))].append((face, owner))
        else:
            for face in faces:
                explicit_faces[tuple(sorted(face))] = (face, owner)

    boundary_faces: list[tuple[tuple[int, ...], int]] = []
    for key, uses in face_uses.items():
        if len(uses) == 1 and key not in explicit_faces:
            boundary_faces.append(uses[0])
    boundary_faces.extend(explicit_faces.values())

    triangles: list[int] = []
    owners: list[int] = []
    surface_edge_set: set[tuple[int, int]] = set()
    for face, owner in boundary_faces:
        for index, start in enumerate(face):
            surface_edge_set.add(tuple(sorted((start, face[(index + 1) % len(face)]))))
        for triangle in _triangulate(face):
            triangles.extend(triangle)
            owners.append(owner)

    surface_edges = [node for edge in sorted(surface_edge_set) for node in edge]
    all_edges = [node for edge in sorted(all_edge_set) for node in edge]
    return triangles, owners, surface_edges, all_edges


def _usable_numeric_fields(frame: pd.DataFrame, excluded: Iterable[str | None]) -> list[str]:
    blocked = {column for column in excluded if column}
    return [
        str(column)
        for column in frame.columns
        if column not in blocked
        and pd.api.types.is_numeric_dtype(frame[column])
        and frame[column].notna().any()
    ]


def _tier(element_count: int) -> str:
    if element_count < 100_000:
        return "full"
    if element_count < 500_000:
        return "surface"
    if element_count < 2_000_000:
        return "decimated"
    return "progressive"


def reconstruct_mesh(
    node_frame: pd.DataFrame,
    element_frame: pd.DataFrame,
    result_frames: list[pd.DataFrame] | None = None,
) -> tuple[pd.DataFrame, dict[str, str], MeshRecord]:
    coordinates = coordinate_columns(node_frame)
    node_id_column = _column(node_frame, NODE_ID_ALIASES)
    if "x" not in coordinates or "y" not in coordinates or not node_id_column:
        raise DatasetValidationError("Mesh nodes require node ID, X, and Y columns (Z is optional).")

    analysis = node_frame.copy()
    analysis["__mesh_node_id__"] = analysis[node_id_column].map(_id_string)
    analysis = analysis.dropna(subset=["__mesh_node_id__", coordinates["x"], coordinates["y"]])
    analysis = analysis.drop_duplicates("__mesh_node_id__", keep="first").reset_index(drop=True)

    for result_frame in result_frames or []:
        result_id = _column(result_frame, NODE_ID_ALIASES)
        if not result_id:
            continue
        prepared = result_frame.copy()
        prepared["__mesh_node_id__"] = prepared[result_id].map(_id_string)
        result_fields = _usable_numeric_fields(prepared, [result_id, "__mesh_node_id__"])
        if result_fields:
            analysis = analysis.merge(
                prepared[["__mesh_node_id__", *result_fields]].drop_duplicates("__mesh_node_id__"),
                on="__mesh_node_id__",
                how="left",
                suffixes=("", "__result"),
            )
            for field in result_fields:
                result_name = f"{field}__result"
                if result_name in analysis:
                    analysis[field] = analysis[result_name].combine_first(analysis.get(field))
                    analysis = analysis.drop(columns=[result_name])

    node_ids = analysis["__mesh_node_id__"].astype(str).tolist()
    node_lookup = {node_id: index for index, node_id in enumerate(node_ids)}
    connectivity = connectivity_columns(element_frame)
    combined_connectivity = _column(element_frame, CONNECTIVITY_ALIASES)
    element_id_column = _column(element_frame, ELEMENT_ID_ALIASES)
    type_column = _column(element_frame, ELEMENT_TYPE_ALIASES)
    domain_column = _column(element_frame, DOMAIN_ID_ALIASES)
    boundary_column = _column(element_frame, BOUNDARY_ID_ALIASES)
    if len(connectivity) < 2 and not combined_connectivity:
        raise DatasetValidationError("Element connectivity columns were not found in the mesh dataset.")

    structural = [
        element_id_column,
        type_column,
        domain_column,
        boundary_column,
        combined_connectivity,
        *connectivity,
        *coordinate_columns(element_frame).values(),
        _column(element_frame, NODE_ID_ALIASES),
    ]
    element_fields = _usable_numeric_fields(element_frame, structural)
    dimension = "3D" if "z" in coordinates else "2D"
    elements: list[MeshElement] = []
    missing_references = 0
    for position, row in element_frame.iterrows():
        referenced_ids = _connectivity_values(row, connectivity, combined_connectivity)
        if len(referenced_ids) < 2:
            continue
        if any(node_id not in node_lookup for node_id in referenced_ids):
            missing_references += 1
            continue
        element_id = _id_string(row[element_id_column]) if element_id_column else str(position)
        element_type = _element_type(row[type_column] if type_column else None, len(referenced_ids), dimension)
        values = {
            field: float(row[field]) if pd.notna(row[field]) else None
            for field in element_fields
        }
        elements.append(
            MeshElement(
                element_id=element_id or str(position),
                element_type=element_type,
                node_indices=[node_lookup[node_id] for node_id in referenced_ids],
                domain_id=_id_string(row[domain_column]) if domain_column else None,
                boundary_id=_id_string(row[boundary_column]) if boundary_column else None,
                values=values,
            )
        )
    if not elements:
        detail = " All connectivity referenced unknown node IDs." if missing_references else ""
        raise DatasetValidationError(f"No valid finite elements could be reconstructed.{detail}")

    # Element-associated results remain available as exact cell values, and are
    # also projected to incident nodes for the optional smooth field rendering.
    for field in element_fields:
        if field in analysis and analysis[field].notna().any():
            continue
        totals = np.zeros(len(analysis), dtype=float)
        counts = np.zeros(len(analysis), dtype=np.int64)
        for element in elements:
            value = element.values.get(field)
            if value is None or not np.isfinite(value):
                continue
            for node_index in element.node_indices:
                totals[node_index] += value
                counts[node_index] += 1
        analysis[field] = [
            float(totals[index] / counts[index]) if counts[index] else np.nan
            for index in range(len(analysis))
        ]

    excluded_node_columns = [node_id_column, "__mesh_node_id__", *coordinates.values(), *structural]
    node_fields = _usable_numeric_fields(analysis, excluded_node_columns)
    surface_triangles, surface_owners, surface_edges, all_edges = _surface_topology(elements)
    type_counts = dict(Counter(element.element_type for element in elements))
    domains = {element.domain_id for element in elements if element.domain_id is not None}
    boundaries = {element.boundary_id for element in elements if element.boundary_id is not None}
    mesh_dimension = (
        "3D"
        if any(element.element_type in {"tetra", "hexahedron", "wedge", "pyramid"} for element in elements)
        else "2D"
        if any(element.element_type in {"triangle", "quadrilateral"} for element in elements)
        else "1D"
    )
    statistics = MeshMetadata(
        nodeCount=len(node_ids),
        elementCount=len(elements),
        elementTypeCounts=type_counts,
        domainCount=len(domains) if domains else None,
        boundaryCount=len(boundaries) if boundaries else None,
        meshDimension=mesh_dimension,
        nodeFields=node_fields,
        elementFields=element_fields,
        visualizationTier=_tier(len(elements)),
    )
    analysis = analysis.drop(columns=["__mesh_node_id__"])
    return analysis, coordinates, MeshRecord(
        node_ids=node_ids,
        elements=elements,
        node_fields=node_fields,
        element_fields=element_fields,
        surface_triangles=surface_triangles,
        surface_owners=surface_owners,
        surface_edges=surface_edges,
        all_edges=all_edges,
        statistics=statistics,
    )


def serialize_mesh(dataset_id: str, dataframe: pd.DataFrame, coordinates: Any, mesh: MeshRecord) -> MeshDataResponse:
    connectivity: list[int] = []
    offsets = [0]
    for element in mesh.elements:
        connectivity.extend(element.node_indices)
        offsets.append(len(connectivity))
    z_values = dataframe[coordinates.z].astype(float).tolist() if coordinates.z else [0.0] * len(dataframe)
    return MeshDataResponse(
        datasetId=dataset_id,
        nodeIds=mesh.node_ids,
        coordinates=MeshCoordinates(
            x=dataframe[coordinates.x].astype(float).tolist(),
            y=dataframe[coordinates.y].astype(float).tolist(),
            z=z_values,
        ),
        nodeFields={
            field: [float(value) if pd.notna(value) else None for value in dataframe[field]]
            for field in mesh.node_fields
        },
        elementIds=[element.element_id for element in mesh.elements],
        elementTypes=[element.element_type for element in mesh.elements],
        elementOffsets=offsets,
        connectivity=connectivity,
        domainIds=[element.domain_id for element in mesh.elements],
        boundaryIds=[element.boundary_id for element in mesh.elements],
        elementFields={
            field: [element.values.get(field) for element in mesh.elements]
            for field in mesh.element_fields
        },
        surfaceTriangles=mesh.surface_triangles,
        surfaceOwners=mesh.surface_owners,
        surfaceEdges=mesh.surface_edges,
        allEdges=mesh.all_edges,
        statistics=mesh.statistics,
    )
