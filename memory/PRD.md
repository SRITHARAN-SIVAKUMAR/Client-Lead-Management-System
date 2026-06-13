# Ledger CRM — Product Requirements Document

## Original problem statement
Build a simple CRM to manage client leads generated from website contact forms.
- Frontend: React.js
- Backend: FastAPI (Python) — substituted for Node.js/Express per platform
- Database: MongoDB
- Key features: lead listing (name/email/source/status), status updates (new/contacted/converted), notes & follow-ups per lead, secure admin access.

## Architecture
- React 19 SPA with React Router (public landing + protected admin routes)
- FastAPI backend with JWT auth (httpOnly cookies, samesite=none, secure)
- MongoDB collections: `users`, `leads` (notes embedded as subdocument array)
- All API routes prefixed with `/api`

## User personas
1. **Website visitor** — submits the public contact form, no account.
2. **Admin** (single seeded account) — triages leads, updates status, adds notes & follow-ups.

## Core requirements (static)
- Public POST `/api/leads/public` to capture leads from website.
- JWT email/password login at `/api/auth/login`; httpOnly cookies for session.
- Protected admin endpoints for leads list, lead detail, status update, notes CRUD, stats.
- Predefined lead sources (Website Contact Form, Referral, Social Media, Email Campaign, Other).

## What's been implemented (2026-06-13)
- Public landing page (`/`) with hero, features, and contact form
- Admin login (`/admin/login`) — seeded admin: `admin@crm.local` / `Admin@12345`
- Dashboard (`/admin`) with stats (total/new/contacted/converted), conversion %, upcoming follow-ups, by-source breakdown, recent leads
- Leads list (`/admin/leads`) with search (name/email/phone), filter by status & source
- Lead detail (`/admin/leads/:id`) — status workflow buttons, follow-up calendar popover (shadcn), notes timeline (add/delete), delete lead
- Logout flow with cookie cleanup
- 21/21 backend pytest tests passing; all frontend E2E flows verified

## Backlog (next iterations)
**P0**
- None — MVP is feature complete.

**P1**
- Allow clearing follow_up_at via null (currently stores empty string)
- Email notification when a new public lead is captured
- Multiple admin users with role-based permissions

**P2**
- CSV export of leads
- Activity audit log (status changes, deletions)
- Webhook on lead create for Slack/Zapier
- Dark mode toggle
