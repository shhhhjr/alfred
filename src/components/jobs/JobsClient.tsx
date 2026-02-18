"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
// Simple toast state management
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { downloadTextAsPdf } from "@/lib/jobs/pdfExport";

type Resume = {
  id: string;
  skills: string[];
  keywords: string[];
  education: string | null;
  contentLength: number;
} | null;

type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  source: string;
  matchScore: number | null;
  status: string;
  customResume: string | null;
  customCover: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactTitle: string | null;
  notes: string | null;
  createdAt: string;
};

type SourceResult = {
  name: string;
  success: boolean;
  error?: string;
  count: number;
};

export function JobsClient({ initialJobs }: { initialJobs: Job[] }) {
  const [resume, setResume] = useState<Resume>(null);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [keywords, setKeywords] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasting, setPasting] = useState(false);
  const [generatingResume, setGeneratingResume] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState<string | null>(null);
  const [findingContact, setFindingContact] = useState<string | null>(null);
  const [view, setView] = useState<"search" | "tracker">("search");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ title: string; description?: string; variant?: "default" | "destructive" } | null>(null);
  const [applyDialog, setApplyDialog] = useState<{ job: Job; step: "did_apply" | "send_cover" } | null>(null);
  const router = useRouter();

  function showToast(title: string, description?: string, variant: "default" | "destructive" = "default") {
    setToast({ title, description, variant });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    loadResume();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function loadResume() {
    try {
      const res = await fetch("/api/jobs/resume");
      const data = await res.json();
      if (!res.ok) {
        showToast("Could not load resume", data.error ?? "Request failed", "destructive");
        return;
      }
      setResume(data.resume ? { ...data.resume, contentLength: data.resume.contentLength ?? data.resume.content?.length ?? 0 } : null);
    } catch {
      showToast("Could not load resume", "Network error", "destructive");
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/jobs/resume", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      setResume(data.resume);
      showToast("Resume uploaded successfully");
    } catch (err) {
      showToast("Upload failed", err instanceof Error ? err.message : String(err), "destructive");
    } finally {
      setUploading(false);
    }
  }

  async function handlePasteResume() {
    const text = pasteText.trim();
    if (!text) {
      showToast("Paste your resume text first", undefined, "destructive");
      return;
    }
    setPasting(true);
    try {
      const res = await fetch("/api/jobs/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save resume");
      }

      const data = await res.json();
      setResume(data.resume);
      setPasteText("");
      showToast("Resume saved (AI extracted skills & education)");
    } catch (err) {
      showToast("Failed to save", err instanceof Error ? err.message : String(err), "destructive");
    } finally {
      setPasting(false);
    }
  }

  async function handleSearch() {
    if (!keywords.trim() && !jobTitle.trim()) {
      showToast("Enter keywords or job title", undefined, "destructive");
      return;
    }

    setSearching(true);
    setSearchProgress([]);

    try {
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, jobTitle, location }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Search failed");
      }
      setJobs(data.jobs);
      setSearchProgress(data.sources.map((s: SourceResult) => `${s.name}: ${s.count} jobs`));
      showToast(`Found ${data.jobs.length} jobs`);
    } catch (err) {
      showToast("Search failed", err instanceof Error ? err.message : String(err), "destructive");
    } finally {
      setSearching(false);
    }
  }

  async function handleGenerateResume(jobId: string) {
    setGeneratingResume(jobId);
    try {
      const res = await fetch("/api/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, type: "resume" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, customResume: data.job.customResume } : j)));
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, customResume: data.job.customResume });
      }
      showToast("Resume generated");
    } catch (err) {
      showToast("Failed to generate resume", err instanceof Error ? err.message : "Unknown error", "destructive");
    } finally {
      setGeneratingResume(null);
    }
  }

  async function handleGenerateCover(jobId: string) {
    setGeneratingCover(jobId);
    try {
      const res = await fetch("/api/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, type: "cover_letter" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, customCover: data.job.customCover } : j)));
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, customCover: data.job.customCover });
      }
      showToast("Cover letter generated");
    } catch (err) {
      showToast("Failed to generate cover letter", err instanceof Error ? err.message : "Unknown error", "destructive");
    } finally {
      setGeneratingCover(null);
    }
  }

  async function handleFindContact(jobId: string) {
    setFindingContact(jobId);
    try {
      const res = await fetch("/api/jobs/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Contact search failed";
        if (res.status === 503 && msg.includes("API keys")) {
          showToast("Add API keys", "Add HUNTER_API_KEY and/or APOLLO_API_KEY to your .env file", "destructive");
        } else {
          showToast("Could not find contact", msg, "destructive");
        }
        return;
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, contactName: data.contact.name, contactEmail: data.contact.email, contactTitle: data.contact.title }
            : j
        )
      );
      if (selectedJob?.id === jobId) {
        setSelectedJob({
          ...selectedJob,
          contactName: data.contact.name,
          contactEmail: data.contact.email,
          contactTitle: data.contact.title,
        });
      }
      showToast("Contact found");
    } catch (err) {
      showToast("Could not find contact", err instanceof Error ? err.message : "Unknown error", "destructive");
    } finally {
      setFindingContact(null);
    }
  }

  async function handleUpdateStatus(jobId: string, status: string) {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Update failed");

      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, status });
      }
    } catch {
      showToast("Failed to update status", undefined, "destructive");
    }
  }

  async function handleUpdateNotes(jobId: string, notes: string) {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!res.ok) throw new Error("Update failed");

      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, notes } : j)));
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, notes });
      }
    } catch {
      // Silent update
    }
  }

  function handleDraftEmail(job: Job) {
    const prompt = `Draft a cold outreach email to ${job.contactName || "the hiring manager"} (${job.contactTitle || "hiring manager"}) at ${job.company} about the ${job.title} position.`;
    router.push(`/chat?prompt=${encodeURIComponent(prompt)}`);
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;

    const jobId = result.draggableId;
    const newStatus = result.destination.droppableId;

    handleUpdateStatus(jobId, newStatus);
  }

  function getFullUrl(job: Job): string {
    if (job.url.startsWith("http")) return job.url;
    const domain = job.source === "indeed" ? "www.indeed.com" : job.source === "linkedin" ? "www.linkedin.com" : "www.businessoffashion.com";
    return `https://${domain}${job.url.startsWith("/") ? job.url : "/" + job.url}`;
  }

  function handleApplyClick(job: Job) {
    const url = getFullUrl(job);
    window.open(url, "_blank", "noopener,noreferrer");
    setApplyDialog({ job, step: "did_apply" });
  }

  function handleSendCoverLetter(job: Job) {
    if (!job.customCover?.trim()) {
      showToast("Generate a cover letter first", undefined, "destructive");
      return;
    }
    const to = job.contactEmail?.trim() || "";
    const subject = `Application for ${job.title} at ${job.company}`;
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(job.customCover)}`;
    window.location.href = mailto;
    setApplyDialog(null);
    handleUpdateStatus(job.id, "applied");
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "applied" } : j)));
    if (selectedJob?.id === job.id) setSelectedJob({ ...selectedJob, status: "applied" });
  }

  const statusColumns = ["found", "saved", "applied", "interview", "offer", "rejected"];

  return (
    <div className="space-y-4">
      {/* Resume Upload */}
      <Card className="p-5">
        {!resume ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Upload Your Master Resume</h2>
            <p className="text-sm text-zinc-400">Upload a PDF or DOCX file to enable job matching</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 p-8 transition-colors hover:border-[#6C63FF] hover:bg-zinc-900"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file && (file.name.endsWith(".pdf") || file.name.endsWith(".docx"))) {
                  handleFileUpload(file);
                } else {
                  showToast("Invalid file type", "Use PDF or DOCX", "destructive");
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                  Uploading...
                </span>
              ) : (
                <>
                  <p className="text-sm text-zinc-400">Drag and drop your resume here, or</p>
                  <Button type="button" variant="outline" className="mt-2" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Choose File
                  </Button>
                </>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-xs text-zinc-500">Or paste your resume text (AI will extract skills & education)</p>
              <Textarea
                placeholder="Paste your resume text here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="min-h-[100px] bg-zinc-900"
                disabled={uploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePasteResume}
                disabled={!pasteText.trim() || pasting}
              >
                {pasting ? "Saving..." : "Save from pasted text"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Resume</h2>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                Re-upload
              </Button>
            </div>
            <div className="rounded-lg bg-zinc-900 p-3 text-sm">
              <p className="text-zinc-400">Skills detected: {resume.skills.slice(0, 10).join(", ")}</p>
              {resume.education && <p className="mt-1 text-zinc-400">Education: {resume.education}</p>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </div>
        )}
      </Card>

      {/* Search Bar */}
      <Card className="p-5">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Keywords (e.g., software engineer)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Input
            placeholder="Job title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Button onClick={handleSearch} disabled={searching}>
            {searching ? "Searching..." : "Search Jobs"}
          </Button>
        </div>
        {searchProgress.length > 0 && (
          <div className="mt-3 text-sm text-zinc-400">
            {searchProgress.map((p, i) => (
              <div key={i}>{p}</div>
            ))}
          </div>
        )}
      </Card>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button variant={view === "search" ? "default" : "outline"} onClick={() => setView("search")}>
          Search Results
        </Button>
        <Button variant={view === "tracker" ? "default" : "outline"} onClick={() => setView("tracker")}>
          Application Tracker
        </Button>
      </div>

      {view === "search" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Job List */}
          <Card className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-2 p-4">
                {jobs.length === 0 ? (
                  <p className="p-4 text-sm text-zinc-400">No jobs found. Start a search above.</p>
                ) : (
                  jobs.map((job) => (
                      <div
                        key={job.id}
                        className={`w-full rounded-lg border p-3 transition-colors ${
                          selectedJob?.id === job.id ? "border-[#6C63FF] bg-zinc-900" : "border-zinc-800 hover:bg-zinc-900"
                        }`}
                      >
                        <button
                          className="w-full text-left"
                          onClick={() => setSelectedJob(job)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate font-medium">{job.title}</h3>
                              <p className="truncate text-sm text-zinc-400">{job.company}</p>
                              <p className="text-xs text-zinc-500">{job.location || "Remote"}</p>
                            </div>
                            <div className="ml-2 flex flex-col items-end gap-1">
                              <Badge variant="outline" className="text-xs">
                                {job.source}
                              </Badge>
                              {job.matchScore !== null && (
                                <div
                                  className={`h-2 w-12 rounded ${
                                    job.matchScore >= 70 ? "bg-green-500" : job.matchScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${Math.min(job.matchScore, 100)}%` }}
                                />
                              )}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyClick(job);
                          }}
                        >
                          Apply
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Job Detail */}
          <Card className="p-5">
            {selectedJob ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">{selectedJob.title}</h2>
                  <p className="text-zinc-400">{selectedJob.company}</p>
                  <p className="text-sm text-zinc-500">{selectedJob.location || "Remote"}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge>{selectedJob.source}</Badge>
                    {selectedJob.matchScore !== null && (
                      <Badge variant={selectedJob.matchScore >= 70 ? "default" : selectedJob.matchScore >= 40 ? "secondary" : "destructive"}>
                        {selectedJob.matchScore}% match
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => handleGenerateResume(selectedJob.id)}
                    disabled={!!generatingResume}
                  >
                    {generatingResume === selectedJob.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                        Generating...
                      </span>
                    ) : (
                      "Generate Custom Resume"
                    )}
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleGenerateCover(selectedJob.id)}
                    disabled={!!generatingCover}
                  >
                    {generatingCover === selectedJob.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                        Generating...
                      </span>
                    ) : (
                      "Generate Cover Letter"
                    )}
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleFindContact(selectedJob.id)}
                    disabled={!!findingContact}
                  >
                    {findingContact === selectedJob.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                        Finding...
                      </span>
                    ) : (
                      "Find Contact"
                    )}
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleApplyClick(selectedJob)}
                  >
                    Apply for this job
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Button>
                </div>

                {selectedJob.customResume && (
                  <div>
                    <h3 className="mb-2 font-medium">Custom Resume</h3>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        downloadTextAsPdf(
                          selectedJob.customResume!,
                          `Resume_${selectedJob.company.replace(/\s+/g, "_")}_${selectedJob.title.replace(/\s+/g, "_")}`
                        )
                      }
                    >
                      Download as PDF
                    </Button>
                  </div>
                )}

                {selectedJob.customCover && (
                  <div>
                    <h3 className="mb-2 font-medium">Cover Letter</h3>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        downloadTextAsPdf(
                          selectedJob.customCover!,
                          `CoverLetter_${selectedJob.company.replace(/\s+/g, "_")}_${selectedJob.title.replace(/\s+/g, "_")}`
                        )
                      }
                    >
                      Download as PDF
                    </Button>
                  </div>
                )}

                {selectedJob.contactEmail && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <h3 className="font-medium">Contact</h3>
                    <p className="text-sm text-zinc-400">{selectedJob.contactName}</p>
                    <p className="text-sm text-zinc-400">{selectedJob.contactTitle}</p>
                    <p className="text-sm text-[#6C63FF]">{selectedJob.contactEmail}</p>
                    <Button className="mt-2 w-full" size="sm" onClick={() => handleDraftEmail(selectedJob)}>
                      Draft Outreach Email
                    </Button>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium">Status</label>
                  <Select value={selectedJob.status} onValueChange={(v) => handleUpdateStatus(selectedJob.id, v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusColumns.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Notes</label>
                  <Textarea
                    value={selectedJob.notes || ""}
                    onChange={(e) => {
                      setSelectedJob({ ...selectedJob, notes: e.target.value });
                      handleUpdateNotes(selectedJob.id, e.target.value);
                    }}
                    placeholder="Add notes..."
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400">Select a job to view details</div>
            )}
          </Card>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {statusColumns.map((status) => (
              <Droppable key={status} droppableId={status}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    <h3 className="text-sm font-medium uppercase text-zinc-400">{status}</h3>
                    <div className="min-h-[400px] space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
                      {jobs
                        .filter((j) => j.status === status)
                        .map((job, index) => (
                          <Draggable key={job.id} draggableId={job.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="cursor-move rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm"
                                onClick={() => setSelectedJob(job)}
                              >
                                <p className="font-medium">{job.title}</p>
                                <p className="text-xs text-zinc-400">{job.company}</p>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Apply flow dialog */}
      <Dialog open={!!applyDialog} onOpenChange={(o) => !o && setApplyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {applyDialog?.step === "did_apply"
                ? "Did you apply?"
                : "Send cover letter?"}
            </DialogTitle>
          </DialogHeader>
          {applyDialog && (
            <>
              {applyDialog.step === "did_apply" ? (
                <p className="text-sm text-zinc-400">
                  The job listing is open in a new tab. Let us know when you&apos;ve finished applying.
                </p>
              ) : (
                <div className="space-y-2 text-sm text-zinc-400">
                  <p>
                    Would you like to send your cover letter to the hiring manager? We&apos;ll open your email client with the cover letter ready.
                  </p>
                  {!applyDialog.job.contactEmail && (
                    <p className="text-amber-400">
                      Find the hiring contact first to pre-fill the recipient. Otherwise you&apos;ll need to add it manually.
                    </p>
                  )}
                </div>
              )}
              <DialogFooter>
                {applyDialog.step === "did_apply" ? (
                  <>
                    <Button variant="outline" onClick={() => setApplyDialog(null)}>
                      No
                    </Button>
                    <Button
                      onClick={() => setApplyDialog({ ...applyDialog, step: "send_cover" })}
                    >
                      Yes, I applied
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setApplyDialog(null)}>
                      No
                    </Button>
                    <Button
                      onClick={() => {
                        handleSendCoverLetter(applyDialog.job);
                        setApplyDialog(null);
                      }}
                      disabled={!applyDialog.job.customCover?.trim()}
                    >
                      Yes, send cover letter
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-100 shadow-lg">
          <p className="font-medium">{toast.title}</p>
          {toast.description && <p className="mt-1 text-xs text-zinc-400">{toast.description}</p>}
        </div>
      )}
    </div>
  );
}
