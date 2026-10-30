"""Agencies: ad-hoc groupings of agents.

Overlay module — lives outside upstream. Every endpoint only needs a signed-in
user; there is no permission gate. Queries run straight through
``server.services.repos.db`` instead of a repo class.

# ponytail: no AgencyRepo. Each query below is used once or twice; promote this
# module to a repos/agencies.py class when a third caller appears or the query
# set grows past ~10 statements.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from octop.api.deps import current_user, get_server
from octop.infra.db.repos._base import now_ts
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.users.identity import User
from octop.infra.utils.ulid import new_short_id

router = APIRouter()

_SUMMARY_SQL = """
SELECT a.*,
       (SELECT COUNT(*) FROM agency_member m WHERE m.agency_id = a.agency_id) AS agent_count,
       (SELECT COUNT(DISTINCT c.channel_id) FROM agency_member m
          JOIN channels c ON c.agent_id = m.agent_id
        WHERE m.agency_id = a.agency_id) AS channel_count
  FROM agency a
"""


class AgencyBody(BaseModel):
    # Length is checked in _clean_name so an over-long name returns 400, not 422.
    name: str
    description: str | None = Field(default=None, max_length=500)
    color: str = Field(default="blue", max_length=32)
    icon_name: str | None = Field(default=None, max_length=32)


class AgencyPatchBody(BaseModel):
    name: str | None = None
    description: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=32)
    icon_name: str | None = Field(default=None, max_length=32)


class ReplaceAgencyIdsBody(BaseModel):
    agency_ids: list[str] = Field(default_factory=list)


class ReplaceMemberIdsBody(BaseModel):
    agent_ids: list[str] = Field(default_factory=list)


def _clean_name(raw: str) -> str:
    name = raw.strip()
    if not name:
        raise OctopError(ErrorCode.FORBIDDEN, "agency name is required", status=400)
    if len(name) > 64:
        raise OctopError(ErrorCode.FORBIDDEN, "agency name is too long", status=400)
    return name


def _clean_optional(raw: str | None) -> str | None:
    if raw is None:
        return None
    text = raw.strip()
    return text or None


def _summary(row: Any) -> dict[str, Any]:
    return {
        "agency_id": row["agency_id"],
        "name": row["name"],
        "description": row["description"],
        "color": row["color"],
        "icon_name": row["icon_name"],
        "created_by": row["created_by"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "agent_count": row["agent_count"],
        "channel_count": row["channel_count"],
    }


def _fetch_summary(conn: Any, agency_id: str) -> Any:
    row = conn.execute(f"{_SUMMARY_SQL} WHERE a.agency_id = ?", (agency_id,)).fetchone()
    if row is None:
        raise OctopError(ErrorCode.NOT_FOUND, "agency not found")
    return row


def _detail(conn: Any, agency_id: str) -> dict[str, Any]:
    row = _fetch_summary(conn, agency_id)
    payload = _summary(row)
    agents = conn.execute(
        "SELECT g.agent_id, g.name, g.color, g.icon_name, g.last_state AS state, "
        "       g.default_model, g.user_id "
        "  FROM agency_member m JOIN agents g ON g.agent_id = m.agent_id "
        " WHERE m.agency_id = ? ORDER BY g.name",
        (agency_id,),
    ).fetchall()
    payload["agents"] = [
        {
            "agent_id": a["agent_id"],
            "name": a["name"],
            "color": a["color"],
            "icon_name": a["icon_name"],
            "state": a["state"] or "unknown",
            "default_model": a["default_model"],
            "user_id": a["user_id"],
        }
        for a in agents
    ]
    agent_ids = [a["agent_id"] for a in agents]
    channels: list[dict[str, Any]] = []
    if agent_ids:
        marks = ", ".join("?" for _ in agent_ids)
        rows = conn.execute(
            f"SELECT channel_id, agent_id, name, kind, enabled FROM channels "
            f"WHERE agent_id IN ({marks}) ORDER BY name",
            tuple(agent_ids),
        ).fetchall()
        channels = [
            {
                "channel_id": c["channel_id"],
                "agent_id": c["agent_id"],
                "name": c["name"],
                "kind": c["kind"],
                "enabled": bool(c["enabled"]),
            }
            for c in rows
        ]
    payload["channels"] = channels
    return payload


def _known_agent_ids(conn: Any, agent_ids: list[str]) -> list[str]:
    wanted = list(dict.fromkeys(agent_ids))
    if not wanted:
        return []
    marks = ", ".join("?" for _ in wanted)
    rows = conn.execute(
        f"SELECT agent_id FROM agents WHERE agent_id IN ({marks})",
        tuple(wanted),
    ).fetchall()
    known = {r["agent_id"] for r in rows}
    return [agent_id for agent_id in wanted if agent_id in known]


def _known_agency_ids(conn: Any, agency_ids: list[str]) -> list[str]:
    wanted = list(dict.fromkeys(agency_ids))
    if not wanted:
        return []
    marks = ", ".join("?" for _ in wanted)
    rows = conn.execute(
        f"SELECT agency_id FROM agency WHERE agency_id IN ({marks})",
        tuple(wanted),
    ).fetchall()
    known = {r["agency_id"] for r in rows}
    return [agency_id for agency_id in wanted if agency_id in known]


@router.get("", summary="List agencies")
async def list_agencies(
    server: Any = Depends(get_server),
    _: User = Depends(current_user),
) -> list[dict[str, Any]]:
    with server.services.repos.db.connect() as conn:
        rows = conn.execute(f"{_SUMMARY_SQL} ORDER BY a.name").fetchall()
    return [_summary(row) for row in rows]


@router.post("", status_code=201, summary="Create an agency")
async def create_agency(
    body: AgencyBody,
    server: Any = Depends(get_server),
    user: User = Depends(current_user),
) -> dict[str, Any]:
    name = _clean_name(body.name)
    db = server.services.repos.db
    now = now_ts()
    try:
        with db.transaction() as conn:
            existing = conn.execute(
                "SELECT 1 FROM agency WHERE name = ?", (name,)
            ).fetchone()
            if existing is not None:
                raise OctopError(
                    ErrorCode.FORBIDDEN, "agency name is already in use", status=409
                )
            agency_id = ""
            for _attempt in range(8):
                candidate = new_short_id()
                taken = conn.execute(
                    "SELECT 1 FROM agency WHERE agency_id = ?", (candidate,)
                ).fetchone()
                if taken is None:
                    agency_id = candidate
                    break
            if not agency_id:
                raise OctopError(
                    ErrorCode.INTERNAL_ERROR, "could not allocate an agency id"
                )
            conn.execute(
                "INSERT INTO agency (agency_id, name, description, color, icon_name, "
                "                    created_by, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    agency_id,
                    name,
                    _clean_optional(body.description),
                    body.color,
                    _clean_optional(body.icon_name),
                    user.id,
                    now,
                    now,
                ),
            )
    except OctopError:
        raise
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise OctopError(
                ErrorCode.FORBIDDEN, "agency name is already in use", status=409
            ) from exc
        raise
    with server.services.repos.db.connect() as conn:
        return _detail(conn, agency_id)


@router.get("/by-agent/{agent_id}", summary="List agencies an agent belongs to")
async def agencies_for_agent(
    agent_id: str,
    server: Any = Depends(get_server),
    _: User = Depends(current_user),
) -> dict[str, list[str]]:
    with server.services.repos.db.connect() as conn:
        rows = conn.execute(
            "SELECT agency_id FROM agency_member WHERE agent_id = ? ORDER BY agency_id",
            (agent_id,),
        ).fetchall()
    return {"agency_ids": [r["agency_id"] for r in rows]}


@router.put("/by-agent/{agent_id}", summary="Replace an agent's agencies")
async def replace_agencies_for_agent(
    agent_id: str,
    body: ReplaceAgencyIdsBody,
    server: Any = Depends(get_server),
    _: User = Depends(current_user),
) -> dict[str, list[str]]:
    now = now_ts()
    with server.services.repos.db.transaction() as conn:
        if not _known_agent_ids(conn, [agent_id]):
            # Unknown agent: nothing to link. Reporting [] beats an FK error.
            return {"agency_ids": []}
        agency_ids = _known_agency_ids(conn, body.agency_ids)
        conn.execute("DELETE FROM agency_member WHERE agent_id = ?", (agent_id,))
        for agency_id in agency_ids:
            conn.execute(
                "INSERT INTO agency_member (agency_id, agent_id, created_at) "
                "VALUES (?, ?, ?)",
                (agency_id, agent_id, now),
            )
    return {"agency_ids": agency_ids}


@router.get("/{agency_id}", summary="Read an agency")
async def get_agency(
    agency_id: str,
    server: Any = Depends(get_server),
    _: User = Depends(current_user),
) -> dict[str, Any]:
    with server.services.repos.db.connect() as conn:
        return _detail(conn, agency_id)


@router.patch("/{agency_id}", summary="Update an agency")
async def update_agency(
    agency_id: str,
    body: AgencyPatchBody,
    server: Any = Depends(get_server),
    _: User = Depends(current_user),
) -> dict[str, Any]:
    fields = body.model_fields_set
    clauses: list[str] = []
    params: list[Any] = []
    if body.name is not None:
        clauses.append("name = ?")
        params.append(_clean_name(body.name))
    if "description" in fields:
        clauses.append("description = ?")
        params.append(_clean_optional(body.description))
    if body.color is not None:
        clauses.append("color = ?")
        params.append(body.color)
    if "icon_name" in fields:
        clauses.append("icon_name = ?")
        params.append(_clean_optional(body.icon_name))
    try:
        with server.services.repos.db.transaction() as conn:
            _fetch_summary(conn, agency_id)
            if body.name is not None:
                duplicate = conn.execute(
                    "SELECT 1 FROM agency WHERE name = ? AND agency_id <> ?",
                    (_clean_name(body.name), agency_id),
                ).fetchone()
                if duplicate is not None:
                    raise OctopError(
                        ErrorCode.FORBIDDEN, "agency name is already in use", status=409
                    )
            if clauses:
                clauses.append("updated_at = ?")
                params.append(now_ts())
                params.append(agency_id)
                conn.execute(
                    f"UPDATE agency SET {', '.join(clauses)} WHERE agency_id = ?",
                    tuple(params),
                )
    except OctopError:
        raise
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise OctopError(
                ErrorCode.FORBIDDEN, "agency name is already in use", status=409
            ) from exc
        raise
    with server.services.repos.db.connect() as conn:
        return _detail(conn, agency_id)


@router.delete("/{agency_id}", status_code=204, summary="Delete an agency")
async def delete_agency(
    agency_id: str,
    server: Any = Depends(get_server),
    _: User = Depends(current_user),
) -> None:
    with server.services.repos.db.transaction() as conn:
        deleted = conn.execute(
            "DELETE FROM agency WHERE agency_id = ?", (agency_id,)
        ).rowcount
    if not deleted:
        raise OctopError(ErrorCode.NOT_FOUND, "agency not found")


@router.put("/{agency_id}/members", summary="Replace an agency's agents")
async def replace_members(
    agency_id: str,
    body: ReplaceMemberIdsBody,
    server: Any = Depends(get_server),
    _: User = Depends(current_user),
) -> dict[str, Any]:
    now = now_ts()
    with server.services.repos.db.transaction() as conn:
        _fetch_summary(conn, agency_id)
        agent_ids = _known_agent_ids(conn, body.agent_ids)
        conn.execute("DELETE FROM agency_member WHERE agency_id = ?", (agency_id,))
        for agent_id in agent_ids:
            conn.execute(
                "INSERT INTO agency_member (agency_id, agent_id, created_at) "
                "VALUES (?, ?, ?)",
                (agency_id, agent_id, now),
            )
        conn.execute(
            "UPDATE agency SET updated_at = ? WHERE agency_id = ?", (now, agency_id)
        )
        return _detail(conn, agency_id)
