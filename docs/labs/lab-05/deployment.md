# QuickOrder Deployment Specification (Lab 5)

> **CPE 334 Introduction to Software Engineering in the Age of AI Agents**  
> **Lab 5: Cloud Deployment and CI/CD Pipeline on GCP**  
> **Team Members:** Panyakorn Lohaviboonsap (67070503424), Ivan Luwongsuwat (67070503449)  
> **Repository:** [`https://github.com/Apuaticguy/cpe334_project1`](https://github.com/Apuaticguy/cpe334_project1)

---

## 1. Stack Architecture & Differences from Reference

QuickOrder adapts the reference TokTickIT cloud delivery pattern for the campus pre-order and fulfillment system.

| Component | Reference Architecture (TokTickIT) | QuickOrder Implementation |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Vanilla CSS | React 18, TypeScript, Vite, Bootstrap 5 |
| **Backend API** | Node.js, Express, TypeScript | Node.js, Express, TypeScript |
| **Database & ORM** | PostgreSQL 16 on Cloud SQL, Prisma | PostgreSQL 16 on Cloud SQL, Prisma |
| **Container Architecture** | 3-stage unified production Dockerfile | 3-stage unified production Dockerfile serving SPA + API on `$PORT` |
| **Runtime Port** | Port 3000 (`PORT=3000`) | Port 3000 (`PORT=3000`) in Cloud Run / Port 5001 local |
| **Health Probes** | `/api/health`, `/api/ready` | `/api/health` (liveness), `/api/ready` (readiness with `SELECT 1`) |
| **CI Quality Gate** | GitHub Actions (`test-and-docker`) | GitHub Actions (`test-and-docker` running Vitest suites) |
| **CD Pipeline** | GitHub Actions with Workload Identity Federation (WIF) | GitHub Actions with WIF deploying to Cloud Run & running `smoke_test.py` |

---

## 2. Environment Variables Dictionary

Every configuration setting is read from the environment. Real secrets are never committed into Git, baked into container images, or exposed in logs.

| Variable Name | Purpose / Description | Secret? | Source in Cloud Run (Production) | Default in Local Dev |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | HTTP port the server listens on (`0.0.0.0`) | No | Injected by Cloud Run runtime (`3000`) | `5001` |
| `NODE_ENV` | Application environment mode | No | Set via Cloud Run `--set-env-vars NODE_ENV=production` | `development` |
| `TZ` | Container timezone | No | Set via Cloud Run `--set-env-vars TZ=Asia/Bangkok` | `Asia/Bangkok` |
| `DATABASE_URL` | PostgreSQL connection string with Cloud SQL socket | **Yes** | Injected from Google Secret Manager (`quickorder-database-url:latest`) | `postgresql://postgres:postgres@localhost:5432/quickorder_db` |
| `JWT_SECRET` | 256-bit secret key used to sign and verify JWT authentication tokens | **Yes** | Injected from Google Secret Manager (`quickorder-jwt-secret:latest`) | `quickorder_development_jwt_secret_key...` |
| `DEMO_USER_PASSWORD` | Initial password applied to seeded test users (`customer1`, `operator1`) | **Yes** | Injected from Google Secret Manager (`quickorder-demo-password:latest`) | `Password123!` |
| `VITE_API_URL` | Client API endpoint URL | No | Empty string in container (requests use relative path `/api` on same origin) | `http://localhost:5001/api` |

---

## 3. Operational Commands (Build, Test, Run, Migrate, Seed)

### 3.1 Local Development
```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Run database migrations and seed
cd ../server
npx prisma migrate dev --name init
npm run seed

# Run automated tests
npm test            # Server API tests (Vitest)
cd ../client && npm test  # Client component tests (Vitest)
```

### 3.2 Docker Build & Local Container Run
```bash
# Build unified container image from repo root
docker build -t quickorder:local .

# Run locally with Docker Compose (PostgreSQL + server + client)
docker compose up --build -d

# Verify container health
curl -f http://localhost:3000/api/health
curl -f http://localhost:3000/api/ready

# Stop containers while preserving data volume
docker compose down
```

### 3.3 Database Migration & Seeding in Production
Migrations and seeding execute inside a dedicated Cloud Run Job before traffic reaches updated containers:
```bash
# Executed by Cloud Run Job quickorder-migrate
sh -c "npx prisma migrate deploy && npm run seed"
```

---

## 4. Google Cloud Platform (GCP) Resource Configuration

| Resource Type | Resource Name | Purpose | Configuration Details |
| :--- | :--- | :--- | :--- |
| **GCP Project** | `cpe334-quickorder` | Central project holding all lab resources | Region: `asia-southeast1` |
| **Cloud Run Service** | `quickorder` | Hosts unified web application & REST API | Memory: `512Mi`, CPU: `1`, Min: `0`, Max: `3`, Port: `3000` |
| **Cloud Run Job** | `quickorder-migrate` | Executes additive schema migrations and idempotent seeds | Max retries: `1`, Timeout: `300s` |
| **Cloud SQL Instance** | `quickorder-pg` | Managed PostgreSQL database | Edition: `Enterprise`, Tier: `db-f1-micro`, Storage auto-increase: **OFF** |
| **Artifact Registry** | `quickorder` | Docker container image repository | Format: `Docker`, Location: `asia-southeast1` |
| **Runtime Service Account** | `quickorder-runner` | Cloud Run execution identity | Roles: `Cloud SQL Client`, `Secret Manager Secret Accessor` |
| **Deployer Service Account** | `quickorder-deployer` | GitHub Actions deployment identity | Roles: `Cloud Run Developer`, `Artifact Registry Writer`, `Service Account User` |
| **WIF Pool & Provider** | `github-actions` / `github-main` | Keyless OIDC authentication from GitHub Actions | OIDC issuer: `https://token.actions.githubusercontent.com` |

---

## 5. Release Procedure & Traceability

1. **Feature Development:** Developers work on `feature/<issue-name>` branches off `staging`.
2. **Integration into Staging:**
   - Open Pull Request targeting `staging`.
   - CI workflow `ci-docker.yml` triggers automatically (`test-and-docker` job runs tests and verifies Docker build).
   - Teammate reviews code with substantive comments and approves.
   - PR is merged into `staging`.
3. **Release into Main:**
   - Open Release Pull Request targeting `main` from `staging`.
   - CI checks must pass green. Teammate approves.
   - PR is merged into `main`.
4. **Automated Continuous Deployment:**
   - Merge to `main` triggers GitHub Actions workflow `deploy.yml`.
   - Workflow authenticates to GCP via Workload Identity Federation (no service account keys).
   - Docker image is built and tagged with the **full 40-character commit SHA**.
   - Cloud Run Job `quickorder-migrate` applies schema migrations and seeds.
   - Cloud Run service `quickorder` is updated by **image digest** (`@sha256:...`).
   - Automated smoke test (`deploy/smoke_test.py`) verifies `/api/health`, `/api/ready`, `/`, and `/api/catalog`.
5. **How to Verify Running Commit:**
   - Open Google Cloud Run Console → Revisions → Click active revision.
   - The deployed container image tag matches the Git commit SHA from `main`.
   - In GitHub Actions → `Deploy demo` run summary → Inspect `Commit image tag` and `Digest`.
