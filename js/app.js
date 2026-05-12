const App = {
  _timerInterval: null,
  _activeDispute: null,
  _activeLogForDispute: null,
  _changePwUserId: null,
  _currentTab: 'employees',

  /* ══════════════════════════════════════
     BOOT
  ══════════════════════════════════════ */

  async init() {
    // 1. Seed localStorage defaults first (so app works offline too)
    DB.init();

    // 2. If GitHub is configured, pull latest .txt files into localStorage
    if (GitHub.isConfigured()) {
      this._showSyncSpinner('Syncing with GitHub…');
      await GitHub.loadAll();
      DB.init(); // re-check in case GitHub had fresh data
    }

    // 3. Navigate
    const user = Auth.getCurrentUser();
    this.navigateTo(user ? (user.role === 'admin' ? 'admin' : 'employee') : 'login');

    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) this.closeModal();
    });
  },

  _showSyncSpinner(msg) {
    document.getElementById('app').innerHTML = `
      <div class="loading-screen">
        <div class="loading-brand">
          <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <p style="font-size:.82rem;color:var(--muted);margin-top:14px;font-family:var(--font-sans);letter-spacing:.04em">${msg}</p>
        </div>
      </div>`;
  },

  /* ══════════════════════════════════════
     ROUTING
  ══════════════════════════════════════ */

  navigateTo(page, params = {}) {
    this._stopTimer();
    const app = document.getElementById('app');

    if (page === 'login') {
      app.innerHTML = Views.login();
      document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault(); this.handleLogin();
      });
      return;
    }

    if (page === 'employee') {
      const user     = Auth.getCurrentUser();
      const logs     = DB.getLogsForUser(user.id);
      const disputes = DB.getDisputesForUser(user.id);
      const active   = DB.getActiveLog(user.id);
      app.innerHTML  = Views.employeeDashboard(user, logs, disputes, active);
      if (active) this._startTimer(active.clockIn);
      return;
    }

    if (page === 'admin') {
      this._currentTab = params.tab || this._currentTab || 'employees';
      app.innerHTML    = Views.adminDashboard(this._currentTab);
      return;
    }
  },

  /* ══════════════════════════════════════
     AUTH
  ══════════════════════════════════════ */

  handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.innerHTML = '';

    const result = Auth.login(username, password);
    if (!result.ok) {
      errEl.innerHTML = `<div class="form-error">${result.error}</div>`;
      return;
    }
    this.navigateTo(result.user.role === 'admin' ? 'admin' : 'employee');
  },

  logout() {
    this._stopTimer();
    Auth.logout();
    this.navigateTo('login');
  },

  /* ══════════════════════════════════════
     CLOCK IN / OUT
  ══════════════════════════════════════ */

  clockIn() {
    const user = Auth.getCurrentUser();
    if (DB.getActiveLog(user.id)) {
      this.toast('Already clocked in.', 'warning'); return;
    }
    DB.clockIn(user.id);
    this.toast('Clocked in successfully.', 'success');
    this.navigateTo('employee');
  },

  clockOut() {
    const user   = Auth.getCurrentUser();
    const active = DB.getActiveLog(user.id);
    if (!active) { this.toast('No active session.', 'warning'); return; }
    const log = DB.clockOut(active.id);
    this.toast(`Clocked out. Worked ${Utils.formatDuration(log.duration)}.`, 'success');
    this.navigateTo('employee');
  },

  /* ══════════════════════════════════════
     ADMIN TABS
  ══════════════════════════════════════ */

  adminTab(tab) {
    this._currentTab = tab;
    this.navigateTo('admin', { tab });
  },

  /* ══════════════════════════════════════
     DISPUTES — Employee side
  ══════════════════════════════════════ */

  openRaiseDispute(logId) {
    const log = DB.getLogById(logId);
    if (!log || !log.clockOut) { this.toast('Cannot raise dispute for an active session.', 'warning'); return; }
    const existing = DB.getDisputeForLog(logId);
    if (existing) { this.toast('A dispute is already pending for this entry.', 'warning'); return; }
    this._activeLogForDispute = log;
    this.openModal('Raise Dispute', Views.raiseDisputeModal(log));
  },

  submitDispute(logId) {
    const reqIn  = document.getElementById('req-in').value;
    const reqOut = document.getElementById('req-out').value;
    const reason = document.getElementById('dispute-reason').value.trim();
    const errEl  = document.getElementById('dispute-error');
    errEl.innerHTML = '';

    if (!reqIn || !reqOut)  { errEl.innerHTML = '<div class="form-error">Please select both correction times.</div>'; return; }
    if (!reason)            { errEl.innerHTML = '<div class="form-error">Please provide a reason.</div>'; return; }

    const inDate  = new Date(reqIn);
    const outDate = new Date(reqOut);
    if (outDate <= inDate) { errEl.innerHTML = '<div class="form-error">Clock out must be after clock in.</div>'; return; }

    const user = Auth.getCurrentUser();
    DB.raiseDispute({
      userId:       user.id,
      logId,
      requestedIn:  inDate.toISOString(),
      requestedOut: outDate.toISOString(),
      reason
    });

    this.closeModal();
    this.toast('Dispute submitted. Admin will review it.', 'success');
    this.navigateTo('employee');
  },

  cancelDispute(disputeId) {
    const dispute = DB.getDisputeById(disputeId);
    if (!dispute || dispute.status !== 'pending') { this.toast('Cannot cancel this dispute.', 'warning'); return; }
    dispute.status     = 'cancelled';
    dispute.resolvedAt = new Date().toISOString();
    DB.saveDispute(dispute);
    this.toast('Dispute cancelled.', 'info');
    this.navigateTo('employee');
  },

  /* ══════════════════════════════════════
     DISPUTES — Admin side
  ══════════════════════════════════════ */

  openResolveDispute(disputeId) {
    const dispute = DB.getDisputeById(disputeId);
    const log     = DB.getLogById(dispute?.logId);
    const user    = DB.getUserById(dispute?.userId);
    if (!dispute || !log) { this.toast('Dispute or log not found.', 'error'); return; }
    this._activeDispute = dispute;
    this.openModal('Approve Dispute', Views.resolveDisputeModal(dispute, log, user));
  },

  approveDispute(disputeId) {
    const approvedIn  = document.getElementById('approved-in').value;
    const approvedOut = document.getElementById('approved-out').value;
    const adminNote   = document.getElementById('admin-note').value.trim();
    const errEl       = document.getElementById('resolve-error');
    errEl.innerHTML   = '';

    if (!approvedIn || !approvedOut) { errEl.innerHTML = '<div class="form-error">Please set both times.</div>'; return; }

    const inDate  = new Date(approvedIn);
    const outDate = new Date(approvedOut);
    if (outDate <= inDate) { errEl.innerHTML = '<div class="form-error">Clock out must be after clock in.</div>'; return; }

    const dispute = DB.getDisputeById(disputeId);
    const log     = DB.getLogById(dispute.logId);

    log.clockIn   = inDate.toISOString();
    log.clockOut  = outDate.toISOString();
    log.duration  = Math.round((outDate - inDate) / 60000);
    log.modified  = true;
    DB.saveLog(log);

    dispute.status     = 'approved';
    dispute.resolvedAt = new Date().toISOString();
    dispute.adminNote  = adminNote || null;
    DB.saveDispute(dispute);

    this.closeModal();
    this.toast('Dispute approved and time updated.', 'success');
    this.navigateTo('admin', { tab: 'disputes' });
  },

  openRejectDispute(disputeId) {
    const dispute = DB.getDisputeById(disputeId);
    const user    = DB.getUserById(dispute?.userId);
    if (!dispute) { this.toast('Dispute not found.', 'error'); return; }
    this.openModal('Reject Dispute', Views.rejectDisputeModal(dispute, user));
  },

  confirmRejectDispute(disputeId) {
    const note  = document.getElementById('reject-note').value.trim();
    const errEl = document.getElementById('reject-error');
    errEl.innerHTML = '';
    if (!note) { errEl.innerHTML = '<div class="form-error">Please provide a reason for rejection.</div>'; return; }

    const dispute      = DB.getDisputeById(disputeId);
    dispute.status     = 'rejected';
    dispute.resolvedAt = new Date().toISOString();
    dispute.adminNote  = note;
    DB.saveDispute(dispute);

    this.closeModal();
    this.toast('Dispute rejected.', 'info');
    this.navigateTo('admin', { tab: 'disputes' });
  },

  /* ══════════════════════════════════════
     ADMIN — User management
  ══════════════════════════════════════ */

  openAddEmployee() {
    this.openModal('Add Employee', Views.addEmployeeModal());
  },

  addEmployee() {
    const name     = document.getElementById('emp-name').value.trim();
    const username = document.getElementById('emp-username').value.trim().toLowerCase();
    const password = document.getElementById('emp-password').value;
    const errEl    = document.getElementById('add-emp-error');
    errEl.innerHTML = '';

    if (!name)            { errEl.innerHTML = '<div class="form-error">Full name is required.</div>'; return; }
    if (!username)        { errEl.innerHTML = '<div class="form-error">Username is required.</div>'; return; }
    if (!/^[a-z0-9._-]+$/.test(username)) { errEl.innerHTML = '<div class="form-error">Username can only contain letters, numbers, dots, hyphens, underscores.</div>'; return; }
    if (password.length < 6) { errEl.innerHTML = '<div class="form-error">Password must be at least 6 characters.</div>'; return; }
    if (DB.getUserByUsername(username)) { errEl.innerHTML = '<div class="form-error">Username already exists.</div>'; return; }

    DB.addUser({ name, username, password, role: 'employee' });
    this.closeModal();
    this.toast(`Employee "${name}" added successfully.`, 'success');
    this.navigateTo('admin', { tab: 'employees' });
  },

  openChangePassword(userId) {
    const user = DB.getUserById(userId);
    if (!user) return;
    this._changePwUserId = userId;
    this.openModal('Change Password', Views.changePasswordModal(user));
  },

  changePassword(userId) {
    const newPw     = document.getElementById('new-password').value;
    const confirmPw = document.getElementById('confirm-password').value;
    const errEl     = document.getElementById('chpw-error');
    errEl.innerHTML = '';

    if (newPw.length < 6)  { errEl.innerHTML = '<div class="form-error">Password must be at least 6 characters.</div>'; return; }
    if (newPw !== confirmPw) { errEl.innerHTML = '<div class="form-error">Passwords do not match.</div>'; return; }

    const user       = DB.getUserById(userId);
    user.passwordHash = Crypto.hash(newPw);
    DB.saveUser(user);

    this.closeModal();
    this.toast('Password updated successfully.', 'success');
  },

  toggleUserActive(userId, currentActive) {
    const user   = DB.getUserById(userId);
    user.active  = currentActive === 'true' ? false : true;
    DB.saveUser(user);
    const action = user.active ? 'activated' : 'deactivated';
    this.toast(`${user.name} has been ${action}.`, 'info');
    this.navigateTo('admin', { tab: 'employees' });
  },

  exportData() {
    const data = DB.exportAll();
    Utils.downloadJSON(data, `timekeeper-export-${Utils.todayStr()}.json`);
    this.toast('Database exported as JSON.', 'success');
  },

  /* ══════════════════════════════════════
     GITHUB SETTINGS
  ══════════════════════════════════════ */

  async testGitHubConnection() {
    const tokenVal = document.getElementById('gh-token').value;
    const owner    = document.getElementById('gh-owner').value.trim();
    const repo     = document.getElementById('gh-repo').value.trim();
    const statusEl = document.getElementById('gh-status');
    if (!tokenVal || !owner || !repo) {
      statusEl.innerHTML = '<div class="form-error">All three fields are required.</div>'; return;
    }
    const prevCfg = GitHub.getConfig();
    const token   = tokenVal.startsWith('•') ? prevCfg?.token : tokenVal;
    if (!token) { statusEl.innerHTML = '<div class="form-error">Enter a valid token.</div>'; return; }
    GitHub.saveConfig({ token, owner, repo });
    statusEl.innerHTML = '<div class="alert alert-info" style="font-size:.82rem">Testing…</div>';
    const result = await GitHub.testConnection();
    if (result.ok) {
      statusEl.innerHTML = '<div class="alert alert-success" style="font-size:.82rem">✓ Connection successful!</div>';
    } else {
      statusEl.innerHTML = `<div class="form-error">${result.error}</div>`;
      if (prevCfg) GitHub.saveConfig(prevCfg); else GitHub.clearConfig();
    }
  },

  async saveGitHubConfig() {
    const tokenVal = document.getElementById('gh-token').value;
    const owner    = document.getElementById('gh-owner').value.trim();
    const repo     = document.getElementById('gh-repo').value.trim();
    const statusEl = document.getElementById('gh-status');
    if (!owner || !repo) { statusEl.innerHTML = '<div class="form-error">Owner and repo are required.</div>'; return; }
    const prevCfg = GitHub.getConfig();
    const token   = tokenVal.startsWith('•') ? prevCfg?.token : tokenVal;
    if (!token) { statusEl.innerHTML = '<div class="form-error">Enter a valid token.</div>'; return; }

    GitHub.saveConfig({ token, owner, repo });
    statusEl.innerHTML = '<div class="alert alert-info" style="font-size:.82rem">Testing connection…</div>';
    const result = await GitHub.testConnection();
    if (!result.ok) {
      statusEl.innerHTML = `<div class="form-error">${result.error}</div>`;
      if (prevCfg) GitHub.saveConfig(prevCfg); else GitHub.clearConfig();
      return;
    }
    statusEl.innerHTML = '<div class="alert alert-info" style="font-size:.82rem">Pushing data to GitHub…</div>';
    const pushed = await GitHub.pushAll();
    if (pushed) {
      statusEl.innerHTML = '<div class="alert alert-success" style="font-size:.82rem">✓ Connected and synced — data is now in your .txt files.</div>';
      this.toast('GitHub integration active.', 'success');
    } else {
      statusEl.innerHTML = '<div class="alert alert-warning" style="font-size:.82rem">Connected but initial push had errors. Check token permissions.</div>';
      this.toast('Connected but push had errors.', 'warning');
    }
    setTimeout(() => this.navigateTo('admin', { tab: 'settings' }), 1200);
  },

  async syncFromGitHub() {
    this.toast('Pulling from GitHub…', 'info');
    await GitHub.loadAll();
    DB.init();
    this.toast('Synced from GitHub.', 'success');
    this.navigateTo('admin', { tab: 'settings' });
  },

  disconnectGitHub() {
    GitHub.clearConfig();
    this.toast('GitHub integration disconnected.', 'info');
    this.navigateTo('admin', { tab: 'settings' });
  },

  /* ══════════════════════════════════════
     MODAL
  ══════════════════════════════════════ */

  openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML    = bodyHtml;
    document.getElementById('modal-overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.getElementById('modal-body').innerHTML = '';
  },

  /* ══════════════════════════════════════
     TOAST
  ══════════════════════════════════════ */

  toast(message, type = 'info') {
    const icons = { success: '✓', error: '✕', warning: '⚠', info: '·' };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]||'·'}</span><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove());
    }, 3500);
  },

  /* ══════════════════════════════════════
     TIMER
  ══════════════════════════════════════ */

  _startTimer(clockIn) {
    const update = () => {
      const el = document.getElementById('live-timer');
      if (!el) { this._stopTimer(); return; }
      el.textContent = Utils.formatTimerHMS(Date.now() - new Date(clockIn).getTime());
    };
    update();
    this._timerInterval = setInterval(update, 1000);
  },

  _stopTimer() {
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
  }
};

/* Boot */
document.addEventListener('DOMContentLoaded', () => App.init());
