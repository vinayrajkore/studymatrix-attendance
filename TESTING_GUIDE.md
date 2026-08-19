# StudyMatrix Attendance: Backend and Test Guide

## Current backend

StudyMatrix Attendance currently uses an **Expo mobile client** connected to a **Node.js/Express server** through type-safe **tRPC** procedures. The server code is located in `server/routers.ts`, the database access layer is in `server/db.ts`, and the application data models are in `drizzle/schema.ts`.

The checked-in adapter currently uses `drizzle-orm/mysql2`. Therefore, the current service expects a **MySQL or TiDB-compatible `DATABASE_URL`**, not PostgreSQL. This is an important deployment boundary: use a MySQL-compatible managed database for the present codebase, or complete a deliberate Drizzle schema and adapter migration before selecting PostgreSQL for production.

| Layer | Current implementation | Purpose |
| --- | --- | --- |
| Mobile client | Expo / React Native | Student and faculty user interface, Bluetooth and file-sharing features |
| API | Node.js, Express, tRPC | Validates requests and applies role rules |
| Database | Drizzle with MySQL-compatible driver | Stores profiles, credentials, subjects, sessions, attendance, and notices |
| Local authentication | Hashed local credentials | Student registration/login and administrator login |

## Test the live connection

On the welcome screen, select **Test backend connection**. The test makes a read-only API request and executes a small database read. It does not create, alter, or delete attendance data. A successful response states that the API is online and the attendance database is connected.

## End-to-end testing sequence

First, run the backend connection test. Then open **Student**, select registration, and create a test account using a unique enrollment number. Keep the generated Bluetooth tag for the device-name setup test. Sign in with that enrollment number and password to test the student dashboard, Bluetooth setup, attendance-code flow, and profile.

Next, open **Faculty & Administration**. On a fresh database, the first administrator login automatically initializes the administrator account. Use the initial password `admin@2026`, then set a new password when prompted. In the faculty workspace, create a test subject, start a test session, run a Bluetooth scan or use the attendance-code fallback, and export a report.

> Do not use real student data or a shared production class while testing. Use distinctive test enrollment numbers and delete test catalog entries after validation where appropriate.

## Physical Android validation

The preview is appropriate for user-interface and API checks. Bluetooth Classic discovery, Android device-name settings, notification permissions, PDF sharing, and the final PDF appearance must be tested from an Android development build or APK on a physical phone. Before production deployment, configure the same environment variables and database connection in the selected hosting platform.
