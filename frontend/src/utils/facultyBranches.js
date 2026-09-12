/**
 * Helpers for the combined branch + section tokens stored on faculty records.
 *
 * A faculty's branch_classes is a list of "CODE-SECTION" tokens (e.g.
 * "CSE-1"). A token without a section ("CSE") means every section of that
 * branch. The section separator is the last "-" in the token so short codes
 * that themselves contain a dash (e.g. "AI-ML-1") still parse correctly.
 */

export function splitBranchToken(token) {
  const value = String(token || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!value) return { code: '', section: null };
  const idx = value.lastIndexOf('-');
  if (idx > 0) {
    const section = value.slice(idx + 1).trim();
    return { code: value.slice(0, idx).trim(), section: section || null };
  }
  return { code: value, section: null };
}

export function parseBranchTokens(value) {
  return [...new Set(
    String(value || '')
      .split(/[,;\n]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
  )];
}

export function displayBranchToken(token, section) {
  const { code, section: tokenSection } = splitBranchToken(token);
  const sec = tokenSection || section;
  return sec ? `${code}-${sec}` : code;
}

export function facultyTeachesClass(faculty, shortCode, section) {
  const targetCode = String(shortCode || '').toUpperCase();
  const targetSection = String(section || '').toUpperCase();
  return (faculty?.branch_classes || []).some((token) => {
    const { code, section: tokenSection } = splitBranchToken(token);
    if (code !== targetCode) return false;
    return !tokenSection || !targetSection || tokenSection === targetSection;
  });
}
