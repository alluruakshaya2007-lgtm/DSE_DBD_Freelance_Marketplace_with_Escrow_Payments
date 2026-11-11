# SmartCare

SmartCare is a hospital bed management and operations project with a Spring Boot
API and a React operations dashboard. Use fictional demonstration data only.

## Project structure

- `backend/` — Java 21, Spring Boot, Spring Data JPA, and MySQL/H2 profiles.
- `frontend/` — React, Vite, TypeScript, and the operations dashboard.
- `reference-notebooks/` — not copied or modified; the supplied notebooks remain
  in the sibling `Documents/SmartCare/reference-notebooks` directory.

## Run locally

Requirements: Java 21+, Maven 3.9+, Node.js 20.19+ (or 22.12+), and npm.

1. In a PowerShell terminal from the project directory, create a local JWT key
   and bootstrap administrator, then start the API:

   ```powershell
   $secretBytes = New-Object byte[] 32
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($secretBytes)
   $rng.Dispose()
   $env:SMARTCARE_JWT_SECRET = [Convert]::ToBase64String($secretBytes)
   $env:SMARTCARE_BOOTSTRAP_ADMIN_USERNAME = 'admin'
   $securePassword = Read-Host 'Choose an admin password (at least 12 characters)' -AsSecureString
   $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
   try {
     $env:SMARTCARE_BOOTSTRAP_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
   } finally {
     [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
   }
   Set-Location .\backend
   mvn spring-boot:run
   ```

   Keep this terminal open. On the first run, sign in with the username and
   password you configured; the bootstrap process does not reset an existing
   account's password.
2. In a second terminal from the project directory, start the UI:

   ```powershell
   Set-Location .\frontend
   npm ci
   npm run dev
   ```

3. Open `http://localhost:5173` and sign in. The UI stores the short-lived JWT
   in session storage and sends it to the API automatically.

The default local profile uses a file-backed H2 database at
`backend/data/smartcare`. It inserts fictional demo wards and beds on first
startup. The API requires a base64 JWT secret containing at least 32 bytes and
an initial admin password of at least 12 characters.

For MySQL, set `SPRING_PROFILES_ACTIVE=mysql` and configure `DB_URL`, `DB_USER`,
`DB_PASSWORD`, `SMARTCARE_JWT_SECRET`, and the bootstrap administrator variables
before starting the backend for local development. Do not put credentials in
source control.

## Initial API

- `POST /api/auth/login` and `GET /api/auth/me` — authenticate and inspect the
  current account.
- `GET /api/dashboard/summary` — persisted bed counts and ward occupancy.
- `GET|POST /api/wards` — list and create wards.
- `GET|POST /api/beds` — list and create beds.
- `PATCH /api/beds/{id}/status` — change a bed status using the allowed status
  transitions.
- Patient, allocation, admission, transfer, cleaning, and allocation-settings
  endpoints are also present in the backend; see their controllers under
  `backend/src/main/java/com/smartcare`.

## Current scope

See [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) for implemented and pending
work. This project is not a production-ready clinical system and must not be used with
real patient information. Authentication and role checks are implemented, but
the frontend currently exposes only the dashboard, bed, and ward screens.
Severity-based placement is operational decision support only, not validated
clinical triage.

## Allocation policy conflict

The supplied notebooks disagree about severity 10: one assigns ICU and the
other assigns Emergency. The API supports an administrator-configurable policy;
set and review that policy before using allocation recommendations. No clinical
policy is silently selected.
