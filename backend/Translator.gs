/**
 * Translator.gs
 * English Academy Indonesia — EN ↔ ID Translator
 *
 * Routed server-side specifically so identical phrases (very common
 * across shared lesson content) hit CacheService instead of re-calling
 * an external API per student — see Architecture §6 for why this is
 * the one external integration NOT called directly from the browser.
 */

/**
 * Any logged-in role. direction is 'en-id' or 'id-en'.
 */
function translateText(token, text, direction) {
  _requireSession(token, null);

  if (!text || !text.trim()) {
    return { success: false, message: 'No text provided.' };
  }
  if (['en-id', 'id-en'].indexOf(direction) === -1) {
    return { success: false, message: 'direction must be "en-id" or "id-en".' };
  }

  var cacheKey = 'translate_' + direction + '_' + _hashText_(text);
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) {
    return { success: true, translatedText: cached, source: 'cache' };
  }

  var sourceLang = direction === 'en-id' ? 'en' : 'id';
  var targetLang = direction === 'en-id' ? 'id' : 'en';

  var diagnostics = [];

  var result = _translateViaMyMemory_(text, sourceLang, targetLang, diagnostics);
  var source = 'mymemory';

  if (!result) {
    result = _translateViaLibreTranslate_(text, sourceLang, targetLang, diagnostics);
    source = 'libretranslate';
  }

  if (!result) {
    Logger.log('translateText: all providers failed — ' + diagnostics.join(' | '));
    return {
      success: false,
      message: 'Translation service is currently unavailable. Please try again shortly.',
      diagnostics: diagnostics // surfaced to the browser console by translator.html — no Apps Script editor needed to see why
    };
  }

  cache.put(cacheKey, result, CONFIG.CACHE_TTL_TRANSLATION);
  return { success: true, translatedText: result, source: source };
}

/**
 * Convenience used by ocr.html: translates whatever Tesseract.js
 * extracted client-side, assuming English source (the common case for
 * scanned English textbook pages) to Indonesian.
 */
function translateOcrResult(token, extractedText) {
  return translateText(token, extractedText, 'en-id');
}

// ── Internal: provider calls ───────────────────────────────────────

/**
 * MyMemory has a hard ~500-byte limit per request (truncated here to
 * stay safely under it) and tracks its free quota by IP unless an
 * email is supplied via CONFIG.MYMEMORY_EMAIL (Config.gs comment).
 * Checks the JSON-embedded responseStatus, not just the HTTP status —
 * MyMemory returns HTTP 200 even for quota-exceeded/invalid-pair
 * errors, with the real status nested in the response body.
 *
 * `diagnostics`, if passed, gets a human-readable line appended
 * describing exactly what happened — surfaced all the way to the
 * browser on total failure (see translateText above).
 */
function _translateViaMyMemory_(text, sourceLang, targetLang, diagnostics) {
  function log(msg) {
    Logger.log('MyMemory: ' + msg);
    if (diagnostics) diagnostics.push('MyMemory: ' + msg);
  }

  try {
    var truncated = text.length > 480 ? text.substring(0, 480) : text;
    var url = CONFIG.MYMEMORY_URL +
      '?q=' + encodeURIComponent(truncated) +
      '&langpair=' + sourceLang + '|' + targetLang +
      (CONFIG.MYMEMORY_EMAIL ? '&de=' + encodeURIComponent(CONFIG.MYMEMORY_EMAIL) : '');

    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = response.getResponseCode();
    if (code !== 200) {
      log('HTTP ' + code + ' — ' + response.getContentText().substring(0, 150));
      return null;
    }

    var json = JSON.parse(response.getContentText());
    if (json.responseStatus && Number(json.responseStatus) !== 200) {
      log('quota/error status ' + json.responseStatus + ' — ' + (json.responseDetails || ''));
      return null;
    }
    if (json.responseData && json.responseData.translatedText) {
      log('success');
      return json.responseData.translatedText;
    }
    log('unexpected response shape: ' + response.getContentText().substring(0, 150));
    return null;
  } catch (e) {
    log('threw exception — ' + e.message);
    return null;
  }
}

/**
 * Tries every URL in CONFIG.LIBRETRANSLATE_URLS in order, returning the
 * first successful translation. libretranslate.com itself is NOT in
 * this list by default — it requires a paid API key for all requests
 * as of this writing (see Config.gs comment).
 */
function _translateViaLibreTranslate_(text, sourceLang, targetLang, diagnostics) {
  function log(msg) {
    Logger.log('LibreTranslate: ' + msg);
    if (diagnostics) diagnostics.push('LibreTranslate: ' + msg);
  }

  var urls = CONFIG.LIBRETRANSLATE_URLS || [];
  if (urls.length === 0) {
    log('no mirrors configured in CONFIG.LIBRETRANSLATE_URLS');
    return null;
  }

  for (var i = 0; i < urls.length; i++) {
    try {
      var response = UrlFetchApp.fetch(urls[i], {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: 'text' }),
        muteHttpExceptions: true
      });
      var code = response.getResponseCode();
      if (code !== 200) {
        log(urls[i] + ' — HTTP ' + code + ' — ' + response.getContentText().substring(0, 150));
        continue;
      }
      var json = JSON.parse(response.getContentText());
      if (json.translatedText) {
        log(urls[i] + ' — success');
        return json.translatedText;
      }
      log(urls[i] + ' — no translatedText in response: ' + response.getContentText().substring(0, 150));
    } catch (e) {
      log(urls[i] + ' — threw exception: ' + e.message);
    }
  }
  return null;
}

function _hashText_(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text.substring(0, 500));
  return digest.map(function (b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); }).join('');
}
