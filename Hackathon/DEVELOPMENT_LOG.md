# Development Log

## Phase 0 — Requirements and environment inspection

- Reviewed the full SmartCare specification and both supplied notebooks.
- The notebooks contain conflicting severity-10 mappings: ICU in
  `AI_Bed_Management_And_Allocation_System (1).ipynb` and Emergency in
  `ai_bed_management_and_allocation_system.ipynb`.
- The notebooks are in the sibling `Documents/SmartCare/reference-notebooks`
  folder and have not been modified.
- The active `Care` workspace was empty. Java 25, Maven 3.9.15, Node 25, and npm
  11 are available; MySQL and Python are not on PATH.
- Implementation is restricted to this `Care` workspace.

## Phase 1 — Runnable application foundation

- Implemented the Spring Boot API and React UI with persisted ward and bed data.
- Added local H2 persistence, a MySQL runtime profile, and fictional first-run
  seed records.
- Added ward/bed create and list APIs, status updates with transition checks,
  optimistic locking, and persisted dashboard metrics.
- Added dashboard charts, bed and ward pages, theme persistence, loading/error
  states, and a responsive layout.
- Verified with `mvn test` (4 integration tests), `npm run lint`, and
  `npm run build`. The frontend build succeeds but reports a large-chunk
  optimization warning.
- Live smoke-tested the UI, dashboard summary, ward list, and bed list over
  HTTP; stopped both local servers after verification.
- Authentication, allocation, and all later modules remain pending. The app is
  localhost-bound and not ready for real patient data or clinical use.

## Phase 2 — Full-stack integration repairs

- Connected the React dashboard to the backend JWT login endpoint, added
  session-scoped token handling and responsive sign-out, and hid bed/ward
  actions the signed-in role cannot perform.
- Fixed the bed-creation request to include its required equipment list.
- Fixed backend compilation gaps in allocation/settings and made integration
  test cleanup remove cleaning records before their referenced beds.
- Updated the Windows local-run instructions and feature checklist to reflect
  the authentication and workflow APIs already present in the source.
- Verified with `npm run lint`, `npm run build`, and `mvn test` (6 integration
  tests). The frontend build succeeds with the existing large-chunk warning.
