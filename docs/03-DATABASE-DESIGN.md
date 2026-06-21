# Database Design
## English Academy Indonesia — Phase 3

| Field | Value |
|---|---|
| Document | Phase 3 — Database Design |
| Depends on | 02-ARCHITECTURE.md |
| Database engine | Google Sheets (one Spreadsheet, 20 sheets/tabs) |
| Status | Draft — proceeding directly to Phase 4 |

---

## 1. Conventions used across every sheet

- **Row 1 is always the header row** — exact column names below, matched case-sensitively by `Database.gs`. Never reorder columns after data exists; the data-access layer maps by header name, not position, specifically so this is safe, but consistency still matters for readability.
- **Every primary key is a prefixed string ID**, generated server-side (e.g. `STU-00001`, `QZ-00042`), never the raw spreadsheet row number — row numbers shift when rows are sorted or deleted, IDs don't.
- **Every sheet has `CreatedAt`** (ISO datetime) at minimum; sheets that can be edited after creation also have `UpdatedAt`.
- **Foreign keys store the referenced ID as plain text**, validated in code (`Database.gs`), not via Sheets' native data validation — native dropdown validation doesn't scale to thousands of rows and isn't enforced for API-driven writes anyway.
- **Booleans are stored as `TRUE`/`FALSE`** (Sheets-native boolean rendering), not `1`/`0`, to stay readable for a non-technical admin glancing at the sheet directly.
- **JSON-shaped data** (e.g. quiz options, rubrics) is stored as a stringified JSON blob in a single cell — Sheets has no native nested-object column type, and this keeps `Database.gs` generic instead of needing a special case per content type.

---

## 2. Core relationships (overview)

The diagram above shows the backbone: a `User` becomes a `Student` or `Teacher` profile, `Teachers` own `Classes`, `Classes` enroll `Students`. Content hangs off `Modules` (`Lessons`, `Quizzes`, `Exams`, `Assignments`), and `Quizzes`/`Exams` each own a set of `Questions`. Student activity produces `Scores` (quiz/exam results) and `Submissions` (assignment uploads). The full 20-sheet schema, including sheets not shown in the simplified diagram (`Roles`, `Videos`, `Answers`, `Attendance`, `Certificates`, `Notifications`, `Settings`, `ActivityLogs`), follows below.

---

## 3. Full schema, sheet by sheet

### 3.1 Users
| Column | Type | Notes |
|---|---|---|
| UserID | string (PK) | `USR-00001` |
| Username | string | unique, used for login |
| PasswordHash | string | SHA-256 + salt (Phase 17 detail) |
| PasswordSalt | string | per-user random salt |
| Role | enum | `admin` \| `teacher` \| `student` |
| FullName | string | |
| Email | string | optional but recommended |
| Phone | string | optional |
| Status | enum | `active` \| `disabled` |
| CreatedAt | datetime | |
| LastLoginAt | datetime | nullable |

**Validation:** `Username` unique (checked in `Auth.gs` before insert); `Role` must be one of the three enum values; `Status` defaults to `active`.

### 3.2 Roles
| Column | Type | Notes |
|---|---|---|
| RoleID | string (PK) | `admin`, `teacher`, `student` |
| RoleName | string | display name |
| Description | string | |
| AccessLevel | number | 100 / 60 / 30 (admin/teacher/student) — informational, not enforced from this sheet (RBAC is enforced in code, see Architecture §3) |

A small static reference table, seeded once during setup (Phase 4), rarely written to again.

### 3.3 Students
| Column | Type | Notes |
|---|---|---|
| StudentID | string (PK) | `STU-00001` |
| UserID | string (FK → Users) | |
| NISN | string | Indonesian national student ID, optional |
| Kelas | enum | `X` \| `XI` \| `XII` |
| ClassID | string (FK → Classes) | |
| Gender | string | optional |
| BirthDate | date | optional |
| ParentContact | string | optional |
| EnrollDate | date | |

### 3.4 Teachers
| Column | Type | Notes |
|---|---|---|
| TeacherID | string (PK) | `TCH-00001` |
| UserID | string (FK → Users) | |
| NIP | string | optional employee ID |
| Subject | string | defaults to "English" |
| Bio | string | optional, shown on teacher profile |

### 3.5 Classes
| Column | Type | Notes |
|---|---|---|
| ClassID | string (PK) | `CLS-X1`, `CLS-XI-IPA2`, etc. |
| ClassName | string | e.g. "X-1", "XI IPA 2" |
| Tingkat | enum | `X` \| `XI` \| `XII` |
| TeacherID | string (FK → Teachers) | homeroom/assigned English teacher |
| AcademicYear | string | e.g. "2026/2027" |
| Status | enum | `active` \| `archived` |

### 3.6 Modules
| Column | Type | Notes |
|---|---|---|
| ModuleID | string (PK) | `MOD-X-01` ... `MOD-XII-12` |
| Tingkat | enum | `X` \| `XI` \| `XII` |
| ModuleNumber | number | order within tingkat |
| ModuleTitle | string | e.g. "Greeting", "Narrative Text" |
| LearningObjectives | string | long text |
| LearningOutcomes | string | long text |
| Status | enum | `draft` \| `published` |

Seeded with all 43 modules from the PRD curriculum (Phase 6 setup script).

### 3.7 Lessons
| Column | Type | Notes |
|---|---|---|
| LessonID | string (PK) | `LSN-00001` |
| ModuleID | string (FK → Modules) | |
| LessonTitle | string | |
| ContentHTML | string | rich text from Quill editor |
| PDFFileID | string | Google Drive file ID, nullable |
| VideoID | string (FK → Videos) | nullable |
| OrderIndex | number | display order within module |
| CreatedBy | string (FK → Teachers) | |
| CreatedAt | datetime | |
| UpdatedAt | datetime | |

### 3.8 Videos
| Column | Type | Notes |
|---|---|---|
| VideoID | string (PK) | `VID-00001` |
| LessonID | string (FK → Lessons) | nullable if uploaded standalone |
| Title | string | |
| DriveFileID | string | nullable if `SourceType = youtube` |
| SourceType | enum | `drive` \| `youtube` |
| ExternalURL | string | used when `SourceType = youtube` |
| Duration | number | seconds, optional |
| UploadedBy | string (FK → Teachers) | |
| UploadedAt | datetime | |

### 3.9 Assignments
| Column | Type | Notes |
|---|---|---|
| AssignmentID | string (PK) | `ASG-00001` |
| ModuleID | string (FK → Modules) | |
| Title | string | |
| Instructions | string | long text |
| DueDate | datetime | |
| MaxScore | number | |
| RubricJSON | string | stringified JSON: `[{criterion, maxPoints}]` |
| CreatedBy | string (FK → Teachers) | |
| CreatedAt | datetime | |

### 3.10 Submissions
| Column | Type | Notes |
|---|---|---|
| SubmissionID | string (PK) | `SUB-00001` |
| AssignmentID | string (FK → Assignments) | |
| StudentID | string (FK → Students) | |
| FileDriveID | string | uploaded PDF/image |
| SubmittedAt | datetime | |
| Status | enum | `submitted` \| `late` \| `graded` |
| Score | number | nullable until graded |
| Feedback | string | nullable |
| GradedBy | string (FK → Teachers) | nullable |
| GradedAt | datetime | nullable |

**Validation:** `Status` auto-set to `late` server-side if `SubmittedAt > Assignments.DueDate`.

### 3.11 Quizzes
| Column | Type | Notes |
|---|---|---|
| QuizID | string (PK) | `QZ-00001` |
| ModuleID | string (FK → Modules) | |
| Title | string | |
| Instructions | string | |
| TimeLimitMinutes | number | nullable = untimed |
| RandomizeQuestions | boolean | |
| MaxAttempts | number | |
| PassingScore | number | percentage |
| Status | enum | `draft` \| `published` \| `closed` |
| CreatedBy | string (FK → Teachers) | |
| CreatedAt | datetime | |

### 3.12 Exams
| Column | Type | Notes |
|---|---|---|
| ExamID | string (PK) | `EX-00001` |
| ModuleID | string (FK → Modules) | nullable if exam spans multiple modules |
| Title | string | |
| Instructions | string | |
| DurationMinutes | number | required |
| StartWindow | datetime | exam opens |
| EndWindow | datetime | exam closes |
| RandomizeQuestions | boolean | |
| AntiCheatWarning | boolean | enables tab-switch warning |
| Status | enum | `draft` \| `published` \| `closed` |
| CreatedBy | string (FK → Teachers) | |
| CreatedAt | datetime | |

### 3.13 Questions
| Column | Type | Notes |
|---|---|---|
| QuestionID | string (PK) | `QN-00001` |
| ParentType | enum | `quiz` \| `exam` |
| ParentID | string (FK → Quizzes.QuizID or Exams.ExamID) | |
| QuestionType | enum | `mc` \| `mr` \| `tf` \| `matching` \| `fillblank` \| `essay` |
| QuestionText | string | |
| OptionsJSON | string | stringified JSON, shape depends on `QuestionType` |
| CorrectAnswerJSON | string | stringified JSON; empty for `essay` (manually graded) |
| Points | number | |
| OrderIndex | number | |

**Why `ParentType` + `ParentID` instead of two separate Question sheets:** Quizzes and exams share an identical question model — duplicating the sheet (and the grading code) would mean every future question-type feature has to be built twice and kept in sync. A single sheet with a type discriminator keeps `Quiz.gs` and `Exam.gs` calling the same underlying question/grading helpers in `Database.gs`.

### 3.14 Answers
| Column | Type | Notes |
|---|---|---|
| AnswerID | string (PK) | `ANS-00001` |
| AttemptID | string | groups all answers from one attempt (generated client-side at attempt start, see §4) |
| StudentID | string (FK → Students) | |
| QuestionID | string (FK → Questions) | |
| StudentAnswerJSON | string | stringified JSON of the student's response |
| IsCorrect | boolean | nullable for `essay` until graded |
| PointsAwarded | number | nullable until graded |

### 3.15 Scores
| Column | Type | Notes |
|---|---|---|
| ScoreID | string (PK) | `SCR-00001` |
| StudentID | string (FK → Students) | |
| AttemptID | string | links back to the `Answers` rows for this attempt |
| ParentType | enum | `quiz` \| `exam` |
| ParentID | string (FK → Quizzes.QuizID or Exams.ExamID) | |
| Score | number | points earned |
| MaxScore | number | total possible points |
| Percentage | number | computed at write time |
| TimeTakenSeconds | number | |
| AttemptNumber | number | 1, 2, 3... respecting `MaxAttempts` |
| SubmittedAt | datetime | |
| GradingStatus | enum | `auto` \| `pending_manual` \| `final` — `pending_manual` when the attempt includes ungraded essay questions |

### 3.16 Attendance
| Column | Type | Notes |
|---|---|---|
| AttendanceID | string (PK) | `ATT-00001` |
| StudentID | string (FK → Students) | |
| ClassID | string (FK → Classes) | |
| Date | date | |
| Status | enum | `present` \| `absent` \| `sick` \| `permit` |
| MarkedBy | string (FK → Teachers) | |
| MarkedAt | datetime | |

**Validation:** one row per `(StudentID, Date)` — enforced in `Attendance.gs` before insert (update existing row instead of duplicating).

### 3.17 Certificates
| Column | Type | Notes |
|---|---|---|
| CertificateID | string (PK) | `CERT-00001` |
| StudentID | string (FK → Students) | |
| ModuleID or CourseRef | string | what was completed |
| CertificateNumber | string | unique, printed on the PDF and encoded in the QR |
| IssueDate | date | |
| PDFFileID | string | Google Drive file ID |
| VerificationToken | string | random token embedded in the QR's verification URL |
| Status | enum | `valid` \| `revoked` |

### 3.18 Notifications
| Column | Type | Notes |
|---|---|---|
| NotificationID | string (PK) | `NTF-00001` |
| UserID | string (FK → Users) | recipient |
| Type | enum | `new_lesson` \| `new_quiz` \| `new_exam` \| `new_assignment` \| `new_score` |
| Title | string | |
| Message | string | |
| RelatedID | string | ID of the related lesson/quiz/exam/etc. |
| IsRead | boolean | |
| CreatedAt | datetime | |

### 3.19 Settings
| Column | Type | Notes |
|---|---|---|
| SettingKey | string (PK) | e.g. `school_name`, `active_academic_year`, `logo_drive_file_id` |
| SettingValue | string | |
| Description | string | |
| UpdatedAt | datetime | |
| UpdatedBy | string (FK → Users) | |

A key-value table — deliberately schemaless so new settings can be added later without a migration.

### 3.20 ActivityLogs
| Column | Type | Notes |
|---|---|---|
| LogID | string (PK) | `LOG-000001` |
| UserID | string (FK → Users) | nullable for failed-login attempts on unknown usernames |
| Action | string | e.g. `login`, `create_lesson`, `grade_submission`, `delete_user` |
| Details | string | short JSON or text summary |
| Timestamp | datetime | |

**Note on IP address:** Apps Script web apps do not reliably expose the client's IP address to server-side code, so `ActivityLogs` intentionally has no `IPAddress` column — including one would create a false sense of audit completeness. This is called out explicitly so Phase 17 (Security) doesn't silently assume it exists.

---

## 4. Attempt grouping pattern (Quizzes/Exams)

There is deliberately no separate `Attempts` sheet. When a student starts a quiz/exam, the client generates an `AttemptID` (UUID) locally; every `Answers` row for that sitting carries it, and the single `Scores` row produced at submission also carries it. This keeps the schema at 20 sheets as scoped in the PRD while still letting `Database.gs` reconstruct a full attempt (`getAllRows('Answers').filter(r => r.AttemptID === id)`) whenever a teacher needs to review one.

---

## 5. Indexing strategy (Sheets has no real indexes)

Google Sheets has no query planner or index structure — every "query" is a full-range read filtered in Apps Script. The schema compensates with:
- **`Database.gs` caches the header-to-column-index mapping** per sheet (read once, reused), so filtering doesn't re-parse headers on every call.
- **Hot-path lookups go through `CacheService`** (Architecture §7) rather than re-scanning Sheets — e.g. a student's own `Scores` rows are cached after first fetch within a session.
- **High-growth sheets (`ActivityLogs`, `Answers`, `Submissions`) get periodic archiving** (Phase 22, Maintenance Guide) to keep the active range small, since unindexed scans get slower as row count grows.

---

## 7. Addendum — VocabularyFavorites (sheet #21)

Discovered missing during Phase 6 implementation of the Vocabulary Builder: a place to persist each student's saved words is needed (the lookup itself stays client-side per Architecture §6, but favorites must be saved server-side to follow the student across devices).

| Column | Type | Notes |
|---|---|---|
| FavoriteID | string (PK) | `FAV-00001` |
| UserID | string (FK → Users) | |
| Word | string | |
| Meaning | string | from Free Dictionary API, copied at save time |
| PartOfSpeech | string | |
| Synonyms | string | comma-joined |
| Antonyms | string | comma-joined |
| ExampleSentence | string | |
| AddedAt | datetime | |

`backend/Setup.gs` has been updated to create this sheet along with the original 20. If you already ran `createDatabaseStructure()` before this addendum, just run it again — it's safe to re-run and will add the missing tab without disturbing existing data.

---

## 6. What's next

Phase 4 turns this schema into exact, click-by-click instructions for creating all 20 sheets with the right headers in a real Google Spreadsheet — written for someone who has never opened Google Sheets' "Apps Script" menu before.
