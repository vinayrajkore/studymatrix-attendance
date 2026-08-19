# StudyMatrix Attendance — Mobile Interface Design

## Design Intent

StudyMatrix Attendance is an Android-first institutional utility for the Institute of Civil and Rural Engineering, Computer Department. The interface will use a deep navy foundation, restrained maroon accents, and gold calls-to-action to feel formal, academic, and recognizably department-led rather than like generic education software. Every primary control will be placed within easy thumb reach on a 9:16 portrait screen. The visual language follows iOS Human Interface Guidelines principles where they improve clarity—large, legible hierarchy, generous touch targets, direct manipulation, and clear feedback—while preserving Android-native permission and attendance behaviors.

## Color Choices

| Purpose | Color | Use |
|---|---|---|
| Institute navy | `#0B1F3A` | Primary headers, navigation, formal identity |
| Department maroon | `#6B1E2F` | Faculty actions and prominent alerts |
| Academic gold | `#C89B3C` | Primary action, selected states, progress highlights |
| Warm paper | `#F8F6F1` | Screen background |
| Ink | `#172033` | Primary text |
| Success green | `#237A57` | Present and verified states |
| Warning amber | `#B7791F` | Low-attendance states |

## Screen List

| Screen | Primary content and functionality |
|---|---|
| Splash and welcome | College-themed icon, institute/department name, StudyMatrix Attendance title, and a concise role entry point. |
| Sign in | Email/password access for staff and students, password visibility control, and a direct path to student registration. |
| Student registration | Full name, enrollment number, roll number, mobile number, class/division, email, password, and validation feedback. |
| Device setup | Generated `SM-<EnrollmentNumber>` device tag, copy action, Android Bluetooth Settings entry point, and verification status. |
| Student dashboard | Overall percentage, attendance health, subject cards, next lecture summary, current active attendance session, and low-attendance notice. |
| Student attendance log | Filterable date-wise records, subject percentages, mark method, and compact present/absent status. |
| Enter attendance code | Six-digit numeric code form with session validation feedback and a confirm action positioned at the bottom. |
| Notices inbox | Faculty announcements grouped by recency, unread cue, full notice view, and class targeting label. |
| Faculty dashboard | Quick actions to start attendance and issue notice, active-session status, today’s classes, and department summary. |
| Start attendance | Subject and class/division selection, scanning permission status, generate-code action, and start-session confirmation. |
| Live attendance session | Session timer, detected/expected count, roster with detected/manual/absent states, manual override controls, and final submit action. |
| Attendance records | Date, subject, and class filters; roster records; percentage summary; and CSV/PDF export controls. |
| Compose notice | Target class selector, title and body fields, send confirmation, and delivery state. |
| Timetable | Faculty-owned timetable entries with subject, room, class, and reminder setting. |
| Super-admin overview | Department attendance metrics, faculty account list, activation controls, and elevated access notice. |
| Profile and about | Role profile, sign out, permission/status information, app version, and “Developed by StudyMatrix” credit. |

## Key User Flows

| User | Flow |
|---|---|
| Student onboarding | Welcome → Student registration → account verification → device-tag setup → device name copied and Android settings opened → setup completion → Student dashboard. |
| Student code fallback | Student dashboard → Active session card or Enter Code → six-digit code → server validation → confirmation → attendance log refreshes. |
| Faculty attendance | Faculty dashboard → Start attendance → choose subject and division → accept scanning permissions → active session roster → review/manual override → submit and lock session. |
| Faculty export | Faculty dashboard → Attendance records → select date or date range and optional filters → choose CSV or PDF → system share/download action. |
| Faculty notice | Faculty dashboard → Compose notice → choose audience → write title and message → send → students receive an inbox item and notification. |
| Super-admin governance | Super-admin overview → faculty directory → create/activate/deactivate a faculty account → confirmation → account availability updates. |

## Layout and Interaction Details

Each dashboard begins with a compact identity header and status area, then places the current actionable item—active attendance session, upcoming class, or low-attendance alert—above secondary analytics. Navigation will have no more than four persistent destinations per role, with infrequent tasks reachable from a profile/menu destination. Forms use one full-width field per line, visible labels, validation in context, and keyboard-safe bottom actions. Attendance state uses both text and color so the interface remains understandable for users with color-vision differences.

Live scanning is deliberately designed as a checklist rather than a fully automated opaque process: detected names appear with the method, unconfirmed students remain actionable, and the faculty member can override every final record before submission. This preserves the PRD’s required human verification step.
