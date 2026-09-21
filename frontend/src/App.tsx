import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type InputMode = "range" | "individual";

type ClassConfig = {
  className: string;
  subject: string;
  mode: InputMode;
  start: string;
  end: string;
  excludeRollNumbers: string;
  rollNumbers: string;
};

type Student = {
  roll: string;
  className: string;
  subject: string;
};

type Seat = {
  left: Student | null;
  right: Student | null;
};

function App() {
  const [rows, setRows] = useState(5);
  const [columns, setColumns] = useState(4);

  const [classes, setClasses] = useState<ClassConfig[]>([
    {
      className: "ECE-A",
      subject: "VLSI Design",
      mode: "range",
      start: "71812202237",
      end: "71812202263",
      excludeRollNumbers: "71812202240, 71812202245",
      rollNumbers: "",
    },
    {
      className: "ECE-B",
      subject: "Embedded Systems",
      mode: "individual",
      start: "",
      end: "",
      excludeRollNumbers: "",
      rollNumbers: "71812202238, 71812202241, 71812202256, 71812202272",
    },
  ]);

  const [seating, setSeating] = useState<Seat[][]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // -----------------------------------------
  // Helper: Parse Roll Numbers
  // -----------------------------------------
  function parseRollNumbers(input: string): string[] {
    if (!input) return [];
    return input
      .split(/[\s,]+/)
      .map((roll) => roll.trim())
      .filter(Boolean);
  }

  // -----------------------------------------
  // Calculate students per class & total
  // -----------------------------------------
  const classCounts = useMemo(() => {
    return classes.map((cls) => {
      if (cls.mode === "range") {
        try {
          if (!cls.start || !cls.end) return 0;
          const start = BigInt(cls.start.trim());
          const end = BigInt(cls.end.trim());
          if (end < start) return 0;

          const totalInRange = Number(end - start + BigInt(1));
          const excludedList = parseRollNumbers(cls.excludeRollNumbers);
          const excludedSet = new Set(excludedList);

          // Count how many excluded items actually fall within range
          let excludedCount = 0;
          excludedSet.forEach((item) => {
            try {
              const num = BigInt(item);
              if (num >= start && num <= end) {
                excludedCount++;
              }
            } catch {
              // Non-numeric roll number in excluded set
            }
          });

          return Math.max(0, totalInRange - excludedCount);
        } catch {
          return 0;
        }
      } else {
        const rolls = parseRollNumbers(cls.rollNumbers);
        return rolls.length;
      }
    });
  }, [classes]);

  const studentCount = useMemo(() => {
    return classCounts.reduce((sum, count) => sum + count, 0);
  }, [classCounts]);

  const capacity = rows * columns * 2;
  const emptySeats = Math.max(capacity - studentCount, 0);

  // -----------------------------------------
  // Update class field
  // -----------------------------------------
  const updateClass = (
    index: number,
    field: keyof ClassConfig,
    value: string
  ) => {
    setClasses((current) => {
      const updated = [...current];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  // -----------------------------------------
  // Change input mode
  // -----------------------------------------
  const changeMode = (index: number, mode: InputMode) => {
    setClasses((current) => {
      const updated = [...current];
      updated[index] = {
        ...updated[index],
        mode,
      };
      return updated;
    });
  };

  // -----------------------------------------
  // Add class
  // -----------------------------------------
  const addClass = () => {
    setClasses((current) => [
      ...current,
      {
        className: "",
        subject: "",
        mode: "range",
        start: "",
        end: "",
        excludeRollNumbers: "",
        rollNumbers: "",
      },
    ]);
  };

  // -----------------------------------------
  // Remove class
  // -----------------------------------------
  const removeClass = (index: number) => {
    if (classes.length === 1) return;
    setClasses((current) => current.filter((_, classIndex) => classIndex !== index));
  };

  // -----------------------------------------
  // Pure Client-Side Seating Algorithm
  // -----------------------------------------
  function generateLocalStudents(classList: ClassConfig[]): Student[] {
    const list: Student[] = [];

    for (const cls of classList) {
      const className = cls.className.trim() || "Class";
      const subject = cls.subject.trim() || "";

      if (cls.mode === "range") {
        if (!cls.start.trim() || !cls.end.trim()) {
          throw new Error(`${className}: Please enter both start and end roll numbers.`);
        }

        const startBig = BigInt(cls.start.trim());
        const endBig = BigInt(cls.end.trim());

        if (endBig < startBig) {
          throw new Error(
            `${className}: End roll number cannot be smaller than start roll number.`
          );
        }

        const excludedList = parseRollNumbers(cls.excludeRollNumbers);
        const excludedSet = new Set(excludedList);

        for (let i = startBig; i <= endBig; i++) {
          const rollStr = i.toString();
          if (!excludedSet.has(rollStr)) {
            list.push({
              roll: rollStr,
              className,
              subject,
            });
          }
        }
      } else {
        const rolls = parseRollNumbers(cls.rollNumbers);
        if (rolls.length === 0) {
          throw new Error(`${className}: Please enter at least one roll number.`);
        }

        for (const roll of rolls) {
          list.push({
            roll,
            className,
            subject,
          });
        }
      }
    }

    return list;
  }

  function generateLocalSeating(numRows: number, numCols: number, students: Student[]): Seat[][] {
    const maxCapacity = numRows * numCols * 2;
    if (students.length > maxCapacity) {
      throw new Error(
        `Not enough seats. Capacity: ${maxCapacity}, Students: ${students.length}`
      );
    }

    const grid: Seat[][] = Array.from({ length: numRows }, () =>
      Array.from({ length: numCols }, () => ({
        left: null,
        right: null,
      }))
    );

    let idx = 0;

    // Fill LEFT seats first
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        if (idx >= students.length) return grid;
        grid[r][c].left = students[idx++];
      }
    }

    // Fill RIGHT seats next
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        if (idx >= students.length) return grid;
        grid[r][c].right = students[idx++];
      }
    }

    return grid;
  }

  // -----------------------------------------
  // Generate seating (Client-side with Backend support)
  // -----------------------------------------
  const generate = async () => {
    setError("");
    setLoading(true);

    try {
      if (rows < 1 || columns < 1) {
        throw new Error("Rows and columns must be at least 1.");
      }

      if (studentCount > capacity) {
        throw new Error(
          `Not enough seats. Hall capacity is ${capacity}, but you have ${studentCount} students.`
        );
      }

      // Check required fields
      for (const cls of classes) {
        if (!cls.className.trim() && !cls.subject.trim()) {
          throw new Error("Please provide a Class or Subject name for all entries.");
        }
      }

      // Execute generation logic
      const students = generateLocalStudents(classes);
      if (students.length === 0) {
        throw new Error("No students found to arrange.");
      }

      const generatedLayout = generateLocalSeating(rows, columns, students);
      setSeating(generatedLayout);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------
  // Excel download
  // -----------------------------------------
  const downloadExcel = () => {
    if (!seating.length) return;

    const data: (string | number)[][] = [];

    data.push(["EXAM HALL SEATING ARRANGEMENT"]);
    data.push([]);
    data.push(["Hall Details:"]);
    data.push(["Total Rows", rows]);
    data.push(["Total Columns", columns]);
    data.push(["Total Capacity", capacity]);
    data.push(["Total Students", studentCount]);
    data.push(["Empty Seats", emptySeats]);
    data.push([]);

    data.push(["Class / Subject Breakdown:"]);
    classes.forEach((cls, i) => {
      const title = [cls.className, cls.subject].filter(Boolean).join(" - ") || `Class ${i + 1}`;
      const count = classCounts[i] || 0;
      data.push([title, `${count} students`]);
    });
    data.push([]);

    const headers: string[] = ["Row #"];

    for (let column = 1; column <= columns; column++) {
      headers.push(`Col ${column} - Left`);
      headers.push(`Col ${column} - Right`);
    }

    data.push(headers);

    seating.forEach((row, rowIndex) => {
      const rowData: (string | number)[] = [`Row ${rowIndex + 1}`];

      row.forEach((column) => {
        const formatStudent = (s: Student | null) => {
          if (!s) return "";
          const meta = [s.className, s.subject].filter(Boolean).join(" | ");
          return meta ? `${s.roll} (${meta})` : s.roll;
        };

        rowData.push(formatStudent(column.left));
        rowData.push(formatStudent(column.right));
      });

      data.push(rowData);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    worksheet["!cols"] = [
      { wch: 10 },
      ...Array.from({ length: columns * 2 }, () => ({
        wch: 32,
      })),
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Seating Plan");
    XLSX.writeFile(workbook, "exam_seating_arrangement.xlsx");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 font-extrabold text-white shadow-md shadow-blue-500/20">
              E
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 sm:text-lg">Exam SeatGen</h1>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-200">
                  Web Edition
                </span>
              </div>
              <p className="text-xs text-slate-500">Fast, smart seating arrangement planner</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-600 sm:block">
              100% Free & Standalone
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* HERO SECTION */}
        <section className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-100">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
            EXAMINATION DESK ALLOCATOR
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Generate exam seating arrangements
            <span className="block text-slate-400 font-semibold">with roll number exclusion & subject tagging.</span>
          </h2>
          <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Configure hall dimensions, assign class/subject metadata, select continuous roll ranges while excluding specific absent/detained students, or enter custom roll lists.
          </p>
        </section>

        {/* CONFIGURATION SECTION */}
        <section className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          {/* STEP 1: HALL CONFIGURATION */}
          <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Step 01</p>
                <h3 className="text-lg font-bold text-slate-900">Hall Dimensions</h3>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                2 seats / desk
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Set the number of desk rows and columns in the examination hall.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Rows (Desks per column)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Columns (Desk columns)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={columns}
                  onChange={(e) => setColumns(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* CAPACITY STATS */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="Total Capacity" value={capacity} sub="seats" highlight="blue" />
              <Stat
                label="Students"
                value={studentCount}
                sub="allotted"
                highlight={studentCount > capacity ? "red" : "indigo"}
              />
              <Stat
                label="Empty Seats"
                value={emptySeats}
                sub="available"
                highlight={emptySeats > 0 ? "slate" : "green"}
              />
            </div>

            {studentCount > capacity && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                ⚠ Over capacity by {studentCount - capacity} student(s). Increase rows or columns.
              </div>
            )}
          </div>

          {/* STEP 2: CLASS & SUBJECT CONFIGURATION */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Step 02</p>
                <h3 className="text-lg font-bold text-slate-900">Classes, Subjects & Students</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Add multiple classes or subjects with roll number ranges and specific exclusions.
                </p>
              </div>

              <button
                onClick={addClass}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm"
              >
                <span>+</span> Add Class / Subject
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {classes.map((cls, index) => {
                const count = classCounts[index] || 0;
                const excludedCount = parseRollNumbers(cls.excludeRollNumbers).length;

                return (
                  <div
                    key={index}
                    className="group relative rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300"
                  >
                    {/* TOP ROW: Class, Subject, and Remove */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Class / Section
                        </label>
                        <input
                          value={cls.className}
                          onChange={(e) => updateClass(index, "className", e.target.value)}
                          placeholder="e.g., ECE-A, CSE 3rd Year"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Subject
                          </label>
                          {classes.length > 1 && (
                            <button
                              onClick={() => removeClass(index)}
                              type="button"
                              className="text-xs font-medium text-rose-500 hover:text-rose-700 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          value={cls.subject}
                          onChange={(e) => updateClass(index, "subject", e.target.value)}
                          placeholder="e.g., VLSI Design, Mathematics"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    {/* MODE SELECTOR */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => changeMode(index, "range")}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            cls.mode === "range"
                              ? "bg-slate-900 text-white shadow-sm"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Continuous Range
                        </button>
                        <button
                          type="button"
                          onClick={() => changeMode(index, "individual")}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            cls.mode === "individual"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          Individual Roll Numbers
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="rounded-full bg-blue-100/70 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                          {count} students
                        </span>
                      </div>
                    </div>

                    {/* CONTINUOUS RANGE FORM */}
                    {cls.mode === "range" && (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Start Roll Number
                            </label>
                            <input
                              value={cls.start}
                              onChange={(e) => updateClass(index, "start", e.target.value)}
                              placeholder="e.g., 71812202201"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none transition focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              End Roll Number
                            </label>
                            <input
                              value={cls.end}
                              onChange={(e) => updateClass(index, "end", e.target.value)}
                              placeholder="e.g., 71812202260"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none transition focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* EXCLUDE ROLL NUMBERS OPTION */}
                        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900">
                              Exclude Specific Roll Number(s) (Optional)
                            </label>
                            {excludedCount > 0 && (
                              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                {excludedCount} excluded
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            Exclude absent, detained, or transferred roll numbers. Separate multiple roll numbers with commas, spaces, or newlines.
                          </p>
                          <input
                            value={cls.excludeRollNumbers}
                            onChange={(e) => updateClass(index, "excludeRollNumbers", e.target.value)}
                            placeholder="e.g., 71812202214, 71812202225, 71812202240"
                            className="mt-1.5 w-full rounded-md border border-amber-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* INDIVIDUAL ROLL NUMBERS FORM */}
                    {cls.mode === "individual" && (
                      <div className="mt-3">
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Roll Numbers List
                        </label>
                        <textarea
                          value={cls.rollNumbers}
                          onChange={(e) => updateClass(index, "rollNumbers", e.target.value)}
                          placeholder="Paste roll numbers separated by commas, spaces, or newlines&#10;Example: 71812202238, 71812202241, 71812202256"
                          rows={3}
                          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ERROR DISPLAY */}
        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* GENERATE BUTTON */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={generate}
            disabled={loading || studentCount === 0 || studentCount > capacity}
            type="button"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
          >
            {loading ? "Generating Arrangement..." : "Generate Seating Arrangement →"}
          </button>
        </div>

        {/* SEATING PREVIEW SECTION */}
        {seating.length > 0 && (
          <section className="mt-10 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
            {/* PREVIEW HEADER */}
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/50 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Step 03</p>
                <h3 className="text-xl font-bold text-slate-900">Seating Arrangement Layout</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {studentCount} students allocated across {rows} rows and {columns} desk columns (Capacity: {capacity}).
                </p>
              </div>

              <button
                onClick={downloadExcel}
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <span>↓</span> Download Excel Spreadsheet
              </button>
            </div>

            {/* HALL GRID */}
            <div className="overflow-x-auto p-6 bg-slate-50/30">
              <div
                className="grid gap-5 min-w-[720px]"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(160px, 1fr))`,
                }}
              >
                {Array.from({ length: columns }).map((_, columnIndex) => (
                  <div key={columnIndex} className="flex flex-col">
                    {/* COLUMN HEADER */}
                    <div className="mb-2.5 rounded-lg border border-slate-200 bg-white py-1.5 text-center shadow-xs">
                      <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                        Desk Column
                      </div>
                      <div className="text-xs font-black text-slate-800">
                        Col {columnIndex + 1}
                      </div>
                    </div>

                    {/* ROWS */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                      {Array.from({ length: rows }).map((_, rowIndex) => {
                        const seat = seating[rowIndex]?.[columnIndex];

                        return (
                          <div
                            key={rowIndex}
                            className="flex border-b border-slate-200 last:border-b-0 hover:bg-slate-50/80 transition"
                          >
                            <div className="flex w-6 shrink-0 items-center justify-center bg-slate-100/80 text-[9px] font-bold text-slate-400 border-r border-slate-200/60">
                              {rowIndex + 1}
                            </div>

                            <SeatCard student={seat?.left ?? null} side="L" />
                            <SeatCard student={seat?.right ?? null} side="R" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FOOTER SUMMARY */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-4">
                  <span>
                    <strong className="font-bold text-slate-800">{studentCount}</strong> students seated
                  </span>
                  <span>
                    <strong className="font-bold text-slate-800">{emptySeats}</strong> empty seats
                  </span>
                </div>
                <div className="text-slate-500 font-medium">
                  Layout: {rows} Rows × {columns} Columns × 2 Seats/Desk
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-400 sm:px-6">
          Exam SeatGen · Exam Hall Seating Arrangement Generator
        </div>
      </footer>
    </div>
  );
}

/* -----------------------------------------
   STAT COMPONENT
----------------------------------------- */
function Stat({
  label,
  value,
  sub,
  highlight = "slate",
}: {
  label: string;
  value: number;
  sub?: string;
  highlight?: "slate" | "blue" | "indigo" | "red" | "green";
}) {
  const colorMap = {
    slate: "text-slate-900",
    blue: "text-blue-600",
    indigo: "text-indigo-600",
    red: "text-rose-600",
    green: "text-emerald-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-xl font-black ${colorMap[highlight]}`}>{value}</span>
        {sub && <span className="text-[10px] font-medium text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}

/* -----------------------------------------
   SEAT CARD COMPONENT
----------------------------------------- */
function SeatCard({
  student,
  side,
}: {
  student: Student | null;
  side: "L" | "R";
}) {
  if (!student) {
    return (
      <div className="min-w-0 flex-1 bg-slate-50/50 px-2 py-2.5 text-center transition">
        <div className="text-[8px] font-bold uppercase tracking-wider text-slate-300">{side}</div>
        <div className="mt-0.5 text-[10px] font-medium text-slate-300 italic">Empty</div>
      </div>
    );
  }

  return (
    <div
      className={`min-w-0 flex-1 px-2 py-2 text-center transition ${
        side === "R" ? "border-l border-slate-200/80 bg-blue-50/40" : "bg-indigo-50/40"
      }`}
    >
      <div className="flex items-center justify-between text-[8px] font-bold text-slate-400">
        <span className="rounded bg-slate-200/60 px-1 py-0.2">{side}</span>
        {student.className && (
          <span className="truncate text-blue-600 font-bold max-w-[80px]" title={student.className}>
            {student.className}
          </span>
        )}
      </div>

      <div
        className="mt-1 truncate font-mono text-[11px] font-bold text-slate-900"
        title={student.roll}
      >
        {student.roll}
      </div>

      {student.subject && (
        <div
          className="mt-0.5 truncate text-[9px] font-medium text-slate-500"
          title={student.subject}
        >
          {student.subject}
        </div>
      )}
    </div>
  );
}

export default App;