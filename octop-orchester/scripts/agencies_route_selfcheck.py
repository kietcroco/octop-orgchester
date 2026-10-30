"""Self-check: the agencies router declares ``by-agent`` routes before ``/{agency_id}``.

FastAPI matches in declaration order, so ``/{agency_id}`` declared first would
swallow ``by-agent``. Parses the module with ``ast`` — no import, so it runs on
any Python (the app itself needs 3.12).

    python octop-orchester/scripts/agencies_route_selfcheck.py
"""
import ast
import pathlib
import sys

ROUTER = (
    pathlib.Path(__file__).resolve().parents[1]
    / "src" / "src" / "octop" / "api" / "routers" / "agencies.py"
)


def main() -> int:
    tree = ast.parse(ROUTER.read_text(encoding="utf-8"))
    routes: list[tuple[str, str]] = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            if not isinstance(dec, ast.Call) or not isinstance(dec.func, ast.Attribute):
                continue
            if not isinstance(dec.func.value, ast.Name) or dec.func.value.id != "router":
                continue
            if dec.func.attr not in {"get", "post", "put", "patch", "delete"}:
                continue
            path = dec.args[0].value if dec.args else ""
            routes.append((dec.func.attr.upper(), path))

    for methods, path in routes:
        print(f"  {methods:6} {path}")

    paths = [p for _, p in routes]
    assert len(paths) == 8, paths
    assert paths.index("/by-agent/{agent_id}") < paths.index("/{agency_id}"), paths
    print(f"OK: {len(paths)} routes, by-agent declared before /{{agency_id}}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
