"""Smoke the org-chart endpoint against a running container.

    python octop-orchester/scripts/orgchart_api_smoke.py

Reads OCTOP_PORT / OCTOP_ADMIN_USERNAME / OCTOP_DEFAULT_PASSWORD from
octop-orchester/.env. Creates an agency, puts an agent in it, asserts the graph
reflects that; then creates a team + a channel, asserts the host→member edge,
its label and the channel badge, and removes everything it made. Exits non-zero
on the first mismatch. Assumes `agency` exists (the agency patch is a
prerequisite).
"""
import json
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
        {
            "username": env["OCTOP_ADMIN_USERNAME"],
            "password": env["OCTOP_DEFAULT_PASSWORD"],
        },
    )
    assert status == 200, (status, payload)
    token = payload["access_token"]
    print("login ok")

    status, graph = call("GET", "/api/org-graph", token=token)
    assert status == 200, (status, graph)
    for key in ("nodes", "edges", "summary"):
        assert key in graph, (key, list(graph))
    assert graph["nodes"] and graph["nodes"][0]["id"] == "root:org", graph["nodes"][:1]
    node_ids = [n["id"] for n in graph["nodes"]]
    assert len(node_ids) == len(set(node_ids)), "duplicate node ids"
    print(
        f"GET /api/org-graph -> 200, {len(graph['nodes'])} nodes, "
        f"{len(graph['edges'])} edges, {graph['summary']}"
    )

    created_agent: str | None = None
    status, agents = call("GET", "/api/agents", token=token)
    assert status == 200, (status, agents)
    agent_ids = [a["agent_id"] for a in (agents or [])]
    if not agent_ids:
        status, agent = call("POST", "/api/agents", {"name": "__smoke_org_agent__"}, token)
        assert status == 201, (status, agent)
        created_agent = agent["agent_id"]
        agent_ids = [created_agent]
        print(f"created smoke agent {created_agent}")
    agent_id = agent_ids[0]

    name = "__smoke_org_agency__"
    status, agency = call("POST", "/api/agencies", {"name": name}, token)
    if status == 409:
        print("SKIP: an agency named __smoke_org_agency__ already exists")
        return 1
    assert status == 201, (status, agency)
    agency_id = agency["agency_id"]
    print(f"POST /api/agencies -> 201 {agency_id}")

    try:
        status, _ = call(
            "PUT", f"/api/agencies/{agency_id}/members", {"agent_ids": [agent_id]}, token
        )
        assert status == 200, status

        status, graph = call("GET", "/api/org-graph", token=token)
        assert status == 200, status
        agency_node = f"agency:{agency_id}"
        assert agency_node in [n["id"] for n in graph["nodes"]], "agency node missing"
        edge = [
            e
            for e in graph["edges"]
            if e["source"] == agency_node and e["target"] == f"agent:{agent_id}"
        ]
        assert edge, "agency-agent edge missing"
        print(f"graph shows {agency_node} -> agent:{agent_id}")

        status, _ = call("DELETE", f"/api/agencies/{agency_id}", token=token)
        assert status == 204, status
        status, graph = call("GET", "/api/org-graph", token=token)
        assert status == 200, status
        assert agency_node not in [n["id"] for n in graph["nodes"]], "agency node survived"
        print("agency removed from graph after delete")
    finally:
        call("DELETE", f"/api/agencies/{agency_id}", token=token)
        if created_agent:
            call("DELETE", f"/api/agents/{created_agent}", token=token)
            print(f"removed smoke agent {created_agent}")

    status, graph = call("GET", "/api/org-graph", token=token)
    assert status == 200, status
    stale = [n for n in graph["nodes"] if n["id"].startswith("agent:") and n["id"] == f"agent:{created_agent}"]
    assert not stale, "cleanup left an agent node behind"

    _check_team_and_channel(call, token)

    print("OK org-chart smoke")
    return 0


def _check_team_and_channel(call, token: str) -> None:
    """Host→member edge + channel badge — the two things only live data proves."""
    made_agents: list[str] = []
    made_channels: list[tuple[str, str]] = []
    made_teams: list[str] = []
    try:
        for name in ("__smoke_org_member1__", "__smoke_org_member2__"):
            status, agent = call("POST", "/api/agents", {"name": name}, token)
            assert status == 201, (status, agent)
            made_agents.append(agent["agent_id"])

        status, team = call(
            "POST", "/api/teams", {"name": "__smoke_org_team__", "member_ids": made_agents}, token
        )
        assert status in (200, 201), (status, team)
        team_id = team["agent_id"]
        made_teams.append(team_id)

        status, chan = call(
            "POST",
            f"/api/agents/{made_agents[0]}/channels",
            {"kind": "telegram", "name": "__smoke_org_chan__", "config": {}},
            token,
        )
        assert status == 201, (status, chan)
        chan_id = chan.get("id") or chan["channel_id"]
        made_channels.append((made_agents[0], chan_id))

        status, graph = call("GET", "/api/org-graph", token=token)
        assert status == 200, status
        nodes = {n["id"]: n for n in graph["nodes"]}

        host_edges = [
            e for e in graph["edges"]
            if e.get("kind") == "team-agent" and e["source"] == f"agent:{team_id}"
        ]
        assert {e["target"] for e in host_edges} == {f"agent:{a}" for a in made_agents}, host_edges
        assert {e.get("label") for e in host_edges} == {"__smoke_org_team__"}, host_edges
        print(f"team edge OK: {len(host_edges)} host->member, labelled with the team name")

        badged = nodes[f"agent:{made_agents[0]}"]["meta"]
        assert badged["channelCount"] == 1, badged["channelCount"]
        assert [c["channelId"] for c in badged["channels"]] == [chan_id], badged["channels"]
        assert badged["teamMember"] is True, badged
        bare = nodes[f"agent:{made_agents[1]}"]["meta"]
        assert bare["channelCount"] == 0, bare["channelCount"]
        print("channel badge OK: counted on its owner only; teamMember flag set")
    finally:
        for agent_id, chan_id in made_channels:
            call("DELETE", f"/api/agents/{agent_id}/channels/{chan_id}", token=token)
        for team_id in made_teams:
            call("DELETE", f"/api/teams/{team_id}", token=token)
        for agent_id in made_agents:
            call("DELETE", f"/api/agents/{agent_id}", token=token)
        if made_agents:
            status, graph = call("GET", "/api/org-graph", token=token)
            assert status == 200, status
            left = {f"agent:{a}" for a in made_agents} & {n["id"] for n in graph["nodes"]}
            assert not left, f"cleanup left nodes behind: {left}"


if __name__ == "__main__":
    sys.exit(main())
