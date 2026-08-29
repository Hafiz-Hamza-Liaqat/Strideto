# Strideto – What to Do: Setup, APIs, JWT, and Running on Localhost

This guide explains **everything you need to do** to run the project on your machine and what to set for deployment (APIs, JWT, database).

---

## What You Need Before Starting

- **Node.js** 18 or newer ([nodejs.org](https://nodejs.org))
- **MongoDB** – either installed on your PC or a free cloud database (MongoDB Atlas)
- **Terminal** (PowerShell, CMD, or Git Bash on Windows)

---

## Part 1: Database (MongoDB)

The app stores jobs, users, resumes, and everything else in **MongoDB**. You must have a running database and its connection URL.

### Option A – MongoDB on your computer

1. **Install MongoDB**
   - Windows: [Download MongoDB Community](https://www.mongodb.com/try/download/community) → run installer → choose “Complete”.
   - Mac: `brew install mongodb-community` then `brew services start mongodb-community`.
   - Linux: `sudo apt-get install mongodb` then `sudo systemctl start mongod`.

2. **Start MongoDB**
   - Windows (if installed as service): open **Command Prompt as Administrator** → run:
     ```bash
     net start MongoDB
     ```
   - Or run manually: `mongod --dbpath C:\data\db` (create folder `C:\data\db` if needed).

3. **Connection URL (use this in the next part)**
   ```
   mongodb://localhost:27017/strideto
   ```

### Option B – MongoDB Atlas (cloud, no local install)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → sign up / log in.
2. **Create a project** → **Build a database** → choose **FREE** (M0).
3. **Create database user:** Database Access → Add New User → set username and password → Create User.
4. **Allow network access:** Network Access → Add IP Address → “Allow access from anywhere” (0.0.0.0/0) for testing.
5. **Get the connection string from Atlas:** Databases → **Connect** → **Drivers** (or “Connect your application”) → copy the connection string Atlas generates for your cluster.
6. **Configure locally (never in git):**
   - Paste the Atlas string into `server/.env` (or your host’s environment settings) as **`MONGO_URI`**.
   - On your machine only, replace Atlas’s built-in placeholders with your database user and password, and ensure the database name ends with `/strideto` (or your chosen DB name).
   - For production (e.g. Render), set the same completed value as the **`MONGO_URI`** environment variable in the hosting dashboard.

   > **Security:** Never commit `MONGO_URI` or any database credentials to source control. Keep them only in git-ignored local `.env` files or your deployment provider’s secret store (e.g. Render Environment, Vercel Environment Variables).

---

## Part 2: Environment Variables (APIs, JWT, DB URL)

The app reads settings from **env files**. You do **not** need any external paid APIs; the only “API” is your own backend. You **do** need to set:

- **Database URL** (MongoDB)
- **Distinct JWT and refresh-token signing secrets**
- **Redis URL** (required by the canonical session and access-denylist architecture)
- **Optional:** client API URL (for production)

### Step 1 – Create `server/.env`

1. Open the project folder in your editor.
2. In the **server** folder, create a file named **`.env`** (exactly, with the dot at the start).
3. Paste the following and **replace the two required values**:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/strideto
JWT_SECRET=REPLACE_WITH_A_STRONG_SECRET_AT_LEAST_32_CHARS
REFRESH_SECRET=REPLACE_WITH_A_DIFFERENT_STRONG_SECRET_AT_LEAST_32_CHARS
REDIS_URL=redis://localhost:6379
SITE_URL=http://localhost:5173
```

**What to change:**

| Variable           | What to put                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **MONGO_URI**      | Your MongoDB URL from Part 1 (local: `mongodb://localhost:27017/strideto`, or the Atlas connection string you configured in `server/.env` / hosting env — never committed). |
| **JWT_SECRET**     | Any long random string (e.g. 32+ characters). Example: `mySuperSecretKeyForStrideto2024!@#` – in production use a strong random value. |
| **REFRESH_SECRET** | A second strong random string that must differ from `JWT_SECRET`.                                                                      |
| **REDIS_URL**      | The Redis connection URL used by session issuance and access-token denylisting.                                                        |

Leave the rest as-is for local run. Save the file.

### Step 2 – (Optional) Create `client/.env`

For **localhost** you often don’t need this: the frontend is configured to call `http://localhost:5000/api` by default.  
If you want to set it explicitly, create **`client/.env`** with:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_URL=http://localhost:5173
```

- **VITE_API_URL** = your backend API base URL (local: `http://localhost:5000/api`).
- **VITE_APP_URL** = your site URL (local: `http://localhost:5173`).

For **production** you will set these to your real domain and API URL.

---

## Part 3: Install Dependencies and Seed the Database

Run these in a terminal, from the **project root** (the folder that contains `server` and `client`).

### 1. Install packages

```bash
cd server
npm install
cd ../client
npm install
```

### 2. Seed the database (so the app has jobs, scholarships, etc.)

From project root:

```bash
cd server
npm run seed
```

Wait until you see something like “Seed completed successfully.”  
Optional: you can also run `npm run seed:users` (creates test users) and `npm run seed:exam-prep` (exam data). See DEPLOYMENT.md for the full list.

---

## Part 4: Run on Localhost and Check It Works

You will run **two** processes: the **API server** and the **React frontend**.

### Terminal 1 – Start the API (backend)

```bash
cd server
npm run dev
```

You should see:

- `MongoDB connected`
- `Strideto API running at http://localhost:5000`

If you see “MongoDB connection failed”, MongoDB is not running or `MONGO_URI` in `server/.env` is wrong. Fix that and run again.

### Terminal 2 – Start the frontend (React)

Open a **second** terminal:

```bash
cd client
npm run dev
```

You should see something like:

- `Local: http://localhost:5173/`

### Check that it’s working

1. **Browser:** Open [http://localhost:5173](http://localhost:5173). You should see the Strideto homepage.
2. **API health:** Open [http://localhost:5000/api/health](http://localhost:5000/api/health). You should get a short JSON response (e.g. `{"ok":true}` or similar).
3. **Login/Register:** On the site, try Register with an email and password, then Login. If that works, **JWT and the auth API are working**.
4. **Browse:** Click Jobs, Scholarships, Admissions. If listings appear, the **database and APIs are working**.

If any step fails, see the “Troubleshooting” section at the end.

---

## Part 5: What “APIs” and “JWT” Mean Here

### APIs

- **No external paid APIs are required.**
- The **only API** the frontend needs is **your own backend** (the Express server you run with `npm run dev` in `server/`).
- That backend exposes routes like:
  - `/api/auth/login`, `/api/auth/register` (auth)
  - `/api/jobs`, `/api/scholarships`, `/api/admissions` (listings)
  - `/api/resumes/*` (resume builder)
  - etc.  
    All are listed in **DEPLOYMENT.md** under “APIs used by this project”.
- You “add” them only by **setting the correct URL** in the client:
  - **Local:** `VITE_API_URL=http://localhost:5000/api` (or rely on default).
  - **Production:** `VITE_API_URL=https://your-api-domain.com/api`.

### JWT (JSON Web Token)

- Login returns a short-lived access JWT to the frontend, which keeps it in memory and sends it in the `Authorization` header.
- Refresh credentials are separate seven-day JWTs held only in realm-specific HttpOnly cookies and backed by `RefreshSession` records.
- Set distinct **JWT_SECRET** and **REFRESH_SECRET** values in `server/.env`; never commit either secret.
- Access and refresh lifetimes are source-controlled at 15 minutes and seven days. They are not environment-variable overrides.
- Redis is required for canonical session issuance and access-token denylisting.

---

## Part 6: Deployment (Production) – Short Checklist

When you deploy to a real server (e.g. Vercel, Railway, your own VPS):

1. **Server env (on the machine running the Node API)**  
   Same variables as `server/.env`, but:
   - **MONGO_URI** = your production MongoDB URL (e.g. Atlas).
   - **JWT_SECRET** = a new, strong random secret (not the one you use on localhost).
   - **REFRESH_SECRET** = a different new, strong random secret.
   - **REDIS_URL** = the production Redis URL.
   - **NODE_ENV** = `production`.
   - **SITE_URL** = your real site URL (e.g. `https://strideto.com`).

2. **Client env (when building the frontend)**  
   When you run `npm run build` in `client/`, set (or put in `client/.env.production`):
   - **VITE_API_URL** = your production API URL (e.g. `https://api.strideto.com/api`).
   - **VITE_APP_URL** = your production site URL (e.g. `https://strideto.com`).

3. **Do not commit** `server/.env` or `client/.env` (they should be in `.gitignore`). Set the same values in your hosting provider’s “Environment variables” or “Config” instead.

4. **Database:** Ensure your production MongoDB (e.g. Atlas) is reachable from the server and that you’ve run the seed (or migrated data) there.

5. **Run the server** with `NODE_ENV=production node src/index.js` (or use PM2 / your host’s process manager). Serve the built client from `client/dist/` with Nginx or your host’s static hosting.

Full deployment details (build, process manager, CORS, etc.) are in **DEPLOYMENT.md**.

---

## Troubleshooting

| Problem                                   | What to do                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| “MongoDB connection failed”               | Start MongoDB (Part 1). Check `MONGO_URI` in `server/.env` (no typos, correct password for Atlas).                                                                 |
| “Authentication required” or 401 on login | Ensure distinct `JWT_SECRET` and `REFRESH_SECRET` values and `REDIS_URL` are set, then restart the server.                                                         |
| Blank page or “Cannot connect” in browser | 1) Backend must be running on port 5000. 2) Client must be running (e.g. 5173). 3) For production, set `VITE_API_URL` and ensure CORS allows your frontend origin. |
| No jobs/scholarships on homepage          | Run `cd server && npm run seed` and refresh the page.                                                                                                              |
| Port 5000 or 5173 already in use          | Change `PORT` in `server/.env` (e.g. 5001) and in `client/.env` set `VITE_API_URL=http://localhost:5001/api`.                                                      |

---

## Quick Copy-Paste Summary (Localhost)

```bash
# 1. Create server/.env with at least:
#    MONGO_URI=mongodb://localhost:27017/strideto
#    JWT_SECRET=your-long-random-secret-32-chars
#    REFRESH_SECRET=a-different-long-random-secret
#    REDIS_URL=redis://localhost:6379

# 2. Install and seed
cd server
npm install
npm run seed
cd ../client
npm install

# 3. Run (two terminals)
# Terminal 1:
cd server && npm run dev

# Terminal 2:
cd client && npm run dev

# 4. Open http://localhost:5173 and test login + browse
```

That’s everything you need to do for setup, APIs, JWT, and running on localhost.
