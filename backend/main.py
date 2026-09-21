from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from seating import generate_students, generate_seating

app = FastAPI(title="Exam SeatGen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Exam SeatGen API is running"
    }


@app.post("/api/generate")
def generate(data: dict):

    rows = data.get("rows")
    columns = data.get("columns")
    classes = data.get("classes")

    if not rows or not columns:
        raise HTTPException(
            status_code=400,
            detail="Rows and columns are required"
        )

    if not classes:
        raise HTTPException(
            status_code=400,
            detail="At least one class is required"
        )

    try:

        students = generate_students(classes)

        seating = generate_seating(
            rows,
            columns,
            students
        )

        return {
            "rows": rows,
            "columns": columns,
            "student_count": len(students),
            "capacity": rows * columns * 2,
            "seating": seating
        }

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )