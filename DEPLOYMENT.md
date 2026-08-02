# Strideto E-Portal – Deployment & Setup Guide

This guide covers local development, database setup, environment variables, and production deployment so the project runs fully and correctly.

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **MongoDB** 6+ (local or Atlas)
- **npm** or **yarn**

---

## 1. Clone and install dependencies

```bash
cd EDU-E-Portal
npm install
cd server && npm install
cd ../client && npm install
```

Or from repo root (if you have a root `package.json` with workspaces, otherwise run in `server` and `client` separately):

```bash
cd server && npm install
cd ../client && npm install
```

---

## 2. Database (MongoDB) setup

### Option A: MongoDB locally

**Windows**

1. Download MongoDB Community from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community).
2. Run the installer; choose “Complete” and optionally install as a service.
3. Start MongoDB:
   - If installed as service: `net start MongoDB`
   - Or run: `mongod --dbpath C:\data\db` (create `C:\data\db` if needed).

**macOS (Homebrew)**

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu/Debian)**

```bash
sudo apt-get install -y mongodb
sudo systemctl start mongod
sudo systemctl enable mongod
```

Default connection string for local MongoDB:

```
mongodb://localhost:27017/edurozgaar
```

### Option B: MongoDB Atlas (cloud)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create an account.
2. Create a cluster (free tier is enough).
3. Under **Database Access** → Add user (username + password).
4. Under **Network Access** → Add IP (e.g. `0.0.0.0/0` for “allow from anywhere” for dev; restrict in production).
5. Click **Connect** on the cluster → **Connect your application** → copy the URI.
6. Replace `<password>` with the user password and set the database name (e.g. `edurozgaar`):

```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/edurozgaar?retryWrites=true&w=majority
```

Use this URI as `MONGO_URI` in the server `.env` (see below).

---

## 3. Environment variables

### Server (`server/.env`)

1. From the **project root**, open `.env.template` and copy the **SERVER** section into a new file `server/.env` (create the file if needed).
2. Edit `server/.env` and set at least:

| Variable               | Required               | Description                                                                                                                                                    |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGO_URI`            | Yes                    | MongoDB connection string (local or Atlas).                                                                                                                    |
| `JWT_SECRET`           | Yes                    | Strong random string (32+ chars) for access-token signing. **Must be set in production.**                                                                      |
| `REFRESH_SECRET`       | Yes                    | A different strong random string (32+ chars) for refresh-token signing. **Must differ from `JWT_SECRET`.**                                                     |
| `PORT`                 | No                     | API port (default `5000`).                                                                                                                                     |
| `NODE_ENV`             | No                     | `development` or `production`.                                                                                                                                 |
| `SITE_URL`             | No                     | Public site URL (for sitemap, referrals; e.g. `https://strideto.com`).                                                                                         |
| `FRONTEND_URL`         | No                     | Frontend app URL for password-reset emails (defaults to `http://localhost:5173` if unset). Set to your client URL in production (e.g. `https://strideto.com`). |
| `DISABLE_SCRAPER_CRON` | No                     | Set to `1` to disable the 6-hour scraper cron.                                                                                                                 |
| `REDIS_URL`            | Yes for authentication | Shared Redis used by session issuance, refresh availability checks, and the access-token denylist. It is mandatory in production.                              |

Example minimal `.env` for local:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/edurozgaar
JWT_SECRET=your-very-long-random-secret-at-least-32-characters
REFRESH_SECRET=a-different-random-secret-at-least-32-characters
SITE_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
```

The canonical secure-auth implementation uses 15-minute in-memory access
tokens and seven-day HttpOnly refresh cookies backed by `RefreshSession`.
These lifetimes are source-controlled rather than selected by environment
variables.

**Important:** Never commit `.env` files. Only the root `.env.template` (no secrets) is committed.

### Client (`client/.env`)

1. From the **project root**, open `.env.template` and copy the **CLIENT** section into a new file `client/.env`.
2. For **local development** you can keep:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_URL=http://localhost:5173
```

3. For **production build**, create `.env.production` (or set env when building):

```env
VITE_API_URL=https://api.your-domain.com/api
VITE_APP_URL=https://your-domain.com
```

Vite embeds these at build time; the client uses them for API calls and SEO/canonical URLs.

---

## 4. Seed the database

Run from the **server** directory so MongoDB has data (jobs, scholarships, admissions, blogs, exams, etc.):

```bash
cd server
```

**Main seed (jobs, scholarships, admissions, universities, blogs):**

```bash
npm run seed
```

**Optional seeds (run in this order if you want full data):**

```bash
npm run seed:users
npm run seed:listings
npm run seed:phase4
npm run seed:phase5
npm run seed:phase7
npm run seed:phase8
npm run seed:exam-prep
npm run seed:phase9
```

After seeding you can log in with the seeded user (check `server/src/scripts/seedUsers.js` for test email/password) or register a new account.

---

## 5. Run the project locally

**Terminal 1 – API server**

```bash
cd server
npm run dev
```

Server runs at `http://localhost:5000`. Health: `http://localhost:5000/api/health`.

**Terminal 2 – Frontend**

```bash
cd client
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api` to the server (see `client/vite.config.js`).

Open `http://localhost:5173` in the browser. You can register, log in, browse jobs/scholarships/admissions, use Resume Builder, Exam Prep, Blog, etc.

---

## 6. Production build and run

**Build client**

```bash
cd client
npm run build
```

Output is in `client/dist/`. Serve these static files with Nginx, Apache, or any static host. Point the document root to `client/dist` and configure fallback to `index.html` for client-side routing.

**Run server in production**

```bash
cd server
NODE_ENV=production node src/index.js
```

Or use a process manager (e.g. PM2):

```bash
cd server
npx pm2 start src/index.js --name edurozgaar-api
```

In production:

- Set `NODE_ENV=production`.
- Use a strong `JWT_SECRET` in `server/.env`.
- Use a production `MONGO_URI` (e.g. Atlas).
- Set `SITE_URL` and client `VITE_APP_URL` / `VITE_API_URL` to your real domain and API URL.

---

## 7. APIs used by this project

### Backend API (this server)

The **only required API** for the app to work is **this Express backend**. It exposes all of the following under the base path `/api` (e.g. `http://localhost:5000/api`).

| Area              | Path (prefix `/api`)                                                                            | Description                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Health            | `GET /health`                                                                                   | Health check.                                                                            |
| Auth              | `/auth/*`                                                                                       | Register, login, refresh, profile, dashboard, saved, recently viewed, FCM.               |
| Jobs              | `/jobs`, `/jobs/:id`                                                                            | List jobs, get by id/slug, save/unsave, apply.                                           |
| Scholarships      | `/scholarships`, `/scholarships/:id`                                                            | List, get, save/unsave.                                                                  |
| Admissions        | `/admissions`, `/admissions/:id`                                                                | List, get, save/unsave.                                                                  |
| Blogs             | `/blogs`, `/blogs/:slug`                                                                        | List, get, auto-generate (admin).                                                        |
| Foreign studies   | `/foreign-studies`, `/foreign-studies/:slug`                                                    | List, get.                                                                               |
| Trending          | `/trending/jobs`, `/trending/scholarships`, `/trending/admissions`                              | Trending listings.                                                                       |
| Newsletter        | `/newsletter/subscribe`, `/newsletter/unsubscribe`                                              | Subscribe/unsubscribe.                                                                   |
| Notifications     | `/notifications/*`                                                                              | Send/list (admin).                                                                       |
| Monetization      | `/monetization/*`                                                                               | Featured/sponsored listings, ad slots (admin).                                           |
| Users             | `/users/resume-analyze`, `/users/resume-scans`, `/users/cover-letter`, `/users/applications`    | Resume scan, cover letter, applications.                                                 |
| Exams             | `/exams`, `/exams/:slug`, `/exams/:examId/past-papers`, `/quizzes/*`                            | Exams, past papers, quizzes, submit, leaderboard.                                        |
| Internships       | `/internships`, `/internships/:id`, apply, save                                                 | Internships.                                                                             |
| Chatbot           | `/chatbot/query`, `/chatbot/history`                                                            | Chat (auth).                                                                             |
| Webinars          | `/webinars`, `/webinars/:id`, register, my registrations                                        | Webinars.                                                                                |
| Intl scholarships | `/intl-scholarships`, `/intl-scholarships/universities`                                         | International scholarships.                                                              |
| Badges            | `/badges/me`, `/badges/leaderboard`, `/badges/rank`                                             | Badges and leaderboard.                                                                  |
| SEO               | `/seo/jobs-in/:slug`, `/seo/jobs-by-category/:slug`, `/seo/scholarships-in/:country`            | SEO listing pages.                                                                       |
| Resumes           | `/resumes`, `/resumes/user`, `/resumes/:id`, `/resumes/ai-suggest`, `/resumes/optimize-for-job` | Resume CRUD, AI suggest, optimize for job.                                               |
| Admin             | `/admin/*`                                                                                      | Growth, scraper, jobs/scholarships/admissions/blogs/exams/intl/notifications management. |
| v1                | `/v1/*`                                                                                         | Save job/scholarship/admission, recommendations, bookmarks, notifications, analytics.    |

Sitemap and robots are at **root**: `GET /sitemap.xml`, `GET /robots.txt`.

### External services (optional)

- **MongoDB**: Required. Use local or Atlas; no other database is needed.
- **Redis**: Optional; used for caching/session if `REDIS_URL` is set. If not set, the app uses in-memory store.
- **Firebase / Google OAuth**: Optional (commented in env); for future push notifications or OAuth.
- **File storage (e.g. Cloudinary)**: Optional; for future uploads (e.g. profile images). Not required for current deployment.

No third-party paid APIs are required for the app to run; the backend is self-contained except for MongoDB (and optional Redis).

---

## 8. Checklist before going live

- [ ] MongoDB running and `MONGO_URI` set in `server/.env`.
- [ ] `JWT_SECRET` set to a strong random value (and not the template placeholder).
- [ ] `SITE_URL` set to your public URL.
- [ ] Client built with `VITE_APP_URL` and `VITE_API_URL` pointing to production.
- [ ] Database seeded so the site has content (jobs, scholarships, etc.).
- [ ] CORS and reverse proxy (if any) allow requests from your frontend origin to the API.
- [ ] `.env` files are in `.gitignore` and never committed.

---

## 10. Production deployment (Docker + VPS)

Recommended stack: **VPS + Docker Compose + Caddy (HTTPS)**.

### Quick production steps

1. **VPS setup** (Ubuntu 22.04):

   ```bash
   sudo bash deploy/setup-vps.sh
   ```

2. **Clone and configure env**:

   ```bash
   git clone https://github.com/SyedDaniyal31/Strideto.git
   cd Strideto
   cp .env.template .env
   # Edit .env: JWT_SECRET (openssl rand -hex 32), SITE_URL, VITE_APP_URL, MAIL_*
   ```

3. **Deploy**:

   ```bash
   bash deploy/deploy.sh
   ```

4. **HTTPS** — edit `deploy/Caddyfile` with your domain, then:

   ```bash
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

5. **Seed DB + admin** (set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`):

   ```bash
   bash scripts/production-setup.sh
   ```

6. **Smoke test**:
   ```bash
   SITE_URL=https://strideto.com npm run smoke-test
   ```

### Production security notes

- Production `docker-compose.yml` does **not** expose MongoDB (27017), Redis (6379), or backend (5000) publicly.
- `JWT_SECRET` must be 32+ characters or the server exits on startup.
- In production, `ensureAdminUser.js` requires `ADMIN_PASSWORD` — never use default `Admin1234`.
- CORS is restricted to `SITE_URL` / `FRONTEND_URL` in production.
- Password reset emails require `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS` in `.env`.

### Local Docker with exposed ports (debugging)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Post-launch checklist

See [docs/POST_LAUNCH.md](docs/POST_LAUNCH.md) for Google Search Console, uptime monitoring, and backups.

---

## 11. Quick reference – from zero to running

```bash
# 1. Install
cd server && npm install && cd ../client && npm install

# 2. Env: copy from root .env.template
#    - SERVER section → server/.env  (set MONGO_URI and JWT_SECRET)
#    - CLIENT section → client/.env  (optional for dev)

# 4. Start MongoDB (local or use Atlas and set MONGO_URI)

# 5. Seed DB
cd server && npm run seed

# 6. Run API
cd server && npm run dev

# 7. Run frontend (new terminal)
cd client && npm run dev
# Open http://localhost:5173
```

After this, the project is complete, running, and ready for deployment using the same env and build steps in your hosting environment.
