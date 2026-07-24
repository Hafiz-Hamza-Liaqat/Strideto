# Strideto – Pakistan Career Intelligence Platform

**Brand:** Strideto · **Tagline:** Your Career Journey Starts Here · **Domain:** [https://strideto.com](https://strideto.com)

Production-ready platform helping students find **jobs, scholarships, admissions, and career readiness** across Pakistan — with employer hiring tools and an admin CMS.

**Founders:** see [AUTHORS.md](./AUTHORS.md) · **License:** [MIT](./LICENSE) · **Notice:** [NOTICE.md](./NOTICE.md)

## Overview

Strideto combines a public opportunity marketplace with Career Intelligence (Talent Profile, readiness scoring, assessments, credentials) and employer productivity (candidate filters, comparison, job match, vacancy seats).

## Features

- Jobs, scholarships, admissions, internships, exam prep, and career guidance
- Student Talent Profile, resume builder, readiness scores, assessments & credentials
- Application tracker and personalized career dashboard
- Employer portal: jobs, applicants, intelligence filters, comparison, hiring recommendations
- Admin CMS, moderation, search reindex, analytics, and role-based access (Admin / Moderator / Editor)
- Deterministic scoring engines (no paid AI required for launch — see [AI Budget Policy](./docs/AI_BUDGET_POLICY.md))

## Architecture

| Layer | Stack |
| ----- | ----- |
| Frontend | React, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Auth | JWT access + refresh (students/staff & employers) |
| Optional | Redis (session revoke / cache), SMTP, object storage |

Monorepo layout: `client/` · `server/` · `shared/` · `docs/` · `scripts/`

## Screenshots

Optional screenshots live under `docs/screenshots/` (add as needed for the GitHub landing page).

## Installation

```bash
git clone https://github.com/Hafiz-Hamza-Liaqat/Strideto.git
cd Strideto
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

Copy environment templates (never commit real secrets):

```bash
cp .env.example server/.env   # or copy sections from .env.template
# Set MONGO_URI and a strong JWT_SECRET in server/.env
```

See [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) and [docs/SETUP_AND_RUN.md](./docs/SETUP_AND_RUN.md).

## Development

1. Start MongoDB locally (or set an Atlas `MONGO_URI`).
2. From repo root:

```bash
npm run server    # API → http://localhost:5000
npm run client    # Vite → http://localhost:5173
# or both:
npm run dev:all
```

Health check: `http://localhost:5000/api/health`

**Recommended seed (fresh DB):**

```bash
cd server
npm run seed              # core + CMS
npm run seed:launch       # launch content
npm run seed:assessments  # assessment catalog
```

## Deployment

| Target | Guide |
| ------ | ----- |
| Staging | [docs/STAGING_DEPLOYMENT.md](./docs/STAGING_DEPLOYMENT.md) |
| Production | [docs/PRODUCTION_DEPLOYMENT.md](./docs/PRODUCTION_DEPLOYMENT.md) |
| Docker / VPS | [DEPLOYMENT.md](./DEPLOYMENT.md), [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) |
| Post-launch | [docs/POST_LAUNCH.md](./docs/POST_LAUNCH.md) |

**Typical production stack:** Vercel (frontend) · Render / Node host (API) · MongoDB Atlas · Redis (recommended) · SMTP · TLS

Guides: [docs/VERCEL_CONFIGURATION.md](./docs/VERCEL_CONFIGURATION.md) · [docs/RENDER_CONFIGURATION.md](./docs/RENDER_CONFIGURATION.md) · [docs/DNS_CHECKLIST.md](./docs/DNS_CHECKLIST.md)

```bash
npm run build           # frontend production build
npm run start:server    # backend production start
```

## Environment variables

Use **`.env.example`** / **`.env.template`** / **`.env.production.example`** as the source of truth for keys. Required for a minimal local run:

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `MONGO_URI` | `server/.env` | MongoDB connection |
| `JWT_SECRET` | `server/.env` | Sign JWTs (long random secret) |
| `SITE_URL` / `FRONTEND_URL` | server | CORS / links |
| `VITE_API_URL` | client | API base URL |

Full list: [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md).

## Documentation

| Doc | Purpose |
| --- | ------- |
| [docs/SETUP_AND_RUN.md](./docs/SETUP_AND_RUN.md) | Local setup |
| [docs/PHASE_C_PRODUCTION_SUMMARY.md](./docs/PHASE_C_PRODUCTION_SUMMARY.md) | Pre-deploy production config (Phase C) |
| [docs/PRODUCTION_ENVIRONMENT_REPORT.md](./docs/PRODUCTION_ENVIRONMENT_REPORT.md) | Env audit |
| [docs/SECURITY_AUDIT_REPORT.md](./docs/SECURITY_AUDIT_REPORT.md) | Security audit |
| [docs/SECURITY_CHECKLIST.md](./docs/SECURITY_CHECKLIST.md) | Security checklist |
| [docs/BACKUP_GUIDE.md](./docs/BACKUP_GUIDE.md) | Backups |
| [docs/AI_BUDGET_POLICY.md](./docs/AI_BUDGET_POLICY.md) | AI cost policy |
| [docs/RC2_IMPLEMENTATION_REPORT.md](./docs/RC2_IMPLEMENTATION_REPORT.md) | Current RC status |
| [docs/archive/](./docs/archive/) | Historical sprint / QA docs |

Production env template: [`.env.production.example`](./.env.production.example)

## License

Licensed under the [MIT License](./LICENSE).

## Contributors

| Role | Name | Contact |
| ---- | ---- | ------- |
| Founder, Lead Developer, QA | Hafiz Hamza Liaqat | hamza4h761@gmail.com |
| Co-Founder, Developer, UI/UX | Daniyal Abbas Shah | abbaskazmi231@gmail.com |

See [AUTHORS.md](./AUTHORS.md), [NOTICE.md](./NOTICE.md), and [CONTRIBUTING.md](./CONTRIBUTING.md).
