/**
 * assets/js/app.js
 * English Academy Indonesia — shared frontend helpers
 *
 * Loaded on every page via <script src="assets/js/app.js">. Replaces
 * what used to live inline in partials/head.html and partials/navbar.html
 * back when Apps Script rendered the pages itself.
 *
 * Note how much simpler navigation and URL-param reading are now versus
 * the old Apps Script-hosted version: GitHub Pages serves plain static
 * files with NO iframe sandboxing, so window.location works completely
 * normally. The old code needed window.top tricks and the async
 * google.script.url.getLocation() API specifically to work around Apps
 * Script's cross-origin iframe wrapper — none of that is needed here.
 */

// ── Session ─────────────────────────────────────────────────────────

function eaGetSession() {
  var raw = sessionStorage.getItem('ea_session');
  return raw ? JSON.parse(raw) : null;
}

function eaSetSession(session) {
  sessionStorage.setItem('ea_session', JSON.stringify(session));
}

function eaClearSession() {
  sessionStorage.removeItem('ea_session');
}

function eaRequireLogin(allowedRoles) {
  var session = eaGetSession();
  if (!session || !session.token) {
    eaNavigateTo('login');
    return null;
  }
  if (allowedRoles && allowedRoles.indexOf(session.role) === -1) {
    eaNavigateTo('dashboard-' + session.role);
    return null;
  }
  return session;
}

function eaLogout() {
  var session = eaGetSession();
  if (session) {
    EA.api('logout', [session.token]).catch(function () {}); // best-effort, don't block logout on network errors
  }
  eaClearSession();
  eaNavigateTo('login');
}

// ── Navigation (plain — no iframe workarounds needed on GitHub Pages) ─

function eaNavigateTo(page, extraQuery) {
  window.location.href = page + '.html' + (extraQuery ? ('?' + extraQuery) : '');
}

function eaGetUrlParams() {
  var params = {};
  new URLSearchParams(window.location.search).forEach(function (value, key) {
    params[key] = value;
  });
  return params;
}

// ── Partial includes (client-side, since static hosting has no
//    server-side include() — fetches partials/navbar.html etc. and
//    injects the markup; app.js's own functions then wire it up) ─────

function eaIncludeHTML(selector, url, callback) {
  fetch(url)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var el = document.querySelector(selector);
      if (!el) return;
      el.innerHTML = html;

      // innerHTML does NOT execute <script> tags — re-create each one so
      // it actually runs (needed for partials/footer.html's year script).
      el.querySelectorAll('script').forEach(function (oldScript) {
        var newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(function (attr) {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.textContent = oldScript.textContent;
        oldScript.replaceWith(newScript);
      });

      if (callback) callback();
    })
    .catch(function (err) {
      console.error('Failed to load partial ' + url, err);
    });
}

// ── Toast ───────────────────────────────────────────────────────────

function eaToast(icon, title) {
  Swal.fire({ icon: icon, title: title, toast: true, position: 'top-end', timer: 2500, showConfirmButton: false });
}

// ── Navbar rendering ────────────────────────────────────────────────

var EA_NAV_BY_ROLE = {
  admin: [
    { page: 'dashboard-admin', label: 'Dashboard', icon: 'bi-speedometer2' },
    { page: 'admin-users', label: 'Pengguna', icon: 'bi-people' },
    { page: 'lessons', label: 'Materi', icon: 'bi-journal-text' },
    { page: 'attendance', label: 'Kehadiran', icon: 'bi-calendar-check' }
  ],
  teacher: [
    { page: 'dashboard-teacher', label: 'Dashboard', icon: 'bi-speedometer2' },
    { page: 'lessons', label: 'Materi', icon: 'bi-journal-text' },
    { page: 'assignments', label: 'Tugas', icon: 'bi-clipboard-check' },
    { page: 'attendance', label: 'Kehadiran', icon: 'bi-calendar-check' }
  ],
  student: [
    { page: 'dashboard-student', label: 'Dashboard', icon: 'bi-speedometer2' },
    { page: 'lessons', label: 'Materi', icon: 'bi-journal-text' },
    { page: 'assignments', label: 'Tugas', icon: 'bi-clipboard-check' },
    { page: 'ocr', label: 'OCR', icon: 'bi-camera' },
    { page: 'translator', label: 'Translator', icon: 'bi-translate' },
    { page: 'vocabulary', label: 'Kosakata', icon: 'bi-book' },
    { page: 'certificates', label: 'Sertifikat', icon: 'bi-award' }
  ]
};

/**
 * Call after eaIncludeHTML has injected partials/navbar.html into the
 * page. Fills in the user's name, builds role-specific nav links, and
 * highlights whichever link matches the current file name.
 */
function eaRenderNav(session) {
  var nameEl = document.getElementById('eaUserName');
  if (nameEl) nameEl.textContent = session.fullName;

  var links = EA_NAV_BY_ROLE[session.role] || [];
  var currentFile = window.location.pathname.split('/').pop().replace('.html', '') || 'index';

  var navLinksEl = document.getElementById('eaNavLinks');
  if (navLinksEl) {
    navLinksEl.innerHTML = links.map(function (l) {
      var activeClass = l.page === currentFile ? ' active' : '';
      return '<li class="nav-item"><a class="nav-link' + activeClass + '" href="' + l.page + '.html">' +
        '<i class="bi ' + l.icon + ' me-1"></i>' + l.label + '</a></li>';
    }).join('');
  }

  eaRefreshNotificationBadge();

  var logoutBtn = document.getElementById('eaLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', eaLogout);

  var bellBtn = document.getElementById('eaNotifBell');
  if (bellBtn) bellBtn.addEventListener('click', eaShowNotifications);

  var brandLink = document.getElementById('eaBrandLink');
  if (brandLink) brandLink.href = 'dashboard-' + session.role + '.html';
}

function eaRefreshNotificationBadge() {
  var session = eaGetSession();
  if (!session) return;
  EA.api('getUnreadNotificationCount', [session.token]).then(function (count) {
    var badge = document.getElementById('eaNotifBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  }).catch(function () {});
}

function eaShowNotifications() {
  var session = eaGetSession();
  if (!session) return;
  EA.api('listMyNotifications', [session.token, 20]).then(function (notifications) {
    var html = notifications.length === 0
      ? '<p class="text-muted">Belum ada notifikasi.</p>'
      : notifications.map(function (n) {
          return '<div class="text-start border-bottom py-2"><strong>' + n.Title + '</strong>' +
            '<div class="small text-muted">' + n.Message + '</div></div>';
        }).join('');
    Swal.fire({ title: 'Notifikasi', html: '<div style="max-height:300px;overflow-y:auto;">' + html + '</div>', confirmButtonText: 'Tutup' });
    EA.api('markAllNotificationsRead', [session.token]).then(eaRefreshNotificationBadge);
  }).catch(function (err) { eaToast('error', 'Gagal memuat notifikasi.'); console.error(err); });
}
