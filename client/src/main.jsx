import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { calculatePayrollDays } from "./payroll-days.mjs";
import { API_BASE_URL } from "./config.js";

const ADMIN_NAV = [
  ["Overview", "◫"],
  ["Employees", "♙"],
  ["Work updates", "≋"],
  ["Bank reviews", "▣"],
  ["Attendance", "◷"],
  ["Requests", "⇧"],
  ["Leave rules", "▤"],
  ["Company updates", "▰"],
  ["Tasks", "✓"],
  ["Calendar", "▦"],
  ["Payroll", "₹"],
  ["Reports", "▥"],
  ["Documents", "▧"],
  ["Audit log", "≡"],
];
const EMP_NAV = [
  ["Overview", "◫"],
  ["My tasks", "✓"],
  ["My daily updates", "≋"],
  ["Company updates", "▰"],
  ["Calendar", "▦"],
  ["My attendance", "◷"],
  ["My leave & requests", "⇧"],
  ["My profile", "♙"],
  ["My payslips", "₹"],
  ["Documents & policies", "▧"],
];
const ROLE_NAV = {
  hr_manager: [
    ["Overview", "◫"],
    ["Employees", "♙"],
    ["Work updates", "≋"],
    ["Attendance", "◷"],
    ["Requests", "⇧"],
    ["Leave rules", "▤"],
    ["Company updates", "▰"],
    ["Tasks", "✓"],
    ["Calendar", "▦"],
    ["Documents", "▧"],
    ["Payroll", "₹"],
    ["Reports", "▥"],
  ],
  payroll_manager: [
    ["Overview", "◫"],
    ["Bank reviews", "▣"],
    ["Payroll", "₹"],
    ["Reports", "▥"],
  ],
  manager: [
    ["Overview", "◫"],
    ["Work updates", "≋"],
    ["Attendance", "◷"],
    ["Requests", "⇧"],
    ["Tasks", "✓"],
    ["Reports", "▥"],
  ],
};
function groupedNavigation(navigation, role) {
  const sections = role === "employee" ? [
    ["Home", ["Overview"]],
    ["My work", ["My tasks", "My daily updates", "Company updates", "Calendar"]],
    ["My time", ["My attendance", "My leave & requests"]],
    ["My details", ["My profile", "My payslips", "Documents & policies"]],
  ] : [
    ["Home", ["Overview"]],
    ["People", ["Employees", "Work updates", "Attendance", "Requests", "Leave rules"]],
    ["Work", ["Company updates", "Tasks", "Calendar"]],
    ["Payroll & reports", ["Payroll", "Bank reviews", "Reports"]],
    ["Library & audit", ["Documents", "Audit log"]],
  ];
  return sections.map(([title, labels]) => [title, navigation.filter(([label]) => labels.includes(label))]).filter(([, items]) => items.length);
}

let csrf = "";
async function api(url, options = {}) {
  const fullUrl = url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (options.method && options.method !== "GET" && csrf)
    headers["X-CSRF-Token"] = csrf;
  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include",
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Unexpected response" }));
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  if (data.csrf) csrf = data.csrf;
  return data;
}
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const showTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    })
    : "—";
const cash = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
function elapsed(record) {
  if (!record) return "00:00:00";
  let milliseconds = 0;
  for (const segment of JSON.parse(record.segments || "[]")) {
    const a = Date.parse(segment.start),
      b = segment.end ? Date.parse(segment.end) : Date.now();
    let part = Math.max(0, b - a);
    for (
      let day = Math.floor(a / 86400000) * 86400000;
      day <= b;
      day += 86400000
    )
      for (const [from, to] of [
        [450, 495],
        [600, 615],
      ])
        part -= Math.max(
          0,
          Math.min(b, day + to * 60000) - Math.max(a, day + from * 60000),
        );
    milliseconds += Math.max(0, part);
  }
  const sec = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}
function Button({ children, primary = false, ...props }) {
  return (
    <button className={`button${primary ? " primary" : ""}`} {...props}>
      {children}
    </button>
  );
}
function Pill({ children, tone = "" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
function Field({
  name,
  label,
  type = "text",
  required = true,
  defaultValue,
  min,
  step,
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={type === "number" ? min : undefined}
        minLength={type === "password" ? min : undefined}
        step={step}
      />
    </div>
  );
}
function SelectField({ name, label, options, required = true, defaultValue }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
      >
        {options.map(([value, text]) => (
          <option value={value} key={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
function Header({ tag, title, description, children }) {
  return (
    <div className="welcome">
      <div>
        <div className="eyebrow">{tag}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Panel({ title, children, aside }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
function DataTable({ columns, children, empty = "No records yet." }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children || (
            <tr>
              <td colSpan={columns.length} className="muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function Stat({ label, value, detail, icon }) {
  return (
    <article className="card stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="sub">{detail}</div>
    </article>
  );
}
function Empty({ children = "No records yet." }) {
  return <div className="empty">{children}</div>;
}

function AuthScreen({ setup, onSuccess }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget),
      body = Object.fromEntries(form);
    try {
      const result = await api(setup ? "/api/setup" : "/api/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onSuccess(result);
    } catch (ex) {
      setError(ex.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="eyebrow">MACROW DIGITAL · INTERNAL HRMS</div>
        <h1>People operations in one place.</h1>
        <p>
          A private workspace for attendance, leave, team updates, and payroll
          records.
        </p>
      </section>
      <section className="login-box">
        <form className="login-card" onSubmit={submit}>
          <div className="eyebrow">MACROW PEOPLE</div>
          <h2>{setup ? "Create administrator" : "Welcome back"}</h2>
          <p className="help">
            {setup
              ? "Use the one-time setup token printed in the server terminal."
              : "Sign in with your invited work account."}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {setup && (
            <>
              <Field name="token" label="Setup token" />
              <Field name="name" label="Your name" />
            </>
          )}
          <Field name="email" label="Work email" type="email" />
          <Field
            name="password"
            label="Password (12+ characters)"
            type="password"
            min="12"
          />
          <Button primary disabled={busy}>
            {busy ? "Please wait…" : setup ? "Create admin account" : "Sign in"}
          </Button>
        </form>
      </section>
    </div>
  );
}

function InviteApp() {
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    const f = event.currentTarget,
      d = Object.fromEntries(new FormData(f));
    if (d.password !== d.confirm) {
      setError("Passwords do not match.");
      return;
    }
    delete d.confirm;
    d.token = location.hash.slice(1);
    setBusy(true);
    try {
      const res = await api("/api/accept-invite", {
        method: "POST",
        body: JSON.stringify(d),
      });
      setDone(true);
      setTimeout(() => {
        location.href = "/";
      }, 600);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-brand">
        <h1>Macrow People</h1>
        <p>Set a private employee password to activate your account.</p>
      </section>
      <section className="login-box">
        <form className="login-card" onSubmit={submit}>
          <h2>{done ? "Invitation accepted" : "Accept invitation"}</h2>
          {done ? (
            <p>Your account is active. Redirecting to your workspace…</p>
          ) : (
            <>
              {error && <div className="error">{error}</div>}
              <Field
                name="password"
                label="Password (12+ characters)"
                type="password"
                min="12"
              />
              <Field
                name="confirm"
                label="Confirm password"
                type="password"
                min="12"
              />
              <Button primary disabled={busy}>
                {busy ? "Activating…" : "Activate account"}
              </Button>
            </>
          )}
        </form>
      </section>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState({ loading: true, setup: false, user: null });
  const [page, setPage] = useState("Overview");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const invitation = location.pathname.endsWith("accept-invite.html");
  useEffect(() => {
    if (invitation) return;
    (async () => {
      try {
        const status = await api("/api/setup-status");
        if (status.needed) {
          setAuth({ loading: false, setup: true, user: null });
          return;
        }
        const session = await api("/api/me");
        csrf = session.csrf || "";
        setAuth({ loading: false, setup: false, user: session.user });
      } catch (e) {
        setAuth({ loading: false, setup: false, user: null });
        setNotice(e.message);
      }
    })();
  }, [invitation]);
  const onAuth = (result) => {
    csrf = result.csrf || "";
    setAuth({ loading: false, setup: false, user: result.user });
    setPage("Overview");
  };
  const toast = useCallback((message) => {
    setNotice(message);
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => setNotice(""), 3600);
  }, []);
  if (invitation) return <InviteApp />;
  if (auth.loading)
    return <main className="loading">Loading Macrow People…</main>;
  if (!auth.user)
    return (
      <>
        <AuthScreen setup={auth.setup} onSuccess={onAuth} />
        {notice && (
          <div className="notice show" role="status">
            <div className="notice-card">
              <span className="notice-mark" aria-hidden="true">✳</span>
              <div><b>Macrow People</b><p>{notice}</p></div>
              <button className="toast-close" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button>
            </div>
          </div>
        )}
      </>
    );
  return (
    <Workspace
      user={auth.user}
      page={page}
      setPage={setPage}
      onLogout={async () => {
        try {
          await api("/api/logout", { method: "POST", body: "{}" });
        } finally {
          csrf = "";
          setAuth({ loading: false, setup: false, user: null });
        }
      }}
      toast={toast}
      modal={modal}
      setModal={setModal}
      refresh={refresh}
      refreshPage={() => setRefresh((x) => x + 1)}
      notice={notice}
      dismiss={() => setNotice("")}
    />
  );
}

function Workspace({
  user,
  page,
  setPage,
  onLogout,
  toast,
  modal,
  setModal,
  refresh,
  refreshPage,
  notice,
  dismiss,
}) {
  const navigation =
    ROLE_NAV[user.role] || (user.role === "admin" ? ADMIN_NAV : EMP_NAV);
  const navGroups = groupedNavigation(navigation, user.role === "employee" ? "employee" : "admin");
  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <img src="/assets/macrow-digital-logo.png" alt="Macrow Digital" />
          </div>
          <div className="brand-sub">People · {user.role}</div>
          <nav className="nav" aria-label="Main navigation">
            {navGroups.map(([section, items]) => (
              <div className="nav-section" key={section}>
                <div className="nav-label">{section}</div>
                {items.map(([label, icon]) => (
                  <button
                    key={label}
                    className={page === label ? "active" : ""}
                    aria-current={page === label ? "page" : undefined}
                    onClick={() => setPage(label)}
                  >
                    <span className="ico" aria-hidden="true">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="side-bottom">
            <b>{user.name}</b>
            {user.email}
            <p>
              <Button onClick={onLogout}>Sign out</Button>
            </p>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div className="crumb">
              Macrow Digital / <b>{page}</b>
            </div>
            <div className="top-actions">
              <label className="jump-to">
                <span className="sr-only">Go to section</span>
                <select defaultValue="" aria-label="Go to section" onChange={(e) => { if (e.target.value) setPage(e.target.value); e.target.value = ""; }}>
                  <option value="" disabled>Go to section…</option>
                  {navigation.map(([label]) => <option value={label} key={label}>{label}</option>)}
                </select>
              </label>
              <Pill tone={user.role === "admin" ? "blue" : "green"}>
                {user.role.replaceAll("_", " ")} workspace
              </Pill>
            </div>
          </header>
          <div className="content">
            <PageContent
              key={`${user.role}:${page}`}
              user={user}
              page={page}
              setPage={setPage}
              toast={toast}
              setModal={setModal}
              refresh={refresh}
              refreshPage={refreshPage}
            />
          </div>
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <h2 id="modal-title">{modal.title}</h2>
            <p>{modal.description}</p>
            <form onSubmit={modal.submit}>
              {modal.type === "confirm" || modal.type === "details" ? null : <div className="field">
                <label htmlFor="reason">{modal.fieldLabel || "Reason"}</label>
                <textarea id="reason" name="reason" required />
              </div>}
              {modal.error && <div className="error">{modal.error}</div>}
              <div className="modal-actions">
                <Button type="button" onClick={() => setModal(null)} disabled={modal.busy}>
                  Cancel
                </Button>
                {modal.type !== "details" && <Button primary type="submit" disabled={modal.busy}>
                  {modal.busy ? "Please wait…" : modal.confirmLabel || "Confirm clock out"}
                </Button>}
              </div>
            </form>
          </section>
        </div>
      )}
      {notice && (
        <div className="notice show" role="status" aria-live="polite">
          <div className="notice-card">
            <span className="notice-mark" aria-hidden="true">✳</span>
            <div><b>Macrow People</b><p>{notice}</p></div>
            <button className="toast-close" aria-label="Dismiss notification" onClick={dismiss}>×</button>
          </div>
        </div>
      )}
    </>
  );
}

async function loadPage(user, page) {
  const role = user.role;
  if (page === "Overview")
    return Promise.all([
      api("/api/dashboard"),
      api("/api/hrm/notifications"),
    ]).then(([dashboard, notifications]) => ({
      ...dashboard,
      notifications: notifications.notifications,
    }));
  switch (page) {
    case "Employees":
      return Promise.all([
        api("/api/hrm/employees"),
        ["admin", "hr_manager"].includes(role)
          ? api("/api/hrm/invitations")
          : Promise.resolve({ invitations: [] }),
      ]).then(([employees, invitations]) => ({ ...employees, invitations: invitations.invitations }));
    case "Work updates":
      return Promise.all([api("/api/hrm/employees"), api("/api/hrm/daily-updates")]).then(([employees, updates]) => ({ ...employees, ...updates }));
    case "Bank reviews":
      return api("/api/hrm/bank/pending");
    case "My daily updates":
      return Promise.all([api("/api/hrm/daily-updates"), api("/api/hrm/tasks")]).then(([updates, tasks]) => ({ ...updates, tasks: tasks.tasks }));
    case "Attendance":
      return role === "admin"
        ? api("/api/attendance")
        : api("/api/hrm/attendance");
    case "My attendance":
      return api("/api/attendance");
    case "Requests":
    case "My leave & requests":
      return Promise.all([
        api("/api/requests"),
        api("/api/hrm/leave-types"),
      ]).then(([requests, categories]) => ({
        requests: requests.requests,
        rules: categories.categories,
      }));
    case "Leave rules":
      return api("/api/hrm/leave-types");
    case "Company updates":
      return Promise.all([
        api("/api/updates"),
        ["admin", "hr_manager"].includes(role)
          ? api("/api/hrm/employees")
          : Promise.resolve({ employees: [] }),
      ]).then(([updates, employees]) => ({
        updates: updates.updates,
        employees: employees.employees,
      }));
    case "Tasks":
    case "My tasks":
      return Promise.all([
        api("/api/hrm/tasks"),
        ["admin", "hr_manager", "manager"].includes(role)
          ? api("/api/hrm/employees")
          : Promise.resolve({ employees: [] }),
      ]).then(([tasks, employees]) => ({
        tasks: tasks.tasks,
        employees: employees.employees,
      }));
    case "Calendar":
      return api("/api/calendar");
    case "Payroll":
    case "My payslips":
      return Promise.all([
        api("/api/hrm/payroll"),
        ["admin", "payroll_manager"].includes(role)
          ? api("/api/hrm/employees")
          : Promise.resolve({ employees: [] }),
      ]).then(([periods, employees]) => ({
        periods: periods.periods,
        employees: employees.employees,
      }));
    case "Reports":
      return api("/api/hrm/reports");
    case "Documents":
    case "Documents & policies":
      return api("/api/documents");
    case "Audit log":
      return api("/api/audit");
    case "My profile":
      return Promise.all([api(`/api/hrm/employees/${encodeURIComponent(user.id)}/profile`), api("/api/hrm/bank")]).then(
        ([profile, bank]) => ({ profile: profile.employee, ...profile, bank: bank.bank }),
      );
    default:
      if (page.startsWith("Employee profile · ")) {
        const id = page.slice("Employee profile · ".length);
        const bankCalls=["admin","payroll_manager"].includes(role)?Promise.all([api(`/api/hrm/bank?user_id=${encodeURIComponent(id)}`),api(`/api/hrm/bank/history?user_id=${encodeURIComponent(id)}`)]):Promise.resolve([{bank:null},{history:[]}]);
        return Promise.all([api(`/api/hrm/employees/${encodeURIComponent(id)}/profile`), bankCalls])
          .then(([profile, [bank, bankHistory]]) => ({ ...profile, bank: bank.bank, bankHistory:bankHistory.history }));
      }
      return {};
  }
}

function PageContent({ user, page, setPage, toast, setModal, refresh, refreshPage }) {
  const [data, setData] = useState(null),
    [loadError, setLoadError] = useState(""),
    [formError, setFormError] = useState(""),
    [result, setResult] = useState(""),
    [rules, setRules] = useState([]),
    [month, setMonth] = useState(new Date()),
    [selectedDate, setSelectedDate] = useState(today()),
    [tick, setTick] = useState(Date.now()),
    [payrollDetail, setPayrollDetail] = useState(null),
    [busyForm, setBusyForm] = useState(""),
    [employeeQuery, setEmployeeQuery] = useState(""),
    [employeeStatus, setEmployeeStatus] = useState("All statuses"),
    [directoryDepartment, setDirectoryDepartment] = useState("All departments"),
    [directoryTitle, setDirectoryTitle] = useState("All designations"),
    [directoryManager, setDirectoryManager] = useState("All managers"),
    [directoryAccess, setDirectoryAccess] = useState("All access"),
    [directorySort, setDirectorySort] = useState("name"),
    [directoryPage, setDirectoryPage] = useState(1),
    [editingUpdate, setEditingUpdate] = useState(null),
    [revealedBank, setRevealedBank] = useState(null),
    [updateFilters, setUpdateFilters] = useState({ user_id: "", from: "", to: "", status: "" }),
    [employeeUpdateFilters, setEmployeeUpdateFilters] = useState({ from: "", to: "", status: "", project: "" }),
    [timelineMode, setTimelineMode] = useState("custom"),
    [payrollTab, setPayrollTab] = useState("builder");
  const reload = useCallback(async () => {
    setLoadError("");
    try {
      const value = await loadPage(user, page);
      setData(value);
      if (page === "Leave rules")
        setRules(
          value.categories.length
            ? value.categories
            : [
              {
                name: "Annual leave",
                category: "Paid",
                entitlement_days: 12,
                allow_half_day: 1,
                excess_to_unpaid: 1,
                notes: "",
              },
              {
                name: "Unpaid leave",
                category: "Unpaid",
                entitlement_days: 0,
                allow_half_day: 1,
                excess_to_unpaid: 1,
                notes: "",
              },
            ],
        );
    } catch (e) {
      setLoadError(e.message);
    }
  }, [user.role, user.id, page]);
  useEffect(() => {
    reload();
  }, [reload, refresh]);
  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  async function saveForm(event) {
    event.preventDefault();
    const form = event.currentTarget,
      name = form.dataset.form,
      d = Object.fromEntries(new FormData(form));
    setFormError("");
    setResult("");
    setBusyForm(name);
    let successMessage = "";
    try {
      switch (name) {
        case "invite": {
          const r = await api("/api/employees/invite", {
            method: "POST",
            body: JSON.stringify(d),
          });
          setResult({
            url: r.activationUrl || "",
            expiresInDays: r.expiresInDays,
            accepted: !!r.emailDelivery?.accepted,
            mode: r.emailDelivery?.mode,
            error: r.emailDelivery?.error,
          });
          form.reset();
          successMessage = r.emailDelivery?.accepted
            ? "Invitation email accepted for sending."
            : r.emailDelivery?.mode === "demo"
              ? "Email is not configured. Copy the trial activation link; no email was sent."
              : "Unable to send the email. Please try again.";
          toast(successMessage);
          await reload();
          return;
        }
        case "updates":
          d.pinned = form.elements.pinned.checked;
          await api("/api/updates", {
            method: "POST",
            body: JSON.stringify(d),
          });
          break;
        case "task":
          d.subtasks = String(d.subtasks || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          await api("/api/hrm/tasks", {
            method: "POST",
            body: JSON.stringify({ ...d, priority: d.priority || "Medium" }),
          });
          break;
        case "payroll-generate":
          await api("/api/hrm/payroll/generate", {
            method: "POST",
            body: JSON.stringify(d),
          });
          break;
        case "salary": {
          const list = (v) =>
            String(v || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
              .map((x) => {
                const [name, amount] = x.split(":");
                return { name: name.trim(), amount: (amount || "0").trim() };
              });
          await api("/api/hrm/salary", {
            method: "POST",
            body: JSON.stringify({
              ...d,
              allowances: list(d.allowances),
              earnings: list(d.earnings),
              deductions: list(d.deductions),
              weekly_offs: [Number(d.weekly_off)],
            }),
          });
          break;
        }
        case "leave-types": {
          const categories = rules.map((r, i) => ({
            ...r,
            name: d[`name-${i}`],
            category: d[`category-${i}`],
            entitlement_days: Number(d[`annual-${i}`] || 0),
            allow_half_day: !!d[`half-${i}`],
            exclude_non_working_days: true,
            excess_to_unpaid: !!d[`excess-${i}`],
          }));
          await api("/api/hrm/leave-types", {
            method: "PUT",
            body: JSON.stringify({ categories }),
          });
          break;
        }
        case "rules": {
          const updated = rules.map((_, i) => ({
            name: d[`name-${i}`],
            annual_days: d[`annual-${i}`],
            sick_days: d[`sick-${i}`],
            notes: d[`notes-${i}`],
          }));
          await api("/api/leave-rules", {
            method: "PUT",
            body: JSON.stringify({ rules: updated }),
          });
          break;
        }
        case "event":
          await api("/api/calendar", {
            method: "POST",
            body: JSON.stringify(d),
          });
          break;
        case "request":
          if (d.kind === "Leave") d.details = `${d.leave_type}: ${d.details}`;
          await api("/api/requests", {
            method: "POST",
            body: JSON.stringify(d),
          });
          break;
        case "clockout":
          await api("/api/attendance/action", {
            method: "POST",
            body: JSON.stringify({ action: "out", reason: d.reason }),
          });
          setModal(null);
          break;
        case "profile":
          await api(`/api/hrm/employees/${encodeURIComponent(user.id)}/profile`, {
            method: "PUT",
            body: JSON.stringify(d),
          });
          break;
        case "bank":
          await api("/api/hrm/bank", {
            method: "PUT",
            body: JSON.stringify(d),
          });
          break;
        case "daily-update": {
          if (d.id) await api(`/api/hrm/daily-updates/${encodeURIComponent(d.id)}`, { method: "PUT", body: JSON.stringify(d) });
          else await api("/api/hrm/daily-updates", { method: "POST", body: JSON.stringify(d) });
          setEditingUpdate(null);
          form.reset();
          break;
        }
        case "payroll":
          await api("/api/payroll", {
            method: "POST",
            body: JSON.stringify(d),
          });
          break;
        case "document": {
          const file = form.elements.file?.files?.[0];
          if (!file) throw new Error("Choose a PDF or DOCX file to upload.");
          if (file.size > 10 * 1024 * 1024) throw new Error("The file must be 10 MB or smaller.");
          const ext = file.name.toLowerCase().split(".").pop();
          const mime = ext === "pdf" ? "application/pdf" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "";
          if (!mime) throw new Error("Only PDF and DOCX files are supported.");
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
            reader.onerror = () => reject(new Error("Could not read the selected file."));
            reader.readAsDataURL(file);
          });
          delete d.file;
          const publishNow = d.publish_now === "yes";
          delete d.publish_now;
          const created = await api("/api/documents", {
            method: "POST",
            body: JSON.stringify({ ...d, filename: file.name, mime_type: mime, content_base64: dataUrl }),
          });
          if (publishNow) {
            await api(`/api/documents/${created.id}/publish`, { method: "PATCH", body: "{}" });
            successMessage = `Published ${d.title} · version ${created.version}.`;
          } else {
            successMessage = `Uploaded ${d.title} as draft · version ${created.version}.`;
          }
          break;
        }
      }
      toast(successMessage || "Saved successfully.");
      form.reset();
      await reload();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusyForm("");
    }
  }
  async function action(doThing, extra = {}) {
    try {
      switch (doThing) {
        case "clock": {
          const res = await api("/api/attendance");
          const rec = (res.attendance || []).find(
            (x) => x.work_date === today(),
          );
          const act = !rec ? "in" : rec.status === "in" ? "out" : "resume";
          const clockTime = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(new Date());
          if (act === "out" && clockTime < "19:00") {
            setModal({
              title: "Reason for early clock out",
              description:
                "Your shift ends at 7:00 PM IST. Please add a reason for Admin.",
              error: "",
              submit: async (e) => {
                e.preventDefault();
                try {
                  const reason = new FormData(e.currentTarget).get("reason");
                  await api("/api/attendance/action", {
                    method: "POST",
                    body: JSON.stringify({ action: "out", reason }),
                  });
                  setModal(null);
                  toast("Clocked out.");
                  refreshPage();
                } catch (err) {
                  setModal((v) => ({ ...v, error: err.message }));
                }
              },
            });
            return;
          }
          await api("/api/attendance/action", {
            method: "POST",
            body: JSON.stringify({
              action: act,
              reason: "Scheduled end of shift",
            }),
          });
          toast(
            act === "in"
              ? "Clocked in · timer started."
              : act === "out"
                ? "Clocked out."
                : "Shift resumed.",
          );
          await reload();
          return;
        }
        case "decision": {
          let note = "";
          if (extra.status === "Rejected") {
            note = window.prompt("Reason for rejection?") || "";
            if (!note.trim()) return;
          }
          await api(`/api/requests/${extra.id}/decision`, {
            method: "POST",
            body: JSON.stringify({ status: extra.status, note }),
          });
          break;
        }
        case "pay":
          await api(`/api/payroll/${extra.id}/pay`, {
            method: "POST",
            body: "{}",
          });
          break;
        case "access":
          await api(`/api/employees/${extra.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ active: extra.active }),
          });
          break;
        case "resend-invite": {
          const response = await api(`/api/hrm/invitations/${extra.id}/resend`, { method: "POST", body: "{}" });
          setResult({ url: response.activationUrl || "", accepted: !!response.emailDelivery?.accepted, mode: response.emailDelivery?.mode, expiresInDays: response.expiresInDays });
          toast(response.emailDelivery?.accepted ? "Activation email accepted for sending." : response.emailDelivery?.mode === "demo" ? "Email is not configured. Copy the trial activation link; no email was sent." : "Unable to send the email. Please try again.");
          await reload();
          return;
        }
        case "task-status":
          await api(`/api/hrm/tasks/${extra.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: extra.status }),
          });
          break;
      }
      toast("Updated successfully.");
      await reload();
    } catch (e) {
      toast(e.message);
    }
  }
  if (!data && !loadError)
    return <div className="loading">Loading {page.toLowerCase()}…</div>;
  if (loadError)
    return (
      <section className="panel">
        <h2>Unable to load this page</h2>
        <p>{loadError}</p>
        <Button onClick={reload}>Retry</Button>
      </section>
    );
  const commonFormError = formError && (
    <div className="error" role="alert">
      {formError}
    </div>
  );
  const invitationRows = data.invitations || [];
  const employeesList = Array.isArray(data.employees) ? data.employees : [];
  const matchesEmployeeSearch = (item) => `${item.name} ${item.email} ${item.department} ${item.title}`.toLowerCase().includes(employeeQuery.trim().toLowerCase());
  const visibleEmployees = employeesList.filter(x=>matchesEmployeeSearch(x)&&(directoryDepartment==="All departments"||x.department===directoryDepartment)&&(directoryTitle==="All designations"||x.title===directoryTitle)&&(directoryManager==="All managers"||x.manager_id===directoryManager)&&(directoryAccess==="All access"||(directoryAccess==="Active"?x.active:!x.active))).sort((a,b)=>directorySort==="joining_date"?String(a.start_date||"").localeCompare(String(b.start_date||"")):directorySort==="activity"?String(b.last_activity||"").localeCompare(String(a.last_activity||"")):a.name.localeCompare(b.name));
  const employeePageSize=10, pagedEmployees=visibleEmployees.slice((directoryPage-1)*employeePageSize,directoryPage*employeePageSize);
  const visibleInvitations = invitationRows.filter((item) => matchesEmployeeSearch(item) && (employeeStatus === "All statuses" || item.status === employeeStatus));
  function confirmResend(item) {
    setModal({
      type: "confirm",
      title: "Resend activation email?",
      description: `Send a new one-time activation link to ${item.name} at ${item.email}? The previous link will stop working.`,
      confirmLabel: item.status === "Not Invited" ? "Create login" : "Resend invitation",
      busy: false,
      submit: async (event) => {
        event.preventDefault();
        setModal((current) => ({ ...current, busy: true }));
        try {
          const response = await api(`/api/hrm/invitations/${item.id}/resend`, { method: "POST", body: "{}" });
          setModal(null);
          setResult({ url: response.activationUrl || "", accepted: !!response.emailDelivery?.accepted, mode: response.emailDelivery?.mode, expiresInDays: response.expiresInDays });
          toast(response.emailDelivery?.accepted ? "Activation email accepted for sending." : response.emailDelivery?.mode === "demo" ? "Email is not configured. Copy the trial activation link; no email was sent." : "Unable to send the email. Please try again.");
          await reload();
        } catch (error) {
          setModal((current) => ({ ...current, busy: false, error: error.message }));
        }
      },
    });
  }
  function confirmDocumentAction(doc, operation) {
    const publishing = operation === "publish";
    setModal({
      type: "confirm",
      title: publishing ? "Publish this document?" : "Unpublish this document?",
      description: publishing
        ? `Version ${doc.version} of “${doc.title}” will become the current employee-facing copy. The previous published upload stays in version history.`
        : `Employees will no longer see “${doc.title}” until it is published again.`,
      confirmLabel: publishing ? "Publish document" : "Unpublish document",
      submit: async (event) => {
        event.preventDefault();
        setModal((current) => ({ ...current, busy: true }));
        try {
          await api(`/api/documents/${doc.id}/${operation}`, { method: "PATCH", body: "{}" });
          setModal(null);
          toast(publishing ? "Document published." : "Document unpublished.");
          await reload();
        } catch (error) {
          setModal((current) => ({ ...current, busy: false, error: error.message }));
        }
      },
    });
  }
  if (page === "Overview" && user.role === "admin")
    return (
      <>
        <Header
          tag="ADMIN WORKSPACE"
          title="Macrow Digital HRMS"
          description="Manage your team, approvals, and payroll."
        />
        <div className="cards">
          <Stat
            label="Employees"
            value={data.employees}
            detail="Active team members"
            icon="♙"
          />
          <Stat
            label="Clocked in today"
            value={data.clockedIn}
            detail="Current shift"
            icon="◷"
          />
          <Stat
            label="Pending approvals"
            value={data.pending}
            detail="Requests to review"
            icon="⇧"
          />
          <Stat
            label="Payroll drafts"
            value={data.payroll}
            detail="Awaiting review"
            icon="₹"
          />
        </div>
        <Panel title="Recent activity">
          <div className="event-list">
            {data.latest.map((x, i) => (
              <div className="event" key={i}>
                <div className="event-mark">≡</div>
                <div>
                  <b>{x.action}</b>
                  <small>
                    {x.name || "System"} · {showTime(x.created_at)} ·{" "}
                    {x.details}
                  </small>
                </div>
              </div>
            ))}
          </div>
          {!data.latest.length && <Empty>No activity recorded yet.</Empty>}
        </Panel>
      </>
    );
  if (page === "Overview")
    return (
      <EmployeeOverview
        user={user}
        data={data}
        onClock={() => action("clock")}
        tick={tick}
        toast={toast}
      />
    );
  if (page === "My daily updates") {
    const rows = (data.updates || []).filter(x=>(!employeeUpdateFilters.from||x.work_date>=employeeUpdateFilters.from)&&(!employeeUpdateFilters.to||x.work_date<=employeeUpdateFilters.to)&&(!employeeUpdateFilters.status||x.status===employeeUpdateFilters.status)&&(!employeeUpdateFilters.project||x.project===employeeUpdateFilters.project));
    const edit = (row) => { setEditingUpdate(row); document.getElementById("daily-update-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); };
    return <>
      <Header tag="MY WORK" title="My daily updates" description="Record what you worked on, progress, blockers, and what comes next." />
      <div className="cards">
        <Stat label="Updates submitted" value={rows.length} detail="Historical work log" icon="≋" />
        <Stat label="Tasks in progress" value={(data.tasks || []).filter(x => ["In Progress", "Accepted"].includes(x.status)).length} detail="Assigned and active" icon="◷" />
        <Stat label="Blocked items" value={rows.filter(x => x.status === "Blocked").length} detail="Flagged for support" icon="!" />
      </div>
      <Panel title={editingUpdate ? "Edit daily update" : "Submit today's update"} aside={<span className="muted">Edits are kept in the history.</span>}>
        <form key={editingUpdate?.id || "new"} id="daily-update-form" data-form="daily-update" className="form-grid" onSubmit={saveForm}>
          {editingUpdate && <input type="hidden" name="id" value={editingUpdate.id} />}
          <Field name="work_date" label="Work date" type="date" defaultValue={editingUpdate?.work_date || today()} />
          <Field name="title" label="Task title" defaultValue={editingUpdate?.title || ""} />
          <SelectField name="task_id" label="Linked assigned task" required={false} defaultValue={editingUpdate?.task_id || ""} options={[["", "No linked task"], ...(data.tasks || []).map(t => [t.id, t.title])]} />
          <Field name="project" label="Project" required={false} defaultValue={editingUpdate?.project || ""} />
          <Field name="client" label="Client" required={false} defaultValue={editingUpdate?.client || ""} />
          <SelectField name="priority" label="Priority" defaultValue={editingUpdate?.priority || "Medium"} options={["Low", "Medium", "High", "Urgent"].map(x => [x,x])} />
          <SelectField name="status" label="Task status" defaultValue={editingUpdate?.status || "In Progress"} options={["Not Started", "In Progress", "Blocked", "Completed"].map(x => [x,x])} />
          <Field name="progress" label="Progress (%)" type="number" min="0" max="100" defaultValue={editingUpdate?.progress ?? 0} />
          <Field name="time_spent" label="Time spent (hours)" type="number" min="0" max="24" step="0.25" required={false} defaultValue={editingUpdate?.time_spent ?? ""} />
          <div className="field full"><label htmlFor="daily-description">Detailed description</label><textarea id="daily-description" name="description" required defaultValue={editingUpdate?.description || ""} /></div>
          <div className="field"><label htmlFor="daily-completed">Completed today</label><textarea id="daily-completed" name="completed_today" defaultValue={editingUpdate?.completed_today || ""} /></div>
          <div className="field"><label htmlFor="daily-pending">Pending work</label><textarea id="daily-pending" name="pending_work" defaultValue={editingUpdate?.pending_work || ""} /></div>
          <div className="field"><label htmlFor="daily-blockers">Challenges or blockers</label><textarea id="daily-blockers" name="blockers" defaultValue={editingUpdate?.blockers || ""} /></div>
          <div className="field"><label htmlFor="daily-next">Next steps</label><textarea id="daily-next" name="next_steps" defaultValue={editingUpdate?.next_steps || ""} /></div>
          <div className="field full"><Button primary type="button" disabled={busyForm === "daily-update"} onClick={(e) => e.currentTarget.closest("form").requestSubmit()}>{editingUpdate ? "Save update" : "Submit update"}</Button> {editingUpdate && <Button type="button" onClick={() => setEditingUpdate(null)}>Cancel edit</Button>}{commonFormError}</div>
        </form>
      </Panel>
      <Panel title="Work history" aside={<span className="muted">Newest updates first · absence is not inferred from missing entries</span>}>
        <div className="toolbar employee-toolbar"><input aria-label="Updates from date" type="date" value={employeeUpdateFilters.from} onChange={e=>setEmployeeUpdateFilters({...employeeUpdateFilters,from:e.target.value})}/><input aria-label="Updates to date" type="date" value={employeeUpdateFilters.to} onChange={e=>setEmployeeUpdateFilters({...employeeUpdateFilters,to:e.target.value})}/><select aria-label="Filter update status" value={employeeUpdateFilters.status} onChange={e=>setEmployeeUpdateFilters({...employeeUpdateFilters,status:e.target.value})}><option value="">All statuses</option>{["Not Started","In Progress","Blocked","Completed"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter update project" value={employeeUpdateFilters.project} onChange={e=>setEmployeeUpdateFilters({...employeeUpdateFilters,project:e.target.value})}><option value="">All projects</option>{[...new Set((data.updates||[]).map(x=>x.project).filter(Boolean))].sort().map(x=><option key={x}>{x}</option>)}</select></div>
        {rows.length ? <div className="event-list">{rows.map(x => <article className="event" key={x.id}><div className="event-mark">{x.status === "Completed" ? "✓" : x.status === "Blocked" ? "!" : "≋"}</div><div><b>{x.work_date} · {x.title}</b><small>{x.project || "No project"}{x.client ? ` · ${x.client}` : ""} · {x.priority} · {x.status} · {x.progress}%</small><p>{x.description}</p>{x.completed_today && <small><b>Completed:</b> {x.completed_today}</small>}{x.blockers && <small><b>Blockers:</b> {x.blockers}</small>}{(x.comments||[]).map(c=><small key={c.id}><b>Feedback · {c.author_name}:</b> {c.body}</small>)}<small>Submitted {showTime(x.created_at)} · Last edited {showTime(x.updated_at)}</small><Button onClick={() => edit(x)}>Edit update</Button></div></article>)}</div> : <Empty>No daily updates yet. Submit your first update above.</Empty>}
      </Panel>
    </>;
  }
  if (page === "Bank reviews") {
    const rows=data.banks||[];
    return <><Header tag="PAYROLL PRIVACY" title="Bank detail verification" description="Review masked employee bank records. Reveal a full account number only when required."/><div className="cards"><Stat label="Pending verification" value={rows.filter(x=>x.status==="Pending Verification").length} detail="Needs payroll review" icon="◷"/><Stat label="Changes requested" value={rows.filter(x=>x.status==="Changes Requested").length} detail="Waiting on employee" icon="!"/><Stat label="Verified" value={rows.filter(x=>x.status==="Verified").length} detail="Approved details" icon="✓"/></div><Panel title="Employee bank records"><DataTable columns={["Employee","Department","Designation","Submitted","Status","Review"]} empty="No bank detail submissions.">{rows.map(x=><tr key={x.user_id}><td><b>{x.name}</b><br/><span className="muted">{x.employee_code||x.email}</span></td><td>{x.department||"—"}</td><td>{x.title||"—"}</td><td>{x.submitted_at?showTime(x.submitted_at):"—"}</td><td><Pill tone={x.status==="Verified"?"green":x.status==="Changes Requested"?"red":"amber"}>{x.status}</Pill></td><td><Button onClick={()=>setPage(`Employee profile · ${x.user_id}`)}>Open secure profile</Button></td></tr>)}</DataTable></Panel></>;
  }
  if (page === "Work updates") {
    const rows=(data.updates||[]).filter(x=>(!updateFilters.user_id||x.user_id===updateFilters.user_id)&&(!updateFilters.from||x.work_date>=updateFilters.from)&&(!updateFilters.to||x.work_date<=updateFilters.to)&&(!updateFilters.status||x.status===updateFilters.status));
    const selectedDay=updateFilters.from&&updateFilters.from===updateFilters.to?updateFilters.from:(!updateFilters.from&&!updateFilters.to?today():"");
    const missingOnDay=selectedDay?employeesList.filter(e=>(!updateFilters.user_id||e.id===updateFilters.user_id)&&!(data.updates||[]).some(u=>u.user_id===e.id&&u.work_date===selectedDay)):[];
    return <>
      <Header tag="WORKFORCE" title="Daily work updates" description="Review employee-reported work by date, status, and person. Missing updates do not indicate absence." />
      <div className="toolbar employee-toolbar"><select aria-label="Timeline period" value={timelineMode} onChange={e=>{const mode=e.target.value;setTimelineMode(mode);const d=new Date(),date=(x)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(x);if(mode==="daily"){const t=date(d);setUpdateFilters({...updateFilters,from:t,to:t})}else if(mode==="weekly"){const start=new Date(d);start.setDate(d.getDate()-((d.getDay()+6)%7));const end=new Date(start);end.setDate(start.getDate()+6);setUpdateFilters({...updateFilters,from:date(start),to:date(end)})}else if(mode==="monthly"){const start=new Date(d.getFullYear(),d.getMonth(),1),end=new Date(d.getFullYear(),d.getMonth()+1,0);setUpdateFilters({...updateFilters,from:date(start),to:date(end)})}else setUpdateFilters({...updateFilters,from:"",to:""})}}><option value="custom">Custom range</option><option value="daily">Today</option><option value="weekly">This week</option><option value="monthly">This month</option></select><select aria-label="Filter by employee" value={updateFilters.user_id} onChange={e=>setUpdateFilters({...updateFilters,user_id:e.target.value})}><option value="">All employees</option>{employeesList.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><input aria-label="From date" type="date" value={updateFilters.from} onChange={e=>{setTimelineMode("custom");setUpdateFilters({...updateFilters,from:e.target.value})}}/><input aria-label="To date" type="date" value={updateFilters.to} onChange={e=>{setTimelineMode("custom");setUpdateFilters({...updateFilters,to:e.target.value})}}/><select aria-label="Filter by status" value={updateFilters.status} onChange={e=>setUpdateFilters({...updateFilters,status:e.target.value})}><option value="">All statuses</option>{["Not Started","In Progress","Blocked","Completed"].map(x=><option key={x}>{x}</option>)}</select></div>
      <div className="cards"><Stat label="Updates shown" value={rows.length} detail="Filtered work history" icon="≋"/><Stat label="Blocked" value={rows.filter(x=>x.status==="Blocked").length} detail="Reported blockers" icon="!"/><Stat label="Completed" value={rows.filter(x=>x.status==="Completed").length} detail="Reported as complete" icon="✓"/></div>
      {selectedDay&&<Panel title={`No update recorded · ${selectedDay}`} aside={<span className="muted">This is a reporting status only; it does not establish absence.</span>}>{missingOnDay.length?missingOnDay.map(x=><Pill key={x.id}>{x.name}</Pill>):<Empty>Every employee in scope has submitted an update for this date.</Empty>}</Panel>}
      <Panel title="Employee activity timeline"><DataTable columns={["Date & employee","Update","Project / task","Status","Progress","Recorded","Actions"]} empty="No work updates match your filters.">{rows.map(x=><tr key={x.id}><td><b>{x.work_date}</b><br/>{x.employee_name}</td><td><b>{x.title}</b><br/><span className="muted">{x.description}</span>{x.blockers&&<div><Pill tone="red">Blocker reported</Pill> {x.blockers}</div>}</td><td>{x.project||"—"}{x.task_title&&<div className="muted">{x.task_title}</div>}</td><td><Pill tone={x.status==="Completed"?"green":x.status==="Blocked"?"red":"blue"}>{x.status}</Pill></td><td>{x.progress}%</td><td>{showTime(x.created_at)}<br/><span className="muted">Edited {showTime(x.updated_at)}</span></td><td><Button onClick={()=>setPage(`Employee profile · ${x.user_id}`)}>View profile</Button></td></tr>)}</DataTable></Panel>
    </>;
  }
  if (page.startsWith("Employee profile · ")) {
    const e=data.employee||{}, s=data.stats||{};
    async function reviewBank(status){const note=status==="Changes Requested"?window.prompt("What needs to be corrected?"):"";if(status==="Changes Requested"&&!note)return;try{await api("/api/hrm/bank/review",{method:"POST",body:JSON.stringify({user_id:e.user_id,status,note})});toast(`Bank details ${status.toLowerCase()}.`);await reload()}catch(err){toast(err.message)}}
    async function reveal(){try{const r=await api("/api/hrm/bank/reveal?user_id="+encodeURIComponent(e.user_id),{method:"POST",body:JSON.stringify({user_id:e.user_id})});setRevealedBank(r.bank)}catch(err){toast(err.message)}}
    async function commentUpdate(updateId){const body=window.prompt("Feedback for this work update:");if(!body?.trim())return;try{await api(`/api/hrm/daily-updates/${encodeURIComponent(updateId)}/comments`,{method:"POST",body:JSON.stringify({body})});toast("Feedback added to the work history.");await reload()}catch(err){toast(err.message)}}
    return <>
      <Header tag="EMPLOYEE PROFILE" title={e.name||"Employee profile"} description={`${e.employee_code||"Employee ID pending"} · ${e.title||"Employee"} · ${e.department||"Unassigned department"}`}><Button onClick={()=>setPage(user.role==="manager"?"Work updates":user.role==="payroll_manager"?"Bank reviews":"Employees")}>← Back to team</Button></Header>
      <div className="cards">{[["Assigned tasks",s.total_tasks],["Completed",s.completed],["In progress",s.in_progress],["Pending",s.pending],["Overdue",s.overdue],["Blocked",s.blocked],["Active projects",s.active_projects],["Daily updates",s.daily_updates]].map(([label,value])=><Stat key={label} label={label} value={value||0} detail={label==="Daily updates"?"Reported separately from productivity":"From recorded tasks"} icon="·"/>)}</div>
      <Panel title="Personal & professional information"><div className="profile-grid"><p><b>Official email</b><br/>{e.email}</p><p><b>Phone</b><br/>{e.phone||"—"}</p><p><b>Address</b><br/>{e.address||"—"}</p><p><b>Emergency contact</b><br/>{e.emergency_contact||"—"}</p><p><b>Date of birth</b><br/>{e.date_of_birth||"—"}</p><p><b>Employee ID</b><br/>{e.employee_code||"—"}</p><p><b>Role / title</b><br/>{e.title||"—"}</p><p><b>Department</b><br/>{e.department||"—"}</p><p><b>Reporting manager</b><br/>{e.manager_name||employeesList.find(x=>x.id===e.manager_id)?.name||"—"}</p><p><b>Joined</b><br/>{e.start_date||"—"}</p><p><b>Location</b><br/>{e.location||"—"}</p><p><b>Account</b><br/>{e.active?"Active":"Disabled"}</p><p><b>Responsibilities</b><br/>{e.responsibilities||"—"}</p><p><b>Skills</b><br/>{(e.skills||[]).join(", ")||"—"}</p><p><b>Profile updated</b><br/>{e.profile_updated_at?showTime(e.profile_updated_at):"—"}</p><p><b>Profile created</b><br/>{showTime(e.created_at)}</p></div></Panel>
      {(user.role==="admin"||user.role==="hr_manager")&&<Panel title="Edit employee record"><form className="form-grid" onSubmit={async ev=>{ev.preventDefault();const d=Object.fromEntries(new FormData(ev.currentTarget));d.skills=String(d.skills||"").split(",").map(x=>x.trim()).filter(Boolean);try{await api(`/api/hrm/employees/${encodeURIComponent(e.user_id)}/profile`,{method:"PUT",body:JSON.stringify(d)});toast("Employee profile saved and audit recorded.");await reload()}catch(err){toast(err.message)}}}><Field name="employee_code" label="Employee ID" defaultValue={e.employee_code||""}/><Field name="title" label="Designation" defaultValue={e.title||""}/><Field name="department" label="Department" defaultValue={e.department||""}/><SelectField name="location" label="Work location" defaultValue={e.location||"Hybrid"} options={["Onsite","Remote","Hybrid"].map(x=>[x,x])}/><Field name="start_date" label="Joining date" type="date" defaultValue={e.start_date||""}/><Field name="phone" label="Contact number" type="tel" required={false} defaultValue={e.phone||""}/><Field name="emergency_contact" label="Emergency contact" required={false} defaultValue={e.emergency_contact||""}/><Field name="date_of_birth" label="Date of birth" type="date" required={false} defaultValue={e.date_of_birth||""}/><Field name="address" label="Address" required={false} defaultValue={e.address||""}/><Field name="manager_id" label="Reporting manager user ID" required={false} defaultValue={e.manager_id||""}/><Field name="skills" label="Skills (comma separated)" required={false} defaultValue={(e.skills||[]).join(", ")}/><div className="field full"><label htmlFor="edit-responsibilities">Responsibilities</label><textarea id="edit-responsibilities" name="responsibilities" defaultValue={e.responsibilities||""}/><Button primary>Save employee record</Button></div></form></Panel>}
      <Panel title="Assigned tasks"><DataTable columns={["Task","Project","Priority","Status","Deadline"]} empty="No tasks assigned.">{(data.tasks||[]).map(t=><tr key={t.id}><td>{t.title}</td><td>{t.project||"—"}</td><td>{t.priority}</td><td>{t.status}</td><td>{t.due_date||"—"}</td></tr>)}</DataTable></Panel>
      <Panel title="Projects and clients"><DataTable columns={["Project","Client","Responsibility","Status","Dates"]} empty="No project assignments recorded.">{(data.projects||[]).map(x=><tr key={x.id}><td>{x.project}</td><td>{x.client||"—"}</td><td>{x.responsibility||"—"}</td><td>{x.status}</td><td>{x.start_date||"—"} {x.end_date||""}</td></tr>)}</DataTable>{user.role==="admin"||user.role==="hr_manager"?<form className="form-grid" onSubmit={async ev=>{ev.preventDefault();const d=Object.fromEntries(new FormData(ev.currentTarget));d.user_id=e.user_id;try{await api("/api/hrm/employee-projects",{method:"POST",body:JSON.stringify(d)});toast("Project assignment added.");await reload()}catch(err){toast(err.message)}}}><Field name="project" label="Add project"/><Field name="client" label="Client" required={false}/><Field name="responsibility" label="Responsibility" required={false}/><Field name="start_date" label="Start date" type="date" required={false}/><Button primary>Assign project</Button></form>:null}</Panel>
      <Panel title="Day-wise daily updates"><div className="event-list">{(data.updates||[]).map(x=><article className="event" key={x.id}><div className="event-mark">{x.status==="Blocked"?"!":"≋"}</div><div><b>{x.work_date} · {x.title}</b><small>{x.project||"No project"} · {x.status} · {x.progress}% · {x.priority}</small><p>{x.description}</p>{x.completed_today&&<small>Completed: {x.completed_today}</small>}{x.pending_work&&<small>Pending: {x.pending_work}</small>}{x.blockers&&<small>Blockers: {x.blockers}</small>}{x.next_steps&&<small>Next: {x.next_steps}</small>}{(x.comments||[]).map(c=><small key={c.id}><b>Feedback · {c.author_name}:</b> {c.body}</small>)}<small>Submitted {showTime(x.created_at)} · Edited {showTime(x.updated_at)}</small>{["admin","hr_manager","manager"].includes(user.role)&&<Button onClick={()=>commentUpdate(x.id)}>Add feedback</Button>}</div></article>)}</div>{!(data.updates||[]).length&&<Empty>No work updates recorded.</Empty>}</Panel>
      {(user.role==="admin"||user.role==="payroll_manager")&&<Panel title="Restricted bank details" aside={<span className="muted">Account number stays masked until explicitly revealed.</span>}>{data.bank?<><p><b>{data.bank.account_holder}</b> · {data.bank.bank_name} · {data.bank.account_number_masked} · {data.bank.ifsc} · <Pill tone={data.bank.status==="Verified"?"green":data.bank.status==="Changes Requested"?"red":"amber"}>{data.bank.status}</Pill></p>{data.bank.review_note&&<p>{data.bank.review_note}</p>}<Button onClick={reveal}>{revealedBank?"Refresh full details":"Reveal full account number"}</Button>{revealedBank&&<div className="sensitive-panel">Account: {revealedBank.account_number} · Branch: {revealedBank.branch_name||"—"} · UPI: {revealedBank.upi_id||"—"}</div>}<div className="toolbar"><Button onClick={()=>reviewBank("Verified")}>Verify</Button><Button onClick={()=>reviewBank("Changes Requested")}>Request correction</Button><Button onClick={()=>reviewBank("Rejected")}>Reject</Button></div><small>Submitted {data.bank.submitted_at?showTime(data.bank.submitted_at):"—"} · Verified {data.bank.verified_at?showTime(data.bank.verified_at):"—"} · Last modified {data.bank.updated_at?showTime(data.bank.updated_at):"—"}</small><h3>Verification and access history</h3><EventList rows={(data.bankHistory||[]).map(x=>({title:`${x.action} · ${x.status}`,detail:`${x.actor_name} · ${showTime(x.created_at)}${x.note?` · ${x.note}`:""}`}))}/></>:<Empty>No bank details submitted.</Empty>}</Panel>}
      <Panel title="Activity history"><EventList rows={(data.activity||[]).map(x=>({title:x.action,detail:`${x.actor_name||"System"} · ${showTime(x.created_at)} · ${x.details}`}))}/></Panel>
    </>;
  }
  if (page === "Employees")
    return (
      <>
        <Header
          tag="PEOPLE"
          title="Employee directory"
          description="See account status at a glance, onboard people, and manage access."
        ><Button primary onClick={() => document.getElementById("invite-employee")?.scrollIntoView({ behavior: "smooth", block: "center" })}>＋ Invite employee</Button></Header>
        <div className="cards onboarding-cards">
          <Stat label="Active accounts" value={employeesList.filter((x) => x.active).length} detail="Ready to use HRMS" icon="✓" />
          <Stat label="Invitations sent" value={invitationRows.filter((x) => x.status === "Invitation Sent").length} detail="Waiting for activation" icon="✉" />
          <Stat label="Need attention" value={invitationRows.filter((x) => ["Not Invited", "Invitation Expired"].includes(x.status)).length} detail="Create login or resend link" icon="!" />
          <Stat label="Team size" value={employeesList.length} detail="Employee records" icon="♙" />
        </div>
        <Panel title="Invite an employee" aside={<span className="muted">They set their own password from the secure link.</span>}>
          <form id="invite-employee" data-form="invite" className="form-grid" onSubmit={saveForm}>
            <Field name="name" label="Full name" />
            <Field name="email" label="Work email" type="email" />
            <Field name="title" label="Job title" required={false} />
            <Field name="department" label="Department" required={false} />
            <SelectField name="location" label="Work arrangement" options={["Onsite", "Remote", "Hybrid"].map((x) => [x, x])} />
            <SelectField name="role" label="Account role" options={[["employee", "Employee"], ["hr_manager", "HR Manager"], ["payroll_manager", "Payroll Manager"], ["manager", "Department Manager"]]} />
            <div className="field full invite-submit">
              <Button primary disabled={busyForm === "invite"}>{busyForm === "invite" ? "Sending invitation…" : "Create login & invite"}</Button>
              {commonFormError}
              {result && typeof result === "object" && <div className={`invite-result ${result.accepted ? "success" : "pending"}`}>
                <div><b>{result.accepted ? "Invitation email accepted for sending" : result.mode === "demo" ? "Trial link ready · no email was sent" : "Unable to send the email"}</b><span>{result.accepted ? "The mail service accepted the message. Inbox delivery can take a little time." : result.error || "Retry from the employee’s onboarding row."}</span></div>
                {result.url && <div className="copy-link"><input aria-label="Trial activation link" readOnly value={result.url} onFocus={(e) => e.target.select()} /><Button type="button" onClick={async () => { try { await navigator.clipboard.writeText(result.url); toast("Activation link copied."); } catch { toast("Select the activation link and copy it manually."); } }}>Copy link</Button></div>}
                <small>Link expires in {result.expiresInDays} days · single use</small>
              </div>}
            </div>
          </form>
        </Panel>
        <Panel title="Onboarding status" aside={<span className="muted">Latest invitation for each employee</span>}>
          <div className="toolbar employee-toolbar">
            <input type="search" placeholder="Search name, email, department or role" aria-label="Search onboarding" value={employeeQuery} onChange={(e) => { setEmployeeQuery(e.target.value); setDirectoryPage(1); }} />
            <select aria-label="Filter onboarding status" value={employeeStatus} onChange={(e) => setEmployeeStatus(e.target.value)}>
              {["All statuses", "Not Invited", "Invitation Sent", "Invitation Expired", "Active", "Disabled"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <DataTable columns={["Employee", "Department", "Designation", "Email", "Invitation date", "Account status", "Actions"]} empty="No employees match these filters.">
            {visibleInvitations.length ? visibleInvitations.map((x) => <tr key={x.id}>
              <td><b>{x.name}</b><br /><span className="muted">{x.role?.replaceAll("_", " ") || "employee"}</span></td>
              <td>{x.department || "—"}</td><td>{x.title || "—"}</td><td>{x.email}</td>
              <td>{x.sent_at ? showTime(x.sent_at) : x.created_at ? showTime(x.created_at) : "—"}</td>
              <td><Pill tone={x.status === "Active" ? "green" : x.status === "Invitation Sent" ? "blue" : x.status === "Invitation Expired" || x.status === "Disabled" ? "red" : "amber"}>{x.status}</Pill></td>
              <td className="table-actions">
                <Button onClick={() => setModal({ type: "details", title: x.name, description: `${x.email}\n${x.title || "No designation"} · ${x.department || "No department"}\n${x.location || "Hybrid"} · ${x.status}\nInvitation: ${x.created_at ? showTime(x.created_at) : "Not sent"}` })}>View details</Button>
                {x.status !== "Active" && x.status !== "Disabled" && <Button onClick={() => confirmResend(x)}>{x.status === "Not Invited" ? "Create login" : "Resend invitation"}</Button>}
              </td>
            </tr>) : null}
          </DataTable>
        </Panel>
        <Panel title="Active employee access" aside={<span className="muted">Disable or restore sign-in access</span>}>
          <div className="toolbar employee-toolbar"><select aria-label="Filter department" value={directoryDepartment} onChange={e=>{setDirectoryDepartment(e.target.value);setDirectoryPage(1)}}><option>All departments</option>{[...new Set(employeesList.map(x=>x.department).filter(Boolean))].sort().map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter designation" value={directoryTitle} onChange={e=>{setDirectoryTitle(e.target.value);setDirectoryPage(1)}}><option>All designations</option>{[...new Set(employeesList.map(x=>x.title).filter(Boolean))].sort().map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter reporting manager" value={directoryManager} onChange={e=>{setDirectoryManager(e.target.value);setDirectoryPage(1)}}><option>All managers</option>{(data.managers||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select aria-label="Filter access status" value={directoryAccess} onChange={e=>{setDirectoryAccess(e.target.value);setDirectoryPage(1)}}>{["All access","Active","Disabled"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Sort employees" value={directorySort} onChange={e=>setDirectorySort(e.target.value)}><option value="name">Sort by name</option><option value="joining_date">Sort by joining date</option><option value="activity">Sort by latest activity</option></select></div>
          <DataTable columns={["Employee", "Role", "Department", "Location", "Email", "Tasks / activity", "Access"]} empty="No employee records match your search.">
            {pagedEmployees.length ? pagedEmployees.map((x) => (
              <tr key={x.id}>
                <td>{x.name}<br /><span className="muted">{x.title || "—"}</span></td><td>{x.role.replaceAll("_", " ")}</td><td>{x.department || "—"}</td><td>{x.location || "—"}</td><td>{x.email}</td>
                <td>{(x.task_summary||[]).reduce((a,r)=>a+Number(r.count||0),0)} tasks · {x.active_projects||0} projects<br/><span className="muted">{x.last_activity?showTime(x.last_activity):"No activity recorded"}</span><br/><Button onClick={()=>setPage(`Employee profile · ${x.id}`)}>View profile</Button></td>
                <td><Pill tone={x.active ? "green" : "red"}>{x.active ? "Active" : "Disabled"}</Pill>{" "}<Button onClick={() => action("access", { id: x.id, active: !x.active })}>{x.active ? "Disable" : "Reactivate"}</Button></td>
              </tr>
            )) : null}
          </DataTable>
          <div className="toolbar"><span className="muted">Showing {visibleEmployees.length ? (directoryPage-1)*employeePageSize+1 : 0}–{Math.min(directoryPage*employeePageSize,visibleEmployees.length)} of {visibleEmployees.length}</span><Button disabled={directoryPage<=1} onClick={()=>setDirectoryPage(n=>Math.max(1,n-1))}>Previous</Button><Button disabled={directoryPage*employeePageSize>=visibleEmployees.length} onClick={()=>setDirectoryPage(n=>n+1)}>Next</Button></div>
        </Panel>
      </>
    );
  if (page === "Attendance")
    return (
      <>
        <Header
          tag="TIME & ATTENDANCE"
          title="Team attendance"
          description="Clock segments and employee activity logs."
        />
        <Panel title="Shift records">
          <DataTable columns={["Employee", "Date", "Clock segments", "Status"]}>
            {data.attendance.map((x) => (
              <tr key={x.id}>
                <td>{x.name}</td>
                <td>{x.work_date}</td>
                <td>
                  {JSON.parse(x.segments).map((s) => (
                    <div key={s.start}>
                      {showTime(s.start)} → {s.end ? showTime(s.end) : "now"}
                    </div>
                  ))}
                </td>
                <td>{x.status}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        <Panel title="Attendance activity">
          <EventList
            rows={data.logs.map((x) => ({
              title: `${x.name} · ${x.action}`,
              detail: `${showTime(x.created_at)} · ${x.details}`,
            }))}
          />
        </Panel>
      </>
    );
  if (page === "Requests")
    return (
      <>
        <Header
          tag="APPROVALS"
          title="Employee requests"
          description="Admin approval is required for all employee requests."
        />
        <Panel title="Requests awaiting review">
          <DataTable
            columns={[
              "Employee",
              "Type",
              "Details",
              "Dates",
              "Status",
              "Decision",
            ]}
          >
            {data.requests.map((x) => (
              <tr key={x.id}>
                <td>{x.name}</td>
                <td>{x.kind}</td>
                <td>{x.details}</td>
                <td>
                  {x.start_date || "—"} {x.end_date ? `– ${x.end_date}` : ""}
                </td>
                <td>
                  <Pill
                    tone={
                      x.status === "Approved"
                        ? "green"
                        : x.status === "Rejected"
                          ? "red"
                          : "amber"
                    }
                  >
                    {x.status}
                  </Pill>
                </td>
                <td>
                  {x.status === "Pending" && user.role === "admin" ? (
                    <>
                      <Button
                        primary
                        onClick={() =>
                          action("decision", { id: x.id, status: "Approved" })
                        }
                      >
                        Approve
                      </Button>{" "}
                      <Button
                        onClick={() =>
                          action("decision", { id: x.id, status: "Rejected" })
                        }
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    x.decision_note || "—"
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </>
    );
  if (page === "Leave rules")
    return (
      <>
        <Header
          tag="POLICY"
          title="Leave rules"
          description="Admin-managed paid and unpaid leave rules; leave requests remain pending until an administrator decides."
        />
        <Panel title="Leave entitlements">
          <form data-form="leave-types" onSubmit={saveForm}>
            <div id="rules">
              {rules.map((r, i) => (
                <div className="form-grid rule-row" key={i}>
                  <Field
                    name={`name-${i}`}
                    label="Leave type"
                    required={false}
                    defaultValue={r.name}
                  />
                  <SelectField
                    name={`category-${i}`}
                    label="Paid / unpaid"
                    defaultValue={r.category}
                    options={[
                      ["Paid", "Paid leave"],
                      ["Unpaid", "Unpaid leave"],
                    ]}
                  />
                  <Field
                    name={`annual-${i}`}
                    label="Entitlement (days/year)"
                    type="number"
                    required={false}
                    min="0"
                    step="0.5"
                    defaultValue={r.entitlement_days}
                  />
                  <label>
                    <input
                      type="checkbox"
                      name={`half-${i}`}
                      defaultChecked={!!r.allow_half_day}
                    />{" "}
                    Allow half-days
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name={`excess-${i}`}
                      defaultChecked={r.excess_to_unpaid !== 0}
                    />{" "}
                    Excess paid leave becomes unpaid
                  </label>
                  <Field
                    name={`notes-${i}`}
                    label="Notes"
                    required={false}
                    defaultValue={r.notes}
                  />
                  <Button
                    type="button"
                    onClick={() => setRules((v) => v.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              onClick={() =>
                setRules((v) => [
                  ...v,
                  {
                    name: "New leave type",
                    category: "Paid",
                    entitlement_days: 0,
                    allow_half_day: 1,
                    excess_to_unpaid: 1,
                    notes: "",
                  },
                ])
              }
            >
              ＋ Add leave type
            </Button>{" "}
            <Button primary>Save rules</Button>
            {commonFormError}
          </form>
        </Panel>
      </>
    );
  if (page === "Company updates")
    return (
      <>
        <Header
          tag="COMMUNICATIONS"
          title="Company updates"
          description={
            ["admin", "hr_manager"].includes(user.role)
              ? "Post company-wide announcements or messages to individual team members."
              : "Read announcements and organizational notices from leadership."
          }
        />
        {["admin", "hr_manager"].includes(user.role) && (
          <Panel title="Publish an update">
            <form data-form="updates" className="form-grid" onSubmit={saveForm}>
              <Field name="title" label="Title" />
              <SelectField
                name="audience"
                label="Audience"
                options={[
                  ["all", "All employees"],
                  ...(Array.isArray(data.employees) ? data.employees : []).map((x) => [x.id, x.name]),
                ]}
              />
              <div className="field full">
                <label htmlFor="body">Message</label>
                <textarea id="body" name="body" required />
              </div>
              <div className="field full">
                <label>
                  <input type="checkbox" name="pinned" /> Pin update
                </label>
                <Button primary>Publish</Button>
                {commonFormError}
              </div>
            </form>
          </Panel>
        )}
        <Panel title={["admin", "hr_manager"].includes(user.role) ? "Published updates" : "Company notices"}>
          <EventList
            rows={(data.updates || []).map((x) => ({
              title: x.title,
              detail: `${showTime(x.created_at)} · ${x.body}`,
            }))}
          />
          {!(data.updates || []).length && <Empty>No updates published yet.</Empty>}
        </Panel>
      </>
    );
  if (page === "Tasks" || page === "My tasks")
    return ["admin", "hr_manager", "manager"].includes(user.role) ? (
      <>
        <Header
          tag="WORK"
          title="Task board"
          description="Assign tasks, monitor deadlines, and review completed work."
        />
        <Panel title="Assign task">
          <form data-form="task" className="form-grid" onSubmit={saveForm}>
            <SelectField
              name="user_id"
              label="Employee"
              options={(Array.isArray(data.employees) ? data.employees : []).map((x) => [x.id, x.name])}
            />
            <Field name="title" label="Task title" />
            <Field name="description" label="Description" required={false} />
            <SelectField
              name="priority"
              label="Priority"
              options={["Low", "Medium", "High", "Urgent"].map((x) => [x, x])}
            />
            <Field
              name="start_date"
              label="Start date"
              type="date"
              required={false}
            />
            <Field
              name="due_date"
              label="Due date"
              type="date"
              required={false}
            />
            <Field
              name="estimate_hours"
              label="Estimated hours"
              type="number"
              min="0"
              step="0.5"
              required={false}
            />
            <Field name="category" label="Category" required={false} />
            <Field name="project" label="Project" required={false} />
            <Field
              name="attachment_url"
              label="Attachment / deliverable link"
              required={false}
            />
            <Field
              name="subtasks"
              label="Checklist (comma separated)"
              required={false}
            />
            <div className="field full">
              <Button primary>Assign task</Button>
              {commonFormError}
            </div>
          </form>
        </Panel>
        <Panel title="Team tasks">
          <DataTable
            columns={[
              "Employee",
              "Task",
              "Priority",
              "Project",
              "Due",
              "Progress",
              "Review",
            ]}
          >
            {data.tasks.map((x) => (
              <tr key={x.id}>
                <td>{x.employee_name || x.name}</td>
                <td>
                  {x.title}
                  <small>{x.description}</small>
                </td>
                <td>{x.priority}</td>
                <td>{x.project || "—"}</td>
                <td>{x.due_date || "—"}</td>
                <td>{x.status}</td>
                <td>
                  {x.status === "Pending Review" ? (
                    <>
                      <Button
                        primary
                        onClick={() =>
                          action("task-status", {
                            id: x.id,
                            status: "Completed",
                          })
                        }
                      >
                        Approve
                      </Button>{" "}
                      <Button
                        onClick={() =>
                          action("task-status", {
                            id: x.id,
                            status: "Reopened",
                          })
                        }
                      >
                        Reopen
                      </Button>
                    </>
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </>
    ) : (
      <>
        <Header
          tag="MY WORK"
          title="My tasks"
          description="Create your own tasks, accept work, update progress, and track your checklist."
        />
        <Panel title="Create task">
          <form data-form="task" className="form-grid" onSubmit={saveForm}>
            <Field name="title" label="Task title" />
            <Field name="description" label="Description" required={false} />
            <SelectField
              name="priority"
              label="Priority"
              options={["Low", "Medium", "High", "Urgent"].map((x) => [x, x])}
            />
            <Field
              name="start_date"
              label="Start date"
              type="date"
              required={false}
            />
            <Field
              name="due_date"
              label="Due date"
              type="date"
              required={false}
            />
            <Field
              name="estimate_hours"
              label="Estimated hours"
              type="number"
              min="0"
              step="0.5"
              required={false}
            />
            <Field name="category" label="Category" required={false} />
            <Field name="project" label="Project" required={false} />
            <Field
              name="attachment_url"
              label="Attachment / deliverable link"
              required={false}
            />
            <Field
              name="subtasks"
              label="Checklist items (comma separated)"
              required={false}
            />
            <div className="field full">
              <Button primary>Create task</Button>
              {commonFormError}
            </div>
          </form>
        </Panel>
        <div className="rows">
          {data.tasks.map((x) => (
            <div className="row task-card" key={x.id}>
              <div className="row-copy">
                <b>{x.title}</b>
                <span>
                  {x.description} · Due {x.due_date || "—"} · {x.priority}
                </span>
              </div>
              <select
                value={x.status}
                onChange={(e) =>
                  action("task-status", { id: x.id, status: e.target.value })
                }
              >
                {[
                  x.status,
                  ...({
                    Assigned: ["Accepted", "Blocked"],
                    Accepted: ["In Progress", "Blocked"],
                    "In Progress": ["Pending Review", "Blocked"],
                    Blocked: ["In Progress"],
                    Reopened: ["In Progress"],
                  }[x.status] || []),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {x.subtasks?.map((sub) => (
                <label className="task-check" key={sub.id}>
                  <input
                    type="checkbox"
                    checked={sub.status === "Done"}
                    onChange={async (e) => {
                      try {
                        await api(`/api/hrm/tasks/${x.id}/subtasks/${sub.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ completed: e.target.checked }),
                        });
                        await reload();
                      } catch (err) {
                        toast(err.message);
                      }
                    }}
                  />
                  {sub.title}
                </label>
              ))}
            </div>
          ))}
        </div>
        {!data.tasks.length && <Empty>No tasks assigned yet.</Empty>}
      </>
    );
  if (page === "Calendar")
    return (
      <CalendarPage
        data={data}
        user={user}
        month={month}
        setMonth={setMonth}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        saveForm={saveForm}
        formError={commonFormError}
      />
    );
  if (
    page === "Payroll" &&
    ["admin", "payroll_manager", "hr_manager"].includes(user.role)
  )
    return (
      <>
        <Header
          tag="PAY"
          title="Payroll & Payslips"
          description="Create customized payslips, configure salary structures, and manage monthly payroll workflows."
        />
        <div className="payroll-tab-nav">
          <button
            type="button"
            className={`payroll-tab-btn ${payrollTab === "builder" ? "active" : ""}`}
            onClick={() => setPayrollTab("builder")}
          >
            Payslip Generator
          </button>
          <button
            type="button"
            className={`payroll-tab-btn ${payrollTab === "workflow" ? "active" : ""}`}
            onClick={() => setPayrollTab("workflow")}
          >
            Monthly Workflow & Salary Structures
          </button>
        </div>

        {payrollTab === "builder" ? (
          <PayslipBuilder
            employees={Array.isArray(data.employees) ? data.employees : []}
            toast={toast}
          />
        ) : (
          <>
        {["admin", "payroll_manager"].includes(user.role) && (
          <Panel title="Salary profile · add effective dated structure">
            <form data-form="salary" className="form-grid" onSubmit={saveForm}>
              <SelectField
                name="user_id"
                label="Employee"
                options={(Array.isArray(data.employees) ? data.employees : []).map((x) => [x.id, x.name])}
              />
              <Field name="effective_from" label="Effective from" type="date" />
              <Field
                name="basic_salary"
                label="Monthly basic (INR)"
                type="number"
                min="0"
                step="0.01"
              />
              <Field
                name="allowances"
                label="Fixed allowances"
                required={false}
                placeholder="HRA:10000, Travel:1500"
              />
              <Field
                name="earnings"
                label="Other earnings"
                required={false}
                placeholder="Bonus:0"
              />
              <Field
                name="deductions"
                label="Recurring deductions"
                required={false}
                placeholder="PF:0, TDS:0"
              />
              <SelectField
                name="workday_method"
                label="Salary divisor"
                options={[
                  ["working_days", "Scheduled working days"],
                  ["calendar_days", "Calendar days"],
                ]}
              />
              <SelectField
                name="weekly_off"
                label="Weekly off"
                options={[
                  ["0", "Sunday"],
                  ["1", "Monday"],
                  ["2", "Tuesday"],
                  ["3", "Wednesday"],
                  ["4", "Thursday"],
                  ["5", "Friday"],
                  ["6", "Saturday"],
                ]}
              />
              <Field
                name="paid_leave_entitlement"
                label="Paid leave cap (days, optional)"
                type="number"
                required={false}
                min="0"
                step="0.5"
              />
              <div className="field full">
                <Button primary>Save salary structure</Button>
                {commonFormError}
              </div>
            </form>
            <p className="help">
              Use “Name:amount” components separated by commas. Statutory values
              must be reviewed and entered under your approved policy.
            </p>
          </Panel>
        )}
        {["admin", "payroll_manager"].includes(user.role) && (
          <Panel title="Generate monthly draft">
            <form
              data-form="payroll-generate"
              className="form-grid"
              onSubmit={saveForm}
            >
              <Field name="period" label="Payroll month" type="month" />
              <div className="field">
                <Button primary>Calculate draft</Button>
                {commonFormError}
              </div>
            </form>
          </Panel>
        )}
        <Panel title="Payroll workflow">
          <DataTable
            columns={[
              "Period",
              "Status",
              "Employees",
              "Gross",
              "Net",
              "Actions",
            ]}
          >
            {data.periods.map((p) => (
              <tr key={p.id}>
                <td>{p.period}</td>
                <td>
                  <Pill>{p.status}</Pill>
                </td>
                <td>{p.item_count}</td>
                <td>{cash(p.gross_paise / 100)}</td>
                <td>{cash(p.net_paise / 100)}</td>
                <td>
                  <Button
                    onClick={async () => {
                      try {
                        const r = await api(`/api/hrm/payroll/periods/${p.id}`);
                        setPayrollDetail(r.period);
                      } catch (e) {
                        toast(e.message);
                      }
                    }}
                  >
                    Review
                  </Button>{" "}
                  {[
                    "Validation",
                    "HR Review",
                    "Payroll Approval",
                    "Finalized",
                  ].includes(p.status) && (
                      <Button
                        primary
                        onClick={async () => {
                          const to = {
                            Validation: "HR Review",
                            "HR Review": "Payroll Approval",
                            "Payroll Approval": "Finalized",
                            Finalized: "Published",
                          }[p.status];
                          try {
                            await api(
                              `/api/hrm/payroll/periods/${p.id}/transition`,
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  to,
                                  note: "Reviewed in HRMS",
                                }),
                              },
                            );
                            toast(`Payroll moved to ${to}.`);
                            await reload();
                          } catch (e) {
                            toast(e.message);
                          }
                        }}
                      >
                        {
                          {
                            Validation: "Send for HR review",
                            "HR Review": "Send for payroll approval",
                            "Payroll Approval": "Finalize",
                            Finalized: "Publish payslips",
                          }[p.status]
                        }
                      </Button>
                    )}{" "}
                  {p.status === "Published" && (
                    <Button
                      onClick={async () => {
                        const reference =
                          window.prompt("Payment batch reference (optional)") ||
                          "";
                        try {
                          await api(`/api/hrm/payroll/periods/${p.id}/paid`, {
                            method: "POST",
                            body: JSON.stringify({ reference }),
                          });
                          await reload();
                        } catch (e) {
                          toast(e.message);
                        }
                      }}
                    >
                      Mark paid
                    </Button>
                  )}{" "}
                  {["Draft", "Validation"].includes(p.status) && (
                    <Button
                      onClick={async () => {
                        try {
                          await api(
                            `/api/hrm/payroll/periods/${p.id}/recalculate`,
                            { method: "POST", body: "{}" },
                          );
                          toast("Draft recalculated.");
                          await reload();
                        } catch (e) {
                          toast(e.message);
                        }
                      }}
                    >
                      Recalculate
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        {payrollDetail && (
          <Panel
            title={`${payrollDetail.period} · ${payrollDetail.status}`}
            aside={
              <Button onClick={() => setPayrollDetail(null)}>Close</Button>
            }
          >
            <div className="event-list">
              {(payrollDetail.validation || []).map((v, i) => (
                <div className="event" key={i}>
                  <Pill tone={v.level === "error" ? "red" : "amber"}>
                    {v.level}
                  </Pill>
                  <div>
                    <b>{v.code}</b>
                    <small>{v.message}</small>
                  </div>
                </div>
              ))}
            </div>
            <DataTable
              columns={[
                "Employee",
                "Scheduled",
                "Present",
                "Paid leave",
                "Unpaid leave",
                "Gross",
                "Leave deduction",
                "Other deductions",
                "Net",
                "Payslip",
              ]}
            >
              {payrollDetail.items.map((x) => (
                <tr key={x.id}>
                  <td>{x.name}</td>
                  <td>{x.scheduled_days}</td>
                  <td>{x.present_days}</td>
                  <td>{x.paid_leave_days}</td>
                  <td>{x.unpaid_leave_days}</td>
                  <td>{cash(x.gross_paise / 100)}</td>
                  <td>{cash(x.leave_deduction_paise / 100)}</td>
                  <td>
                    {cash(
                      (x.total_deductions_paise - x.leave_deduction_paise) /
                      100,
                    )}
                  </td>
                  <td>{cash(x.net_paise / 100)}</td>
                  <td>
                    <Button onClick={() => downloadPayslip(x.id, toast)}>
                      Print / save PDF
                    </Button>{" "}
                    {["Finalized", "Published", "Paid"].includes(
                      payrollDetail.status,
                    ) && (
                        <Button
                          onClick={async () => {
                            const amount = window.prompt(
                              "Signed adjustment amount in INR",
                            );
                            if (amount === null) return;
                            const reason =
                              window.prompt("Reason for adjustment") || "";
                            try {
                              await api(
                                `/api/hrm/payroll/items/${x.id}/adjustments`,
                                {
                                  method: "POST",
                                  body: JSON.stringify({
                                    amount: Number(amount),
                                    reason,
                                  }),
                                },
                              );
                              const r = await api(
                                `/api/hrm/payroll/periods/${payrollDetail.id}`,
                              );
                              setPayrollDetail(r.period);
                              toast("Adjustment recorded in the audit trail.");
                            } catch (e) {
                              toast(e.message);
                            }
                          }}
                        >
                          Adjustment
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        )}
        <p className="help">
          <a
            href={`/api/hrm/reports/payroll.csv?period=${today().slice(0, 7)}`}
          >
            Download authorized payroll CSV
          </a>
        </p>
          </>
        )}
      </>
    );
  if (page === "My payslips")
    return (
      <>
        <Header
          tag="PAY"
          title="My payslips"
          description="Published payroll records for your account."
        />
        <Panel title="Payslip history">
          <DataTable
            columns={[
              "Period",
              "Gross",
              "Deductions",
              "Net",
              "Status",
              "Payslip",
            ]}
          >
            {data.periods.map((x) => (
              <tr key={x.id}>
                <td>{x.period}</td>
                <td>{cash(x.gross_paise / 100)}</td>
                <td>{cash(x.total_deductions_paise / 100)}</td>
                <td>{cash(x.net_paise / 100)}</td>
                <td>{x.period_status}</td>
                <td>
                  <Button onClick={() => downloadPayslip(x.id, toast)}>
                    Print / save PDF
                  </Button>{" "}
                  {["Finalized", "Published", "Paid"].includes(
                    payrollDetail.status,
                  ) && (
                      <Button
                        onClick={async () => {
                          const amount = window.prompt(
                            "Signed adjustment amount in INR",
                          );
                          if (amount === null) return;
                          const reason =
                            window.prompt("Reason for adjustment") || "";
                          try {
                            await api(
                              `/api/hrm/payroll/items/${x.id}/adjustments`,
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  amount: Number(amount),
                                  reason,
                                }),
                              },
                            );
                            const r = await api(
                              `/api/hrm/payroll/periods/${payrollDetail.id}`,
                            );
                            setPayrollDetail(r.period);
                            toast("Adjustment recorded in the audit trail.");
                          } catch (e) {
                            toast(e.message);
                          }
                        }}
                      >
                        Adjustment
                      </Button>
                    )}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </>
    );
  if (page === "Reports")
    return (
      <>
        <Header
          tag="REPORTS"
          title="Monthly reports"
          description="Payroll totals, leave activity, and task progress."
        />
        <Panel title="Monthly summary">
          <p>Period: {data.period}</p>
          <div className="cards">
            <Stat
              label="Payroll employees"
              value={data.payroll.employees}
              detail="Finalized or published"
              icon="♙"
            />
            <Stat
              label="Gross payroll"
              value={cash(data.payroll.gross_paise / 100)}
              detail="INR"
              icon="₹"
            />
            <Stat
              label="Net payroll"
              value={cash(data.payroll.net_paise / 100)}
              detail="INR"
              icon="₹"
            />
            <Stat
              label="Overdue tasks"
              value={data.tasks.overdue}
              detail={`${data.tasks.total} tasks tracked`}
              icon="✓"
            />
          </div>
          <p>
            Leave requests: {data.leave.total} · Approved: {data.leave.approved}{" "}
            · Pending: {data.leave.pending}
          </p>
          <p>
            <a href={`/api/hrm/reports/payroll.csv?period=${data.period}`}>
              Download payroll CSV
            </a>
          </p>
        </Panel>
      </>
    );
  if (page === "Documents" || page === "Documents & policies")
    return (
      <>
        <Header
          tag="LIBRARY"
          title={user.role === "admin" || user.role === "hr_manager" ? "Documents & policies" : "Company documents"}
          description={user.role === "admin" || user.role === "hr_manager" ? "Upload, version, and publish official company documents." : "Published resources and policies from Macrow Digital."}
        />
        {(user.role === "admin" || user.role === "hr_manager") && <Panel title="Upload a policy or company document" aside={<span className="muted">PDF or DOCX · up to 10 MB</span>}>
          <form id="document-upload" data-form="document" className="form-grid" onSubmit={saveForm}>
            <Field name="title" label="Document title" />
            <SelectField name="category" label="Category" options={[...new Set(["Company Policies", "HR Policies", "Leave Policy", "Attendance Policy", "Employee Handbook", "Code of Conduct", "IT and Security Policies", "Other Documents", ...data.documents.map((x) => x.category)])].map((x) => [x, x])} />
            <Field name="description" label="Description (optional)" required={false} />
            <div className="field"><label htmlFor="policy-file">Choose document</label><input id="policy-file" name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></div>
            <SelectField name="publish_now" label="After upload" options={[["no", "Save as draft for review"], ["yes", "Publish to employees"]]} />
            <p className="field full help">Uploading a document with the same title and category creates a new version. The existing version stays available in history. Publishing makes the new version current for employees.</p>
            <div className="field full invite-submit"><Button primary disabled={busyForm === "document"}>{busyForm === "document" ? "Uploading securely…" : "Upload document"}</Button>{commonFormError}</div>
          </form>
        </Panel>}
        {data.documents.filter((x) => !x.legacy).length > 0 && <Panel title="Uploaded documents" aside={<span className="muted">Each published item is served through an authorized download route.</span>}>
          <div className="document-list">{data.documents.filter((x) => !x.legacy).map((x) => <article className="document-card" key={x.id}>
            <div className="document-icon">{x.mime_type === "application/pdf" ? "PDF" : "DOCX"}</div>
            <div className="document-copy"><div className="document-title"><b>{x.title}</b><Pill tone={x.published ? "green" : "amber"}>{x.status}</Pill></div>
              <div className="muted">{x.category} · v{x.version} · updated {showTime(x.updated_at || x.created_at)}</div>
              <div className="muted">{x.original_filename} · {(Number(x.file_size || 0) / (1024 * 1024)).toFixed(2)} MB{x.author_name ? ` · uploaded by ${x.author_name}` : ""}</div>
              {x.description && <p>{x.description}</p>}
            </div>
            <div className="document-actions">{x.mime_type === "application/pdf" && <a className="button" href={`/api/documents/${x.id}/preview`} target="_blank" rel="noreferrer">Preview</a>}
              <a className="button" href={`/api/documents/${x.id}/download`}>Download</a>
              {(user.role === "admin" || user.role === "hr_manager") && x.status !== "Replaced" && <><Button onClick={() => { const title = document.getElementById("title"); const category = document.getElementById("category"); if (title) title.value = x.title; if (category) category.value = x.category; document.getElementById("document-upload")?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById("policy-file")?.click(); }}>Replace</Button><Button onClick={() => confirmDocumentAction(x, x.published ? "unpublish" : "publish")}>{x.published ? "Unpublish" : "Publish"}</Button></>}
            </div>
          </article>)}</div>
        </Panel>}
        {data.documents.filter((x) => x.legacy).length > 0 && <Panel title="Archived text policies" aside={<span className="muted">Existing policy notes are preserved. Upload a PDF/DOCX to create a versioned replacement.</span>}>
          {data.documents.filter((x) => x.legacy).map((x) => <article className="legacy-policy" key={x.id}><div><b>{x.title}</b><div className="muted">{x.category} · last updated {showTime(x.created_at)}</div></div><p>{x.body}</p></article>)}
        </Panel>}
        {!data.documents.length && <Empty>No documents published yet.</Empty>}
      </>
    );
  if (page === "Audit log")
    return (
      <>
        <Header
          tag="SECURITY"
          title="Audit log"
          description="Administrative actions and decisions."
        />
        <Panel title="Latest audit entries">
          <EventList
            rows={data.logs.map((x) => ({
              title: `${x.name || "System"} · ${x.action}`,
              detail: `${x.entity} · ${showTime(x.created_at)} · ${x.details}`,
            }))}
          />
        </Panel>
      </>
    );
  if (page === "My attendance") {
    const current = data.attendance.find((x) => x.work_date === today());
    return (
      <>
        <Header
          tag="ATTENDANCE"
          title="My attendance"
          description="Your shift history and activity log."
        />
        <Panel title="Today’s shift">
          <div className="attendance-box">
            <div>
              <b>
                {current?.status === "in"
                  ? "Clocked in"
                  : current
                    ? "Shift paused"
                    : "Not started"}
              </b>
              <div className="timer">{elapsed(current)}</div>
            </div>
            <Button primary onClick={() => action("clock")}>
              {!current
                ? "Clock in"
                : current.status === "in"
                  ? "Clock out"
                  : "Resume shift"}
            </Button>
          </div>
        </Panel>
        <Panel title="Shift records">
          <DataTable columns={["Date", "Segments", "Status"]}>
            {data.attendance.map((x) => (
              <tr key={x.id}>
                <td>{x.work_date}</td>
                <td>
                  {JSON.parse(x.segments).map((s) => (
                    <div key={s.start}>
                      {showTime(s.start)} → {s.end ? showTime(s.end) : "now"}
                    </div>
                  ))}
                </td>
                <td>{x.status}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        <Panel title="Activity log">
          <EventList
            rows={data.logs.map((x) => ({
              title: x.action,
              detail: `${showTime(x.created_at)} · ${x.details}`,
            }))}
          />
        </Panel>
      </>
    );
  }
  if (page === "My leave & requests")
    return (
      <>
        <Header
          tag="REQUESTS"
          title="Leave & HR requests"
          description="Requests are sent to Admin for approval."
        />
        <Panel title="Submit a request">
          <form data-form="request" className="form-grid" onSubmit={saveForm}>
            <SelectField
              name="kind"
              label="Type"
              options={[
                "Leave",
                "Attendance correction",
                "Profile change",
                "Work arrangement",
                "Expense reimbursement",
                "Other HR request",
              ].map((x) => [x, x])}
            />
            <SelectField
              name="leave_type"
              label="Leave rule"
              options={data.rules.map((x) => [x.name, x.name])}
            />
            <Field
              name="start_date"
              label="From"
              type="date"
              required={false}
            />
            <Field name="end_date" label="To" type="date" required={false} />
            <Field
              name="days"
              label="Days"
              type="number"
              required={false}
              min="0.5"
              step="0.5"
              defaultValue="1"
            />
            <div className="field full">
              <label htmlFor="details">Reason / details</label>
              <textarea id="details" name="details" required />
              <Button primary>Send to Admin</Button>
              {commonFormError}
            </div>
          </form>
        </Panel>
        <Panel title="Request history">
          <DataTable columns={["Type", "Details", "Dates", "Status"]}>
            {data.requests.map((x) => (
              <tr key={x.id}>
                <td>{x.kind}</td>
                <td>{x.details}</td>
                <td>
                  {x.start_date || "—"} {x.end_date || ""}
                </td>
                <td>
                  <Pill
                    tone={
                      x.status === "Approved"
                        ? "green"
                        : x.status === "Rejected"
                          ? "red"
                          : "amber"
                    }
                  >
                    {x.status}
                  </Pill>
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </>
    );
  if (page === "My profile")
    return (
      <>
        <Header
          tag="PROFILE"
          title="My profile"
          description="Update your contact information and securely manage your payment details."
        />
        <Panel
          title={`${data.profile.name} · ${data.profile.title || "Employee"}`}
        >
          <p>
            {data.profile.employee_code || "Employee ID pending"} · {data.profile.department} · {data.profile.location} · Joined {data.profile.start_date || "—"}
          </p>
          <form key={`${data.profile.user_id}:${data.profile.profile_updated_at || ""}`} data-form="profile" className="form-grid" onSubmit={saveForm}>
            <Field
              name="phone"
              label="Phone"
              type="tel"
              required={false}
              defaultValue={data.profile.phone ?? ""}
            />
            <Field
              name="emergency_contact"
              label="Emergency contact"
              required={false}
              defaultValue={data.profile.emergency_contact ?? ""}
            />
            <Field name="address" label="Residential address" required={false} defaultValue={data.profile.address ?? ""} />
            <Field name="date_of_birth" label="Date of birth" type="date" required={false} defaultValue={data.profile.date_of_birth ?? ""} />
            <Button primary>Save contact info</Button>
            {commonFormError}
          </form>
        </Panel>
        <Panel title="Payment details">
          <p>Encrypted at rest · Current account: {data.bank?.account_number_masked || "Not added"} · <Pill tone={data.bank?.status === "Verified" ? "green" : data.bank?.status === "Changes Requested" ? "red" : "amber"}>{data.bank?.status || "Not submitted"}</Pill></p>
          {data.bank?.updated_at && <p className="muted">Submitted {data.bank.submitted_at ? showTime(data.bank.submitted_at) : "—"} · Verified {data.bank.verified_at ? showTime(data.bank.verified_at) : "—"} · Last modified {showTime(data.bank.updated_at)}</p>}
          {data.bank?.review_note && <p className="error">Admin note: {data.bank.review_note}</p>}
          <p className="muted">Changes are sent to Payroll/Admin for verification. Your account number is not shown after saving.</p>
          <form data-form="bank" className="form-grid" onSubmit={saveForm}>
            <Field name="account_holder" label="Account holder" />
            <Field name="bank_name" label="Bank name" />
            <Field
              name="account_number"
              label="Account number"
              type="password"
            />
            <Field name="account_number_confirm" label="Confirm account number" type="password" />
            <Field name="ifsc" label="IFSC" />
            <Field name="branch_name" label="Branch name" required={false} />
            <SelectField name="account_type" label="Account type" required={false} options={[["Savings","Savings"],["Current","Current"],["Other","Other"]]} />
            <Field name="upi_id" label="UPI ID (optional)" required={false} />
            <div className="field full">
              <Button primary>Save encrypted bank details</Button>
              {commonFormError}
            </div>
          </form>
        </Panel>
      </>
    );
  return <Empty />;
}

function EventList({ rows }) {
  return (
    <div className="event-list">
      {rows.map((r, i) => (
        <div className="event" key={i}>
          <div className="event-mark">≡</div>
          <div>
            <b>{r.title}</b>
            <small>{r.detail}</small>
          </div>
        </div>
      ))}
      {!rows.length && <Empty />}
    </div>
  );
}
function EmployeeOverview({ user, data, onClock, tick, toast }) {
  const record = data.attendance;
  const status = record?.status;
  return (
    <>
      <Header
        tag="EMPLOYEE WORKSPACE"
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Your workday at a glance."
      />
      <div className="banner">
        <b>Shift · 10:00 AM–7:00 PM IST</b>
        <p>
          Lunch 1:00–1:45 PM · Tea 4:00–4:15 PM. Your clock actions are
          recorded.
        </p>
      </div>
      <Panel title="Shift clock">
        <div className="attendance-box">
          <div>
            <div>
              {status === "in"
                ? "Clocked in"
                : record
                  ? "Shift paused"
                  : "Ready to start"}
            </div>
            <div className="timer">{elapsed(record)}</div>
            <small>Timer excludes scheduled lunch and tea breaks.</small>
          </div>
          <Button primary onClick={onClock}>
            {!record
              ? "Clock in"
              : status === "in"
                ? "Clock out"
                : "Resume shift"}
          </Button>
        </div>
        <div className="schedule">
          <span>
            <b>10:00 AM</b>Clock in
          </span>
          <span>
            <b>1:00–1:45 PM</b>Lunch
          </span>
          <span>
            <b>4:00–4:15 PM</b>Tea
          </span>
          <span>
            <b>7:00 PM</b>Clock out
          </span>
        </div>
      </Panel>
      <div className="grid-two">
        <Panel title="My tasks">
          <div className="rows">
            {data.tasks.slice(0, 4).map((t) => (
              <div className="row" key={t.id}>
                <div className="row-copy">
                  <b>{t.title}</b>
                  <span>Due {t.due_date || "—"}</span>
                </div>
                <Pill>{t.status}</Pill>
              </div>
            ))}
          </div>
          {!data.tasks.length && <Empty>No tasks assigned yet.</Empty>}
        </Panel>
        <Panel title="Company updates">
          <div className="rows">
            {data.updates.slice(0, 4).map((u) => (
              <div className="row" key={u.id}>
                <div className="row-copy">
                  <b>{u.title}</b>
                  <span>{u.body}</span>
                </div>
              </div>
            ))}
          </div>
          {!data.updates.length && <Empty>No updates yet.</Empty>}
        </Panel>
      </div>
      <Panel title="Notifications">
        <EventList
          rows={(data.notifications || []).map((n) => ({
            title: n.title,
            detail: `${showTime(n.created_at)} · ${n.body}`,
          }))}
        />
      </Panel>
      {data.logs.length > 0 && (
        <Panel title="Recent activity">
          <EventList
            rows={data.logs
              .slice(0, 5)
              .map((x) => ({
                title: x.action,
                detail: `${showTime(x.created_at)} · ${x.details}`,
              }))}
          />
        </Panel>
      )}
    </>
  );
}

function CalendarPage({
  data,
  user,
  month,
  setMonth,
  selectedDate,
  setSelectedDate,
  saveForm,
  formError,
}) {
  const year = month.getFullYear(),
    m = month.getMonth(),
    offset = new Date(year, m, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, m, 1 - offset + i),
      key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(d),
      events = data.events.filter(
        (x) => key >= x.start_date && key <= x.end_date,
      );
    return (
      <button
        key={i}
        className={`cal-day ${d.getMonth() !== m ? "outside" : ""} ${key === today() ? "today" : ""} ${key === selectedDate ? "selected" : ""}`}
        onClick={() => setSelectedDate(key)}
      >
        {d.getDate()}
        {events.map((x) => (
          <span className={`cal-event ${x.kind}`} key={x.id}>
            {x.title}
          </span>
        ))}
      </button>
    );
  });
  return (
    <>
      <Header
        tag="TEAM DATES"
        title="Calendar"
        description="Company events and approved leave."
      />
      {user.role === "admin" && (
        <Panel title="Add calendar event">
          <form data-form="event" className="form-grid" onSubmit={saveForm}>
            <Field name="title" label="Event title" />
            <SelectField
              name="kind"
              label="Type"
              options={[
                ["event", "Event"],
                ["holiday", "Holiday"],
              ]}
            />
            <Field name="start_date" label="From" type="date" />
            <Field name="end_date" label="To" type="date" required={false} />
            <Button primary>Add event</Button>
            {formError}
          </form>
        </Panel>
      )}
      <Panel
        title={month.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        })}
        aside={
          <>
            <Button onClick={() => setMonth(new Date(year, m - 1, 1))}>
              ‹
            </Button>{" "}
            <Button
              onClick={() => {
                setMonth(new Date());
                setSelectedDate(today());
              }}
            >
              Today
            </Button>{" "}
            <Button onClick={() => setMonth(new Date(year, m + 1, 1))}>
              ›
            </Button>
          </>
        }
      >
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => (
            <div className="cal-head" key={x}>
              {x}
            </div>
          ))}
          {cells}
        </div>
        <div className="event-list">
          {data.events
            .filter(
              (x) => selectedDate >= x.start_date && selectedDate <= x.end_date,
            )
            .map((x) => (
              <div className="event" key={x.id}>
                <b>{x.title}</b>
              </div>
            ))}
        </div>
        {!data.events.some(
          (x) => selectedDate >= x.start_date && selectedDate <= x.end_date,
        ) && <Empty>No events on the selected date.</Empty>}
      </Panel>
    </>
  );
}

function numberToWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return "Zero Rupees Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function convertChunk(val) {
    let s = "";
    if (val >= 100) {
      s += ones[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val >= 20) {
      s += tens[Math.floor(val / 10)] + (val % 10 !== 0 ? " " + ones[val % 10] : "");
    } else if (val > 0) {
      s += ones[val];
    }
    return s.trim();
  }
  let crore = Math.floor(n / 10000000);
  let lakh = Math.floor((n % 10000000) / 100000);
  let thousand = Math.floor((n % 100000) / 1000);
  let hundred = n % 1000;
  let res = "";
  if (crore > 0) res += convertChunk(crore) + " Crore ";
  if (lakh > 0) res += convertChunk(lakh) + " Lakh ";
  if (thousand > 0) res += convertChunk(thousand) + " Thousand ";
  if (hundred > 0) res += convertChunk(hundred);
  return (res.trim() || "Zero") + " Rupees Only";
}

const PAYSLIP_BUILDER_CSS = `
.payslip-page-wrapper {
  max-width: 860px;
  margin: 0 auto 40px auto;
}
.payroll-tab-nav {
  display: flex;
  gap: 10px;
  margin-bottom: 22px;
  background: #edf2f7;
  padding: 5px;
  border-radius: 10px;
  width: fit-content;
}
.payroll-tab-btn {
  border: none;
  background: transparent;
  padding: 8px 18px;
  font-size: 12px;
  font-weight: 600;
  color: #4a5568;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.payroll-tab-btn.active {
  background: #ffffff;
  color: #1a202c;
  box-shadow: 0 2px 6px rgba(0,0,0,0.07);
}
.payslip-canvas-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  padding: 36px 44px;
  color: #2d3748;
  font-family: inherit;
}
.payslip-canvas-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.payslip-logo-uploader {
  display: flex;
  align-items: center;
  gap: 16px;
}
.payslip-upload-box {
  width: 110px;
  height: 70px;
  border: 1.5px dashed #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #3b82f6;
  font-size: 11px;
  font-weight: 600;
  transition: border-color 0.2s, background 0.2s;
  position: relative;
  overflow: hidden;
}
.payslip-upload-box:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}
.payslip-upload-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.payslip-upload-meta h4 {
  margin: 0 0 4px 0;
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}
.payslip-upload-meta p {
  margin: 0;
  font-size: 10px;
  color: #94a3b8;
  line-height: 1.4;
}
.payslip-month-meta {
  text-align: right;
}
.payslip-month-meta .meta-label {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 2px;
}
.payslip-month-meta .meta-val {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}
.payslip-company-inputs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 320px;
  margin-bottom: 30px;
}
.payslip-seamless-input {
  border: none;
  background: transparent;
  padding: 4px 6px;
  font-size: 12px;
  color: #334155;
  outline: none;
  border-radius: 4px;
  transition: all 0.15s ease;
}
.payslip-seamless-input::placeholder {
  color: #94a3b8;
}
.payslip-seamless-input:hover {
  background: #f8fafc;
}
.payslip-seamless-input:focus {
  background: #ffffff;
  box-shadow: 0 0 0 1.5px #60a5fa;
}
.company-name-input {
  font-size: 13.5px;
  font-weight: 600;
  border: 1px solid #bfdbfe;
  background: #f8fafc;
  color: #1e293b;
}
.payslip-section-heading {
  font-size: 12.5px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.payslip-section-heading .req-star {
  color: #ef4444;
}
.payslip-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 36px;
  row-gap: 12px;
  margin-bottom: 14px;
}
.payslip-summary-row {
  display: grid;
  grid-template-columns: 140px 10px 1fr;
  align-items: center;
  font-size: 11.5px;
}
.payslip-summary-row .label-col {
  color: #475569;
  font-weight: 500;
}
.payslip-summary-row .colon-col {
  color: #94a3b8;
}
.payslip-summary-row .input-col {
  display: flex;
  align-items: center;
  position: relative;
}
.payslip-summary-row input, .payslip-summary-row select {
  width: 100%;
  border: none;
  border-bottom: 1px dotted #cbd5e1;
  background: transparent;
  padding: 4px 6px;
  font-size: 11.5px;
  color: #1e293b;
  outline: none;
  border-radius: 0;
}
.payslip-summary-row input:focus, .payslip-summary-row select:focus {
  border-bottom: 1.5px solid #3b82f6;
  background: #f8fafc;
}
.payslip-action-btn-sm {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  cursor: pointer;
  margin-bottom: 24px;
}
.payslip-action-btn-sm:hover {
  text-decoration: underline;
}
.payslip-income-tables {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 22px;
}
.payslip-col-table {
  display: flex;
  flex-direction: column;
}
.payslip-col-table.deductions-col {
  border-left: 1px solid #e2e8f0;
}
.payslip-table-head {
  display: flex;
  justify-content: space-between;
  background: #f8fafc;
  padding: 8px 14px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}
.payslip-table-body {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 110px;
}
.payslip-line-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.payslip-line-name-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 11.5px;
  color: #334155;
  outline: none;
  padding: 3px 0;
}
.payslip-line-name-input:focus {
  border-bottom: 1px solid #94a3b8;
}
.payslip-line-amt-input {
  width: 90px;
  text-align: right;
  border: none;
  background: transparent;
  font-size: 11.5px;
  font-weight: 600;
  color: #1e293b;
  outline: none;
  padding: 3px 0;
}
.payslip-line-amt-input:focus {
  border-bottom: 1px solid #94a3b8;
}
.payslip-del-row-btn {
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0 3px;
  font-size: 13px;
  line-height: 1;
}
.payslip-del-row-btn:hover {
  color: #ef4444;
}
.payslip-table-footer {
  margin-top: auto;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11.5px;
  font-weight: 600;
  color: #1e293b;
}
.payslip-net-payable-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 14px;
}
.net-payable-details {
  padding: 14px 18px;
}
.net-payable-details h3 {
  margin: 0 0 3px 0;
  font-size: 13.5px;
  font-weight: 700;
  color: #1e293b;
}
.net-payable-details p {
  margin: 0;
  font-size: 10.5px;
  color: #64748b;
}
.net-payable-amount {
  background: #f8fafc;
  padding: 18px 28px;
  border-left: 1px solid #e2e8f0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  min-width: 140px;
  text-align: right;
}
.payslip-words-row {
  text-align: right;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 30px;
}
.payslip-btn-toolbar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  margin-top: 24px;
}
.btn-generate-red {
  background: #e04538;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 10px 24px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(224, 69, 56, 0.2);
  transition: background 0.15s ease;
}
.btn-generate-red:hover {
  background: #c8382c;
}
.btn-reset-white {
  background: #ffffff;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 9px 20px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.btn-reset-white:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}
@media(max-width: 720px) {
  .payslip-canvas-card {
    padding: 20px 16px;
  }
  .payslip-canvas-header {
    flex-direction: column;
    gap: 16px;
  }
  .payslip-month-meta {
    text-align: left;
  }
  .payslip-summary-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .payslip-income-tables {
    grid-template-columns: 1fr;
  }
  .payslip-col-table.deductions-col {
    border-left: none;
    border-top: 1px solid #e2e8f0;
  }
}
`;

function PayslipBuilder({ employees = [], toast }) {
  const [logo, setLogo] = useState(null);
  const [companyName, setCompanyName] = useState("Macrow Digital");
  const [companyAddress, setCompanyAddress] = useState("Company Address");
  const [cityPincode, setCityPincode] = useState("City, Pincode");
  const [country, setCountry] = useState("India");

  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [employeeName, setEmployeeName] = useState("Meera Krishnan");
  const [employeeId, setEmployeeId] = useState("1234");
  const [payPeriod, setPayPeriod] = useState("2026-10");
  const [eligibleDays, setEligibleDays] = useState("22");
  const [lossOfPayDays, setLossOfPayDays] = useState("0");
  const [payDate, setPayDate] = useState("2026-10-01");
  const [customFields, setCustomFields] = useState([]);

  const [earnings, setEarnings] = useState([
    { id: 1, name: "Basic", amount: 0 },
    { id: 2, name: "House Rent Allowance", amount: 0 },
  ]);

  const [deductions, setDeductions] = useState([
    { id: 1, name: "Income Tax", amount: 0 },
    { id: 2, name: "Provident Fund", amount: 0 },
  ]);

  const handleEmployeeSelect = (e) => {
    const uid = e.target.value;
    setSelectedEmpId(uid);
    if (!uid) return;
    const emp = employees.find((x) => x.id === uid);
    if (emp) {
      setEmployeeName(emp.name);
      setEmployeeId(emp.employee_code || emp.id.slice(0, 6));
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      if (toast) toast("Logo must be 1MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const addCustomField = () => {
    const fieldName = window.prompt("Enter new field name (e.g. Bank Account, PAN No, Designation):");
    if (!fieldName) return;
    setCustomFields((prev) => [...prev, { id: Date.now(), label: fieldName, value: "" }]);
  };

  const addEarning = () => {
    const name = window.prompt("Earning component name (e.g., Special Allowance, Bonus, Conveyance):");
    if (!name) return;
    setEarnings((prev) => [...prev, { id: Date.now(), name, amount: 0 }]);
  };

  const addDeduction = () => {
    const name = window.prompt("Deduction component name (e.g., Professional Tax, ESI):");
    if (!name) return;
    setDeductions((prev) => [...prev, { id: Date.now(), name, amount: 0 }]);
  };

  const handleReset = () => {
    setLogo(null);
    setCompanyName("Macrow Digital");
    setCompanyAddress("Company Address");
    setCityPincode("City, Pincode");
    setCountry("India");
    setSelectedEmpId("");
    setEmployeeName("Meera Krishnan");
    setEmployeeId("1234");
    setPayPeriod("2026-10");
    setEligibleDays("22");
    setLossOfPayDays("0");
    setPayDate("2026-10-01");
    setCustomFields([]);
    setEarnings([
      { id: 1, name: "Basic", amount: 0 },
      { id: 2, name: "House Rent Allowance", amount: 0 },
    ]);
    setDeductions([
      { id: 1, name: "Income Tax", amount: 0 },
      { id: 2, name: "Provident Fund", amount: 0 },
    ]);
    if (toast) toast("Payslip form reset to default.");
  };

  const totalGross = earnings.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalDeductions = deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalNetPayable = Math.max(0, totalGross - totalDeductions);
  const payrollDays = calculatePayrollDays(eligibleDays, lossOfPayDays);
  const paidDaySummary = payrollDays.valid ? payrollDays.paidDays.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—";

  const formattedPeriod = useMemo(() => {
    if (!payPeriod) return "October 2026";
    try {
      const [y, m] = payPeriod.split("-");
      const d = new Date(Date.UTC(+y, +m - 1, 1));
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    } catch {
      return payPeriod;
    }
  }, [payPeriod]);

  const handleGeneratePayslip = () => {
    const dayCount = calculatePayrollDays(eligibleDays, lossOfPayDays);
    if (!dayCount.valid) {
      if (toast) toast(dayCount.error);
      return;
    }
    const paidDays = dayCount.paidDays.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    const win = window.open("about:blank", "_blank");
    if (!win) {
      if (toast) toast("Please allow pop-ups to print or view payslip.");
      return;
    }
    const pdfFileName = `${(employeeName || "Employee").replace(/\s+/g, "_")}_Payslip_${payPeriod}.pdf`;
    win.document.write(`
      <!doctype html><html><head><meta charset="utf-8"><title>${esc(companyName)} Payslip - ${esc(formattedPeriod)}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <style>
        body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#1e293b;background:#f8fafc;margin:0;padding:24px}
        .container{max-width:820px;margin:0 auto;background:#fff;padding:40px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.06)}
        .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:18px;margin-bottom:24px}
        .logo-wrap{display:flex;align-items:center;gap:16px}
        .logo-img{max-height:60px;max-width:140px;object-fit:contain}
        .company-meta h2{margin:0 0 4px;font-size:18px;color:#0f172a}
        .company-meta p{margin:0;font-size:12px;color:#64748b;line-height:1.4}
        .period-box{text-align:right}
        .period-box small{font-size:11px;color:#64748b}
        .period-box h3{margin:4px 0 0;font-size:18px;color:#0f172a}
        .summary-sec{display:grid;grid-template-columns:1fr 1fr;gap:12px 30px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;font-size:12px}
        .sec-row{display:flex;justify-content:space-between;border-bottom:1px dashed #cbd5e1;padding-bottom:4px}
        .sec-row span{color:#64748b}
        .sec-row strong{color:#0f172a}
        .income-table{width:100%;border-collapse:collapse;margin-bottom:20px}
        .income-table th,.income-table td{border:1px solid #e2e8f0;padding:10px 14px;font-size:12px;text-align:left}
        .income-table th{background:#f1f5f9;color:#334155;font-size:11px;text-transform:uppercase}
        .income-table .amt{text-align:right}
        .net-card{display:flex;justify-content:space-between;align-items:center;background:#172235;color:#fff;border-radius:8px;padding:16px 22px;margin:24px 0}
        .net-card h3{margin:0;font-size:15px}
        .net-card .amt{font-size:22px;font-weight:700;color:#38bdf8}
        .words{text-align:right;font-size:11.5px;color:#64748b;margin-bottom:28px}
        .actions{display:flex;justify-content:flex-end;gap:10px;margin-bottom:16px}
        .btn{padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:none}
        .btn-print{background:#e2e8f0;color:#1e293b}
        .btn-dl{background:#e04538;color:#fff}
        @media print{ .actions{display:none} body{background:#fff;padding:0} .container{box-shadow:none;border-radius:0;padding:10mm} }
      </style>
      </head><body>
      <div class="actions">
        <button class="btn btn-print" id="btn-print">🖨️ Print</button>
        <button class="btn btn-dl" id="btn-dl">⬇️ Download PDF</button>
      </div>
      <div class="container" id="pdf-container">
        <div class="header">
          <div class="logo-wrap">
            ${logo ? `<img class="logo-img" src="${logo}" alt="Logo" />` : ""}
            <div class="company-meta">
              <h2>${esc(companyName)}</h2>
              <p>${esc(companyAddress)}<br/>${esc(cityPincode)}, ${esc(country)}</p>
            </div>
          </div>
          <div class="period-box">
            <small>Payslip For the Month</small>
            <h3>${esc(formattedPeriod)}</h3>
          </div>
        </div>
        <div class="summary-sec">
          <div class="sec-row"><span>Employee Name</span><strong>${esc(employeeName)}</strong></div>
          <div class="sec-row"><span>Employee ID</span><strong>${esc(employeeId)}</strong></div>
          <div class="sec-row"><span>Pay Period</span><strong>${esc(formattedPeriod)}</strong></div>
          <div class="sec-row"><span>Paid Days</span><strong>${esc(paidDays)}</strong></div>
          <div class="sec-row"><span>Loss of Pay Days</span><strong>${esc(lossOfPayDays)}</strong></div>
          <div class="sec-row"><span>Pay Date</span><strong>${esc(payDate)}</strong></div>
          ${customFields.map((f) => `<div class="sec-row"><span>${esc(f.label)}</span><strong>${esc(f.value || "—")}</strong></div>`).join("")}
        </div>
        <table class="income-table">
          <thead>
            <tr><th>Earnings</th><th class="amt">Amount (₹)</th><th>Deductions</th><th class="amt">Amount (₹)</th></tr>
          </thead>
          <tbody>
            ${Array.from({ length: Math.max(earnings.length, deductions.length) }).map((_, i) => {
              const eItem = earnings[i];
              const dItem = deductions[i];
              return `<tr>
                <td>${eItem ? esc(eItem.name) : ""}</td>
                <td class="amt">${eItem ? Number(eItem.amount || 0).toLocaleString("en-IN") : ""}</td>
                <td>${dItem ? esc(dItem.name) : ""}</td>
                <td class="amt">${dItem ? Number(dItem.amount || 0).toLocaleString("en-IN") : ""}</td>
              </tr>`;
            }).join("")}
            <tr style="background:#f8fafc;font-weight:bold">
              <td>Gross Earnings</td>
              <td class="amt">₹${totalGross.toLocaleString("en-IN")}</td>
              <td>Total Deductions</td>
              <td class="amt">₹${totalDeductions.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
        <div class="net-card">
          <div>
            <h3>Total Net Payable</h3>
            <small style="color:#cbd5e1">Gross Earnings - Total Deductions</small>
          </div>
          <div class="amt">₹${totalNetPayable.toLocaleString("en-IN")}</div>
        </div>
        <div class="words">Amount in words : <b>${esc(numberToWords(totalNetPayable))}</b></div>
      </div>
      <script>
        document.getElementById('btn-print').addEventListener('click', function() {
          window.print();
        });
        document.getElementById('btn-dl').addEventListener('click', function() {
          var btn = document.getElementById('btn-dl');
          btn.innerText = 'Generating…';
          btn.disabled = true;
          var el = document.getElementById('pdf-container');
          function finish() {
            btn.innerText = '⬇️ Download PDF';
            btn.disabled = false;
          }
          if (window.html2pdf) {
            html2pdf().set({
              margin: 10,
              filename: '${pdfFileName}',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(el).save().then(finish).catch(function() {
              finish();
              window.print();
            });
          } else {
            finish();
            window.print();
          }
        });
      </script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="payslip-page-wrapper">
      <style>{PAYSLIP_BUILDER_CSS}</style>
      <div className="payslip-canvas-card">
        {/* Top Header with Logo Uploader and Month Tag */}
        <div className="payslip-canvas-header">
          <div className="payslip-logo-uploader">
            <label className="payslip-upload-box">
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleLogoUpload}
              />
              {logo ? (
                <img src={logo} alt="Uploaded logo" />
              ) : (
                <>
                  <span style={{ fontSize: "16px", marginBottom: "2px" }}>⇪</span>
                  <span>Upload</span>
                </>
              )}
            </label>
            <div className="payslip-upload-meta">
              <h4>Upload Logo</h4>
              <p>
                240 x 240 pixels @ 72 DPI,<br />
                Maximum size of 1MB.
              </p>
            </div>
          </div>
          <div className="payslip-month-meta">
            <div className="meta-label">Payslip For the Month</div>
            <div className="meta-val">{formattedPeriod}</div>
          </div>
        </div>

        {/* Company Address Block */}
        <div className="payslip-company-inputs">
          <input
            className="payslip-seamless-input company-name-input"
            value={companyName}
            placeholder="Company Name*"
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <input
            className="payslip-seamless-input"
            value={companyAddress}
            placeholder="Company Address"
            onChange={(e) => setCompanyAddress(e.target.value)}
          />
          <input
            className="payslip-seamless-input"
            value={cityPincode}
            placeholder="City, Pincode"
            onChange={(e) => setCityPincode(e.target.value)}
          />
          <input
            className="payslip-seamless-input"
            value={country}
            placeholder="Country"
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        {/* Employee Pay Summary */}
        <div className="payslip-section-heading">
          Employee Pay Summary <span className="req-star">*</span>
        </div>

        {employees.length > 0 && (
          <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Quick autofill from employee directory:</span>
            <select
              style={{ fontSize: "11.5px", padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
              value={selectedEmpId}
              onChange={handleEmployeeSelect}
            >
              <option value="">Select an employee…</option>
              {employees.map((em) => (
                <option key={em.id} value={em.id}>{em.name} ({em.employee_code || em.title || "Employee"})</option>
              ))}
            </select>
          </div>
        )}

        <div className="payslip-summary-grid">
          {/* Col 1 */}
          <div className="payslip-summary-row">
            <span className="label-col">Employee Name</span>
            <span className="colon-col">:</span>
            <div className="input-col">
              <input
                placeholder="Eg: Meera Krishnan"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
              />
            </div>
          </div>
          {/* Col 2 */}
          <div className="payslip-summary-row">
            <span className="label-col">Employee ID</span>
            <span className="colon-col">:</span>
            <div className="input-col">
              <input
                placeholder="Eg: 1234"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="payslip-summary-row">
            <span className="label-col">Pay Period</span>
            <span className="colon-col">:</span>
            <div className="input-col" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="month"
                value={payPeriod}
                onChange={(e) => setPayPeriod(e.target.value)}
                style={{ fontWeight: "600" }}
              />
            </div>
          </div>
          <div className="payslip-summary-row">
            <span className="label-col">Eligible Days</span>
            <span className="colon-col">:</span>
            <div className="input-col">
              <input
                type="number"
                placeholder="Eg: 22"
                min="0"
                step="0.5"
                value={eligibleDays}
                onChange={(e) => setEligibleDays(e.target.value)}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="payslip-summary-row">
            <span className="label-col">Loss of Pay Days</span>
            <span className="colon-col">:</span>
            <div className="input-col">
              <input
                type="number"
                placeholder="0"
                min="0"
                max={eligibleDays || undefined}
                step="0.5"
                value={lossOfPayDays}
                onChange={(e) => setLossOfPayDays(e.target.value)}
              />
            </div>
          </div>
          <div className="payslip-summary-row">
            <span className="label-col">Pay Date</span>
            <span className="colon-col">:</span>
            <div className="input-col" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                style={{ fontWeight: "600" }}
              />
            </div>
          </div>
          <div className="payslip-summary-row day-count-output" aria-live="polite">
            <span className="label-col">Paid Days</span>
            <span className="colon-col">:</span>
            <div className="input-col"><output>{paidDaySummary}</output></div>
          </div>

          {/* Dynamic custom fields */}
          {customFields.map((f, idx) => (
            <div key={f.id} className="payslip-summary-row">
              <span className="label-col">{f.label}</span>
              <span className="colon-col">:</span>
              <div className="input-col">
                <input
                  placeholder="Value"
                  value={f.value}
                  onChange={(e) => {
                    const next = [...customFields];
                    next[idx].value = e.target.value;
                    setCustomFields(next);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <button className="payslip-action-btn-sm" type="button" onClick={addCustomField}>
          <span style={{ fontSize: "14px", lineHeight: "1" }}>⊕</span> Add another field
        </button>

        {/* Income Details */}
        <div className="payslip-section-heading">
          Income Details <span className="req-star">*</span>
        </div>

        <div className="payslip-income-tables">
          {/* Earnings column */}
          <div className="payslip-col-table">
            <div className="payslip-table-head">
              <span>Earnings</span>
              <span>Amount</span>
            </div>
            <div className="payslip-table-body">
              {earnings.map((item, idx) => (
                <div key={item.id} className="payslip-line-item">
                  <input
                    className="payslip-line-name-input"
                    value={item.name}
                    onChange={(e) => {
                      const next = [...earnings];
                      next[idx].name = e.target.value;
                      setEarnings(next);
                    }}
                  />
                  <input
                    type="number"
                    className="payslip-line-amt-input"
                    value={item.amount}
                    onChange={(e) => {
                      const next = [...earnings];
                      next[idx].amount = Number(e.target.value) || 0;
                      setEarnings(next);
                    }}
                  />
                  {earnings.length > 1 && (
                    <button
                      type="button"
                      className="payslip-del-row-btn"
                      title="Remove earning"
                      onClick={() => setEarnings(earnings.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="payslip-action-btn-sm"
                style={{ marginTop: "4px", marginBottom: "0" }}
                onClick={addEarning}
              >
                <span style={{ fontSize: "14px", lineHeight: "1" }}>⊕</span> Add Earnings
              </button>
            </div>
            <div className="payslip-table-footer">
              <span>Gross Earnings</span>
              <span>₹{totalGross.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Deductions column */}
          <div className="payslip-col-table deductions-col">
            <div className="payslip-table-head">
              <span>Deductions</span>
              <span>Amount</span>
            </div>
            <div className="payslip-table-body">
              {deductions.map((item, idx) => (
                <div key={item.id} className="payslip-line-item">
                  <input
                    className="payslip-line-name-input"
                    value={item.name}
                    onChange={(e) => {
                      const next = [...deductions];
                      next[idx].name = e.target.value;
                      setDeductions(next);
                    }}
                  />
                  <input
                    type="number"
                    className="payslip-line-amt-input"
                    value={item.amount}
                    onChange={(e) => {
                      const next = [...deductions];
                      next[idx].amount = Number(e.target.value) || 0;
                      setDeductions(next);
                    }}
                  />
                  {deductions.length > 1 && (
                    <button
                      type="button"
                      className="payslip-del-row-btn"
                      title="Remove deduction"
                      onClick={() => setDeductions(deductions.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="payslip-action-btn-sm"
                style={{ marginTop: "4px", marginBottom: "0" }}
                onClick={addDeduction}
              >
                <span style={{ fontSize: "14px", lineHeight: "1" }}>⊕</span> Add Deductions
              </button>
            </div>
            <div className="payslip-table-footer">
              <span>Total Deductions</span>
              <span>₹{totalDeductions.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Total Net Payable Box */}
        <div className="payslip-net-payable-box">
          <div className="net-payable-details">
            <h3>Total Net Payable</h3>
            <p>Gross Earnings - Total Deductions</p>
          </div>
          <div className="net-payable-amount">
            ₹{totalNetPayable.toLocaleString("en-IN")}
          </div>
        </div>

        <div className="payslip-words-row">
          Amount in words : <span style={{ fontWeight: 600, color: "#334155" }}>{numberToWords(totalNetPayable)}</span>
        </div>

        {/* Buttons Toolbar */}
        <div className="payslip-btn-toolbar">
          <button type="button" className="btn-generate-red" onClick={handleGeneratePayslip}>
            Generate Payslip
          </button>
          <button type="button" className="btn-reset-white" onClick={handleReset}>
            <span style={{ fontSize: "14px" }}>↺</span> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

async function downloadPayslip(id, toast) {
  const win = window.open("about:blank", "_blank");
  if (!win) {
    toast("Allow pop-ups to print your payslip.");
    return;
  }
  try {
    const { payslip: p } = await api(
      `/api/hrm/payroll/item/payslip?id=${encodeURIComponent(id)}`,
    ),
      amount = (n) => cash(Number(n || 0) / 100),
      lines = [
        ["Basic salary", p.basic_paise],
        ...p.allowances.map((x) => [x.name, x.amount_paise]),
        ...p.earnings.map((x) => [x.name, x.amount_paise]),
      ],
      deductions = [
        ["Unpaid leave deduction", p.leave_deduction_paise],
        ...p.other_deductions.map((x) => [x.name, x.amount_paise]),
      ],
      adj = p.adjustments || [];
    const pdfFileName = `${(p.employee.name || "Employee").replace(/\s+/g, "_")}_Payslip_${p.period}.pdf`;
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.company)} payslip ${esc(p.period)}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <style>
        body{font:14px/1.5 Arial,sans-serif;color:#172033;margin:0;background:#f8fafc;padding:24px}
        #payslip-container{max-width:800px;margin:0 auto;background:#fff;padding:36px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.06)}
        header{border-bottom:3px solid #fb4818;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
        h1{margin:0;color:#0f172a;font-size:24px}
        .period-tag{font-size:16px;font-weight:bold;color:#fb4818}
        small{color:#64748b}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0}
        table{width:100%;border-collapse:collapse;margin:16px 0}
        th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0}
        th{background:#f1f5f9;color:#334155;font-size:13px;text-transform:uppercase;letter-spacing:0.5px}
        .total{font-weight:bold;font-size:16px;background:#f8fafc}
        .net-card{background:#172235;color:#fff;padding:16px 20px;border-radius:8px;margin:24px 0;display:flex;justify-content:space-between;align-items:center}
        .net-card strong{font-size:22px;color:#38bdf8}
        .actions{max-width:800px;margin:0 auto 20px;display:flex;gap:12px;justify-content:flex-end}
        .btn{padding:10px 18px;border-radius:6px;font-weight:bold;cursor:pointer;border:none;font-size:14px;transition:all 0.2s}
        .btn-primary{background:#fb4818;color:#fff}
        .btn-primary:hover{background:#e03b0f}
        .btn-secondary{background:#e2e8f0;color:#1e293b}
        .btn-secondary:hover{background:#cbd5e1}
        @media print{
          body{background:#fff;padding:0}
          #payslip-container{box-shadow:none;border-radius:0;padding:10mm}
          .actions{display:none}
        }
      </style>
      </head>
      <body>
        <div class="actions">
          <button class="btn btn-secondary" id="btn-print-payslip">🖨️ Print</button>
          <button class="btn btn-primary" id="btn-download">⬇️ Download PDF</button>
        </div>
        <div id="payslip-container">
          <header>
            <div>
              <h1>${esc(p.company)}</h1>
              <small>Confidential Salary Statement</small>
            </div>
            <div class="period-tag">Period: ${esc(p.period)}</div>
          </header>
          <div class="info">
            <div><b>Employee name:</b> ${esc(p.employee.name)} (${esc(p.employee.employee_code || "—")})</div>
            <div><b>Department & Role:</b> ${esc(p.employee.department || "—")} · ${esc(p.employee.title || "—")}</div>
            <div><b>Date of Joining:</b> ${esc(p.employee.start_date || "—")}</div>
            <div><b>Payment Status:</b> <span style="text-transform:capitalize;font-weight:bold;color:${p.period_status === "Paid" ? "#16a34a" : "#ca8a04"}">${esc(p.period_status)}</span> ${p.paid_at ? `(${esc(showTime(p.paid_at))})` : ""}</div>
            <div style="grid-column: span 2"><b>Attendance summary:</b> Scheduled: <b>${esc(p.scheduled_days)}</b> days · Present: <b>${esc(p.present_days)}</b> days · Paid leave: <b>${esc(p.paid_leave_days)}</b> days · Unpaid leave: <b>${esc(p.unpaid_leave_days)}</b> days</div>
          </div>
          <h3 style="margin-top:24px;margin-bottom:8px;color:#0f172a">Earnings</h3>
          <table>
            <thead><tr><th>Component</th><th style="text-align:right">Amount (INR)</th></tr></thead>
            <tbody>
              ${lines.map(([n, v]) => `<tr><td>${esc(n)}</td><td style="text-align:right">${amount(v)}</td></tr>`).join("")}
              <tr class="total"><td>Gross Earnings</td><td style="text-align:right">${amount(p.gross_paise)}</td></tr>
            </tbody>
          </table>
          <h3 style="margin-top:24px;margin-bottom:8px;color:#0f172a">Deductions</h3>
          <table>
            <thead><tr><th>Component</th><th style="text-align:right">Amount (INR)</th></tr></thead>
            <tbody>
              ${deductions.map(([n, v]) => `<tr><td>${esc(n)}</td><td style="text-align:right">${amount(v)}</td></tr>`).join("")}
              <tr class="total"><td>Total Deductions</td><td style="text-align:right">${amount(p.total_deductions_paise)}</td></tr>
            </tbody>
          </table>
          ${adj.length ? `
            <h3 style="margin-top:24px;margin-bottom:8px;color:#0f172a">Adjustments</h3>
            <table>
              <thead><tr><th>Reason</th><th style="text-align:right">Amount (INR)</th></tr></thead>
              <tbody>
                ${adj.map((a) => `<tr><td>${esc(a.reason)}</td><td style="text-align:right">${amount(a.amount_paise)}</td></tr>`).join("")}
              </tbody>
            </table>
          ` : ""}
          <div class="net-card">
            <span>Net Payable Amount</span>
            <strong>${amount(p.adjusted_net_paise ?? p.net_paise)}</strong>
          </div>
          <p><small>This document is system generated by Macrow HRMS. Unpaid leave deduction method: ${esc(p.calculation.method || "Configured policy")}.</small></p>
        </div>
        <script>
          document.getElementById('btn-print-payslip').addEventListener('click', function() {
            window.print();
          });
          document.getElementById('btn-download').addEventListener('click', function() {
            var btn = document.getElementById('btn-download');
            btn.innerText = 'Generating PDF…';
            btn.disabled = true;
            var element = document.getElementById('payslip-container');
            function finish() {
              btn.innerText = '⬇️ Download PDF';
              btn.disabled = false;
            }
            if (window.html2pdf) {
              html2pdf().set({
                margin: 10,
                filename: '${pdfFileName}',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
              }).from(element).save().then(finish).catch(function() {
                finish();
                window.print();
              });
            } else {
              finish();
              window.print();
            }
          });
        </script>
      </body></html>`
    );
    win.document.close();
  } catch (e) {
    win.close();
    toast(e.message);
  }
}

createRoot(document.getElementById("root")).render(<App />);
