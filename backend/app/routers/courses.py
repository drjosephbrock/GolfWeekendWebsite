from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import Course, Hole
from ..schemas import CourseCreate, CourseOut, HoleCreate, HoleOut
from ..config import settings

router = APIRouter(prefix="/api/courses", tags=["courses"])


def require_admin(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db)):
    return db.query(Course).all()


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("", response_model=CourseOut)
def create_course(
    course: CourseCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    db_course = Course(**course.model_dump())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course


@router.post("/{course_id}/holes", response_model=HoleOut)
def add_hole(
    course_id: int,
    hole: HoleCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    if not db.query(Course).filter(Course.id == course_id).first():
        raise HTTPException(status_code=404, detail="Course not found")
    db_hole = Hole(course_id=course_id, **hole.model_dump())
    db.add(db_hole)
    db.commit()
    db.refresh(db_hole)
    return db_hole


@router.put("/{course_id}/holes/{hole_id}", response_model=HoleOut)
def update_hole(
    course_id: int,
    hole_id: int,
    hole: HoleCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    db_hole = db.query(Hole).filter(Hole.id == hole_id, Hole.course_id == course_id).first()
    if not db_hole:
        raise HTTPException(status_code=404, detail="Hole not found")
    for field, value in hole.model_dump().items():
        setattr(db_hole, field, value)
    db.commit()
    db.refresh(db_hole)
    return db_hole


@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"ok": True}
