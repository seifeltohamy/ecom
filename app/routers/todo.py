from datetime import datetime

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from app.deps import get_db, get_current_user, get_brand_id
from app import models

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ActivityBody(BaseModel):
    name: str

class ColumnBody(BaseModel):
    name: str

class TaskBody(BaseModel):
    title: str
    deadline: Optional[str] = None
    notes: Optional[str] = None
    activity_id: Optional[int] = None
    done: Optional[bool] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _board(db, brand_id: int):
    """Return full board dict: activities + columns with nested tasks."""
    activities = (
        db.query(models.TodoActivity)
        .filter(models.TodoActivity.brand_id == brand_id)
        .order_by(models.TodoActivity.sort_order, models.TodoActivity.id)
        .all()
    )
    columns = (
        db.query(models.TodoColumn)
        .filter(models.TodoColumn.brand_id == brand_id)
        .order_by(models.TodoColumn.sort_order, models.TodoColumn.id)
        .all()
    )
    # Build activity name lookup
    act_map = {a.id: a.name for a in activities}

    return {
        "activities": [{"id": a.id, "name": a.name} for a in activities],
        "columns": [
            {
                "id": col.id,
                "name": col.name,
                "tasks": [
                    {
                        "id": t.id,
                        "title": t.title,
                        "deadline": t.deadline,
                        "notes": t.notes,
                        "done": t.done,
                        "activity_id": t.activity_id,
                        "activity_name": act_map.get(t.activity_id) if t.activity_id else None,
                        "sort_order": t.sort_order,
                    }
                    for t in sorted(col.tasks, key=lambda x: (x.sort_order, x.id))
                ],
            }
            for col in columns
        ],
    }


# ── Board ─────────────────────────────────────────────────────────────────────

@router.get("/todo")
def get_board(brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    with get_db() as db:
        return _board(db, brand_id)


# ── Activities ────────────────────────────────────────────────────────────────

@router.post("/todo/activities")
def create_activity(body: ActivityBody, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    with get_db() as db:
        existing = db.query(models.TodoActivity).filter(
            models.TodoActivity.brand_id == brand_id,
            models.TodoActivity.name == name,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Activity already exists.")
        act = models.TodoActivity(brand_id=brand_id, name=name)
        db.add(act)
        db.commit()
        return _board(db, brand_id)


@router.put("/todo/activities/{act_id}")
def rename_activity(act_id: int, body: ActivityBody, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    with get_db() as db:
        act = db.query(models.TodoActivity).filter(
            models.TodoActivity.id == act_id,
            models.TodoActivity.brand_id == brand_id,
        ).first()
        if not act:
            raise HTTPException(status_code=404, detail="Activity not found.")
        act.name = name
        db.commit()
        return _board(db, brand_id)


@router.delete("/todo/activities/{act_id}")
def delete_activity(act_id: int, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    with get_db() as db:
        act = db.query(models.TodoActivity).filter(
            models.TodoActivity.id == act_id,
            models.TodoActivity.brand_id == brand_id,
        ).first()
        if not act:
            raise HTTPException(status_code=404, detail="Activity not found.")
        db.delete(act)
        db.commit()
        return _board(db, brand_id)


# ── Columns (people) ──────────────────────────────────────────────────────────

@router.post("/todo/columns")
def create_column(body: ColumnBody, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    with get_db() as db:
        existing = db.query(models.TodoColumn).filter(
            models.TodoColumn.brand_id == brand_id,
            models.TodoColumn.name == name,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Person already exists.")
        col = models.TodoColumn(brand_id=brand_id, name=name)
        db.add(col)
        db.commit()
        return _board(db, brand_id)


@router.put("/todo/columns/{col_id}")
def rename_column(col_id: int, body: ColumnBody, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    with get_db() as db:
        col = db.query(models.TodoColumn).filter(
            models.TodoColumn.id == col_id,
            models.TodoColumn.brand_id == brand_id,
        ).first()
        if not col:
            raise HTTPException(status_code=404, detail="Column not found.")
        col.name = name
        db.commit()
        return _board(db, brand_id)


@router.delete("/todo/columns/{col_id}")
def delete_column(col_id: int, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    with get_db() as db:
        col = db.query(models.TodoColumn).filter(
            models.TodoColumn.id == col_id,
            models.TodoColumn.brand_id == brand_id,
        ).first()
        if not col:
            raise HTTPException(status_code=404, detail="Column not found.")
        db.delete(col)
        db.commit()
        return _board(db, brand_id)


# ── Tasks ─────────────────────────────────────────────────────────────────────

@router.post("/todo/columns/{col_id}/tasks")
def create_task(col_id: int, body: TaskBody, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Title is required.")
    with get_db() as db:
        col = db.query(models.TodoColumn).filter(
            models.TodoColumn.id == col_id,
            models.TodoColumn.brand_id == brand_id,
        ).first()
        if not col:
            raise HTTPException(status_code=404, detail="Column not found.")
        task = models.TodoTask(
            brand_id=brand_id,
            column_id=col_id,
            activity_id=body.activity_id,
            title=body.title.strip(),
            deadline=body.deadline or None,
            notes=body.notes or None,
            done=False,
            created_at=datetime.utcnow(),
        )
        db.add(task)
        db.commit()
        return _board(db, brand_id)


@router.put("/todo/tasks/{task_id}")
def update_task(task_id: int, body: TaskBody, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Title is required.")
    with get_db() as db:
        task = db.query(models.TodoTask).filter(
            models.TodoTask.id == task_id,
            models.TodoTask.brand_id == brand_id,
        ).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")
        task.title = body.title.strip()
        task.deadline = body.deadline or None
        task.notes = body.notes or None
        task.activity_id = body.activity_id
        if body.done is not None:
            task.done = body.done
        db.commit()
        return _board(db, brand_id)


@router.delete("/todo/tasks/{task_id}")
def delete_task(task_id: int, brand_id: int = Depends(get_brand_id), _user=Depends(get_current_user)):
    with get_db() as db:
        task = db.query(models.TodoTask).filter(
            models.TodoTask.id == task_id,
            models.TodoTask.brand_id == brand_id,
        ).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")
        db.delete(task)
        db.commit()
        return _board(db, brand_id)
