/**
 * Setup.gs
 * English Academy Indonesia
 *
 * Run ONCE to create the entire database structure (20 sheets with correct
 * headers) inside whatever spreadsheet this script is bound to, then seed
 * the Roles reference table and the 43-module Kurikulum Merdeka curriculum.
 *
 * HOW TO RUN (see docs/04-GOOGLE-SHEETS-SETUP.md for the full click-by-click guide):
 *   1. Open the Apps Script editor attached to your spreadsheet.
 *   2. Paste this file in as Setup.gs.
 *   3. Select "createDatabaseStructure" from the function dropdown at the top.
 *   4. Click Run. Approve the permissions prompt the first time.
 *   5. Check the spreadsheet — 20 tabs should now exist with headers in row 1.
 */

const DB_SCHEMA = {
  Users: ['UserID', 'Username', 'PasswordHash', 'PasswordSalt', 'Role', 'FullName', 'Email', 'Phone', 'Status', 'CreatedAt', 'LastLoginAt'],
  Roles: ['RoleID', 'RoleName', 'Description', 'AccessLevel'],
  Students: ['StudentID', 'UserID', 'NISN', 'Kelas', 'ClassID', 'Gender', 'BirthDate', 'ParentContact', 'EnrollDate'],
  Teachers: ['TeacherID', 'UserID', 'NIP', 'Subject', 'Bio'],
  Classes: ['ClassID', 'ClassName', 'Tingkat', 'TeacherID', 'AcademicYear', 'Status'],
  Modules: ['ModuleID', 'Tingkat', 'ModuleNumber', 'ModuleTitle', 'LearningObjectives', 'LearningOutcomes', 'Status'],
  Lessons: ['LessonID', 'ModuleID', 'LessonTitle', 'ContentHTML', 'PDFFileID', 'VideoID', 'OrderIndex', 'CreatedBy', 'CreatedAt', 'UpdatedAt'],
  Videos: ['VideoID', 'LessonID', 'Title', 'DriveFileID', 'SourceType', 'ExternalURL', 'Duration', 'UploadedBy', 'UploadedAt'],
  Assignments: ['AssignmentID', 'ModuleID', 'Title', 'Instructions', 'DueDate', 'MaxScore', 'RubricJSON', 'CreatedBy', 'CreatedAt'],
  Submissions: ['SubmissionID', 'AssignmentID', 'StudentID', 'FileDriveID', 'SubmittedAt', 'Status', 'Score', 'Feedback', 'GradedBy', 'GradedAt'],
  Quizzes: ['QuizID', 'ModuleID', 'Title', 'Instructions', 'TimeLimitMinutes', 'RandomizeQuestions', 'MaxAttempts', 'PassingScore', 'Status', 'CreatedBy', 'CreatedAt'],
  Exams: ['ExamID', 'ModuleID', 'Title', 'Instructions', 'DurationMinutes', 'StartWindow', 'EndWindow', 'RandomizeQuestions', 'AntiCheatWarning', 'Status', 'CreatedBy', 'CreatedAt'],
  Questions: ['QuestionID', 'ParentType', 'ParentID', 'QuestionType', 'QuestionText', 'OptionsJSON', 'CorrectAnswerJSON', 'Points', 'OrderIndex'],
  Answers: ['AnswerID', 'AttemptID', 'StudentID', 'QuestionID', 'StudentAnswerJSON', 'IsCorrect', 'PointsAwarded'],
  Scores: ['ScoreID', 'StudentID', 'AttemptID', 'ParentType', 'ParentID', 'Score', 'MaxScore', 'Percentage', 'TimeTakenSeconds', 'AttemptNumber', 'SubmittedAt', 'GradingStatus'],
  Attendance: ['AttendanceID', 'StudentID', 'ClassID', 'Date', 'Status', 'MarkedBy', 'MarkedAt'],
  Certificates: ['CertificateID', 'StudentID', 'ModuleID', 'CertificateNumber', 'IssueDate', 'PDFFileID', 'VerificationToken', 'Status'],
  Notifications: ['NotificationID', 'UserID', 'Type', 'Title', 'Message', 'RelatedID', 'IsRead', 'CreatedAt'],
  Settings: ['SettingKey', 'SettingValue', 'Description', 'UpdatedAt', 'UpdatedBy'],
  ActivityLogs: ['LogID', 'UserID', 'Action', 'Details', 'Timestamp'],
  // Addendum to the original 20-sheet schema (Database Design §3): the
  // Vocabulary Builder's "favorite words" feature needs somewhere to
  // persist per-student saved words. See docs/03-DATABASE-DESIGN.md
  // addendum note.
  VocabularyFavorites: ['FavoriteID', 'UserID', 'Word', 'Meaning', 'PartOfSpeech', 'Synonyms', 'Antonyms', 'ExampleSentence', 'AddedAt']
};

const CURRICULUM_X = [
  'Greeting', 'Introduction', 'Self Introduction', 'Describing People', 'Describing Animals',
  'Describing Places', 'Describing Objects', 'Daily Activities', 'Simple Present Tense',
  'Present Continuous Tense', 'Narrative Text', 'Recount Text', 'Procedure Text',
  'Invitation', 'Announcement', 'Vocabulary Building'
];

const CURRICULUM_XI = [
  'Opinion', 'Suggestion', 'Obligation', 'Prohibition', 'Formal Letter', 'Personal Letter',
  'Exposition Text', 'Explanation Text', 'Report Text', 'Passive Voice', 'Conditional Sentences',
  'Cause and Effect', 'Speaking Practice', 'Listening Practice', 'Academic Vocabulary'
];

const CURRICULUM_XII = [
  'Discussion Text', 'Review Text', 'News Item', 'Job Application Letter', 'Curriculum Vitae',
  'Debate', 'Presentation Skills', 'Public Speaking', 'TOEFL Preparation', 'IELTS Preparation',
  'Advanced Grammar', 'Professional English'
];

/**
 * Main entry point — creates all 20 sheets with headers, then seeds
 * the Roles table and the full 43-module curriculum. Safe to re-run:
 * it will not duplicate seed rows if they already exist.
 */
function createDatabaseStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(DB_SCHEMA).forEach(function (sheetName) {
    const headers = DB_SCHEMA[sheetName];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    if (sheet.getMaxColumns() > headers.length) {
      sheet.deleteColumns(headers.length + 1, sheet.getMaxColumns() - headers.length);
    }
  });

  // Remove the default "Sheet1" if it's empty and unused
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  seedRoles_(ss);
  seedCurriculum_(ss);

  SpreadsheetApp.getUi().alert(
    'Setup complete',
    'All 20 sheets were created with headers. Roles and the 43-module ' +
    'curriculum have been seeded. You can now continue to the Apps Script ' +
    'backend deployment steps.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function seedRoles_(ss) {
  const sheet = ss.getSheetByName('Roles');
  if (sheet.getLastRow() > 1) return; // already seeded

  const rows = [
    ['admin', 'Administrator', 'Full system access', 100],
    ['teacher', 'Teacher', 'Manages content, grading, classes', 60],
    ['student', 'Student', 'Learns, takes quizzes/exams, uses tools', 30]
  ];
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function seedCurriculum_(ss) {
  const sheet = ss.getSheetByName('Modules');
  if (sheet.getLastRow() > 1) return; // already seeded

  const rows = [];
  let counter = 1;

  [['X', CURRICULUM_X], ['XI', CURRICULUM_XI], ['XII', CURRICULUM_XII]].forEach(function (pair) {
    const tingkat = pair[0];
    const titles = pair[1];
    titles.forEach(function (title, idx) {
      const moduleId = 'MOD-' + tingkat + '-' + String(idx + 1).padStart(2, '0');
      rows.push([
        moduleId,
        tingkat,
        idx + 1,
        title,
        '', // LearningObjectives — filled in by teacher/admin via the UI
        '', // LearningOutcomes — filled in by teacher/admin via the UI
        'draft'
      ]);
      counter++;
    });
  });

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Convenience function to print the active Spreadsheet's ID to the
 * Apps Script execution log — you'll need this ID for Config.gs in
 * the Backend Development phase.
 */
function printSpreadsheetId() {
  Logger.log('Spreadsheet ID: ' + SpreadsheetApp.getActiveSpreadsheet().getId());
}
