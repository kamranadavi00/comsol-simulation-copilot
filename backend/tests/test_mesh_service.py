import unittest
from pathlib import Path

import pandas as pd

from app.schemas.datasets import CoordinateColumns, DatasetMetadata
from app.services.dataset_service import DatasetRecord
from app.services.filter_service import filter_rows
from app.services.mesh_service import reconstruct_mesh


class MeshReconstructionTests(unittest.TestCase):
    @staticmethod
    def mesh_record() -> DatasetRecord:
        nodes = pd.DataFrame(
            {
                "node_id": [1, 2, 3, 4, 5],
                "x": [0, 1, 0, 0, 1],
                "y": [0, 0, 1, 0, 1],
                "z": [0, 0, 0, 1, 1],
                "temperature": [100, 200, 300, 400, 500],
            }
        )
        elements = pd.DataFrame(
            {
                "element_id": [101, 102],
                "element_type": ["tetra", "tetra"],
                "node_1": [1, 2],
                "node_2": [2, 3],
                "node_3": [3, 4],
                "node_4": [4, 5],
                "element_energy": [12.5, 18.75],
            }
        )
        dataframe, _, mesh = reconstruct_mesh(nodes, elements)
        metadata = DatasetMetadata(
            datasetId="mesh-test",
            filename="mesh.csv",
            rowCount=len(dataframe),
            dimension="3D",
            coordinateColumns=CoordinateColumns(x="x", y="y", z="z"),
            fields=["temperature", "element_energy"],
            bounds={"x": (0, 1), "y": (0, 1), "z": (0, 1)},
            mesh=mesh.statistics,
        )
        return DatasetRecord(
            path=Path("mesh.csv"),
            filename="mesh.csv",
            dataframe=dataframe,
            metadata=metadata,
            mesh=mesh,
        )

    def test_extracts_only_exterior_tetra_faces(self) -> None:
        nodes = pd.DataFrame(
            {
                "node_id": [1, 2, 3, 4, 5],
                "x": [0, 1, 0, 0, 1],
                "y": [0, 0, 1, 0, 1],
                "z": [0, 0, 0, 1, 1],
                "temperature": [300, 325, 350, 375, 400],
            }
        )
        elements = pd.DataFrame(
            {
                "element_id": [101, 102],
                "element_type": ["tetra", "tetra"],
                "node_1": [1, 2],
                "node_2": [2, 3],
                "node_3": [3, 4],
                "node_4": [4, 5],
                "domain_id": [1, 2],
                "element_energy": [12.5, 18.75],
            }
        )
        _, _, mesh = reconstruct_mesh(nodes, elements)
        self.assertEqual(len(mesh.surface_triangles) // 3, 6)
        self.assertEqual(mesh.statistics.domain_count, 2)
        self.assertEqual(mesh.statistics.element_type_counts, {"tetra": 2})
        self.assertEqual(mesh.element_fields, ["element_energy"])
        self.assertIn("element_energy", mesh.node_fields)

    def test_accepts_alternate_names_and_connectivity_string(self) -> None:
        nodes = pd.DataFrame(
            {
                "nodeId": ["a", "b", "c", "d"],
                "X [m]": [0, 1, 0, 0],
                "Y [m]": [0, 0, 1, 0],
                "Z [m]": [0, 0, 0, 1],
                "Pressure [Pa]": [1, 2, 3, 4],
            }
        )
        elements = pd.DataFrame(
            {"elementId": [9], "elementType": ["tet4"], "connectivity": ["a b c d"]}
        )
        _, _, mesh = reconstruct_mesh(nodes, elements)
        self.assertEqual(mesh.elements[0].node_indices, [0, 1, 2, 3])
        self.assertEqual(len(mesh.surface_triangles) // 3, 4)

    def test_supports_common_linear_element_topologies(self) -> None:
        cases = {
            "triangle": (3, 1),
            "quadrilateral": (4, 2),
            "hexahedron": (8, 12),
            "wedge": (6, 8),
            "line": (2, 0),
        }
        for element_type, (node_count, expected_triangles) in cases.items():
            with self.subTest(element_type=element_type):
                nodes = pd.DataFrame(
                    {
                        "node_id": list(range(1, node_count + 1)),
                        "x": [float(index & 1) for index in range(node_count)],
                        "y": [float((index >> 1) & 1) for index in range(node_count)],
                        "z": [float((index >> 2) & 1) for index in range(node_count)],
                        "temperature": list(range(node_count)),
                    }
                )
                row = {"element_id": 1, "element_type": element_type}
                row.update({f"vertex{index + 1}": index + 1 for index in range(node_count)})
                _, _, mesh = reconstruct_mesh(nodes, pd.DataFrame([row]))
                self.assertEqual(len(mesh.surface_triangles) // 3, expected_triangles)

    def test_point_threshold_uses_connectivity_and_average_by_default(self) -> None:
        result = filter_rows(
            self.mesh_record(),
            {"field": "temperature", "operator": ">", "value": 300},
        )
        self.assertEqual(result["association"], "point")
        self.assertEqual(result["selectionMode"], "average")
        self.assertEqual(result["matchedPointIds"], ["4", "5"])
        self.assertEqual(result["matchedCellIndexes"], [1])
        self.assertEqual(result["matchedCellIds"], ["102"])
        self.assertEqual(result["bounds"], {"x": [0.0, 1.0], "y": [0.0, 1.0], "z": [0.0, 1.0]})

    def test_point_threshold_supports_any_and_all_modes(self) -> None:
        record = self.mesh_record()
        any_result = filter_rows(
            record,
            {"field": "temperature", "operator": ">", "value": 300, "selectionMode": "any"},
        )
        all_result = filter_rows(
            record,
            {"field": "temperature", "operator": ">", "value": 300, "selectionMode": "all"},
        )
        self.assertEqual(any_result["matchedCellIndexes"], [0, 1])
        self.assertEqual(all_result["matchedCellIndexes"], [])
        self.assertIsNone(all_result["bounds"])

    def test_mesh_threshold_supports_inclusive_operators(self) -> None:
        record = self.mesh_record()
        cases = [
            (">=", 350, [1]),
            ("<", 250, []),
            ("<=", 250, [0]),
        ]
        for comparison, value, expected in cases:
            with self.subTest(operator=comparison):
                result = filter_rows(
                    record,
                    {"field": "temperature", "operator": comparison, "value": value},
                )
                self.assertEqual(result["matchedCellIndexes"], expected)

    def test_cell_threshold_uses_original_element_values(self) -> None:
        result = filter_rows(
            self.mesh_record(),
            {"field": "element_energy", "operator": "<", "value": 15},
        )
        self.assertEqual(result["association"], "cell")
        self.assertIsNone(result["selectionMode"])
        self.assertEqual(result["matchedPointCount"], 0)
        self.assertEqual(result["matchedCellIndexes"], [0])
        self.assertEqual(result["matchedCellIds"], ["101"])


if __name__ == "__main__":
    unittest.main()
