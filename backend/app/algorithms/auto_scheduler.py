"""
Purpose: Auto Timetable Scheduler Algorithm
Author: Smart Timetable Backend Team
Module Description: Generates a conflict-free weekly grid by reducing the
problem to bipartite edge coloring.

Each class takes periods of its subjects; every subject has exactly one
applicable faculty per class. The constraint "a faculty cannot teach two
classes in the same (day, period)" means the class->faculty demands form a
bipartite multigraph whose edges must be colored with the week's slots.

The graph is regularized to a Delta-regular bipartite multigraph (Delta = max
degree, which is always <= the number of weekly slots), then perfect matchings
are extracted one at a time - each perfect matching is one slot, and because
the graph is bipartite a perfect matching always exists (Hall's theorem /
Konig). This construction is guaranteed to place every required period without
faculty conflicts.

Additional guarantees:
  - every class has its own room (room conflicts cannot arise during generation)
  - break / lunch periods never contain a class
  - per-subject period counts are capped by each faculty's weekly slot capacity
    so an over-subscribed roster still yields a valid timetable (extra slots
    become free periods)
"""

from typing import Any, Dict, List, Optional, Tuple

from app.services.setup_config import instructional_period_numbers
from app.utils.exceptions import SchedulingFailureError


class AutoScheduler:
    """
    Generates a conflict-free weekly grid for every class.
    """

    @classmethod
    def schedule(
        cls,
        class_models: List[Dict[str, Any]],
        config: Dict[str, Any],
    ) -> Dict[int, Dict[str, Dict[int, Optional[Dict[str, Any]]]]]:
        """
        Build the full grid.

        Args:
            class_models: Per-class scheduling models from TimetableDataService.
            config: Normalized Setup configuration.

        Returns:
            Grid keyed class_id -> day -> {period: slot dict}.

        Raises:
            SchedulingFailureError: When the input cannot be scheduled.
        """
        days = list(config["working_days"])
        inst_periods = instructional_period_numbers(config)
        total_slots = len(days) * len(inst_periods)

        slots: List[Tuple[str, int]] = [(d, p) for d in days for p in inst_periods]

        workloads = cls._compute_workloads(class_models, total_slots)
        color_assignments = cls._edge_color(class_models, workloads)

        # Build the grid from the colored edges: each color index maps to one
        # (day, period) slot.
        grid: Dict[int, Dict[str, Dict[int, Optional[Dict[str, Any]]]]] = {
            cm["class_id"]: {day: {p: None for p in inst_periods} for day in days}
            for cm in class_models
        }

        for cm in class_models:
            class_id = cm["class_id"]
            for edge in color_assignments[class_id]:
                color = edge["color"]
                if color >= len(slots):
                    continue
                day, period = slots[color]
                subject = edge["subject"]
                grid[class_id][day][period] = {
                    "subject_id": subject["subject_id"],
                    "subject_code": subject["subject_code"],
                    "subject_name": subject["subject_name"],
                    "faculty_id": subject["faculty_id"],
                    "faculty_name": subject["faculty_name"],
                    "room_no": cm.get("room_no"),
                }

        return grid

    @classmethod
    def _compute_workloads(
        cls,
        class_models: List[Dict[str, Any]],
        total_slots: int,
    ) -> Dict[int, Dict[str, int]]:
        """
        Compute the per-subject period count for every class.

        The ideal balanced count is total_slots / subject_count. It is capped
        by each faculty's weekly capacity: a faculty cannot teach more than one
        period at a time, so with `n` classes under that faculty each class can
        receive at most floor(capacity / n) periods of the subject.
        """
        capacity = total_slots

        faculty_class_count: Dict[str, int] = {}
        for cm in class_models:
            for subject in cm["subjects"]:
                fid = str(subject["faculty_id"])
                faculty_class_count[fid] = faculty_class_count.get(fid, 0) + 1

        workloads: Dict[int, Dict[str, int]] = {}
        for cm in class_models:
            subjects = cm["subjects"]
            n = len(subjects)
            if not subjects:
                raise SchedulingFailureError(
                    f"No subjects assigned for class '{cm['label']}'. "
                    "Please assign subjects to this branch."
                )
            if total_slots < n:
                raise SchedulingFailureError(
                    f"Not enough periods ({total_slots}) to schedule the "
                    f"{n} subjects of class '{cm['label']}'. "
                    "Increase the number of periods or reduce subjects."
                )

            balanced_cap = total_slots // n
            capacity_cap = capacity
            for subject in subjects:
                n_classes = faculty_class_count.get(str(subject["faculty_id"]), 1)
                capacity_cap = min(capacity_cap, capacity // n_classes)

            q = min(balanced_cap, capacity_cap)
            if q < 1:
                raise SchedulingFailureError(
                    f"Insufficient faculty capacity to schedule class '{cm['label']}'. "
                    "Add more faculty for its subjects or reduce the number of classes."
                )

            workloads[cm["class_id"]] = {str(s["subject_id"]): q for s in subjects}

        return workloads

    @classmethod
    def _edge_color(
        cls,
        class_models: List[Dict[str, Any]],
        workloads: Dict[int, Dict[str, int]],
    ) -> Dict[int, List[Dict[str, Any]]]:
        """
        Assign each (class, subject) period a distinct color (slot) such that a
        faculty never gets the same color twice.

        Returns a dict class_id -> list of {color, subject} records.

        Raises:
            SchedulingFailureError: If the regularized graph cannot be matched
                (should not happen for valid bipartite input).
        """
        # ---- Build the multigraph ----
        left_ids = [cm["class_id"] for cm in class_models]
        right_ids = []  # distinct faculty ids
        left_index = {cid: i for i, cid in enumerate(left_ids)}
        right_index: Dict[str, int] = {}

        edges: List[Dict[str, Any]] = []  # {u, v, real, subject}
        for cm in class_models:
            cid = cm["class_id"]
            for subject in cm["subjects"]:
                fid = str(subject["faculty_id"])
                if fid not in right_index:
                    right_index[fid] = len(right_ids)
                    right_ids.append(fid)
                for _ in range(workloads[cid].get(str(subject["subject_id"]), 0)):
                    edges.append(
                        {
                            "u": left_index[cid],
                            "v": right_index[fid],
                            "real": True,
                            "subject": subject,
                        }
                    )

        if not edges:
            return {cid: [] for cid in left_ids}

        n_left = len(left_ids)
        n_right = len(right_ids)
        m = max(n_left, n_right)

        # ---- Regularize to a Delta-regular bipartite multigraph ----
        degree_left = [0] * m
        degree_right = [0] * m
        for e in edges:
            degree_left[e["u"]] += 1
            degree_right[e["v"]] += 1
        delta = max(max(degree_left, default=0), max(degree_right, default=0))
        if delta == 0:
            return {cid: [] for cid in left_ids}

        left_pool: List[int] = []
        right_pool: List[int] = []
        for u in range(m):
            left_pool.extend([u] * (delta - degree_left[u]))
        for v in range(m):
            right_pool.extend([v] * (delta - degree_right[v]))

        if len(left_pool) != len(right_pool):
            raise SchedulingFailureError(
                "Inconsistent class/faculty workload distribution."
            )

        for u, v in zip(left_pool, right_pool):
            edges.append({"u": u, "v": v, "real": False, "subject": None})

        # Adjacency for matching (edge indices per left vertex)
        adj_left: List[List[int]] = [[] for _ in range(m)]
        for e_idx, e in enumerate(edges):
            adj_left[e["u"]].append(e_idx)

        colors: List[List[int]] = []  # per color: list of edge indices

        for _ in range(delta):
            matching = cls._perfect_matching(m, adj_left, edges)
            if matching is None:
                raise SchedulingFailureError(
                    "Could not resolve faculty slot conflicts. "
                    "Please review class/subject/faculty assignments."
                )
            colors.append(matching)
            # Remove matched edges from adjacency
            matched_set = set(matching)
            for u in range(m):
                adj_left[u] = [e_idx for e_idx in adj_left[u] if e_idx not in matched_set]

        # ---- Map colors back to real (class, subject) demands ----
        result: Dict[int, List[Dict[str, Any]]] = {cid: [] for cid in left_ids}
        for color, edge_indices in enumerate(colors):
            for e_idx in edge_indices:
                e = edges[e_idx]
                if not e["real"]:
                    continue
                cid = left_ids[e["u"]]
                result[cid].append({"color": color, "subject": e["subject"]})

        return result

    @classmethod
    def _perfect_matching(
        cls,
        m: int,
        adj_left: List[List[int]],
        edges: List[Dict[str, Any]],
    ) -> Optional[List[int]]:
        """
        Find a perfect matching of the current bipartite multigraph using
        Kuhn's augmenting-path algorithm. The graph is regular (and bipartite)
        so a perfect matching always exists.

        Returns a list of edge indices forming the matching, or None.
        """
        match_edge_right: Dict[int, int] = {}  # right vertex -> edge index

        def dfs(u: int, visited: set) -> bool:
            for e_idx in adj_left[u]:
                v = edges[e_idx]["v"]
                if v in visited:
                    continue
                visited.add(v)
                prev_e = match_edge_right.get(v)
                if prev_e is None or dfs(edges[prev_e]["u"], visited):
                    match_edge_right[v] = e_idx
                    return True
            return False

        for u in range(m):
            visited = set()
            if not dfs(u, visited):
                return None

        if len(match_edge_right) != m:
            return None
        return list(match_edge_right.values())
