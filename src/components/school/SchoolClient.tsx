"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, Plus, Trash2, Upload, CheckCircle2, Circle, X, GraduationCap } from "lucide-react";

type Assignment = {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  weight?: number | null;
  grade?: number | null;
  isCompleted: boolean;
  source?: string | null;
  course?: { name: string; color: string | null };
};

type Course = {
  id: string;
  name: string;
  code?: string | null;
  instructor?: string | null;
  color: string | null;
  syllabusText?: string | null;
  assignments: Assignment[];
};

const COLORS = ["#6C63FF", "#22C55E", "#3B82F6", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#8B5CF6"];

export function SchoolClient({
  initialCourses,
}: {
  initialCourses: Course[];
}) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [assignments, setAssignments] = useState<Assignment[]>(
    initialCourses.flatMap((c) => c.assignments.map((a) => ({ ...a, course: { name: c.name, color: c.color } })))
  );
  const [tab, setTab] = useState<"courses" | "assignments" | "grades">("courses");
  const [filterCourse, setFilterCourse] = useState<string>("");

  // Course dialog state
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseInstructor, setCourseInstructor] = useState("");
  const [courseColor, setCourseColor] = useState(COLORS[0]);
  const [courseLoading, setCourseLoading] = useState(false);

  // Assignment dialog state
  const [asnDialogOpen, setAsnDialogOpen] = useState(false);
  const [asnTitle, setAsnTitle] = useState("");
  const [asnCourse, setAsnCourse] = useState("");
  const [asnDue, setAsnDue] = useState("");
  const [asnWeight, setAsnWeight] = useState("");
  const [asnLoading, setAsnLoading] = useState(false);

  // Syllabus upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  async function addCourse() {
    if (!courseName.trim()) return;
    setCourseLoading(true);
    const res = await fetch("/api/school/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: courseName, code: courseCode, instructor: courseInstructor, color: courseColor }),
    });
    if (res.ok) {
      const { course } = await res.json() as { course: Course };
      course.assignments = [];
      setCourses((prev) => [...prev, course]);
    }
    setCourseLoading(false);
    setCourseDialogOpen(false);
    setCourseName("");
    setCourseCode("");
    setCourseInstructor("");
    setCourseColor(COLORS[0]);
  }

  async function deleteCourse(id: string) {
    await fetch(`/api/school/courses/${id}`, { method: "DELETE" });
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setAssignments((prev) => prev.filter((a) => a.courseId !== id));
  }

  async function addAssignment() {
    if (!asnTitle.trim() || !asnCourse) return;
    setAsnLoading(true);
    const body: Record<string, unknown> = { courseId: asnCourse, title: asnTitle };
    if (asnDue) body.dueDate = new Date(asnDue).toISOString();
    if (asnWeight) body.weight = parseFloat(asnWeight);
    const res = await fetch("/api/school/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const { assignment } = await res.json() as { assignment: Assignment };
      const course = courses.find((c) => c.id === asnCourse);
      assignment.course = course ? { name: course.name, color: course.color ?? "#6C63FF" } : undefined;
      setAssignments((prev) => [...prev, assignment]);
      setCourses((prev) =>
        prev.map((c) => (c.id === asnCourse ? { ...c, assignments: [...c.assignments, assignment] } : c))
      );
    }
    setAsnLoading(false);
    setAsnDialogOpen(false);
    setAsnTitle("");
    setAsnCourse("");
    setAsnDue("");
    setAsnWeight("");
  }

  async function toggleAssignment(id: string, current: boolean) {
    await fetch(`/api/school/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !current }),
    });
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, isCompleted: !current } : a)));
  }

  async function deleteAssignment(id: string) {
    await fetch(`/api/school/assignments/${id}`, { method: "DELETE" });
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    setCourses((prev) =>
      prev.map((c) => ({ ...c, assignments: c.assignments.filter((a) => a.id !== id) }))
    );
  }

  async function handleSyllabusUpload(courseId: string, file: File) {
    setUploadingFor(courseId);
    setUploadStatus("Uploading and extracting assignments...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/school/courses/${courseId}/syllabus`, { method: "POST", body: fd });
    if (res.ok) {
      const { assignmentsCreated } = await res.json() as { assignmentsCreated: number };
      setUploadStatus(`Done! ${assignmentsCreated} assignment${assignmentsCreated !== 1 ? "s" : ""} extracted.`);
      // Refresh assignments
      const asnRes = await fetch(`/api/school/assignments?courseId=${courseId}`);
      if (asnRes.ok) {
        const { assignments: newAsn } = await asnRes.json() as { assignments: Assignment[] };
        setAssignments((prev) => [
          ...prev.filter((a) => a.courseId !== courseId),
          ...newAsn,
        ]);
      }
    } else {
      setUploadStatus("Upload failed. Please try again.");
    }
    setUploadingFor(null);
    setTimeout(() => setUploadStatus(""), 4000);
  }

  const filteredAssignments = filterCourse
    ? assignments.filter((a) => a.courseId === filterCourse)
    : assignments;
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  function gradeColor(grade: number) {
    if (grade >= 90) return "text-green-400";
    if (grade >= 75) return "text-blue-400";
    if (grade >= 60) return "text-yellow-400";
    return "text-red-400";
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1 w-fit">
        {(["courses", "assignments", "grades"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm capitalize transition ${
              tab === t ? "bg-[#6C63FF] text-white" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Upload status */}
      {uploadStatus && (
        <p className="text-sm text-[#6C63FF]">{uploadStatus}</p>
      )}

      {/* Courses tab */}
      {tab === "courses" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">{courses.length} course{courses.length !== 1 ? "s" : ""} enrolled</p>
            <Dialog.Root open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
              <Dialog.Trigger asChild>
                <Button size="sm" className="bg-[#6C63FF] hover:bg-[#5b53e8] text-white">
                  <Plus size={14} className="mr-1" />
                  Add course
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-[#0A0A0F] p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-semibold">Add Course</Dialog.Title>
                    <Dialog.Close asChild>
                      <button className="text-zinc-500 hover:text-zinc-100"><X size={16} /></button>
                    </Dialog.Close>
                  </div>
                  <div className="space-y-3">
                    <Input
                      placeholder="Course name *"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      className="bg-zinc-900 border-zinc-700"
                    />
                    <Input
                      placeholder="Course code (e.g. CS101)"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      className="bg-zinc-900 border-zinc-700"
                    />
                    <Input
                      placeholder="Instructor name"
                      value={courseInstructor}
                      onChange={(e) => setCourseInstructor(e.target.value)}
                      className="bg-zinc-900 border-zinc-700"
                    />
                    <div>
                      <p className="mb-2 text-xs text-zinc-400">Color</p>
                      <div className="flex gap-2">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setCourseColor(c)}
                            className={`h-6 w-6 rounded-full transition ${courseColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : ""}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={addCourse}
                      disabled={courseLoading || !courseName.trim()}
                      className="w-full bg-[#6C63FF] hover:bg-[#5b53e8] text-white"
                    >
                      {courseLoading ? "Adding..." : "Add Course"}
                    </Button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>

          {courses.length === 0 ? (
            <Card className="p-8 text-center">
              <GraduationCap size={32} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-400">No courses yet. Add your first course above.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((course) => {
                const completed = course.assignments.filter((a) => a.isCompleted).length;
                const total = course.assignments.length;
                const hasGrades = course.assignments.some((a) => a.grade !== null);
                const avg = hasGrades
                  ? Math.round(
                      course.assignments.filter((a) => a.grade !== null).reduce((s, a) => s + (a.grade ?? 0), 0) /
                        course.assignments.filter((a) => a.grade !== null).length
                    )
                  : null;
                return (
                  <Card key={course.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: course.color ?? "#6C63FF" }} />
                        <div>
                          <p className="font-medium text-zinc-100">{course.name}</p>
                          {course.code && <p className="text-xs text-zinc-500">{course.code}</p>}
                        </div>
                      </div>
                      <button onClick={() => deleteCourse(course.id)} className="text-zinc-600 hover:text-red-400 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {course.instructor && (
                      <p className="mt-1 text-xs text-zinc-400">{course.instructor}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                      <span>{completed}/{total} done</span>
                      {avg !== null && <span className={gradeColor(avg)}>avg {avg}%</span>}
                    </div>
                    {total > 0 && (
                      <div className="mt-2 h-1 w-full rounded-full bg-zinc-800">
                        <div
                          className="h-1 rounded-full"
                          style={{ width: `${Math.round((completed / total) * 100)}%`, backgroundColor: course.color ?? "#6C63FF" }}
                        />
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setUploadingFor(course.id);
                          fileRef.current?.click();
                        }}
                        className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                        disabled={uploadingFor === course.id}
                      >
                        <Upload size={12} />
                        {uploadingFor === course.id ? "Uploading..." : "Upload syllabus"}
                      </button>
                      <button
                        onClick={() => {
                          setAsnCourse(course.id);
                          setAsnDialogOpen(true);
                        }}
                        className="flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        <Plus size={12} />
                        Add assignment
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Hidden file input for syllabus */}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && uploadingFor) {
                handleSyllabusUpload(uploadingFor, file);
              }
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Assignments tab */}
      {tab === "assignments" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300"
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Dialog.Root open={asnDialogOpen} onOpenChange={setAsnDialogOpen}>
              <Dialog.Trigger asChild>
                <Button size="sm" className="bg-[#6C63FF] hover:bg-[#5b53e8] text-white">
                  <Plus size={14} className="mr-1" />
                  Add assignment
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-[#0A0A0F] p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-semibold">Add Assignment</Dialog.Title>
                    <Dialog.Close asChild>
                      <button className="text-zinc-500 hover:text-zinc-100"><X size={16} /></button>
                    </Dialog.Close>
                  </div>
                  <div className="space-y-3">
                    <select
                      value={asnCourse}
                      onChange={(e) => setAsnCourse(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
                    >
                      <option value="">Select course *</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Assignment title *"
                      value={asnTitle}
                      onChange={(e) => setAsnTitle(e.target.value)}
                      className="bg-zinc-900 border-zinc-700"
                    />
                    <Input
                      type="datetime-local"
                      value={asnDue}
                      onChange={(e) => setAsnDue(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-zinc-300"
                    />
                    <Input
                      type="number"
                      placeholder="Weight (% of grade)"
                      value={asnWeight}
                      onChange={(e) => setAsnWeight(e.target.value)}
                      min={0}
                      max={100}
                      className="bg-zinc-900 border-zinc-700"
                    />
                    <Button
                      onClick={addAssignment}
                      disabled={asnLoading || !asnTitle.trim() || !asnCourse}
                      className="w-full bg-[#6C63FF] hover:bg-[#5b53e8] text-white"
                    >
                      {asnLoading ? "Adding..." : "Add Assignment"}
                    </Button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>

          {sortedAssignments.length === 0 ? (
            <Card className="p-8 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-400">No assignments yet. Upload a syllabus or add one manually.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {sortedAssignments.map((a) => (
                <Card key={a.id} className={`flex items-start justify-between p-3 ${a.isCompleted ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleAssignment(a.id, a.isCompleted)} className="mt-0.5 text-zinc-500 hover:text-[#6C63FF] transition">
                      {a.isCompleted ? <CheckCircle2 size={16} className="text-green-400" /> : <Circle size={16} />}
                    </button>
                    <div>
                      <p className={`text-sm font-medium ${a.isCompleted ? "line-through text-zinc-500" : "text-zinc-100"}`}>
                        {a.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        {a.course && (
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.course.color ?? "#6C63FF" }} />
                            {a.course.name}
                          </span>
                        )}
                        {a.dueDate && (
                          <span className={new Date(a.dueDate) < new Date() && !a.isCompleted ? "text-red-400" : ""}>
                            Due {new Date(a.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {a.weight != null && <span>{a.weight}%</span>}
                        {a.source === "syllabus" && <span className="text-[#6C63FF]">from syllabus</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteAssignment(a.id)} className="text-zinc-600 hover:text-red-400 transition ml-2">
                    <Trash2 size={14} />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grades tab */}
      {tab === "grades" && (
        <div className="space-y-4">
          {courses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-zinc-400">Add courses first to track grades.</p>
            </Card>
          ) : (
            courses.map((course) => {
              const graded = course.assignments.filter((a) => {
                const live = assignments.find((x) => x.id === a.id);
                return (live?.grade ?? a.grade) !== null;
              });
              const weighted = graded.filter((a) => a.weight != null);
              let finalGrade: number | null = null;
              if (weighted.length > 0) {
                const totalWeight = weighted.reduce((s, a) => s + (a.weight ?? 0), 0);
                const weightedSum = weighted.reduce((s, a) => {
                  const live = assignments.find((x) => x.id === a.id);
                  return s + (live?.grade ?? a.grade ?? 0) * (a.weight ?? 0);
                }, 0);
                finalGrade = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
              } else if (graded.length > 0) {
                const sum = graded.reduce((s, a) => {
                  const live = assignments.find((x) => x.id === a.id);
                  return s + (live?.grade ?? a.grade ?? 0);
                }, 0);
                finalGrade = Math.round(sum / graded.length);
              }

              return (
                <Card key={course.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: course.color ?? "#6C63FF" }} />
                      <p className="font-medium text-zinc-100">{course.name}</p>
                      {course.code && <span className="text-xs text-zinc-500">({course.code})</span>}
                    </div>
                    {finalGrade !== null && (
                      <span className={`text-lg font-bold ${gradeColor(finalGrade)}`}>{finalGrade}%</span>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {course.assignments.length === 0 ? (
                      <p className="text-xs text-zinc-500">No assignments added yet.</p>
                    ) : (
                      course.assignments.map((a) => {
                        const live = assignments.find((x) => x.id === a.id);
                        const grade = live?.grade ?? a.grade;
                        return (
                          <div key={a.id} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-300 truncate max-w-[60%]">{a.title}</span>
                            <div className="flex items-center gap-3">
                              {a.weight != null && (
                                <span className="text-xs text-zinc-500">{a.weight}%</span>
                              )}
                              <GradeInput
                                assignmentId={a.id}
                                initialGrade={grade}
                                onSave={(g) => {
                                  setAssignments((prev) =>
                                    prev.map((x) => (x.id === a.id ? { ...x, grade: g } : x))
                                  );
                                  setCourses((prev) =>
                                    prev.map((c) => ({
                                      ...c,
                                      assignments: c.assignments.map((x) => (x.id === a.id ? { ...x, grade: g } : x)),
                                    }))
                                  );
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function GradeInput({
  assignmentId,
  initialGrade,
  onSave,
}: {
  assignmentId: string;
  initialGrade: number | null | undefined;
  onSave: (grade: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(initialGrade != null ? String(initialGrade) : "");

  async function save() {
    const g = val.trim() === "" ? null : parseFloat(val);
    await fetch(`/api/school/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: g }),
    });
    onSave(g);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="min-w-[4rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-right hover:border-[#6C63FF] transition"
      >
        {initialGrade != null ? `${initialGrade}%` : "— %"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type="number"
        min={0}
        max={100}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="w-16 rounded border border-[#6C63FF] bg-zinc-900 px-2 py-0.5 text-xs text-right text-zinc-100 outline-none"
      />
      <button onClick={save} className="text-xs text-[#6C63FF] hover:underline">OK</button>
    </div>
  );
}
