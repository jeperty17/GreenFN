/*
 * ContactDetailsPage: Full contact profile with 4 sections — contact details
 * (view/edit), portfolio summary, tasks, and interaction history timeline.
 * Breaks out of AppLayout's px-6 py-6 padding via -mx-6 -mt-6 wrapper.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { API_BASE_URL } from "../config/env";
import AddTaskModal from "../components/tasks/AddTaskModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type TagItem = { id: string; name: string };

type ContactItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  type: "LEAD" | "CLIENT";
  birthday: string | null;
  priorities: string | null;
  portfolioSummary: string | null;
  stageName: string | null;
  isStarred: boolean;
  tags: TagItem[];
  updatedAt: string;
};

type InteractionItem = {
  id: string;
  type: string;
  occurredAt: string;
  notes: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  status: string;
  contactId: string;
  contactName: string;
  stageName: string | null;
};

type EditFormState = {
  fullName: string;
  email: string;
  phone: string;
  source: string;
  type: "LEAD" | "CLIENT";
  birthday: string;
  priorities: string;
  portfolioSummary: string;
  isStarred: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium" }).format(d);
}

function formatUpdatedAt(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function formatInteractionDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

function getTaskDueInfo(dueAt: string) {
  const d = new Date(dueAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (taskDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const dateStr = new Intl.DateTimeFormat("en-SG", {
    month: "short",
    day: "numeric",
  }).format(d);
  return {
    dateStr,
    isOverdue: diffDays < 0,
    isToday: diffDays === 0,
    isThisWeek: diffDays > 0 && diffDays <= 7,
    diffDays,
  };
}

function sanitizeTaskDescription(value: string | null | undefined): string {
  const description = (value || "").trim();
  if (!description) return "";

  const normalized = description.toLowerCase();
  const placeholderValues = new Set([
    "no description",
    "none",
    "n/a",
    "na",
    "-",
    "--",
    "—",
    "null",
    "undefined",
  ]);

  return placeholderValues.has(normalized) ? "" : description;
}

function groupByMonth(
  items: InteractionItem[],
): { month: string; items: InteractionItem[] }[] {
  const groups: { month: string; items: InteractionItem[] }[] = [];
  const seen = new Map<string, InteractionItem[]>();
  for (const item of items) {
    const d = new Date(item.occurredAt);
    const key = new Intl.DateTimeFormat("en-SG", {
      month: "short",
      year: "numeric",
    }).format(d);
    if (!seen.has(key)) {
      const arr: InteractionItem[] = [];
      seen.set(key, arr);
      groups.push({ month: key, items: arr });
    }
    seen.get(key)!.push(item);
  }
  return groups;
}

function getInteractionMeta(type: string) {
  const lc = type.toLowerCase();
  if (lc === "call" || lc === "phone")
    return {
      dotColor: "hsl(142 45% 34%)",
      badgeClass: "bg-secondary text-primary",
      icon: Phone,
    };
  if (lc === "meeting" || lc === "in-person")
    return {
      dotColor: "hsl(38 90% 55%)",
      badgeClass: "bg-amber-50 text-amber-700",
      icon: Users,
    };
  if (lc.includes("whatsapp") || lc.includes("dm") || lc.includes("chat"))
    return {
      dotColor: "hsl(142 35% 52%)",
      badgeClass: "bg-secondary text-primary",
      icon: MessageCircle,
    };
  if (lc === "email")
    return {
      dotColor: "hsl(200 70% 48%)",
      badgeClass: "bg-sky-50 text-sky-700",
      icon: Mail,
    };
  // note / default
  return {
    dotColor: "hsl(142 10% 62%)",
    badgeClass: "bg-muted text-foreground",
    icon: FileText,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

function ContactDetailsPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  // Data
  const [contact, setContact] = useState<ContactItem | null>(null);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // UI state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    fullName: "",
    email: "",
    phone: "",
    source: "",
    type: "CLIENT",
    birthday: "",
    priorities: "",
    portfolioSummary: "",
    isStarred: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [taskBusyIds, setTaskBusyIds] = useState<string[]>([]);

  const [activeSection, setActiveSection] = useState("details");
  const [taskTab, setTaskTab] = useState<"open" | "completed">("open");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");

  // Section refs for scrollspy
  const detailsRef = useRef<HTMLElement>(null);
  const portfolioRef = useRef<HTMLElement>(null);
  const tasksRef = useRef<HTMLElement>(null);
  const historyRef = useRef<HTMLElement>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    const id = contactId ?? "";
    if (!id) {
      setErrorMessage("Missing contact ID.");
      return;
    }

    const ctrl = new AbortController();

    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const [cRes, iRes, tRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/contacts/${id}`, { signal: ctrl.signal }),
          fetch(
            `${API_BASE_URL}/api/interactions?contactId=${encodeURIComponent(id)}&page=1&pageSize=100&sortDirection=desc`,
            { signal: ctrl.signal },
          ),
          fetch(`${API_BASE_URL}/api/tasks?view=calendar`, {
            signal: ctrl.signal,
          }),
        ]);
        if (!cRes.ok)
          throw new Error(`Failed to load contact (${cRes.status})`);
        if (!iRes.ok)
          throw new Error(`Failed to load interactions (${iRes.status})`);
        if (!tRes.ok) throw new Error(`Failed to load tasks (${tRes.status})`);

        const { item: c }: { item: ContactItem } = await cRes.json();
        const { items: ints }: { items: InteractionItem[] } = await iRes.json();
        const { tasks: allTasks }: { tasks: TaskItem[] } = await tRes.json();

        setContact(c);
        setInteractions(ints || []);
        setTasks((allTasks || []).filter((t) => t.contactId === id));

        // Seed edit form from loaded contact
        setEditForm({
          fullName: c.fullName,
          email: c.email ?? "",
          phone: c.phone ?? "",
          source: c.source ?? "",
          type: c.type,
          birthday: c.birthday ?? "",
          priorities: c.priorities ?? "",
          portfolioSummary: c.portfolioSummary ?? "",
          isStarred: c.isStarred,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setErrorMessage(
          (err as Error).message || "Failed to load contact details",
        );
      } finally {
        setIsLoading(false);
      }
    }

    load();
    return () => ctrl.abort();
  }, [contactId]);

  // Refetch tasks when AddTaskModal creates a new task
  useEffect(() => {
    if (!contactId || taskRefreshKey === 0) return;
    fetch(`${API_BASE_URL}/api/tasks?view=calendar`)
      .then((r) => r.json())
      .then(({ tasks: all }) =>
        setTasks(
          (all || []).filter((t: TaskItem) => t.contactId === contactId),
        ),
      )
      .catch(() => {});
  }, [contactId, taskRefreshKey]);

  // ── Scrollspy ────────────────────────────────────────────────────────────

  useEffect(() => {
    const refs = [
      { id: "details", ref: detailsRef },
      { id: "portfolio", ref: portfolioRef },
      { id: "tasks", ref: tasksRef },
      { id: "history", ref: historyRef },
    ];
    function onScroll() {
      const OFFSET = 120;
      let active = "details";
      for (const { id, ref } of refs) {
        if (ref.current && ref.current.getBoundingClientRect().top < OFFSET) {
          active = id;
        }
      }
      setActiveSection(active);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const sortedInteractions = useMemo(
    () =>
      [...interactions].sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
    [interactions],
  );

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
      ),
    [tasks],
  );

  const openTasks = useMemo(
    () => sortedTasks.filter((t) => t.status === "OPEN"),
    [sortedTasks],
  );
  const completedTasks = useMemo(
    () => sortedTasks.filter((t) => t.status === "DONE"),
    [sortedTasks],
  );
  const overdueTasks = useMemo(
    () => openTasks.filter((t) => getTaskDueInfo(t.dueAt).isOverdue),
    [openTasks],
  );
  const thisWeekTasks = useMemo(
    () =>
      openTasks.filter((t) => {
        const { isOverdue, isToday, isThisWeek } = getTaskDueInfo(t.dueAt);
        return isToday || (isThisWeek && !isOverdue);
      }),
    [openTasks],
  );
  const upcomingTasks = useMemo(
    () =>
      openTasks.filter((t) => {
        const { isOverdue, isToday, isThisWeek } = getTaskDueInfo(t.dueAt);
        return !isOverdue && !isToday && !isThisWeek;
      }),
    [openTasks],
  );

  const filteredInteractions = useMemo(() => {
    let items = sortedInteractions;
    if (historyFilter !== "all") {
      items = items.filter(
        (i) =>
          i.type.toLowerCase().includes(historyFilter.toLowerCase()) ||
          (historyFilter === "whatsapp" &&
            (i.type.toLowerCase().includes("dm") ||
              i.type.toLowerCase().includes("chat"))),
      );
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      items = items.filter(
        (i) =>
          (i.notes ?? "").toLowerCase().includes(q) ||
          i.type.toLowerCase().includes(q),
      );
    }
    return items;
  }, [sortedInteractions, historyFilter, historySearch]);

  const groupedInteractions = useMemo(
    () => groupByMonth(filteredInteractions),
    [filteredInteractions],
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!contact) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const { item: updated }: { item: ContactItem } = await res.json();
      setContact(updated);
      setEditMode(false);
    } catch (err) {
      setSaveError((err as Error).message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!contact || !deleteConfirmed) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/contacts/${contact.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      navigate("/");
    } catch (err) {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setErrorMessage((err as Error).message || "Failed to delete");
    }
  }

  async function handleStarToggle() {
    if (!contact) return;
    const next = !contact.isStarred;
    setContact({ ...contact, isStarred: next }); // optimistic
    setEditForm((f) => ({ ...f, isStarred: next }));
    try {
      await fetch(`${API_BASE_URL}/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, isStarred: next }),
      });
    } catch {
      // Revert on failure
      setContact({ ...contact, isStarred: !next });
      setEditForm((f) => ({ ...f, isStarred: !next }));
    }
  }

  function enterEdit() {
    if (!contact) return;
    setEditForm({
      fullName: contact.fullName,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      source: contact.source ?? "",
      type: contact.type,
      birthday: contact.birthday ?? "",
      priorities: contact.priorities ?? "",
      portfolioSummary: contact.portfolioSummary ?? "",
      isStarred: contact.isStarred,
    });
    setSaveError("");
    setEditMode(true);
    setTimeout(
      () =>
        detailsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      50,
    );
  }

  async function handleTaskStatusToggle(task: TaskItem) {
    const nextStatus = task.status === "DONE" ? "OPEN" : "DONE";
    setTaskBusyIds((prev) => [...prev, task.id]);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
    );

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update task (${res.status})`);
      }
    } catch (err) {
      // Revert optimistic status change on failure.
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
      setErrorMessage((err as Error).message || "Failed to update task");
    } finally {
      setTaskBusyIds((prev) => prev.filter((id) => id !== task.id));
    }
  }

  async function handleTaskDelete(taskId: string) {
    const previousTasks = tasks;
    setTaskBusyIds((prev) => [...prev, taskId]);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Failed to delete task (${res.status})`);
      }
    } catch (err) {
      // Restore list if delete fails.
      setTasks(previousTasks);
      setErrorMessage((err as Error).message || "Failed to delete task");
    } finally {
      setTaskBusyIds((prev) => prev.filter((id) => id !== taskId));
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const navItems = [
    { id: "details", label: "Contact Details" },
    { id: "portfolio", label: "Portfolio" },
    {
      id: "tasks",
      label: "Tasks",
      badge: openTasks.length > 0 ? String(openTasks.length) : undefined,
      badgeClass: "bg-amber-100 text-amber-700",
    },
    {
      id: "history",
      label: "Interactions",
      badge:
        sortedInteractions.length > 0
          ? String(sortedInteractions.length)
          : undefined,
      badgeClass: "bg-muted text-muted-foreground",
    },
  ];

  return (
    // Break out of AppLayout's px-6 py-6
    <div className="-mx-6 -mt-6">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-[hsl(140,20%,97%)]/90 backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-8">
          {/* Row 1: breadcrumb */}
          <div className="flex items-center justify-between h-[52px]">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">
                Contacts Hub
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              {contact ? (
                <span className="text-foreground font-medium">
                  {contact.fullName}
                </span>
              ) : (
                <span className="text-foreground font-medium">Contact</span>
              )}
            </nav>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/")}
                className="h-8 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors inline-flex items-center gap-1.5"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            </div>
          </div>
          {/* Row 2: anchor nav */}
          <div className="flex items-center gap-0.5 -mb-px">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={[
                  "relative px-3 py-3 text-sm transition-colors",
                  activeSection === item.id
                    ? "text-foreground font-medium after:absolute after:left-3 after:right-3 after:bottom-[-1px] after:h-0.5 after:bg-primary after:rounded-full"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {item.label}
                {item.badge && (
                  <span
                    className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${item.badgeClass}`}
                  >
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <div className="max-w-[1240px] mx-auto px-8 py-8 space-y-8">
        {/* Loading / Error */}
        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading contact details…
          </p>
        )}
        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && contact && (
          <>
            {/* ── Hero ── */}
            <section className="flex items-start gap-5">
              <div
                className="h-16 w-16 shrink-0 rounded-full flex items-center justify-center text-xl font-bold shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(142 35% 40%), hsl(142 45% 28%))",
                  color: "white",
                  fontFamily: "Sora, sans-serif",
                }}
              >
                {getInitials(contact.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1
                    className="text-[26px] font-semibold text-foreground"
                    style={{
                      fontFamily: "Sora, sans-serif",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {contact.fullName}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${contact.type === "CLIENT" ? "bg-secondary text-primary" : "bg-amber-100 text-amber-700"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${contact.type === "CLIENT" ? "bg-primary" : "bg-amber-500"}`}
                    ></span>
                    {contact.type === "CLIENT" ? "Client" : "Lead"}
                  </span>
                  <button
                    onClick={handleStarToggle}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${contact.isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                    />
                    <span
                      className={
                        contact.isStarred
                          ? "text-amber-700"
                          : "text-muted-foreground"
                      }
                    >
                      {contact.isStarred ? "Starred" : "Star"}
                    </span>
                  </button>
                </div>
                <div className="mt-1.5 flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {contact.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {contact.phone}
                    </span>
                  )}
                  {contact.source && (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {contact.source}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={editMode ? () => setEditMode(false) : enterEdit}
                  className="h-9 px-3 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="h-9 w-9 rounded-md border border-destructive/30 bg-card hover:bg-destructive/10 transition-colors inline-flex items-center justify-center text-destructive"
                  title="Delete contact"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 1 — CONTACT DETAILS
                ════════════════════════════════════════════ */}
            <section ref={detailsRef} id="details" className="scroll-mt-28">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ fontFamily: "Sora, sans-serif" }}
                  >
                    Contact Details
                  </h2>
                </div>
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Updated{" "}
                  {formatUpdatedAt(contact.updatedAt)}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                {!editMode ? (
                  /* VIEW MODE */
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                      {/* Left column */}
                      <div className="divide-y divide-border">
                        {[
                          { label: "Full name", value: contact.fullName },
                          {
                            label: "Email",
                            value: contact.email ? (
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-primary hover:underline underline-offset-4"
                              >
                                {contact.email}
                              </a>
                            ) : (
                              "—"
                            ),
                          },
                          {
                            label: "Phone",
                            value: contact.phone ? (
                              <span className="font-mono">{contact.phone}</span>
                            ) : (
                              "—"
                            ),
                          },
                          {
                            label: "Birthday",
                            value: formatDate(contact.birthday),
                          },
                        ].map((row) => (
                          <div
                            key={row.label}
                            className="group h-14 px-6 grid grid-cols-[140px_1fr] items-center gap-4"
                          >
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {row.label}
                            </span>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-foreground">
                                {row.value}
                              </span>
                              <Pencil
                                className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={enterEdit}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Right column */}
                      <div className="divide-y divide-border">
                        {[
                          {
                            label: "Type",
                            value: (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${contact.type === "CLIENT" ? "bg-secondary text-primary" : "bg-amber-100 text-amber-700"}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${contact.type === "CLIENT" ? "bg-primary" : "bg-amber-500"}`}
                                ></span>
                                {contact.type === "CLIENT" ? "Client" : "Lead"}
                              </span>
                            ),
                          },
                          {
                            label: "Tags",
                            value:
                              contact.tags.length > 0 ? (
                                <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                  {contact.tags.map((tag) => (
                                    <span
                                      key={tag.id}
                                      className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-primary"
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                "No tags"
                              ),
                          },
                          {
                            label: "Acq. source",
                            value: contact.source || "—",
                          },
                          {
                            label: "Pipeline stage",
                            value: contact.stageName || "—",
                          },
                        ].map((row) => (
                          <div
                            key={row.label}
                            className="group h-14 px-6 grid grid-cols-[140px_1fr] items-center gap-4"
                          >
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {row.label}
                            </span>
                            <div className="flex items-center justify-between gap-3 min-w-0">
                              <span className="text-sm text-foreground leading-relaxed truncate">
                                {row.value}
                              </span>
                              <Pencil
                                className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                onClick={enterEdit}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Life priorities — full-width bottom row */}
                    <div className="group border-t border-border px-6 py-3.5 grid grid-cols-[140px_1fr] items-start gap-4">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-0.5">
                        Life priorities
                      </span>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm text-foreground leading-relaxed">
                          {contact.priorities || "—"}
                        </span>
                        <Pencil
                          className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0 mt-0.5"
                          onClick={enterEdit}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSave();
                    }}
                    className="p-6 space-y-5"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {(
                        [
                          { label: "Full name", key: "fullName", type: "text" },
                          { label: "Email", key: "email", type: "email" },
                          { label: "Phone", key: "phone", type: "tel" },
                          { label: "Birthday", key: "birthday", type: "date" },
                          {
                            label: "Acquisition source",
                            key: "source",
                            type: "text",
                          },
                        ] as {
                          label: string;
                          key: keyof EditFormState;
                          type: string;
                        }[]
                      ).map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {field.label}
                          </label>
                          <input
                            type={field.type}
                            value={String(editForm[field.key])}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                [field.key]: e.target.value,
                              }))
                            }
                            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      ))}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Type
                        </label>
                        <select
                          value={editForm.type}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              type: e.target.value as "LEAD" | "CLIENT",
                            }))
                          }
                          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="CLIENT">Client</option>
                          <option value="LEAD">Lead</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Life priorities
                        </label>
                        <textarea
                          rows={3}
                          value={editForm.priorities}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              priorities: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.isStarred}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            isStarred: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded accent-primary"
                      />
                      Mark as starred / focus contact
                    </label>
                    {saveError && (
                      <p className="text-sm text-destructive">{saveError}</p>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setEditMode(false)}
                        className="h-9 px-3 rounded-md border border-border bg-card hover:bg-muted transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="h-9 px-3 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                        {isSaving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 2 — PORTFOLIO SUMMARY
                ════════════════════════════════════════════ */}
            <section ref={portfolioRef} id="portfolio" className="scroll-mt-28">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ fontFamily: "Sora, sans-serif" }}
                  >
                    Portfolio Summary
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Summary of {contact.fullName.split(" ")[0]}'s financial
                    portfolio and coverage
                  </p>
                </div>
              </div>

              {contact.portfolioSummary ? (
                <div className="rounded-xl border border-border bg-white shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Portfolio Summary
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">
                    {contact.portfolioSummary}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-white/50 p-10 text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No policies yet
                  </p>
                  <button
                    onClick={enterEdit}
                    className="mt-4 h-8 px-3 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    Add new policy
                  </button>
                </div>
              )}
            </section>

            {/* ════════════════════════════════════════════
                SECTION 3 — TASKS
                ════════════════════════════════════════════ */}
            <section ref={tasksRef} id="tasks" className="scroll-mt-28">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ fontFamily: "Sora, sans-serif" }}
                  >
                    Tasks
                  </h2>
                </div>
                <button
                  onClick={() => setShowAddTaskModal(true)}
                  className="h-9 px-3 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Add task
                </button>
              </div>

              {/* Summary strip */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[
                  {
                    label: "Overdue",
                    count: overdueTasks.length,
                    icon: AlertCircle,
                    iconClass: "bg-destructive/10 text-destructive",
                  },
                  {
                    label: "Due this week",
                    count: thisWeekTasks.length,
                    icon: Clock,
                    iconClass: "bg-amber-50 text-amber-700",
                  },
                  {
                    label: "Upcoming",
                    count: upcomingTasks.length,
                    icon: Calendar,
                    iconClass: "bg-secondary text-primary",
                  },
                  {
                    label: "Completed",
                    count: completedTasks.length,
                    icon: Check,
                    iconClass: "bg-muted text-muted-foreground",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-border bg-white px-4 py-3 shadow-sm flex items-center gap-3"
                  >
                    <div
                      className={`h-8 w-8 rounded-md flex items-center justify-center ${stat.iconClass}`}
                    >
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {stat.label}
                      </div>
                      <div
                        className="text-lg font-semibold"
                        style={{ fontFamily: "Sora, sans-serif" }}
                      >
                        {stat.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                {/* Tabs */}
                <div className="flex items-center gap-0.5 px-3 pt-3 border-b border-border">
                  {(
                    [
                      {
                        key: "open",
                        label: "Open",
                        count: openTasks.length,
                        countClass: "bg-amber-100 text-amber-700",
                      },
                      {
                        key: "completed",
                        label: "Completed",
                        count: completedTasks.length,
                        countClass: "bg-muted text-muted-foreground",
                      },
                    ] as {
                      key: typeof taskTab;
                      label: string;
                      count: number;
                      countClass: string;
                    }[]
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setTaskTab(tab.key)}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${taskTab === tab.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span
                          className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${tab.countClass}`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Task list */}
                {(() => {
                  const displayTasks =
                    taskTab === "open" ? openTasks : completedTasks;
                  if (displayTasks.length === 0) {
                    return (
                      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                        No {taskTab} tasks for this contact.
                      </div>
                    );
                  }
                  return (
                    <ul className="divide-y divide-border">
                      {displayTasks.map((task) => {
                        const due = getTaskDueInfo(task.dueAt);
                        const description = sanitizeTaskDescription(
                          task.description,
                        );
                        const hasDescription = description.length > 0;
                        return (
                          <li
                            key={task.id}
                            className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors group"
                          >
                            <button
                              type="button"
                              onClick={() => void handleTaskStatusToggle(task)}
                              disabled={taskBusyIds.includes(task.id)}
                              className={`mt-0.5 h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors disabled:opacity-50 ${task.status === "DONE" ? "border-primary bg-primary" : "border-border hover:border-primary"}`}
                              aria-label={
                                task.status === "DONE"
                                  ? `Mark task ${task.title} as open`
                                  : `Mark task ${task.title} as done`
                              }
                            >
                              {task.status === "DONE" && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-sm font-medium ${task.status === "DONE" ? "line-through text-muted-foreground" : "text-foreground"}`}
                                >
                                  {task.title}
                                </span>
                                {due.isOverdue && task.status === "OPEN" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                                    <span className="h-1.5 w-1.5 rounded-full bg-destructive"></span>{" "}
                                    Overdue
                                  </span>
                                )}
                                {due.isToday && task.status === "OPEN" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                    Today
                                  </span>
                                )}
                                {due.isThisWeek &&
                                  !due.isToday &&
                                  task.status === "OPEN" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-primary">
                                      In {due.diffDays}d
                                    </span>
                                  )}
                                {task.stageName && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-medium">
                                    {task.stageName}
                                  </span>
                                )}
                              </div>
                              {hasDescription && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {description}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 w-20 self-center text-center">
                              <div className="text-sm text-foreground tabular-nums">
                                {due.dateStr}
                              </div>
                            </div>
                            <div className="flex items-center justify-center gap-1 shrink-0 w-16 self-center">
                              <button
                                className="h-7 w-7 rounded border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 inline-flex items-center justify-center"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleTaskDelete(task.id)}
                                disabled={taskBusyIds.includes(task.id)}
                                className="h-7 w-7 rounded border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive inline-flex items-center justify-center disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            </section>

            {/* ════════════════════════════════════════════
                SECTION 4 — INTERACTION HISTORY
                ════════════════════════════════════════════ */}
            <section
              ref={historyRef}
              id="history"
              className="scroll-mt-28 pb-16"
            >
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ fontFamily: "Sora, sans-serif" }}
                  >
                    Interaction History
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Every interaction you've had with{" "}
                    {contact.fullName.split(" ")[0]}
                  </p>
                </div>
                <button
                  onClick={() => navigate("/interaction-history")}
                  className="h-9 px-3 rounded-md border border-border bg-card hover:bg-muted transition-colors text-sm font-medium inline-flex items-center gap-1.5"
                >
                  <MessageSquarePlus className="h-4 w-4" /> Log interaction
                </button>
              </div>

              <div className="rounded-xl border border-border bg-white shadow-sm">
                {/* Filter bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-wrap">
                  <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                    {[
                      { key: "all", label: "All" },
                      { key: "call", label: "Calls" },
                      { key: "meeting", label: "Meetings" },
                      { key: "whatsapp", label: "WhatsApp/DM" },
                      { key: "note", label: "Notes" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setHistoryFilter(f.key)}
                        className={`h-7 px-2.5 rounded text-xs font-medium transition-colors ${historyFilter === f.key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1" />
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Search in notes…"
                      className="h-8 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                {/* Timeline */}
                <div
                  className="px-6 py-5"
                  style={{ maxHeight: "640px", overflowY: "auto" }}
                >
                  {groupedInteractions.length === 0 ? (
                    <div className="py-12 text-center">
                      <MessageCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {historySearch || historyFilter !== "all"
                          ? "No interactions match your filter."
                          : "No interactions recorded yet."}
                      </p>
                    </div>
                  ) : (
                    groupedInteractions.map((group) => (
                      <div key={group.month} className="mb-4">
                        {/* Month header */}
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-6 px-6 py-1.5 mb-1 flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.month}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>

                        <ol className="ml-2 pl-6 space-y-5 py-3 border-l border-dashed border-border">
                          {group.items.map((interaction) => {
                            const meta = getInteractionMeta(interaction.type);
                            const Icon = meta.icon;
                            return (
                              <li key={interaction.id} className="relative">
                                {/* Dot */}
                                <span
                                  className="absolute -left-[30px] top-2 h-[14px] w-[14px] rounded-full flex items-center justify-center ring-[3px] ring-white"
                                  style={{ background: meta.dotColor }}
                                >
                                  <Icon className="h-2 w-2 text-white" />
                                </span>
                                <div className="rounded-lg border border-border bg-white p-4 hover:shadow-sm transition-shadow">
                                  <div className="flex items-center gap-2 flex-wrap mb-2">
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                                    >
                                      {interaction.type}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatInteractionDate(
                                        interaction.occurredAt,
                                      )}
                                    </span>
                                  </div>
                                  {interaction.notes ? (
                                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                                      {interaction.notes}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                      No notes recorded.
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))
                  )}

                  {/* Timeline end marker */}
                  {filteredInteractions.length > 0 && (
                    <div className="ml-2 pl-6 pt-2 text-xs text-muted-foreground font-mono inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-border" />
                      {filteredInteractions.length} interaction
                      {filteredInteractions.length !== 1 ? "s" : ""} total
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white shadow-xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3
                    className="text-lg font-semibold"
                    style={{ fontFamily: "Sora, sans-serif" }}
                  >
                    Delete {contact?.fullName}?
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    This removes the contact along with all linked tasks and
                    interaction logs. <strong>This cannot be undone.</strong>
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                      className="h-4 w-4 rounded accent-destructive"
                    />
                    I understand this is permanent
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-muted/40 border-t border-border">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmed(false);
                }}
                className="h-9 px-3 rounded-md border border-border bg-white hover:bg-muted transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!deleteConfirmed || isDeleting}
                className="h-9 px-3 rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting…" : "Delete contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onSuccess={() => {
          setShowAddTaskModal(false);
          setTaskRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

export default ContactDetailsPage;
