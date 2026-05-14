/* ============================================================
   GitHub API — reads/writes data/*.txt files in the repo.
   Each file stores AES-encrypted JSON (a CryptoJS ciphertext
   string), so data at rest in GitHub is always encrypted.
   ============================================================ */

const GitHub = {
  CONFIG_KEY: 'tk_gh_config',
  SHA_STORE:  'tk_gh_shas',

  /* ── Config ─────────────────────────────── */

  getConfig() {
    // Priority 1 — shared config embedded in config.js (deployed by admin,
    //              auto-used by every employee who visits the site)
    if (typeof SHARED_GITHUB !== 'undefined' && SHARED_GITHUB) {
      try {
        const cfg = Crypto.decrypt(SHARED_GITHUB);
        if (cfg && cfg.token) return cfg;
      } catch {}
    }
    // Priority 2 — per-device config saved in this browser's localStorage
    const r = localStorage.getItem(this.CONFIG_KEY);
    return r ? Crypto.decrypt(r) : null;
  },

  isSharedConfig() {
    if (typeof SHARED_GITHUB === 'undefined' || !SHARED_GITHUB) return false;
    try { return !!(Crypto.decrypt(SHARED_GITHUB)?.token); } catch { return false; }
  },

  saveConfig(cfg) {
    localStorage.setItem(this.CONFIG_KEY, Crypto.encrypt(cfg));
  },

  clearConfig() {
    localStorage.removeItem(this.CONFIG_KEY);
    localStorage.removeItem(this.SHA_STORE);
  },

  isConfigured() {
    const c = this.getConfig();
    return !!(c && c.token && c.owner && c.repo);
  },

  /* ── SHA cache (needed for GitHub file updates) ─── */

  _shas() {
    try { return JSON.parse(localStorage.getItem(this.SHA_STORE) || '{}'); }
    catch { return {}; }
  },
  _getSha(file)      { return this._shas()[file] || null; },
  _setSha(file, sha) {
    const s = this._shas(); s[file] = sha;
    localStorage.setItem(this.SHA_STORE, JSON.stringify(s));
  },

  /* ── HTTP helpers ───────────────────────── */

  _headers() {
    const c = this.getConfig();
    return {
      'Authorization':  `Bearer ${c.token}`,
      'Accept':         'application/vnd.github.v3+json',
      'Content-Type':   'application/json'
    };
  },

  _apiUrl(filename) {
    const c = this.getConfig();
    return `https://api.github.com/repos/${c.owner}/${c.repo}/contents/data/${filename}`;
  },

  /* ── Read a file from GitHub ────────────── */

  async readFile(filename) {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(this._apiUrl(filename), { headers: this._headers() });
      if (!res.ok) return null;
      const json = await res.json();
      this._setSha(filename, json.sha);
      // GitHub returns base64; decode to the stored string
      return atob(json.content.replace(/\s/g, ''));
    } catch (e) {
      console.warn('[GitHub] readFile failed:', filename, e);
      return null;
    }
  },

  /* ── Write a file to GitHub ─────────────── */

  async writeFile(filename, content) {
    if (!this.isConfigured()) return false;
    try {
      // GitHub requires the file's current SHA to update an existing file.
      // If we don't have it cached, fetch it first (handles fresh page loads
      // and the initial '[]' placeholder files in the repo).
      let sha = this._getSha(filename);
      if (!sha) {
        await this.readFile(filename);   // populates SHA cache as a side-effect
        sha = this._getSha(filename);
      }

      const encoded = btoa(content);    // CryptoJS output is ASCII — safe for btoa
      const body = {
        message: `[TimeKeeper] update ${filename}`,
        content: encoded
      };
      if (sha) body.sha = sha;

      const res = await fetch(this._apiUrl(filename), {
        method:  'PUT',
        headers: this._headers(),
        body:    JSON.stringify(body)
      });

      // 409 = stale SHA (another client wrote first). Re-fetch and retry once.
      if (res.status === 409) {
        await this.readFile(filename);
        const body2 = { ...body, sha: this._getSha(filename) };
        const res2  = await fetch(this._apiUrl(filename), {
          method: 'PUT', headers: this._headers(), body: JSON.stringify(body2)
        });
        if (res2.ok) {
          const j2 = await res2.json();
          this._setSha(filename, j2.content?.sha);
          return true;
        }
        return false;
      }

      if (res.ok) {
        const j = await res.json();
        this._setSha(filename, j.content?.sha);
        return true;
      }

      // Surface specific errors for actionable toasts
      if (res.status === 403) return 'permission';
      if (res.status === 401) return 'auth';
      const errText = await res.text().catch(() => res.status);
      console.warn(`[GitHub] writeFile ${filename} → ${res.status}:`, errText);
      return false;
    } catch (e) {
      console.warn('[GitHub] writeFile error:', filename, e);
      return false;
    }
  },

  /* ── Test connection ───────────────────── */

  async testConnection() {
    const c = this.getConfig();
    if (!c) return { ok: false, error: 'Not configured.' };
    try {
      const res = await fetch(
        `https://api.github.com/repos/${c.owner}/${c.repo}`,
        { headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (res.ok)             return { ok: true };
      if (res.status === 401) return { ok: false, error: 'Invalid or expired token.' };
      if (res.status === 404) return { ok: false, error: 'Repository not found — check owner and repo name.' };
      return { ok: false, error: `GitHub returned HTTP ${res.status}.` };
    } catch {
      return { ok: false, error: 'Network error — check your connection.' };
    }
  },

  /* ── Load all 3 files from GitHub into localStorage ── */

  async loadAll() {
    if (!this.isConfigured()) return;
    const map = {
      'tk_doc_users':    'users.txt',
      'tk_doc_logs':     'logs.txt',
      'tk_doc_disputes': 'disputes.txt'
    };
    for (const [lsKey, file] of Object.entries(map)) {
      const content = await this.readFile(file);
      if (!content) continue;

      const remoteData = Crypto.decrypt(content);
      if (remoteData === null || !Array.isArray(remoteData)) continue;

      // Safety: never overwrite real local data with an empty remote array.
      // This prevents a race condition where DB.init() pushed [] to GitHub
      // before real data was written, then loadAll() wiped localStorage on
      // the next page load.
      if (remoteData.length === 0) {
        try {
          const local = localStorage.getItem(lsKey);
          const localData = local ? Crypto.decrypt(local) : null;
          if (Array.isArray(localData) && localData.length > 0) continue;
        } catch { /* fall through and use remote */ }
      }

      localStorage.setItem(lsKey, content);
    }
  },

  /* ── Push all localStorage data → GitHub ── */

  async pushAll() {
    if (!this.isConfigured()) return false;
    const map = {
      'tk_doc_users':    'users.txt',
      'tk_doc_logs':     'logs.txt',
      'tk_doc_disputes': 'disputes.txt'
    };
    // Pre-fetch SHAs for all files so writeFile doesn't need a second round-trip
    for (const file of Object.values(map)) {
      await this.readFile(file);
    }
    const results = [];
    for (const [lsKey, file] of Object.entries(map)) {
      const content = localStorage.getItem(lsKey);
      if (content) results.push(await this.writeFile(file, content));
    }
    return results.length > 0 && results.every(Boolean);
  }
};
