// StudyMatrix Attendance deployment and architecture report.
#import "report-theme.typ": report-accent, report-theme
#import "@preview/glossarium:0.5.10": make-glossary, register-glossary, print-glossary, gls

#let terms = (
  (
    key: "api",
    short: "API",
    long: "Application Programming Interface",
    description: [The server interface through which the mobile client requests authentication, attendance, catalog, and reporting operations.],
  ),
  (
    key: "trpc",
    short: "tRPC",
    long: "Type-safe Remote Procedure Call",
    description: [A TypeScript procedure layer that connects the app client to the Node.js backend with shared input and output types.],
  ),
  (
    key: "orm",
    short: "ORM",
    long: "Object-Relational Mapper",
    description: [A data-access layer that maps typed application queries to SQL. StudyMatrix uses Drizzle ORM.],
  ),
  (
    key: "paas",
    short: "PaaS",
    long: "Platform as a Service",
    description: [A managed hosting platform that runs an application service and exposes it through a public URL.],
  ),
  (
    key: "eas",
    short: "EAS",
    long: "Expo Application Services",
    description: [Expo's cloud build and update service, used to create Android binaries that include custom native modules.],
  ),
)

#register-glossary(terms)
#show: make-glossary
#show: report-theme.with(
  title: "StudyMatrix Attendance",
  author: "Vinayraj Kore",
  rhythm: "report",
  running-header: true,
)

// ---------- Title page ----------
#page(margin: (top: 18%, x: 2.2cm), numbering: none, header: none)[
  #set par(first-line-indent: 0em)
  #align(center)[
    #image("../assets/images/college-logo.png", width: 3.0cm)
    #v(1.1em)
    #text(size: 26pt, weight: "bold", fill: report-accent)[StudyMatrix Attendance]
    #v(0.45em)
    #text(size: 14pt, fill: luma(75))[Technical Architecture, Deployment, and Free-Tier Hosting Report]
    #v(2.0em)
    #line(length: 44%, stroke: 0.7pt + report-accent)
    #v(1.8em)
    #text(size: 11pt)[
      Institute of Civil and Rural Engineering — Computer Department \
      Prepared for project testing and deployment planning \
      Developed by Vinayraj Kore \
      #datetime.today().display("[day] [month repr:long] [year]")
    ]
  ]
]

// ---------- Table of contents ----------
#page(numbering: none, header: none)[
  #outline(title: [Contents], indent: 1.5em)
]

// ---------- Main body ----------
#counter(page).update(1)

= Executive Summary

StudyMatrix Attendance is an Android-first college attendance application for the ICRE Computer Department. It combines local student and administrator credentials, catalog-driven attendance sessions, Bluetooth Classic device-name discovery, an attendance-code fallback, notifications, charts, and PDF/CSV exports. The mobile application communicates with a Node.js service through #gls("trpc") procedures, while the server persists application data through #gls("orm") queries.

The source currently supports a credible *free-tier test or hobby deployment* when paired with a free Node web service and a MySQL-compatible managed database. The proposed no-migration combination is **Render Free Web Service + TiDB Cloud Starter**. This is appropriate for demonstrations, limited pilots, and technical validation; it is not a production-grade commitment because free instances have availability, restart, quota, and backup limitations. [1] [3]

> The current repository uses `mysql2` and `drizzle-orm/mysql2`. Although earlier planning referenced PostgreSQL, a PostgreSQL deployment is not a drop-in target for the checked-in code. It requires a purposeful Drizzle schema, driver, migration, and connection-string migration before use.

= System Scope and Current Capability

The system is designed around three connected roles: students configure a persistent `SM-<EnrollmentNumber>` Bluetooth name and mark attendance through discovery or code; faculty create and review sessions; and administrators maintain catalog information, notices, records, and report exports. The system is Android-first because Bluetooth Classic discovery and device-name operations require a custom Android build and native permissions.

#table(
  columns: (1.2fr, 1.7fr, 1.4fr),
  inset: 6pt,
  stroke: 0.4pt + luma(185),
  table.header([*Area*], [*Implemented responsibility*], [*Operational note*]),
  [Student experience], [Registration, enrollment/password login, generated device tag, Bluetooth self-test, attendance history, profile verification, and attendance-code fallback.], [Uses a unique test enrollment number during pilot validation.],
  [Faculty experience], [Session planning, catalog management, Bluetooth scanning, roster review, unmatched-device handling, manual linking, reports, and exports.], [Faculty review remains part of the attendance control.],
  [Backend], [Credential hashing, role checks, tag-to-student matching, attendance records, catalog persistence, and reporting queries.], [Node.js service exposes tRPC procedures.],
  [Native Android], [Bluetooth Classic bridge, Android device-name settings, Nearby devices permissions, notifications, sharing, and PDF export.], [Requires custom APK/development build; Expo Go is insufficient.],
)

= Technology Stack and Languages

#table(
  columns: (1.1fr, 1.4fr, 1.8fr),
  inset: 6pt,
  stroke: 0.4pt + luma(185),
  table.header([*Layer*], [*Language / framework*], [*Purpose in StudyMatrix*]),
  [Mobile application], [TypeScript, React 19, React Native 0.81, Expo SDK 54, Expo Router], [Android-first screens, navigation, stateful user flows, device integration, and application configuration.],
  [User interface], [TypeScript, NativeWind / Tailwind-style tokens, React Native Reanimated], [ICRE branding, responsive cards, form controls, animations, and feedback states.],
  [Backend], [TypeScript, Node.js, Express, tRPC, Zod], [Validated API procedures, authorization boundaries, local authentication, and business rules.],
  [Database], [SQL, Drizzle ORM, `mysql2`], [Users, local credentials, student/faculty profiles, catalog items, sessions, attendance, and notices.],
  [Bluetooth], [TypeScript bridge to `react-native-bluetooth-classic`], [Android Bluetooth Classic discovery filtered to `SM-<EnrollmentNumber>` device names.],
  [Reporting and tests], [HTML/CSS for print, Expo Print/Sharing, Vitest], [PDF/CSV exports, share sheets, and deterministic attendance/domain tests.],
)

= Technical Flow

== 1. Registration and device-tag preparation

The student registers with name, enrollment number, class/division, mobile number, and password. The server hashes the password and generates the canonical device tag, for example `SM-21CE045`. The student sets the Android Bluetooth device name to the exact tag. The application can check local adapter availability, but the final verification happens only after a faculty scan resolves the broadcast tag to the registered record.

#align(center)[
  #grid(
    columns: (1fr, auto, 1fr, auto, 1fr),
    column-gutter: 7pt,
    align(center)[*Student app* \
    registration], [#text(fill: report-accent)[→]],
    align(center)[*Node.js API* \
    validation + tag generation], [#text(fill: report-accent)[→]],
    align(center)[*MySQL-compatible DB* \
    profile + credentials],
  )
]

== 2. Bluetooth attendance and fallback

During a faculty session, the faculty phone requests Android Bluetooth permissions, starts Classic discovery, normalizes discovered names to uppercase, and accepts only names following `SM-[A-Z0-9]+`. The client sends recognized tags and the active class/division to the backend. The backend matches the tag against the registered student device tag *and* class, then returns a roster candidate for faculty review. If discovery is unavailable or ambiguous, the student can use the expiring six-digit attendance-code flow.

#align(center)[
  #grid(
    columns: (1fr, auto, 1fr, auto, 1fr, auto, 1fr),
    column-gutter: 6pt,
    align(center)[*Student phone* \
    `SM-…` name], [#text(fill: report-accent)[→]],
    align(center)[*Faculty scan* \
    tag filter], [#text(fill: report-accent)[→]],
    align(center)[*Class-scoped API match*], [#text(fill: report-accent)[→]],
    align(center)[*Faculty review* \
    attendance record],
  )
]

The device name is a proximity signal, not an unconditional proof of personal identity. The class restriction, manual review, session expiry, audit records, and attendance-code fallback are intentional controls around that limitation.

= Recommended Free-Tier Deployment Architecture

== Recommended direct path: Render + TiDB Cloud Starter

The most direct free-tier path for the current code is a Render Free Node web service paired with TiDB Cloud Starter. Render can host Node/Express web services on free instances, while TiDB Cloud Starter is MySQL-compatible and therefore aligns with the project’s present `mysql2` adapter. Render's own documentation states that Free instances are for testing, hobby work, and previews rather than production, and describes additional free-database limitations such as restarts and no backups. [1] TiDB Cloud Starter publishes a monthly free allowance that includes 5 GiB row storage and 50 million request units per eligible instance. [3]

| Component | Free-tier recommendation | Configuration required | Important limitation |
| --- | --- | --- | --- |
| API service | Render Free Web Service | Connect Git repository; set build command and start command; configure secrets. | Free services are a test/hobby path, not a production SLA. [1] |
| Database | TiDB Cloud Starter | Create a MySQL-compatible cluster; set `DATABASE_URL` with its TLS-capable connection string. | Quotas apply; no production backup policy should be assumed. [3] |
| Android test binary | Expo #gls("eas") free allocation or a local Android build | Build a custom Android binary because Bluetooth Classic is native. | Free EAS builds are limited and low-priority; limits reset monthly. [4] |
| Public store distribution | Private APK link or managed internal testing | Sign the Android release and distribute to approved test users. | Google Play publication has a separate one-time developer registration fee; it is not a free publishing route. [5] |

== Concrete service commands

Render’s Node deployment guidance requires application-specific build and start commands. [2] The repository already defines the following production commands:

```bash
# Render build command
corepack enable && pnpm install --frozen-lockfile && pnpm build

# Render start command
pnpm start
```

The database schema must be created before the application is used. In a controlled deployment job or one-off administrative shell, run the repository migration script against the TiDB database:

```bash
pnpm db:push
```

Run migrations deliberately and once per release; do not treat a schema migration as an unreviewed side effect of every application restart.

== Required environment variables

| Variable | Where it belongs | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Render API service | MySQL-compatible TiDB connection string used by Drizzle. |
| `JWT_SECRET` | Render API service | Cookie/session signing secret used by the server core. Generate a high-entropy value; never commit it. |
| `NODE_ENV=production` | Render API service | Enables production runtime behavior. |
| `EXPO_PUBLIC_API_BASE_URL` | Android build environment | Public HTTPS API base URL used by the mobile application, for example the Render service URL. |
| OAuth / Forge variables | Only if the Manus-specific core routes remain active | The current core includes platform OAuth and storage helpers. Local student/admin credentials do not require them, but an independent deployment must disable, replace, or configure those platform-specific features before production. |

== Deployment sequence

1. Place the repository in a private GitHub repository and keep `.env` files, passwords, and database URLs out of version control.
2. Create the TiDB Cloud Starter database and save its MySQL-compatible `DATABASE_URL` in Render as a secret.
3. Create a Render Web Service from the repository. Use the documented commands above and add `DATABASE_URL`, `JWT_SECRET`, and `NODE_ENV`.
4. Run `pnpm db:push` once against the target database, then verify the API health endpoint and register one unique test student.
5. Set `EXPO_PUBLIC_API_BASE_URL` to the deployed HTTPS service URL before generating the Android build.
6. Generate a custom Android build. The Bluetooth Classic module, Android device-name screen, permissions, notifications, sharing, and PDF generation should be validated on real phones, not only in a web preview.
7. Perform a two-phone Bluetooth test: register the student device tag, make the student device discoverable where required, run the faculty scan, confirm a class-scoped match, then test the code fallback.

= Alternative Routes and Decision Guidance

Railway can simplify a Node service and database deployment, but its official pricing presents a 30-day free trial with credits followed by a monthly charge. It should be treated as a low-cost trial rather than an indefinitely free baseline. [6] Render Free plus TiDB Cloud Starter is therefore the more appropriate report recommendation for a limited pilot that follows the current MySQL-compatible code.

If the institution requires PostgreSQL, complete a planned migration first. That work includes replacing the MySQL Drizzle imports and driver, adapting schema definitions and migrations, moving data-access queries, provisioning PostgreSQL, and running new end-to-end tests. Only after this migration would Render Postgres or another PostgreSQL provider be a consistent target.

= Security, Operations, and Testing Boundaries

The free-tier architecture is suitable for an educational demonstration. Before handling real attendance records at institutional scale, add a predictable backup policy, monitored error logs, uptime expectations, password-rotation process, a privacy notice, HTTPS-only mobile configuration, and a paid or institution-managed deployment. Free database restarts, limited quotas, and no managed backup promise are not acceptable controls for a production attendance system. [1]

For Bluetooth attendance, testing requires a custom Android build and two physical devices. The student phone broadcasts the configured `SM-<EnrollmentNumber>` device name, while the faculty phone discovers and matches the tag. The browser preview cannot validate the native Bluetooth Classic bridge. Android's Bluetooth permission and discovery requirements must be accepted on the participating devices. [7] [8]

= Glossary

#print-glossary(terms, show-all: true, disable-back-references: true)

= References

[1] #link("https://render.com/docs/free")[Render, *Deploy for Free*.]

[2] #link("https://render.com/docs/deploy-node-express-app")[Render, *Deploy a Node Express App on Render*.]

[3] #link("https://www.pingcap.com/tidb-cloud-starter-pricing-details/")[PingCAP, *TiDB Cloud Starter Pricing Details*.]

[4] #link("https://docs.expo.dev/billing/plans/")[Expo, *Subscriptions, Plans, and Add-ons*.]

[5] #link("https://support.google.com/googleplay/android-developer/answer/6112435")[Google Play Console Help, *Get Started with Play Console*.]

[6] #link("https://railway.com/pricing")[Railway, *Pricing*.]

[7] #link("https://developer.android.com/develop/connectivity/bluetooth/bt-permissions")[Android Developers, *Bluetooth Permissions*.]

[8] #link("https://developer.android.com/develop/connectivity/bluetooth/find-bluetooth-devices")[Android Developers, *Find Bluetooth Devices*.]
