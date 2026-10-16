# Macrow People — React HRMS

Internal HRMS for Macrow Digital. The application is a React 19 frontend built with Vite, backed by a Node.js 24 API and SQLite database. Role checks and salary privacy are enforced on the server.

## Run locally

1. Install Node.js 24 or newer.
2. Open a terminal in this folder and run `npm install`.
3. Run `npm run build` to bundle the React interface into `public/`.
4. Run `npm start`, then open `http://127.0.0.1:3000` in a browser on the same computer.
5. On first run, a one-time administrator setup token is printed in the terminal. Keep it private and enter it on the setup page to create the first Admin account.
6. Admin or HR can invite employees and select an account role. Invite links expire after seven days and can only be used once. Employees create their own password from the activation page.

## Invitations and policy documents

- Copy `.env.example` to `.env` and configure `APP_BASE_URL` plus `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` to send real invitation emails. In production, use an HTTPS `APP_BASE_URL`. Without SMTP, the app clearly marks the invite as unsent and shows a one-time activation link for local trials.
- An invitation is marked sent only after the mail service accepts the message. A sent status does not guarantee inbox delivery. Admin/HR can view invite status, resend expired or failed invites, and activate an account by sending a fresh link.
- Admin/HR can upload PDF and DOCX policy files up to 10 MB. Files are stored under `data/private-documents` with generated names, outside the public site directory, and are served only through authenticated download/preview routes. Documents can be saved as drafts or published; a same-title and same-category upload creates a new version and keeps the prior record in history.
- Existing text policies remain available in an archived section. They are not deleted by the document upload workflow.
- Keep `.env`, `data/`, and backups private. The provided `.gitignore` excludes mail credentials, the database, the encryption key, and uploaded documents.

For frontend development, run `npm start` for the API and `npm run dev` in a second terminal. Vite runs at `http://127.0.0.1:5173` and proxies API requests to port 3000.

The database and encryption key are stored under `data/`. Back up the database and encryption key together, with access restricted to authorized administrators. The `data/` directory is intentionally excluded from the source ZIP.

## Included features

- **Roles:** Super Admin, HR Manager, Payroll/Finance Manager, Department Manager, and Employee. Only Admin can invite users or decide employee requests. Department managers are scoped to their department. Payroll and bank details are restricted to Admin and Payroll roles, with employees able to view their own published payslips and submit their own encrypted bank details.
- **Employee management:** Searchable onboarding status, invitation/resend actions, profile details, Onsite/Remote/Hybrid work arrangements, and account access controls.
- **Attendance:** Server-recorded clock in, pause/clock out, resume, elapsed timer, activity log, and reason required for clock-out before 7:00 PM Asia/Kolkata. The configured schedule is 10:00 AM–7:00 PM with lunch 1:00–1:45 PM and tea 4:00–4:15 PM.
- **Leave and requests:** Admin-managed leave categories and entitlements; paid/unpaid policies; half-day setting; weekly-off and holiday handling; admin approvals; request history; leave balances; calendar integration. Pending leave is flagged for payroll review and is not deducted.
- **Payroll:** Effective-dated salary structures with basic pay, allowances, other earnings, authorized deductions, workday/calendar-day salary divisor, weekly off, and paid-leave cap. Payroll calculation is server-side and decimal-safe, with validation warnings/errors, duplicate period protection, recalculation while in draft/validation, separate HR review and Payroll approval, finalization, publishing, paid status, adjustments with reasons and audit logs, and role-scoped reports/CSV.
- **Payslips:** Individual employee payslip history and printable PDF workflow through the browser's Print / Save as PDF feature. Employees can access only their own published slips.
- **Tasks:** Priority, assignment, description, dates, category/project, estimated hours, attachment links, checklist items, task status workflow, manager review/reopen, activity history, and notifications. Task performance never triggers automatic salary deductions.
- **Employee profiles and workforce management:** Individual profiles linked to authenticated accounts, profile history fields, manager/department/location assignment, searchable directory filters, task-derived workload summaries, assigned projects and clients, and profile activity.
- **Daily work updates:** Employees can submit and edit date-based updates with project/client, priority, task status, progress, completed and pending work, blockers, next steps, and time spent. Edits are kept in a history; Admin/HR/managers can filter and review the day-wise timeline within their role scope. Missing reports are clearly not treated as proof of absence.
- **Bank detail verification:** Employee-submitted bank details are encrypted with AES-256-GCM and masked in normal responses. The employee can request changes by resubmitting; Admin and Payroll can review, verify, reject, or request correction. An authorized reveal is audited, and bank actions are kept in a separate history. Bank fields are excluded from general employee lists and payroll exports.
- **Updates, notifications, calendar, documents, and reports:** Admin-published company updates, private versioned PDF/DOCX policies, internal notifications, events and approved leave, attendance/payroll/task metrics, and authorized CSV export.

Salary setup components use comma-separated `Name:amount` values, for example `HRA:10000, Travel:1500`. Amounts are INR with up to two decimals. The paid-leave cap is optional and applies across paid categories; leave category entitlements still apply by type.

## Payroll and legal review

The payroll calculator does not embed statutory rates. Configure applicable PF, ESI, professional tax, TDS, and other permitted deductions using the current company-approved values and review their legal basis with a qualified payroll professional. A payroll draft flags missing salary structures, missing attendance, open shifts, pending leave, overlapping leave, and other exceptions. It avoids automatic absence deductions from missing clock records. Task completion, deadlines, and manager ratings never affect pay. Finalized payroll changes are recorded as authorized adjustments; finalized calculations are not edited in place.

Treat payroll as a human-reviewed calculation tool. Verify calculations against manually checked cases before using real salary data. This starter code has not been security-audited or certified for legal compliance and is not a payroll payment processor.

## Security notes

- Passwords use salted scrypt hashes; session tokens are opaque and stored only as hashes. Mutating API requests require a per-session CSRF token.
- The session cookie is HttpOnly and SameSite=Lax. Secure cookies are enabled with `NODE_ENV=production`; production deployment requires HTTPS.
- Login attempts are rate-limited. The server binds to `127.0.0.1` by default and sends security headers.
- Bank details are encrypted with AES-256-GCM. The encryption key is generated and stored in `data/hrms-encryption.key`; keep it backed up and private. An environment-provided key can be set with `HRMS_ENCRYPTION_KEY` as a base64-encoded 32-byte key.
- For remote access, deploy behind a correctly configured HTTPS reverse proxy, restrict server/database/backup access, use a dedicated service account, and do not expose port 3000 directly to the public internet.

## Commands

- `npm start` — run the API and built React app.
- `npm run dev` — run Vite for frontend development.
- `npm run build` — build the React frontend into `public/`.
- `npm run check` — syntax-check the Node API modules.
- `npm test` — run isolated in-memory payroll calculations for leap years, paid/unpaid and half-day leave, pending leave, holidays/week-offs, and joining-date proration.

`GET /health` returns a health status without user data.

## Employee profile and workforce data

The existing SQLite schema is extended idempotently at startup. The additions include optional employee profile fields, daily updates and their history, employee project assignments, bank verification metadata, and a bank-action history. Existing user IDs remain the employee identity; no duplicate employee identity table is introduced. Database upgrades are applied automatically when the server starts.

Key authenticated endpoints:

- `GET/PUT /api/hrm/employees/:id/profile` — read a profile within role scope; employees may update their own permitted contact/address fields, while Admin/HR can edit professional fields.
- `GET/POST /api/hrm/daily-updates`, `PUT /api/hrm/daily-updates/:id`, `GET /api/hrm/daily-updates/:id/history` — submit, view, edit, and review daily work with ownership and department checks.
- `POST /api/hrm/employee-projects`, `DELETE /api/hrm/employee-projects/:id` — Admin/HR project assignment and archival.
- `GET/PUT /api/hrm/bank` — employee's own bank information or masked record for Admin/Payroll.
- `GET /api/hrm/bank/pending`, `POST /api/hrm/bank/review`, `GET /api/hrm/bank/history`, `POST /api/hrm/bank/reveal` — Payroll/Admin-only verification, audit history, and explicit full-account access.

Bank access is restricted server-side to the employee who owns the record and to the Admin/Payroll roles for review. Full account numbers are never returned by the ordinary `GET /api/hrm/bank` endpoint. The account number is stored only as AES-256-GCM ciphertext; audit details contain no bank values. Bank proof uploads, profile photos, formal department/client master-data screens, and document attachments to daily updates are not implemented in this increment because the supplied app did not have those modules. Projects and clients are recorded as assignments attached to employee profiles and task/update text fields.

## Developer configuration

Start from `.env.example` and put real credentials only in a local `.env` file. Never share `.env`, `data/macrow-people.sqlite`, or `data/hrms-encryption.key`. The new data tables contain employee and bank records; production use requires HTTPS, restricted administrator access, encrypted backups, and keeping the encryption key separate from public files. The current automated suite includes payroll calculations plus profile ownership, daily-update history, bank masking, permission denial, verification, and bank audit checks.


