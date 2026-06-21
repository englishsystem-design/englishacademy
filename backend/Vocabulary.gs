/**
 * Vocabulary.gs
 * English Academy Indonesia — Vocabulary Builder (favorites persistence)
 *
 * Word lookup itself (meaning/pronunciation/synonyms/antonyms/examples)
 * happens entirely client-side via a direct fetch() to the Free
 * Dictionary API — see Architecture §6. This file only persists the
 * words a student chooses to save, using the VocabularyFavorites sheet
 * (Database Design §7 addendum).
 */

function saveFavoriteWord(token, wordData) {
  var session = _requireSession(token, ['student']);

  if (!wordData.word) return { success: false, message: 'Word is required.' };

  var existing = getRowsWhere('VocabularyFavorites', 'UserID', session.userId)
    .filter(function (f) { return f.Word.toLowerCase() === wordData.word.toLowerCase(); });
  if (existing.length > 0) {
    return { success: false, message: 'This word is already in your favorites.' };
  }

  var created = insertRow('VocabularyFavorites', {
    FavoriteID: generateId('FAV', 'VocabularyFavorites', 'FavoriteID'),
    UserID: session.userId,
    Word: sanitizePlainText(wordData.word),
    Meaning: sanitizePlainText(wordData.meaning || ''),
    PartOfSpeech: sanitizePlainText(wordData.partOfSpeech || ''),
    Synonyms: Array.isArray(wordData.synonyms) ? wordData.synonyms.join(', ') : (wordData.synonyms || ''),
    Antonyms: Array.isArray(wordData.antonyms) ? wordData.antonyms.join(', ') : (wordData.antonyms || ''),
    ExampleSentence: sanitizePlainText(wordData.exampleSentence || ''),
    AddedAt: nowIso()
  });

  return { success: true, favorite: created };
}

function listFavoriteWords(token) {
  var session = _requireSession(token, ['student']);
  var mine = getRowsWhere('VocabularyFavorites', 'UserID', session.userId);
  mine.sort(function (a, b) { return new Date(b.AddedAt) - new Date(a.AddedAt); });
  return mine;
}

function removeFavoriteWord(token, favoriteId) {
  var session = _requireSession(token, ['student']);
  var favorite = getRowById('VocabularyFavorites', 'FavoriteID', favoriteId);
  if (!favorite || favorite.UserID !== session.userId) {
    return { success: false, message: 'Favorite not found.' };
  }
  deleteRow('VocabularyFavorites', 'FavoriteID', favoriteId);
  return { success: true };
}
