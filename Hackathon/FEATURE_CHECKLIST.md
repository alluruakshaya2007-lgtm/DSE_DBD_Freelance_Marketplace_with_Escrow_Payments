# Feature Checklist

Legend: `[x]` implemented and verified, `[~]` partial/in progress, `[ ]` pending.

## Foundation

- [x] Spring Boot API and relational persistence (local H2; MySQL profile)
- [x] JWT authentication, password hashing, and backend role authorization
- [x] Centralized API error handling and request validation

## Hospital management

- [~] Patient registration, profile, search, filtering, and pagination (API)
- [ ] Ward create, edit, and delete
- [~] Ward listing/creation and capacity/occupancy metrics
- [~] Bed listing, creation, and status changes
- [~] Bed isolation capability and allocation history
- [ ] Interactive bed map

## Operations and intelligence

- [~] Explainable allocation, severity/FIFO queue, and configurable severity-10 rule (API)
- [~] Waiting list and allocation recommendations (API)
- [~] Admissions, transfers, discharges, and cleaning workflows (API)
- [ ] Staff and equipment management
- [ ] Python prediction service and evaluated baseline
- [ ] Isolated what-if simulation
- [~] Allocation settings (API); analytics, reports, audit logs, and notifications

## User experience and quality

- [~] Responsive dashboard with API-backed metrics
- [x] Light/dark/system theme support
- [~] Dashboard, bed, and ward routes with loading/error/empty states
- [~] Integration coverage for core bed/ward APIs and authorization
- [ ] API documentation, ER diagram, and end-to-end demo guide
