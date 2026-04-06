# GymSync Testing Report (Milestone 03)

**Date:** April 6, 2026  
**Project:** GymSync  
**Backend Test Command:** `npm test` (run from `src/backend`)

## 1) Testing Scope

This milestone testing focused on backend reliability and API behavior for core workflows:

- Health endpoints
- Authentication (`register`, `login`)
- Workout template CRUD workflow
- Exercise endpoints
- Validation and basic security checks (invalid IDs, malformed/oversized input)

## 2) Test Environment

- **OS:** Windows (Code With Me session)
- **Runtime:** Node.js
- **Package Manager:** npm
- **Frameworks/Libraries:** Jest, Supertest
- **Backend:** Express + PostgreSQL codebase
- **Test Mode:** `NODE_ENV=test`

## 3) Test Approach

We used automated API tests with Jest + Supertest at the route/controller level.

- Endpoint behavior was validated for expected status codes and response structure.
- Workflow/state tests were included (create -> read -> update -> delete).
- Validation/security tests were included for bad IDs and invalid payloads.
- Database calls were mocked in automated tests to keep test runs deterministic and fast.

## 4) Results Summary

- **Test Suites:** 5 passed / 5 total
- **Tests:** 21 passed / 21 total
- **Pass Rate:** 100%
- **Execution Time:** ~2.1s

### Included Suites

1. `health.test.js`
2. `workouts.crud.test.js`
3. `auth.api.test.js`
4. `workouts.exercises.test.js`
5. `validation.security.test.js`

## 5) Representative Test Coverage

| ID | Area | Test Case | Expected | Result |
|---|---|---|---|---|
| T-01 | Health | `GET /health` | 200 + `{status:"ok"}` | Pass |
| T-02 | Health | `GET /api/health` | 200 + `{status:"ok"}` | Pass |
| T-03 | Auth | Register with missing fields | 400 | Pass |
| T-04 | Auth | Register duplicate user/email | 400 | Pass |
| T-05 | Auth | Register valid user | 201 | Pass |
| T-06 | Auth | Login wrong password | 401 | Pass |
| T-07 | Auth | Login valid credentials | 200 | Pass |
| T-08 | Workouts | Create workout | 201 | Pass |
| T-09 | Workouts | Read created workout | 200 + matching data | Pass |
| T-10 | Workouts | Update workout | 200 + updated data | Pass |
| T-11 | Workouts | Delete workout | 200 | Pass |
| T-12 | Validation | Invalid workout ID (`abc`) | 400 | Pass |
| T-13 | Validation | Oversized/invalid payload | 400 | Pass |
| T-14 | Exercises | Exercise create/read/update/delete handlers | Expected handling/status | Pass |

## 6) Database Integration Verification

Automated tests mock DB interactions for repeatability.  
For milestone verification, DB behavior was validated through controller/query-path execution and schema constraints in application logic.

Recommended manual DB spot checks (for demo evidence):
- Create workout -> row appears in `WorkoutTemplates`
- Update workout -> row fields changed
- Delete workout -> row removed
- Exercise operations map correctly to `Exercises` and `TemplateExercises`

## 7) Validation & Security Hygiene Evidence

The backend demonstrates server-side checks for:
- Required fields
- Type/format checks (IDs, email, string lengths)
- Rejection of malformed/invalid payloads
- Safe parameterized SQL usage in controllers (`$1`, `$2`, ...)

## 8) Limitations

- Automated tests currently use mocked DB clients (not a full live-DB integration suite).
- No load/performance testing in this milestone.
- Authentication token/session flows can be expanded further in future tests.

## 9) Conclusion

For Milestone 03 scope, backend testing is stable and repeatable, with **21/21 passing tests** across core API workflows, validation paths, and baseline security checks. Remaining risks are documented and are mainly around deeper integration/performance coverage rather than core functional correctness.
