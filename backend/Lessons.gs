/**
 * Lessons.gs
 * English Academy Indonesia — Module & Lesson Content Management
 *
 * Modules are curriculum-wide (shared by every class at that Kelas),
 * not owned by a single class — so any teacher or admin may create or
 * edit lessons within any module, by design (this mirrors how teachers
 * collaboratively build a shared course catalog in real schools).
 * Deletion is restricted to the original author or an admin, as a
 * safety net against accidentally removing a colleague's work.
 */

// ── Modules ─────────────────────────────────────────────────────────

/**
 * Lists curriculum modules. Students only see published modules;
 * teachers/admin see everything (including drafts being authored).
 */
function listModules(token, tingkatFilter) {
  var session = _requireSession(token, null);
  var all = getAllRows('Modules');

  if (tingkatFilter) {
    all = all.filter(function (m) { return m.Tingkat === tingkatFilter; });
  }
  if (session.role === 'student') {
    all = all.filter(function (m) { return m.Status === 'published'; });
  }

  all.sort(function (a, b) { return Number(a.ModuleNumber) - Number(b.ModuleNumber); });
  return all;
}

function getModule(token, moduleId) {
  var session = _requireSession(token, null);
  var mod = getRowById('Modules', 'ModuleID', moduleId);
  if (!mod) return null;
  if (session.role === 'student' && mod.Status !== 'published') {
    throw new Error('FORBIDDEN: this module is not yet published.');
  }
  return mod;
}

/**
 * Teacher/admin. Fills in or edits the objectives/outcomes seeded blank
 * by Setup.gs, and flips Status to 'published' once content is ready.
 */
function updateModule(token, moduleId, updates) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var allowedFields = ['LearningObjectives', 'LearningOutcomes', 'Status'];
  var safeUpdates = {};
  allowedFields.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(updates, f)) {
      safeUpdates[f] = updates[f];
    }
  });
  if (safeUpdates.Status && ['draft', 'published'].indexOf(safeUpdates.Status) === -1) {
    return { success: false, message: 'Status must be draft or published.' };
  }

  var updated = updateRow('Modules', 'ModuleID', moduleId, safeUpdates);
  if (!updated) return { success: false, message: 'Module not found.' };

  _logActivity(session.userId, 'update_module', 'Updated module: ' + moduleId);
  return { success: true, module: updated };
}

// ── Lessons ─────────────────────────────────────────────────────────

function createLesson(token, payload) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var mod = getRowById('Modules', 'ModuleID', payload.moduleId);
  if (!mod) return { success: false, message: 'Module not found.' };
  if (!payload.lessonTitle) return { success: false, message: 'Lesson title is required.' };

  var lessonId = generateId('LSN', 'Lessons', 'LessonID');
  var created = insertRow('Lessons', {
    LessonID: lessonId,
    ModuleID: payload.moduleId,
    LessonTitle: sanitizePlainText(payload.lessonTitle),
    ContentHTML: payload.contentHTML || '', // Quill output — intentionally not plain-text sanitized, see file header
    PDFFileID: '',
    VideoID: '',
    OrderIndex: payload.orderIndex || 0,
    CreatedBy: session.userId,
    CreatedAt: nowIso(),
    UpdatedAt: nowIso()
  });

  _logActivity(session.userId, 'create_lesson', 'Created lesson: ' + lessonId);
  return { success: true, lesson: created };
}

function getLesson(token, lessonId) {
  var session = _requireSession(token, null);
  var lesson = getRowById('Lessons', 'LessonID', lessonId);
  if (!lesson) return null;

  if (session.role === 'student') {
    var mod = getRowById('Modules', 'ModuleID', lesson.ModuleID);
    if (!mod || mod.Status !== 'published') {
      throw new Error('FORBIDDEN: this lesson is not yet published.');
    }
  }

  var result = Object.assign({}, lesson);
  if (lesson.PDFFileID) {
    result.pdfUrl = getDriveFileViewUrl(lesson.PDFFileID);
  }
  if (lesson.VideoID) {
    var video = getRowById('Videos', 'VideoID', lesson.VideoID);
    if (video) {
      result.video = {
        title: video.Title,
        sourceType: video.SourceType,
        url: video.SourceType === 'youtube' ? video.ExternalURL : getDriveFileViewUrl(video.DriveFileID)
      };
    }
  }
  return result;
}

function listLessonsByModule(token, moduleId) {
  var session = _requireSession(token, null);
  var lessons = getRowsWhere('Lessons', 'ModuleID', moduleId);

  if (session.role === 'student') {
    var mod = getRowById('Modules', 'ModuleID', moduleId);
    if (!mod || mod.Status !== 'published') return [];
  }

  lessons.sort(function (a, b) { return Number(a.OrderIndex) - Number(b.OrderIndex); });
  return lessons;
}

function updateLesson(token, lessonId, updates) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var allowedFields = ['LessonTitle', 'ContentHTML', 'OrderIndex'];
  var safeUpdates = { UpdatedAt: nowIso() };
  allowedFields.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(updates, f)) {
      safeUpdates[f] = updates[f];
    }
  });
  if (safeUpdates.LessonTitle) {
    safeUpdates.LessonTitle = sanitizePlainText(safeUpdates.LessonTitle);
  }

  var updated = updateRow('Lessons', 'LessonID', lessonId, safeUpdates);
  if (!updated) return { success: false, message: 'Lesson not found.' };

  _logActivity(session.userId, 'update_lesson', 'Updated lesson: ' + lessonId);
  return { success: true, lesson: updated };
}

function deleteLesson(token, lessonId) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var lesson = getRowById('Lessons', 'LessonID', lessonId);
  if (!lesson) return { success: false, message: 'Lesson not found.' };

  if (session.role === 'teacher' && lesson.CreatedBy !== session.userId) {
    throw new Error('FORBIDDEN: only the original author or an admin can delete this lesson.');
  }

  if (lesson.PDFFileID) deleteFileFromDrive(lesson.PDFFileID);

  deleteRow('Lessons', 'LessonID', lessonId);
  _logActivity(session.userId, 'delete_lesson', 'Deleted lesson: ' + lessonId);
  return { success: true };
}

/**
 * Teacher/admin. Uploads a PDF for a lesson. `base64Data` is the file
 * content read client-side via FileReader.readAsDataURL (the data: URL
 * prefix must be stripped by the client before calling this).
 */
function uploadLessonPDF(token, lessonId, base64Data, fileName) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var lesson = getRowById('Lessons', 'LessonID', lessonId);
  if (!lesson) return { success: false, message: 'Lesson not found.' };

  if (lesson.PDFFileID) deleteFileFromDrive(lesson.PDFFileID); // replace, don't accumulate

  var fileId = uploadFileToDrive(base64Data, fileName, 'application/pdf');
  var updated = updateRow('Lessons', 'LessonID', lessonId, { PDFFileID: fileId, UpdatedAt: nowIso() });

  _logActivity(session.userId, 'upload_lesson_pdf', 'Uploaded PDF for lesson: ' + lessonId);
  return { success: true, lesson: updated, pdfUrl: getDriveFileViewUrl(fileId) };
}

/**
 * Teacher/admin. Attaches a video to a lesson — either an uploaded
 * Drive file or an external (e.g. YouTube) URL.
 */
function attachLessonVideo(token, lessonId, payload) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var lesson = getRowById('Lessons', 'LessonID', lessonId);
  if (!lesson) return { success: false, message: 'Lesson not found.' };

  var videoId = generateId('VID', 'Videos', 'VideoID');
  var videoRow = {
    VideoID: videoId,
    LessonID: lessonId,
    Title: sanitizePlainText(payload.title || lesson.LessonTitle),
    DriveFileID: '',
    SourceType: payload.sourceType === 'youtube' ? 'youtube' : 'drive',
    ExternalURL: '',
    Duration: payload.duration || '',
    UploadedBy: session.userId,
    UploadedAt: nowIso()
  };

  if (payload.sourceType === 'youtube') {
    videoRow.ExternalURL = payload.externalUrl;
  } else {
    videoRow.DriveFileID = uploadFileToDrive(payload.base64Data, payload.fileName, payload.mimeType || 'video/mp4');
  }

  insertRow('Videos', videoRow);
  updateRow('Lessons', 'LessonID', lessonId, { VideoID: videoId, UpdatedAt: nowIso() });

  _logActivity(session.userId, 'attach_lesson_video', 'Attached video to lesson: ' + lessonId);
  return { success: true, video: videoRow };
}
