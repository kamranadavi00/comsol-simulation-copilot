import unittest

import pandas as pd

from app.services.mesh_service import reconstruct_mesh


class MeshReconstructionTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
