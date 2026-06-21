/**
 * Quiz.gs
 * English Academy Indonesia — Quiz System
 *
 * Also owns the generic Questions-sheet CRUD (addQuestion/updateQuestion/
 * deleteQuestion/listQuestions), shared by Exam.gs via ParentType='exam'.
 * Quizzes and exams use an identical question model, so this logic lives
 * once here rather than being duplicated — see Database Design §3.13.
 *
 * Note on trust model: quiz attempts are lower-stakes than exams and do
 * not enforce a strict server-side timer or anti-cheat warning — that
 * stronger handling lives in Exam.gs. TimeTakenSeconds here is
 * client-reported and used for analytics/leaderboard only, not grading.
 */

// ── Questions (shared by Quiz + Exam) ──────────────────────────────

var QUESTION_TYPES = ['mc', 'mr', 'tf', 'matching', 'fillblank', 'essay'];

function addQuestion(token, payload) {
  var session = _requireSession(token, ['admin', 'teacher']);

  if (['quiz', 'exam'].indexOf(payload.parentType) === -1) {
    return { success: false, message: 'parentType must be quiz or exam.' };
  }
  if (QUESTION_TYPES.indexOf(payload.questionType) === -1) {
    return { success: false, message: 'Invalid question type.' };
  }
  if (!payload.questionText) {
    return { success: false, message: 'Question text is required.' };
  }

  var parentSheet = payload.parentType === 'quiz' ? 'Quizzes' : 'Exams';
  var parentIdCol = payload.parentType === 'quiz' ? 'QuizID' : 'ExamID';
  var parent = getRowById(parentSheet, parentIdCol, payload.parentId);
  if (!parent) return { success: false, message: 'Parent quiz/exam not found.' };

  var questionId = generateId('QN', 'Questions', 'QuestionID');
  var created = insertRow('Questions', {
    QuestionID: questionId,
    ParentType: payload.parentType,
    ParentID: payload.parentId,
    QuestionType: payload.questionType,
    QuestionText: payload.questionText,
    OptionsJSON: JSON.stringify(payload.options || {}),
    CorrectAnswerJSON: payload.questionType === 'essay' ? '' : JSON.stringify(payload.correctAnswer || {}),
    Points: payload.points || 1,
    OrderIndex: payload.orderIndex || 0
  });

  _logActivity(session.userId, 'add_question', 'Added question to ' + payload.parentType + ' ' + payload.parentId);
  return { success: true, question: created };
}

function updateQuestion(token, questionId, updates) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var allowedFields = ['QuestionText', 'OptionsJSON', 'CorrectAnswerJSON', 'Points', 'OrderIndex'];
  var safeUpdates = {};
  allowedFields.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(updates, f)) safeUpdates[f] = updates[f];
  });

  var updated = updateRow('Questions', 'QuestionID', questionId, safeUpdates);
  if (!updated) return { success: false, message: 'Question not found.' };

  _logActivity(session.userId, 'update_question', 'Updated question: ' + questionId);
  return { success: true, question: updated };
}

function deleteQuestion(token, questionId) {
  var session = _requireSession(token, ['admin', 'teacher']);
  var deleted = deleteRow('Questions', 'QuestionID', questionId);
  if (!deleted) return { success: false, message: 'Question not found.' };
  _logActivity(session.userId, 'delete_question', 'Deleted question: ' + questionId);
  return { success: true };
}

/**
 * Teacher/admin only — includes correct answers, used for the question
 * bank editor. Students must never reach this; see getQuizForAttempt
 * for the sanitized, student-facing version.
 */
function listQuestions(token, parentType, parentId) {
  _requireSession(token, ['admin', 'teacher']);
  var all = getRowsWhere('Questions', 'ParentID', parentId).filter(function (q) {
    return q.ParentType === parentType;
  });
  all.sort(function (a, b) { return Number(a.OrderIndex) - Number(b.OrderIndex); });
  return all;
}

// ── Quizzes (CRUD) ──────────────────────────────────────────────────

function createQuiz(token, payload) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var mod = getRowById('Modules', 'ModuleID', payload.moduleId);
  if (!mod) return { success: false, message: 'Module not found.' };
  if (!payload.title) return { success: false, message: 'Title is required.' };

  var quizId = generateId('QZ', 'Quizzes', 'QuizID');
  var created = insertRow('Quizzes', {
    QuizID: quizId,
    ModuleID: payload.moduleId,
    Title: sanitizePlainText(payload.title),
    Instructions: payload.instructions || '',
    TimeLimitMinutes: payload.timeLimitMinutes || '',
    RandomizeQuestions: !!payload.randomizeQuestions,
    MaxAttempts: payload.maxAttempts || CONFIG.DEFAULT_MAX_QUIZ_ATTEMPTS,
    PassingScore: payload.passingScore || CONFIG.DEFAULT_PASSING_SCORE_PERCENT,
    Status: 'draft',
    CreatedBy: session.userId,
    CreatedAt: nowIso()
  });

  _logActivity(session.userId, 'create_quiz', 'Created quiz: ' + quizId);
  return { success: true, quiz: created };
}

function updateQuiz(token, quizId, updates) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var allowedFields = ['Title', 'Instructions', 'TimeLimitMinutes', 'RandomizeQuestions', 'MaxAttempts', 'PassingScore', 'Status'];
  var safeUpdates = {};
  allowedFields.forEach(function (f) {
    if (Object.prototype.hasOwnProperty.call(updates, f)) safeUpdates[f] = updates[f];
  });

  var updated = updateRow('Quizzes', 'QuizID', quizId, safeUpdates);
  if (!updated) return { success: false, message: 'Quiz not found.' };

  _logActivity(session.userId, 'update_quiz', 'Updated quiz: ' + quizId);
  return { success: true, quiz: updated };
}

function deleteQuiz(token, quizId) {
  var session = _requireSession(token, ['admin', 'teacher']);
  var quiz = getRowById('Quizzes', 'QuizID', quizId);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  if (session.role === 'teacher' && quiz.CreatedBy !== session.userId) {
    throw new Error('FORBIDDEN: only the original author or an admin can delete this quiz.');
  }

  getRowsWhere('Questions', 'ParentID', quizId)
    .filter(function (q) { return q.ParentType === 'quiz'; })
    .forEach(function (q) { deleteRow('Questions', 'QuestionID', q.QuestionID); });

  deleteRow('Quizzes', 'QuizID', quizId);
  _logActivity(session.userId, 'delete_quiz', 'Deleted quiz: ' + quizId);
  return { success: true };
}

function listQuizzesByModule(token, moduleId) {
  var session = _requireSession(token, null);
  var all = getRowsWhere('Quizzes', 'ModuleID', moduleId);
  if (session.role === 'student') {
    all = all.filter(function (q) { return q.Status === 'published'; });
  }
  return all;
}

// ── Taking a quiz ───────────────────────────────────────────────────

/**
 * Student. Returns the quiz plus its questions with answers stripped,
 * options parsed, and order shuffled if RandomizeQuestions is set.
 * Also reports how many attempts remain.
 */
function getQuizForAttempt(token, quizId) {
  var session = _requireSession(token, ['student']);

  var quiz = getRowById('Quizzes', 'QuizID', quizId);
  if (!quiz || quiz.Status !== 'published') {
    throw new Error('NOT_AVAILABLE: this quiz is not currently available.');
  }

  var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
  if (studentMatches.length === 0) throw new Error('STUDENT_PROFILE_NOT_FOUND');
  var studentId = studentMatches[0].StudentID;

  var previousAttempts = getRowsWhere('Scores', 'StudentID', studentId)
    .filter(function (s) { return s.ParentType === 'quiz' && s.ParentID === quizId; });
  var attemptsRemaining = Number(quiz.MaxAttempts) - previousAttempts.length;
  if (attemptsRemaining <= 0) {
    throw new Error('NO_ATTEMPTS_LEFT: you have used all ' + quiz.MaxAttempts + ' attempts for this quiz.');
  }

  var questions = getRowsWhere('Questions', 'ParentID', quizId)
    .filter(function (q) { return q.ParentType === 'quiz'; })
    .map(function (q) {
      return {
        QuestionID: q.QuestionID,
        QuestionType: q.QuestionType,
        QuestionText: q.QuestionText,
        Options: JSON.parse(q.OptionsJSON || '{}'),
        Points: q.Points
        // CorrectAnswerJSON intentionally omitted
      };
    });

  if (quiz.RandomizeQuestions) {
    questions = _shuffleArray(questions);
  }

  return {
    quiz: quiz,
    questions: questions,
    attemptId: Utilities.getUuid(),
    attemptsRemaining: attemptsRemaining,
    attemptNumber: previousAttempts.length + 1
  };
}

/**
 * Student. Submits answers for one attempt, auto-grades objective
 * question types, and records the result. Essay questions are left
 * ungraded (GradingStatus = pending_manual) for the teacher to score.
 *
 * `answers` shape: [{ questionId, studentAnswer }], where studentAnswer
 * is whatever shape matches the question type (see _gradeAnswer_).
 */
function submitQuizAttempt(token, quizId, attemptId, answers, timeTakenSeconds) {
  var session = _requireSession(token, ['student']);

  var quiz = getRowById('Quizzes', 'QuizID', quizId);
  if (!quiz) return { success: false, message: 'Quiz not found.' };

  var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
  if (studentMatches.length === 0) return { success: false, message: 'Student profile not found.' };
  var studentId = studentMatches[0].StudentID;

  var previousAttempts = getRowsWhere('Scores', 'StudentID', studentId)
    .filter(function (s) { return s.ParentType === 'quiz' && s.ParentID === quizId; });
  if (previousAttempts.length >= Number(quiz.MaxAttempts)) {
    return { success: false, message: 'No attempts remaining for this quiz.' };
  }

  var totalPoints = 0;
  var earnedPoints = 0;
  var hasEssay = false;
  var answerRows = [];

  answers.forEach(function (a) {
    var question = getRowById('Questions', 'QuestionID', a.questionId);
    if (!question || question.ParentType !== 'quiz' || question.ParentID !== quizId) return;

    var points = Number(question.Points) || 0;
    totalPoints += points;

    var grading = _gradeAnswer_(question.QuestionType, a.studentAnswer, question.CorrectAnswerJSON);
    if (grading.isCorrect === null) hasEssay = true;
    if (grading.isCorrect === true) earnedPoints += points;

    answerRows.push({
      AnswerID: generateId('ANS', 'Answers', 'AnswerID', 6),
      AttemptID: attemptId,
      StudentID: studentId,
      QuestionID: a.questionId,
      StudentAnswerJSON: JSON.stringify(a.studentAnswer),
      IsCorrect: grading.isCorrect === null ? '' : grading.isCorrect,
      PointsAwarded: grading.isCorrect === true ? points : (grading.isCorrect === false ? 0 : '')
    });
  });

  insertRows('Answers', answerRows);

  var percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  var scoreRow = insertRow('Scores', {
    ScoreID: generateId('SCR', 'Scores', 'ScoreID'),
    StudentID: studentId,
    AttemptID: attemptId,
    ParentType: 'quiz',
    ParentID: quizId,
    Score: earnedPoints,
    MaxScore: totalPoints,
    Percentage: percentage,
    TimeTakenSeconds: timeTakenSeconds || 0,
    AttemptNumber: previousAttempts.length + 1,
    SubmittedAt: nowIso(),
    GradingStatus: hasEssay ? 'pending_manual' : 'auto'
  });

  _logActivity(session.userId, 'submit_quiz', 'Submitted quiz ' + quizId + ' — ' + percentage + '%');

  return { success: true, score: scoreRow, passed: percentage >= Number(quiz.PassingScore) };
}

/**
 * Returns the best (highest percentage) score per student for a quiz,
 * sorted descending, capped to topN — used for the leaderboard widget.
 */
function getQuizLeaderboard(token, quizId, topN) {
  _requireSession(token, null);
  topN = topN || 20;

  var scores = getRowsWhere('Scores', 'ParentID', quizId).filter(function (s) { return s.ParentType === 'quiz'; });

  var bestByStudent = {};
  scores.forEach(function (s) {
    var existing = bestByStudent[s.StudentID];
    if (!existing || Number(s.Percentage) > Number(existing.Percentage)) {
      bestByStudent[s.StudentID] = s;
    }
  });

  var ranked = Object.keys(bestByStudent).map(function (studentId) {
    var student = getRowById('Students', 'StudentID', studentId);
    var user = student ? getRowById('Users', 'UserID', student.UserID) : null;
    return {
      studentId: studentId,
      fullName: user ? user.FullName : 'Unknown',
      percentage: Number(bestByStudent[studentId].Percentage),
      timeTakenSeconds: Number(bestByStudent[studentId].TimeTakenSeconds)
    };
  });

  ranked.sort(function (a, b) {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return a.timeTakenSeconds - b.timeTakenSeconds; // tie-break: faster wins
  });

  return ranked.slice(0, topN);
}

// ── Internal grading logic ─────────────────────────────────────────

/**
 * Returns { isCorrect, } where isCorrect is true/false for
 * auto-gradable types, or null for essay (pending manual grading).
 */
function _gradeAnswer_(questionType, studentAnswer, correctAnswerJSON) {
  if (questionType === 'essay') {
    return { isCorrect: null };
  }

  var correct = JSON.parse(correctAnswerJSON || '{}');

  switch (questionType) {
    case 'mc':
    case 'tf':
      return { isCorrect: studentAnswer && studentAnswer.selected === correct.correct };

    case 'mr': {
      var sel = (studentAnswer && studentAnswer.selected) || [];
      var corr = correct.correct || [];
      var match = sel.length === corr.length &&
        sel.slice().sort().every(function (v, i) { return v === corr.slice().sort()[i]; });
      return { isCorrect: match };
    }

    case 'matching': {
      var pairsA = (studentAnswer && studentAnswer.pairs) || {};
      var pairsB = correct.pairs || {};
      var keysA = Object.keys(pairsA), keysB = Object.keys(pairsB);
      var allMatch = keysA.length === keysB.length &&
        keysB.every(function (k) { return pairsA[k] === pairsB[k]; });
      return { isCorrect: allMatch };
    }

    case 'fillblank': {
      var text = ((studentAnswer && studentAnswer.text) || '').trim().toLowerCase();
      var acceptable = correct.acceptable || [];
      var match = acceptable.some(function (a) { return String(a).trim().toLowerCase() === text; });
      return { isCorrect: match };
    }

    default:
      return { isCorrect: false };
  }
}

function _shuffleArray(arr) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy;
}
