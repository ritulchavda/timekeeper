const DB = {
  K: {
    USERS:    'tk_doc_users',
    LOGS:     'tk_doc_logs',
    DISPUTES: 'tk_doc_disputes'
  },

  FILES: {
    'tk_doc_users':    'users.txt',
    'tk_doc_logs':     'logs.txt',
    'tk_doc_disputes': 'disputes.txt'
  },

  /* ── core ───────────────────────────── */

  read(key) {
    const raw = localStorage.getItem(key);
    return raw ? Crypto.decrypt(raw) : null;
  },

  write(key, data) {
    const encrypted = Crypto.encrypt(data);
    localStorage.setItem(key, encrypted);
    // Background sync → GitHub txt file
    const file = this.FILES[key];
    if (file && typeof GitHub !== 'undefined' && GitHub.isConfigured()) {
      GitHub.writeFile(file, encrypted).then(ok => {
        if (!ok && typeof App !== 'undefined') {
          App.toast('GitHub sync failed — data saved locally.', 'warning');
        }
      }).catch(() => {
        if (typeof App !== 'undefined') App.toast('GitHub sync failed.', 'warning');
      });
    }
  },

  newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  },

  /* ── init ───────────────────────────── */

  init() {
    if (!this.read(this.K.USERS)) {
      this.write(this.K.USERS, [{
        id:           this.newId(),
        username:     'admin',
        passwordHash: Crypto.hash('Admin@123'),
        name:         'Administrator',
        role:         'admin',
        active:       true,
        createdAt:    new Date().toISOString()
      }]);
    }
    if (!this.read(this.K.LOGS))     this.write(this.K.LOGS, []);
    if (!this.read(this.K.DISPUTES)) this.write(this.K.DISPUTES, []);
  },

  /* ── users ──────────────────────────── */

  getUsers()              { return this.read(this.K.USERS) || []; },
  getUserById(id)         { return this.getUsers().find(u => u.id === id); },
  getUserByUsername(name) { return this.getUsers().find(u => u.username === name); },

  saveUser(user) {
    const list = this.getUsers();
    const idx  = list.findIndex(u => u.id === user.id);
    if (idx >= 0) list[idx] = user; else list.push(user);
    this.write(this.K.USERS, list);
  },

  addUser(data) {
    const user = {
      id:           this.newId(),
      username:     data.username.trim().toLowerCase(),
      passwordHash: Crypto.hash(data.password),
      name:         data.name.trim(),
      role:         data.role || 'employee',
      active:       true,
      createdAt:    new Date().toISOString()
    };
    const list = this.getUsers();
    list.push(user);
    this.write(this.K.USERS, list);
    return user;
  },

  /* ── logs ───────────────────────────── */

  getLogs()               { return this.read(this.K.LOGS) || []; },
  getLogsForUser(userId)  { return this.getLogs().filter(l => l.userId === userId); },
  getActiveLog(userId)    { return this.getLogsForUser(userId).find(l => !l.clockOut); },
  getLogById(id)          { return this.getLogs().find(l => l.id === id); },

  saveLog(log) {
    const list = this.getLogs();
    const idx  = list.findIndex(l => l.id === log.id);
    if (idx >= 0) list[idx] = log; else list.push(log);
    this.write(this.K.LOGS, list);
  },

  clockIn(userId) {
    const log = {
      id:       this.newId(),
      userId,
      clockIn:  new Date().toISOString(),
      clockOut: null,
      duration: null,
      modified: false
    };
    this.saveLog(log);
    return log;
  },

  clockOut(logId) {
    const log = this.getLogById(logId);
    if (!log) return null;
    const out    = new Date();
    log.clockOut = out.toISOString();
    log.duration = Math.round((out - new Date(log.clockIn)) / 60000);
    this.saveLog(log);
    return log;
  },

  /* ── disputes ───────────────────────── */

  getDisputes()              { return this.read(this.K.DISPUTES) || []; },
  getDisputesForUser(userId) { return this.getDisputes().filter(d => d.userId === userId); },
  getPendingDisputes()       { return this.getDisputes().filter(d => d.status === 'pending'); },
  getDisputeById(id)         { return this.getDisputes().find(d => d.id === id); },
  getDisputeForLog(logId)    { return this.getDisputes().find(d => d.logId === logId && d.status === 'pending'); },

  saveDispute(dispute) {
    const list = this.getDisputes();
    const idx  = list.findIndex(d => d.id === dispute.id);
    if (idx >= 0) list[idx] = dispute; else list.push(dispute);
    this.write(this.K.DISPUTES, list);
  },

  raiseDispute(data) {
    const dispute = {
      id:           this.newId(),
      userId:       data.userId,
      logId:        data.logId,
      requestedIn:  data.requestedIn,
      requestedOut: data.requestedOut,
      reason:       data.reason.trim(),
      status:       'pending',
      createdAt:    new Date().toISOString(),
      resolvedAt:   null,
      adminNote:    null
    };
    this.saveDispute(dispute);
    return dispute;
  },

  /* ── export ─────────────────────────── */

  exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      users:      this.getUsers().map(u => ({ ...u, passwordHash: '[REDACTED]' })),
      logs:       this.getLogs(),
      disputes:   this.getDisputes()
    };
  }
};
