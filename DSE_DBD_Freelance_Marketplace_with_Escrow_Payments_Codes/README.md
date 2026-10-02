# FreelanceHub

FreelanceHub is a full-stack freelance marketplace where clients publish projects, freelancers submit proposals, and both parties manage contracts, milestones, escrow, messages, and disputes.

## Architecture

| Service | Technology | Local URL | Responsibility |
| --- | --- | --- | --- |
| Frontend | React 19, Vite | http://localhost:5173 | Marketplace workspace and authentication UI (run separately) |
| API gateway | Node.js, Express | http://localhost:3000 | CORS, security headers, rate limiting, and proxying |
| Backend | Java 21, Spring Boot | http://localhost:8080 | Authentication, marketplace, contracts, escrow, and persistence |
| Database | MySQL 8.4 | localhost:3306 | Application data |

The browser should use the API gateway in a deployed environment. For local frontend development, Vite proxies same-origin `/api` requests to Spring Boot, avoiding browser CORS issues regardless of which local Vite port is available. Set `VITE_API_URL` only when intentionally routing the frontend through the API gateway. The Docker Compose stack starts MySQL (`library_db`), Spring Boot, and the API gateway; start the Vite frontend separately.

## Prerequisites

- Docker Desktop with Compose
- Node.js 20 or newer
- Java 21 and Maven 3.9+ when running the backend outside Docker

## Run the complete stack

```powershell
Copy-Item .env.example .env
docker compose up --build
```

In another terminal, start the frontend:

```powershell
Set-Location Frontend\freelance-marketplace
npm install
$env:VITE_API_URL = "http://localhost:3000/api"
npm run dev
```

The first startup may take a few minutes while Maven and npm dependencies are downloaded. Stop the stack with `Ctrl+C`, or use `docker compose down`. Database data is kept in the `mysql_data` volume.

## Run services individually

### Backend

```powershell
Set-Location Backend\freelance-marketplace
mvn spring-boot:run
```

The backend uses MySQL (`library_db`) by default, using the existing datasource credentials in the application configuration. Override the connection with `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` as needed. The H2 profile is reserved for automated tests.

The H2 test profile seeds local-only accounts (`client@example.com` / `client123`, `freelancer@example.com` / `freelancer123`, and `priya@example.com` / `priya123`). The MySQL profile does not seed these accounts. Do not use the H2 seed credentials in production. If your MySQL account cannot create databases, run `project.sql` in MySQL Workbench before starting the application.

### Optional presenter demo data

To seed reusable client and freelancer logins plus sample projects, a funded contract, milestone deliverables, a dispute, messages, and notifications into your local MySQL database, enable the opt-in demo profile when starting the backend:

```powershell
Set-Location Backend\freelance-marketplace
$env:SPRING_PROFILES_ACTIVE = "mysql,demo"
$env:DEMO_SEED_ENABLED = "true"
mvn spring-boot:run
```

Sign in at the frontend with either account:

| Role | Email | Password |
| --- | --- | --- |
| Client | `demo.client@example.com` | `DemoClient123!` |
| Freelancer | `demo.freelancer@example.com` | `DemoFreelancer123!` |

The client has an open project with no proposal yet, and an active project with a funded contract and sample dispute. The freelancer can submit a proposal to the open project, review the existing contract, submit a new milestone deliverable, and download the sample submission. The client can review that submission, release an approved milestone, view the dispute, and message the freelancer. Re-running the seed does not duplicate workflow data; it restores the passwords for these reserved demo accounts. Demo credentials are intentionally public and must only be used in a local presentation database, never in a deployed or production environment. Passwords can be overridden with `DEMO_CLIENT_PASSWORD` and `DEMO_FREELANCER_PASSWORD`.

Freelancers attach one deliverable file (up to 10 MB) when submitting milestone work. The file is stored in MySQL and can be opened or downloaded by either contract participant. Clients can approve submitted work or request changes with written feedback; freelancers can review the feedback and resubmit an updated file.

### API gateway

```powershell
Set-Location API
Copy-Item .env.example .env
npm install
npm run dev
```

### Frontend

```powershell
Set-Location Frontend\freelance-marketplace
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:3000/api` when running the frontend through the gateway.

## Quality checks

Run the same checks used by CI:

```powershell
Set-Location Frontend\freelance-marketplace
npm run lint
npm run build

Set-Location ..\..\Backend\freelance-marketplace
mvn test
```

## Configuration and security

Secrets belong in `.env` or your deployment secret manager, never in source control. The default values in Compose are intentionally suitable only for local development. Production deployments should provide a strong `JWT_SECRET`, a non-root database user, HTTPS, a restricted `FRONTEND_URL`, and a migration-managed database schema.

`project.sql` defines the `library_db` MySQL tables to match the JPA entities and is for schema setup/development. The backend currently uses Hibernate `ddl-auto=update`; use a versioned migration tool before production deployment. Escrow funding and payment release currently update an application ledger only; no card, bank, or payout provider is connected, so the app must not be used to collect or transfer real money.

Health endpoints:

- API gateway: `GET /health`
- Spring Boot: `GET /health`
