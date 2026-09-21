import re

def generate_students(classes):
    """
    Generate students from both:
    1. Continuous roll number ranges (with optional excluded roll numbers)
    2. Individual/random roll numbers
    """

    students = []

    for cls in classes:

        mode = cls.get("mode", "range")
        class_name = cls.get("className") or cls.get("class") or cls.get("name") or "Class"
        subject = cls.get("subject", "")

        # -----------------------------------------
        # RANGE MODE
        # -----------------------------------------
        if mode == "range":

            start = int(cls["start"])
            end = int(cls["end"])

            if end < start:
                raise ValueError(
                    f"{class_name}: End roll number cannot be "
                    f"smaller than start roll number."
                )

            # Parse excluded roll numbers
            excluded_raw = cls.get("exclude") or cls.get("excludeRollNumbers") or cls.get("excludedRollNumbers") or []
            excluded_set = set()
            if isinstance(excluded_raw, str):
                excluded_set = {r.strip() for r in re.split(r'[\s,]+', excluded_raw) if r.strip()}
            elif isinstance(excluded_raw, (list, set, tuple)):
                excluded_set = {str(r).strip() for r in excluded_raw if str(r).strip()}

            for roll in range(start, end + 1):
                roll_str = str(roll)
                if roll_str in excluded_set:
                    continue

                students.append({
                    "roll": roll_str,
                    "class": class_name,
                    "className": class_name,
                    "subject": subject
                })

        # -----------------------------------------
        # INDIVIDUAL MODE
        # -----------------------------------------
        elif mode == "individual":

            roll_numbers = cls.get("rollNumbers", [])
            if isinstance(roll_numbers, str):
                roll_numbers = [r.strip() for r in re.split(r'[\s,]+', roll_numbers) if r.strip()]

            for roll in roll_numbers:

                roll = str(roll).strip()

                if roll:
                    students.append({
                        "roll": roll,
                        "class": class_name,
                        "className": class_name,
                        "subject": subject
                    })

    return students


def generate_seating(rows, columns, students):

    capacity = rows * columns * 2

    if len(students) > capacity:
        raise ValueError(
            f"Not enough seats. Capacity: {capacity}, "
            f"Students: {len(students)}"
        )

    seating = [
        [
            {
                "left": None,
                "right": None
            }
            for _ in range(columns)
        ]
        for _ in range(rows)
    ]

    index = 0

    # -----------------------------------------
    # STEP 1
    # Fill LEFT seats first
    # -----------------------------------------

    for column in range(columns):

        for row in range(rows):

            if index >= len(students):
                return seating

            seating[row][column]["left"] = students[index]

            index += 1

    # -----------------------------------------
    # STEP 2
    # Fill RIGHT seats
    # -----------------------------------------

    for column in range(columns):

        for row in range(rows):

            if index >= len(students):
                return seating

            seating[row][column]["right"] = students[index]

            index += 1

    return seating