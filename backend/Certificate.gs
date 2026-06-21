/**
 * Certificate.gs
 * English Academy Indonesia — Certificate Generation & QR Verification
 *
 * DEPENDENCY NOTE: QR code images are generated via the free, no-API-key
 * public service api.qrserver.com (the same "free external API" pattern
 * already used for Translator.gs — see Architecture §6 and PRD §12 for
 * how this project treats third-party free-service dependency risk).
 * If that service ever becomes unavailable, certificates still generate
 * successfully — just without the QR image; see _generateQrCodeBlob_.
 */

/**
 * Teacher/admin. Issues a certificate for a student completing a module.
 * Builds the PDF on the fly using DocumentApp (a temporary Google Doc
 * is created, rendered, exported to PDF, then discarded — only the
 * final PDF is kept in Drive).
 */
function issueCertificate(token, studentId, moduleId) {
  var session = _requireSession(token, ['admin', 'teacher']);

  var student = getRowById('Students', 'StudentID', studentId);
  if (!student) return { success: false, message: 'Student not found.' };
  var user = getRowById('Users', 'UserID', student.UserID);
  var mod = getRowById('Modules', 'ModuleID', moduleId);
  if (!mod) return { success: false, message: 'Module not found.' };

  var existing = getRowsWhere('Certificates', 'StudentID', studentId)
    .filter(function (c) { return c.ModuleID === moduleId && c.Status === 'valid'; });
  if (existing.length > 0) {
    return { success: false, message: 'A valid certificate already exists for this student and module.' };
  }

  var year = new Date().getFullYear();
  var sameYearCount = getAllRows('Certificates')
    .filter(function (c) { return c.CertificateNumber.indexOf('EAI-' + year + '-') === 0; }).length;
  var certificateNumber = 'EAI-' + year + '-' + String(sameYearCount + 1).padStart(5, '0');
  var verificationToken = Utilities.getUuid();
  var issueDate = nowIso();

  var pdfFileId = _buildCertificatePdf_(user.FullName, mod.ModuleTitle, certificateNumber, issueDate, verificationToken);

  var created = insertRow('Certificates', {
    CertificateID: generateId('CERT', 'Certificates', 'CertificateID'),
    StudentID: studentId,
    ModuleID: moduleId,
    CertificateNumber: certificateNumber,
    IssueDate: issueDate,
    PDFFileID: pdfFileId,
    VerificationToken: verificationToken,
    Status: 'valid'
  });

  notifyUser(student.UserID, 'new_score', 'Certificate issued',
    'You earned a certificate for completing ' + mod.ModuleTitle + '.', created.CertificateID);
  _logActivity(session.userId, 'issue_certificate', 'Issued certificate: ' + certificateNumber);

  return { success: true, certificate: Object.assign({}, created, { pdfUrl: getDriveFileViewUrl(pdfFileId) }) };
}

function listMyCertificates(token) {
  var session = _requireSession(token, ['student']);
  var studentMatches = getRowsWhere('Students', 'UserID', session.userId);
  if (studentMatches.length === 0) return [];

  return getRowsWhere('Certificates', 'StudentID', studentMatches[0].StudentID).map(function (c) {
    return Object.assign({}, c, { pdfUrl: getDriveFileViewUrl(c.PDFFileID) });
  });
}

function revokeCertificate(token, certificateId) {
  var session = _requireSession(token, ['admin']);
  var updated = updateRow('Certificates', 'CertificateID', certificateId, { Status: 'revoked' });
  if (!updated) return { success: false, message: 'Certificate not found.' };
  _logActivity(session.userId, 'revoke_certificate', 'Revoked certificate: ' + certificateId);
  return { success: true };
}

/**
 * PUBLIC — intentionally does NOT call _requireSession. Anyone who scans
 * the QR code (or visits ?page=verify-certificate&token=...) should be
 * able to confirm a certificate is genuine without logging in. Only
 * minimal, non-sensitive fields are returned.
 */
function verifyCertificate(verificationToken) {
  var matches = getAllRows('Certificates').filter(function (c) { return c.VerificationToken === verificationToken; });
  if (matches.length === 0) {
    return { valid: false, message: 'No certificate found for this verification code.' };
  }

  var cert = matches[0];
  var student = getRowById('Students', 'StudentID', cert.StudentID);
  var user = student ? getRowById('Users', 'UserID', student.UserID) : null;
  var mod = getRowById('Modules', 'ModuleID', cert.ModuleID);

  return {
    valid: cert.Status === 'valid',
    status: cert.Status,
    certificateNumber: cert.CertificateNumber,
    studentName: user ? user.FullName : 'Unknown',
    moduleTitle: mod ? mod.ModuleTitle : 'Unknown',
    issueDate: cert.IssueDate
  };
}

// ── Internal: PDF generation ───────────────────────────────────────

function _buildCertificatePdf_(studentName, moduleTitle, certificateNumber, issueDate, verificationToken) {
  var doc = DocumentApp.create('TEMP_CERT_' + certificateNumber);
  var body = doc.getBody();
  body.setPageWidth(792).setPageHeight(612); // landscape Letter

  body.appendParagraph(CONFIG.APP_NAME)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('Certificate of Completion')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(' ');
  body.appendParagraph('This certifies that')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var nameParagraph = body.appendParagraph(studentName);
  nameParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  nameParagraph.editAsText().setBold(true).setFontSize(22);

  body.appendParagraph('has successfully completed the module')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph(moduleTitle)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .editAsText().setBold(true).setFontSize(16);

  body.appendParagraph(' ');
  body.appendParagraph('Certificate Number: ' + certificateNumber)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Issue Date: ' + formatDateForDisplay(issueDate))
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var verifyUrl = ScriptApp.getService().getUrl() + '?page=verify-certificate&token=' + verificationToken;
  var qrBlob = _generateQrCodeBlob_(verifyUrl);
  if (qrBlob) {
    var qrParagraph = body.appendParagraph('');
    qrParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    qrParagraph.appendInlineImage(qrBlob).setWidth(100).setHeight(100);
  }
  body.appendParagraph('Scan to verify, or visit: ' + verifyUrl)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .editAsText().setFontSize(8);

  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs('application/pdf');
  var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  var pdfFile = folder.createFile(pdfBlob).setName(certificateNumber + '.pdf');
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  DriveApp.getFileById(doc.getId()).setTrashed(true); // discard the working Doc, keep only the PDF

  return pdfFile.getId();
}

function _generateQrCodeBlob_(data) {
  try {
    var url = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(data);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    return response.getBlob();
  } catch (e) {
    Logger.log('QR generation failed, continuing without it: ' + e.message);
    return null;
  }
}
