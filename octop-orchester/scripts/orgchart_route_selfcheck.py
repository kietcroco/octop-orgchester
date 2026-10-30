#!/usr/bin/env python3
"""Static check on the overlay org-chart router.

The router is mounted at ``/api``, so any path-parameter route it declares
would be reachable at the API root and could shadow siblings. There must be
exactly one route, ``GET /org-graph``, and no parameterised ones.

Run: python octop-orchester/scripts/orgchart_route_selfcheck.py
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROUTER = ROOT / "src" / "src" / "octop" / "api" / "routers" / "orgchart.py"

METHODS = {"get", "post", "put", "patch", "delete"}


def _routes(tree: ast.AST) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            if not isinstance(dec, ast.Call):
                continue
            fn = dec.func
            if not (
                isinstance(fn, ast.Attribute)
                and fn.attr in METHODS
                and isinstance(fn.value, ast.Name)
                and fn.value.id == "router"
            ):
                continue
            arg = dec.args[0] if dec.args else None
            path = arg.value if isinstance(arg, ast.Constant) else "<dynamic>"
            out.append((fn.attr.upper(), str(path)))
    return out


def main() -> int:
    if not ROUTER.is_file():
        print(f"FAIL missing router: {ROUTER}")
        return 1
    routes = _routes(ast.parse(ROUTER.read_text(encoding="utf-8")))

    problems: list[str] = []
    if len(routes) != 1:
        problems.append(f"expected exactly 1 route, found {len(routes)}: {routes}")
    if routes and routes[0] != ("GET", "/org-graph"):
        problems.append(f"expected GET /org-graph, found {routes[0]}")
    for method, path in routes:
        if "{" in path:
            problems.append(f"{method} {path} declares a path parameter at /api root")

    if problems:
        for p in problems:
            print(f"FAIL {p}")
        return 1
    print("OK orgchart router: 1 route, GET /org-graph, no path parameters")
    return 0


if __name__ == "__main__":
    sys.exit(main())
