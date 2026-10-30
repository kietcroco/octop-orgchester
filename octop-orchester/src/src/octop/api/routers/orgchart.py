"""Org chart: the whole organisation as one graph.

Overlay module — lives outside upstream. Single endpoint, single round trip.
Every node the viewer cannot see is dropped, and an edge is only drawn when
both of its endpoints survive, so a shared-out agent never leaks through a
dangling edge.

# ponytail: no OrgChartRepo. Four read-only statements, one caller. Promote to
# a repo class when a second caller appears or this grows past ~10 queries.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from octop.api.deps import current_user, get_server
from octop.infra.users.identity import User

router = APIRouter()

ROOT_ID = "root:org"
UNASSIGNED_ID = "agency:__unassigned__"
RUNNING = "running"


def _agent_node_id(agent_id: str) -> str:
    return f"agent:{agent_id}"


def _agency_node_id(agency_id: str) -> str:
    return f"agency:{agency_id}"


def _visible_rows(server: Any, user: User) -> list[Any]:
    """Exactly the two calls ``GET /api/agents?scope=mine`` makes."""
    registry = server.app_runtime.agent_registry
    owned = registry.list_agents(user.id)
    shared = server.services.agent_repo.list_shared(
        exclude_user_id=user.id,
        viewer_user_id=None if user.is_admin else user.id,
    )
    return list({row.agent_id: row for row in [*shared, *owned]}.values())


def _team_members(server: Any, host_id: str) -> list[str]:
    registry = getattr(getattr(server, "app_runtime", None), "agent_registry", None)
    teams = getattr(registry, "teams", None)
    if teams is None:
        return []
    try:
        return teams.visible_member_ids(host_id)
    except Exception:  # noqa: BLE001 - a broken roster must not break the chart
        return []


def _channels_by_agent(conn: Any, agent_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {agent_id: [] for agent_id in agent_ids}
    if not agent_ids:
        return out
    marks = ", ".join("?" for _ in agent_ids)
    rows = conn.execute(
        f"SELECT channel_id, agent_id, name, kind FROM channels "
        f"WHERE agent_id IN ({marks}) ORDER BY name",
        tuple(agent_ids),
    ).fetchall()
    for row in rows:
        out.setdefault(row["agent_id"], []).append(
            {
                "channelId": row["channel_id"],
                "name": row["name"],
                "kind": row["kind"],
            }
        )
    return out


def _agency_rows(conn: Any) -> list[Any]:
    return conn.execute(
        "SELECT agency_id, name, description, color, icon_name FROM agency ORDER BY name"
    ).fetchall()


def _membership(conn: Any) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for row in conn.execute("SELECT agency_id, agent_id FROM agency_member").fetchall():
        out.setdefault(row["agency_id"], []).append(row["agent_id"])
    return out


@router.get("/org-graph", summary="Organisation graph")
async def org_graph(
    user: User = Depends(current_user),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    visible = _visible_rows(server, user)
    by_id = {row.agent_id: row for row in visible}
    agent_ids = list(by_id)

    db = server.services.repos.db
    with db.connect() as conn:
        agencies = _agency_rows(conn)
        membership = _membership(conn)
        channels = _channels_by_agent(conn, agent_ids)

    # host -> member, only where both ends are visible to this viewer
    team_edges: list[tuple[str, str, str]] = []
    member_of_team: set[str] = set()
    for row in visible:
        if (getattr(row, "kind", None) or "expert") != "team":
            continue
        for member_id in _team_members(server, row.agent_id):
            if member_id not in by_id or member_id == row.agent_id:
                continue
            team_edges.append((row.agent_id, member_id, row.name))
            member_of_team.add(member_id)

    def agent_node(row: Any) -> dict[str, Any]:
        chans = channels.get(row.agent_id, [])
        return {
            "id": _agent_node_id(row.agent_id),
            "type": "agent",
            "label": row.name,
            "meta": {
                "agentId": row.agent_id,
                "description": row.description,
                "model": getattr(row, "default_model", None),
                "state": getattr(row, "last_state", None) or "idle",
                "color": getattr(row, "color", None),
                "iconName": getattr(row, "icon_name", None),
                "kind": getattr(row, "kind", None) or "expert",
                "channelCount": len(chans),
                "channels": chans,
                "teamMember": row.agent_id in member_of_team,
            },
        }

    def state_of(agent_id: str) -> str:
        row = by_id.get(agent_id)
        return (getattr(row, "last_state", None) or "idle") if row else "idle"

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    placed: set[str] = set()

    # Agencies that reach at least one visible agent; empty ones are hidden.
    # agency_member is N-N but a node renders once, so an agent claimed by an
    # earlier agency (by name) is not drawn again under a later one.
    emitted: list[tuple[str, str, dict[str, Any], list[Any]]] = []
    for ag in agencies:
        members = [
            by_id[a]
            for a in membership.get(ag["agency_id"], [])
            if a in by_id and a not in placed
        ]
        if not members:
            continue
        placed.update(a.agent_id for a in members)
        members.sort(key=lambda r: r.name)
        running = sum(1 for r in members if state_of(r.agent_id) == RUNNING)
        emitted.append(
            (
                ag["agency_id"],
                ag["name"],
                {
                    "description": ag["description"],
                    "color": ag["color"],
                    "iconName": ag["icon_name"],
                    "agentCount": len(members),
                    "activeCount": running,
                },
                members,
            )
        )

    orphans = sorted(
        (row for row in visible if row.agent_id not in placed),
        key=lambda r: r.name,
    )

    groups = list(emitted)
    if orphans:
        running = sum(1 for r in orphans if state_of(r.agent_id) == RUNNING)
        groups.append(
            (
                "__unassigned__",
                "",
                {
                    "description": None,
                    "color": None,
                    "iconName": None,
                    "agentCount": len(orphans),
                    "activeCount": running,
                    "unassigned": True,
                },
                orphans,
            )
        )

    total_channels = sum(len(v) for v in channels.values())
    team_hosts = sum(
        1 for row in visible if (getattr(row, "kind", None) or "expert") == "team"
    )

    nodes.append(
        {
            "id": ROOT_ID,
            "type": "root",
            "label": "",
            "meta": {
                "agencyCount": len(emitted),
                "agentCount": len(visible),
                "teamCount": team_hosts,
                "channelCount": total_channels,
            },
        }
    )
    for agency_id, name, meta, members in groups:
        node_id = UNASSIGNED_ID if meta.get("unassigned") else _agency_node_id(agency_id)
        nodes.append({"id": node_id, "type": "agency", "label": name, "meta": meta})
        edges.append(
            {
                "id": f"root-agency:{node_id}",
                "source": ROOT_ID,
                "target": node_id,
                "kind": "root-agency",
            }
        )
        for row in members:
            nodes.append(agent_node(row))
            edges.append(
                {
                    "id": f"agency-agent:{node_id}:{row.agent_id}",
                    "source": node_id,
                    "target": _agent_node_id(row.agent_id),
                    "kind": "agency-agent",
                }
            )

    for host_id, member_id, team_name in team_edges:
        edges.append(
            {
                "id": f"team-agent:{host_id}:{member_id}",
                "source": _agent_node_id(host_id),
                "target": _agent_node_id(member_id),
                "kind": "team-agent",
                "label": team_name,
                "animated": RUNNING in (state_of(host_id), state_of(member_id)),
            }
        )

    return {
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "agencies": len(emitted),
            "agents": len(visible),
            "activeAgents": sum(1 for r in visible if state_of(r.agent_id) == RUNNING),
            "teams": team_hosts,
            "channels": total_channels,
        },
    }
