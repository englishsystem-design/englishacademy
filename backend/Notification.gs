/**
 * Notification.gs
 * English Academy Indonesia — Notification System
 *
 * No push/real-time delivery (Apps Script has no WebSocket support,
 * per Architecture §13) — notifications are poll-on-load: the client
 * calls listMyNotifications when the page loads and on an interval.
 */

var NOTIFICATION_TYPES = ['new_lesson', 'new_quiz', 'new_exam', 'new_assignment', 'new_score'];

/**
 * Internal/shared helper — called from Lessons.gs, Quiz.gs, Exam.gs,
 * Assignments.gs whenever something notification-worthy happens.
 * Not session-gated since it's never called directly by the client.
 */
function notifyUser(userId, type, title, message, relatedId) {
  if (NOTIFICATION_TYPES.indexOf(type) === -1) {
    Logger.log('notifyUser: unknown type "' + type + '", skipping.');
    return;
  }
  insertRow('Notifications', {
    NotificationID: generateId('NTF', 'Notifications', 'NotificationID'),
    UserID: userId,
    Type: type,
    Title: sanitizePlainText(title),
    Message: sanitizePlainText(message),
    RelatedID: relatedId || '',
    IsRead: false,
    CreatedAt: nowIso()
  });
}

/**
 * Any logged-in role. Returns the caller's notifications, most recent
 * first, capped to `limit` (default 50) to keep the payload small.
 */
function listMyNotifications(token, limit) {
  var session = _requireSession(token, null);
  limit = limit || 50;

  var mine = getRowsWhere('Notifications', 'UserID', session.userId);
  mine.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });
  return mine.slice(0, limit);
}

function getUnreadNotificationCount(token) {
  var session = _requireSession(token, null);
  return getRowsWhere('Notifications', 'UserID', session.userId)
    .filter(function (n) { return n.IsRead === false || n.IsRead === 'FALSE'; })
    .length;
}

function markNotificationRead(token, notificationId) {
  var session = _requireSession(token, null);
  var notification = getRowById('Notifications', 'NotificationID', notificationId);
  if (!notification || notification.UserID !== session.userId) {
    return { success: false, message: 'Notification not found.' };
  }
  updateRow('Notifications', 'NotificationID', notificationId, { IsRead: true });
  return { success: true };
}

function markAllNotificationsRead(token) {
  var session = _requireSession(token, null);
  var mine = getRowsWhere('Notifications', 'UserID', session.userId);
  mine.forEach(function (n) {
    if (n.IsRead !== true && n.IsRead !== 'TRUE') {
      updateRow('Notifications', 'NotificationID', n.NotificationID, { IsRead: true });
    }
  });
  return { success: true, count: mine.length };
}
