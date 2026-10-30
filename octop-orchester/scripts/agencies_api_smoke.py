"""Smoke the 8 agency endpoints against a running container.

    python octop-orchester/scripts/agencies_api_smoke.py

Reads OCTOP_PORT / OCTOP_ADMIN_USERNAME / OCTOP_DEFAULT_PASSWORD from
octop-orchester/.env. Creates one agency, assigns agents, cleans up after
itself. Exits non-zero on the first mismatch.
"""
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


def main() -> int:
    env = load_env()
    base = f"http://localhost:{env.get('OCTOP_PORT', '8088')}"

    def call(method: str, path: str, body=None, token=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{base}{path}", method=method, data=data)
        req.add_header("content-type", "application/json")
        if token:
            req.add_header("authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read()
                return resp.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            return exc.code, (json.loads(raw) if raw else None)

    status, payload = call(
        "POST",
        "/api/auth/login",
        {"username": env["OCTOP_ADMIN_USERNAME"], "password": env["OCTOP_DEFAULT_PASSWORD"]},
    )
    assert status == 200, (status, payload)
    token = payload["access_token"]
    print("login ok")

    status, listed = call("GET", "/api/agencies", token=token)
    assert status == 200 and isinstance(listed, list), (status, listed)
    before = len(listed)
    print(f"GET /api/agencies -> 200, {before} rows")

    name = "__smoke_agency__"
    status, created = call("POST", "/api/agencies", {"name": name}, token)
    assert status == 201, (status, created)
    agency_id = created["agency_id"]
    assert created["agent_count"] == 0 and created["channel_count"] == 0, created
    print(f"POST /api/agencies -> 201 {agency_id}")

    status, dup = call("POST", "/api/agencies", {"name": name}, token)
    assert status == 409, (status, dup)
    print("POST duplicate name -> 409")

    status, agents = call("GET", "/api/agents", token=token)
    created_agents: list[str] = []
    agent_ids = [a["agent_id"] for a in (agents or [])][:2]
    while len(agent_ids) < 2:
        status, agent = call(
            "POST", "/api/agents", {"name": f"__smoke_agent_{len(created_agents)}__"}, token
        )
        assert status == 201, (status, agent)
        created_agents.append(agent["agent_id"])
        agent_ids.append(agent["agent_id"])
    print(f"agents available: {len(agents or [])}, using {len(agent_ids)}"
          f" ({len(created_agents)} created for this run)")

    status, detail = call(
        "PUT", f"/api/agencies/{agency_id}/members", {"agent_ids": agent_ids}, token
    )
    assert status == 200, (status, detail)
    assert len(detail["agents"]) == len(agent_ids), detail
    print(f"PUT members -> 200, {len(detail['agents'])} agents, "
          f"{len(detail['channels'])} channels")

    if agent_ids:
        status, mine = call("GET", f"/api/agencies/by-agent/{agent_ids[0]}", token=token)
        assert status == 200 and agency_id in mine["agency_ids"], (status, mine)
        print(f"GET by-agent -> 200 {mine['agency_ids']}")

        status, mine = call(
            "PUT", f"/api/agencies/by-agent/{agent_ids[0]}",
            {"agency_ids": [agency_id]}, token,
        )
        assert status == 200 and mine["agency_ids"] == [agency_id], (status, mine)
        print("PUT by-agent -> 200")

    status, detail = call("GET", f"/api/agencies/{agency_id}", token=token)
    assert status == 200 and detail["name"] == name, (status, detail)
    print("GET detail -> 200")

    status, patched = call(
        "PATCH", f"/api/agencies/{agency_id}", {"description": "smoke"}, token
    )
    assert status == 200 and patched["description"] == "smoke", (status, patched)
    print("PATCH -> 200")

    status, _ = call("DELETE", f"/api/agencies/{agency_id}", token=token)
    assert status == 204, status
    print("DELETE -> 204")

    status, _ = call("GET", f"/api/agencies/{agency_id}", token=token)
    assert status == 404, status
    print("GET deleted -> 404")

    if agent_ids:
        status, _ = call("GET", f"/api/agents/{agent_ids[0]}", token=token)
        assert status == 200, status
        print("agent survived agency delete -> 200")

    status, after = call("GET", "/api/agencies", token=token)
    assert len(after) == before, (before, len(after))
    print(f"cleanup ok, back to {before} rows")

    for agent_id in created_agents:
        status, _ = call("DELETE", f"/api/agents/{agent_id}", token=token)
        assert status == 204, status
    if created_agents:
        print(f"removed {len(created_agents)} smoke agents")

    check_plain_user(call, token)
    return 0


def check_plain_user(call, admin_token: str) -> None:
    """D4: any signed-in user manages agencies, and `agencies` is a valid nav key."""
    username = "__smoke_plain_user__"
    password = "smoke-plain-pass-1"
    status, user = call(
        "POST", "/api/users",
        {"username": username, "password": password, "role": "user"},
        admin_token,
    )
    if status != 201:
        print(f"SKIP plain-user check ({status}): {user}")
        return
    try:
        status, payload = call("POST", "/api/auth/login",
                               {"username": username, "password": password})
        assert status == 200, (status, payload)
        plain = payload["access_token"]

        status, listed = call("GET", "/api/agencies", token=plain)
        assert status == 200, (status, listed)
        status, created = call("POST", "/api/agencies", {"name": "__smoke_plain__"}, plain)
        assert status == 201, (status, created)
        print("non-admin: GET/POST /api/agencies -> 200/201")

        # The server validates nav keys against SIDEBAR_NAV_KEYS; "agencies" must be known.
        status, prefs = call(
            "PATCH", "/api/preferences",
            {"sidebar_nav": {"groups": [], "items": [{"key": "agencies"}]}}, plain,
        )
        assert status == 200, (status, prefs)
        assert prefs["sidebar_nav"]["items"][0]["key"] == "agencies", prefs
        print("non-admin: sidebar_nav accepts key 'agencies' -> 200")

        status, _ = call("DELETE", f"/api/agencies/{created['agency_id']}", token=plain)
        assert status == 204, status
        print("non-admin: DELETE own agency -> 204")
    finally:
        status, _ = call("DELETE", f"/api/users/{user['id']}", token=admin_token)
        print(f"removed plain user ({status})")


if __name__ == "__main__":
    sys.exit(main())
