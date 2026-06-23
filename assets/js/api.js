/**
 * assets/js/api.js
 * English Academy Indonesia — fetch-based API client
 *
 * Replaces google.script.run, which only exists inside pages Apps
 * Script itself renders. From an external origin (GitHub Pages), the
 * Apps Script Web App is just a JSON API reached via fetch().
 *
 * EA.api('functionName', [arg1, arg2]) returns a Promise — same idea as
 * google.script.run.withSuccessHandler/withFailureHandler, just
 * Promise-shaped instead of callback-shaped:
 *
 *   EA.api('login', [username, password])
 *     .then(function (result) { ... })
 *     .catch(function (err) { console.error(err.message); });
 *
 * CORS note: Content-Type is deliberately 'text/plain' (see Code.gs's
 * matching comment) so the browser treats this as a CORS "simple
 * request" and skips the preflight OPTIONS request that Apps Script
 * Web Apps cannot answer with the right headers.
 */
var EA = window.EA || {};

EA.api = function (action, args) {
  if (!window.EA_CONFIG || !window.EA_CONFIG.API_URL || window.EA_CONFIG.API_URL.indexOf('PASTE_YOUR') === 0) {
    return Promise.reject(new Error('config.js is not set up yet — paste your Apps Script Web App URL into API_URL.'));
  }

  return fetch(window.EA_CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, args: args || [] })
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Network error: HTTP ' + response.status);
      }
      return response.json();
    })
    .then(function (json) {
      if (!json.success) {
        throw new Error(json.error || 'Unknown server error');
      }
      return json.result;
    });
};

window.EA = EA;
