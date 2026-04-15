(function (global) {
  const AIRTABLE_HOSTS = new Set(['airtable.com', 'www.airtable.com']);
  const BASE_ID_RE = /^app[a-zA-Z0-9]+$/;

  function fail(error) {
    return { ok: false, error };
  }

  /**
   * @param {string} [input]
   * @returns {{ ok: true, baseId: string, tableIdOrName: string } | { ok: false, error: string }}
   */
  function parseAirtableSpreadsheetUrl(input) {
    const trimmed = String(input ?? '').trim();
    if (!trimmed) {
      return fail('Paste an Airtable table URL.');
    }

    let url;
    try {
      url = new URL(trimmed);
    } catch {
      return fail('Invalid URL.');
    }

    if (!AIRTABLE_HOSTS.has(url.hostname.toLowerCase())) {
      return fail('Use an airtable.com link.');
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const baseId = parts.find((p) => BASE_ID_RE.test(p));
    const tableIdOrName = parts.find((p) => p.startsWith('tbl'));

    if (!baseId) {
      return fail('URL does not include a base id');
    }
    if (!tableIdOrName) {
      return fail('URL does not include a table id');
    }

    return { ok: true, baseId, tableIdOrName };
  }

  global.parseAirtableSpreadsheetUrl = parseAirtableSpreadsheetUrl;
})(typeof self !== 'undefined' ? self : this);
