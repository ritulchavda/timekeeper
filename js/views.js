const Views = {

  /* ══════════════════════════════════════
     LOGIN
  ══════════════════════════════════════ */

  login() {
    return `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="auth-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <h1>TimeKeeper</h1>
          <p>Professional Time Management</p>
        </div>
        <div class="auth-divider"></div>
        <form id="login-form" class="form-stack" autocomplete="off">
          <div class="field-group">
            <label class="field-label" for="login-username">Username</label>
            <input class="field-input" type="text" id="login-username" placeholder="Enter your username" autocomplete="username" required>
          </div>
          <div class="field-group">
            <label class="field-label" for="login-password">Password</label>
            <div class="field-input-wrap">
              <input class="field-input" type="password" id="login-password" placeholder="Enter your password" autocomplete="current-password" required>
              <button type="button" class="field-toggle" onclick="Views._togglePw('login-password', this)">Show</button>
            </div>
          </div>
          <div id="login-error"></div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:4px">Sign In</button>
        </form>
        <p class="auth-footer">Contact your administrator for access.</p>
      </div>
    </div>`;
  },

  /* ══════════════════════════════════════
     EMPLOYEE DASHBOARD
  ══════════════════════════════════════ */

  employeeDashboard(user, logs, disputes, activeLog) {
    const todayMin  = Utils.getTodayMinutes(logs);
    const weekMin   = Utils.getWeekMinutes(logs);
    const recentLogs = [...logs].sort((a,b) => new Date(b.clockIn)-new Date(a.clockIn)).slice(0,10);
    const pendingDisp = disputes.filter(d => d.status === 'pending');
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
    const yearStr = now.getFullYear();

    return `
    <div class="app-layout">
      ${this._header(user, activeLog)}
      <main class="app-main">
        <div class="container">

          <div class="page-header">
            <div class="page-header-greeting">Good ${this._greeting()}</div>
            <h1>${Utils.esc(user.name.split(' ')[0])}</h1>
            <p>${dateStr}, ${yearStr}</p>
          </div>

          <!-- Clock Card -->
          <div class="clock-card ${activeLog ? 'active' : ''}" id="clock-card">
            ${activeLog ? this._clockInState(activeLog) : this._clockOutState()}
            <div class="clock-stats">
              <div class="clock-stat">
                <div class="clock-stat-value">${this._hmFormat(todayMin)}</div>
                <div class="clock-stat-label">Today</div>
              </div>
              <div class="clock-stat">
                <div class="clock-stat-value">${this._hmFormat(weekMin)}</div>
                <div class="clock-stat-label">This Week</div>
              </div>
              <div class="clock-stat">
                <div class="clock-stat-value">${logs.filter(l=>l.clockOut).length}</div>
                <div class="clock-stat-label">Total Sessions</div>
              </div>
            </div>
          </div>

          ${pendingDisp.length > 0 ? `
          <div class="section">
            <div class="alert alert-warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="flex-shrink:0">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              You have <strong>${pendingDisp.length}</strong> pending dispute${pendingDisp.length>1?'s':''} awaiting admin review.
            </div>
          </div>` : ''}

          <!-- Weekly Hours -->
          <div class="section">
            ${this._weeklyCard(logs)}
          </div>

          <!-- Time Entries -->
          <div class="section">
            <div class="section-header">
              <h2>Time Entries</h2>
            </div>
            ${recentLogs.length === 0
              ? `<div class="table-wrap"><div class="empty-state"><div class="empty-state-icon">○</div>No time entries yet. Clock in to get started.</div></div>`
              : `<div class="table-wrap">
                  <table class="data-table">
                    <thead><tr>
                      <th>Date</th><th>Clock In</th><th>Clock Out</th><th>Duration</th><th>Status</th><th></th>
                    </tr></thead>
                    <tbody>
                      ${recentLogs.map(log => this._logRow(log, disputes)).join('')}
                    </tbody>
                  </table>
                </div>`
            }
          </div>

          <!-- Disputes -->
          ${disputes.length > 0 ? `
          <div class="section">
            <div class="section-header"><h2>My Disputes</h2></div>
            ${disputes.slice().reverse().map(d => this._employeeDisputeCard(d, logs)).join('')}
          </div>` : ''}

        </div>
      </main>
    </div>`;
  },

  /* ══════════════════════════════════════
     ADMIN DASHBOARD
  ══════════════════════════════════════ */

  adminDashboard(tab) {
    const users    = DB.getUsers().filter(u => u.role !== 'admin');
    const allUsers = DB.getUsers();
    const logs     = DB.getLogs();
    const disputes = DB.getDisputes();
    const pending  = disputes.filter(d => d.status === 'pending');
    const activeNow = users.filter(u => DB.getActiveLog(u.id));
    const todayLogs = logs.filter(l => l.clockIn && l.clockIn.slice(0,10) === Utils.todayStr());
    const currentUser = Auth.getCurrentUser();

    return `
    <div class="app-layout">
      ${this._header(currentUser, null)}
      <main class="app-main">
        <div class="container-lg">

          <div class="page-header">
            <div class="page-header-greeting">Admin Panel</div>
            <h1>Dashboard</h1>
          </div>

          <div class="admin-stats">
            <div class="admin-stat-card">
              <div class="admin-stat-value">${users.length}</div>
              <div class="admin-stat-label">Total Employees</div>
            </div>
            <div class="admin-stat-card highlight">
              <div class="admin-stat-value">${activeNow.length}</div>
              <div class="admin-stat-label">Currently Working</div>
            </div>
            <div class="admin-stat-card">
              <div class="admin-stat-value">${todayLogs.length}</div>
              <div class="admin-stat-label">Sessions Today</div>
            </div>
            <div class="admin-stat-card ${pending.length>0?'highlight':''}">
              <div class="admin-stat-value">${pending.length}</div>
              <div class="admin-stat-label">Pending Disputes</div>
            </div>
          </div>

          <div class="tabs">
            <button class="tab-btn ${tab==='employees'?'active':''}" onclick="App.adminTab('employees')">Employees</button>
            <button class="tab-btn ${tab==='logs'?'active':''}" onclick="App.adminTab('logs')">Time Logs</button>
            <button class="tab-btn ${tab==='disputes'?'active':''}" onclick="App.adminTab('disputes')">
              Disputes ${pending.length>0?`<span class="tab-badge">${pending.length}</span>`:''}
            </button>
            <button class="tab-btn ${tab==='settings'?'active':''}" onclick="App.adminTab('settings')">
              Settings ${GitHub.isConfigured()?'<span class="tab-badge" style="background:var(--green-bg);color:var(--green)">●</span>':''}
            </button>
          </div>

          <div id="admin-tab-content">
            ${tab === 'employees' ? this._adminEmployeesTab(users) : ''}
            ${tab === 'logs'      ? this._adminLogsTab(logs, allUsers) : ''}
            ${tab === 'disputes'  ? this._adminDisputesTab(disputes, allUsers, logs) : ''}
            ${tab === 'settings'  ? this._adminSettingsTab() : ''}
          </div>

        </div>
      </main>
    </div>`;
  },

  /* ── Admin Tab: Employees ─────────────── */

  _adminEmployeesTab(users) {
    return `
    <div>
      <div class="section-header" style="margin-bottom:16px">
        <h2>Employees</h2>
        <button class="btn btn-primary btn-sm" onclick="App.openAddEmployee()">+ Add Employee</button>
      </div>
      ${users.length === 0
        ? `<div class="table-wrap"><div class="empty-state"><div class="empty-state-icon">○</div>No employees yet. Add one to get started.</div></div>`
        : `<div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Employee</th><th>Username</th><th>Status</th><th>This Week</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                ${users.map(u => {
                  const uLogs   = DB.getLogsForUser(u.id);
                  const weekMin = Utils.getWeekTotalMinutes(uLogs);
                  const wStatus = Utils.weekStatus(weekMin);
                  const wColors = { normal:'var(--secondary)', caution:'var(--accent)', warning:'var(--orange)', exceeded:'var(--red)' };
                  const wIcons  = { normal:'', caution:'', warning:'⚠ ', exceeded:'⚠ ' };
                  return `
                <tr>
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar">${Utils.initials(u.name)}</div>
                      <div>
                        <div class="user-cell-name">${Utils.esc(u.name)}</div>
                        ${DB.getActiveLog(u.id)
                          ? `<div style="display:flex;align-items:center;gap:5px;margin-top:2px"><div class="status-dot active" style="width:6px;height:6px"></div><span style="font-size:.72rem;color:var(--green)">Working now</span></div>`
                          : ''}
                      </div>
                    </div>
                  </td>
                  <td class="td-muted text-sm">${Utils.esc(u.username)}</td>
                  <td><span class="badge ${u.active?'badge-active':'badge-inactive'}">${u.active?'Active':'Inactive'}</span></td>
                  <td>
                    <span style="font-size:.82rem;font-weight:600;color:${wColors[wStatus]}">
                      ${wIcons[wStatus]}${weekMin > 0 ? Utils.formatDuration(weekMin) : '—'}
                    </span>
                    ${wStatus==='warning'||wStatus==='exceeded'
                      ? `<div style="font-size:.7rem;color:${wColors[wStatus]};margin-top:2px">${wStatus==='exceeded'?'Limit exceeded':'Near 30h limit'}</div>`
                      : ''}
                  </td>
                  <td class="td-muted text-sm">${Utils.formatDateShort(u.createdAt)}</td>
                  <td class="td-actions">
                    <div class="dropdown-actions">
                      <button class="btn btn-outline btn-sm" onclick="App.openChangePassword('${u.id}')">Change Password</button>
                      <button class="btn btn-ghost btn-sm" onclick="App.toggleUserActive('${u.id}','${u.active}')">${u.active?'Deactivate':'Activate'}</button>
                    </div>
                  </td>
                </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`
      }
      <div style="margin-top:20px;text-align:right">
        <button class="btn btn-outline btn-sm" onclick="App.exportData()">Export Database (JSON)</button>
      </div>
    </div>`;
  },

  /* ── Admin Tab: Logs ──────────────────── */

  _adminLogsTab(logs, users) {
    const employees = users.filter(u => u.role !== 'admin');
    const sorted = [...logs].sort((a,b) => new Date(b.clockIn)-new Date(a.clockIn));
    return `
    <div>
      <div class="section-header" style="margin-bottom:16px">
        <h2>All Time Logs</h2>
        <button class="btn btn-primary btn-sm" onclick="App.openAddManualEntry()">+ Add Entry</button>
      </div>
      ${sorted.length === 0
        ? `<div class="table-wrap"><div class="empty-state">No time logs yet.</div></div>`
        : `<div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Employee</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Duration</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                ${sorted.map(log => {
                  const u = users.find(u => u.id === log.userId);
                  return `<tr>
                    <td>
                      <div class="user-cell">
                        <div class="user-avatar" style="width:28px;height:28px;font-size:.65rem">${Utils.initials(u?.name||'?')}</div>
                        <span class="fw-500">${Utils.esc(u?.name||'Unknown')}</span>
                      </div>
                    </td>
                    <td class="td-muted text-sm">${Utils.formatDateShort(log.clockIn)}</td>
                    <td>${Utils.formatTime(log.clockIn)}</td>
                    <td>${log.clockOut ? Utils.formatTime(log.clockOut) : '<span class="badge badge-active">Active</span>'}</td>
                    <td>${log.clockOut ? Utils.formatDuration(log.duration) : '—'}</td>
                    <td>
                      ${log.manualEntry ? '<span class="badge badge-manual">Manual</span>' : ''}
                      ${log.modified ? '<span class="badge badge-modified">Modified</span>' : ''}
                    </td>
                    <td class="td-actions">
                      <div class="dropdown-actions">
                        <button class="btn btn-outline btn-sm" onclick="App.openEditLog('${log.id}')">Edit</button>
                        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="App.deleteLog('${log.id}')">Delete</button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`
      }
    </div>`;
  },

  /* ── Modal: Add Manual Entry ──────────── */

  addManualEntryModal(users) {
    const employees = users.filter(u => u.role !== 'admin');
    const today = Utils.todayStr();
    return `
    <div class="form-stack">
      <div class="alert alert-info" style="font-size:.82rem">
        Add a past time entry on behalf of an employee. Both clock-in and clock-out are required.
      </div>
      <div class="field-group">
        <label class="field-label">Employee</label>
        <select class="field-input" id="manual-user">
          <option value="">— Select employee —</option>
          ${employees.map(u => `<option value="${u.id}">${Utils.esc(u.name)} (${Utils.esc(u.username)})</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label class="field-label">Date</label>
        <input class="field-input" type="date" id="manual-date" max="${today}" value="${today}">
      </div>
      <div class="form-row">
        <div class="field-group">
          <label class="field-label">Clock In</label>
          <input class="field-input" type="time" id="manual-in" value="09:00">
        </div>
        <div class="field-group">
          <label class="field-label">Clock Out</label>
          <input class="field-input" type="time" id="manual-out" value="17:00">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Note <span style="color:var(--muted);font-weight:400">(optional)</span></label>
        <input class="field-input" type="text" id="manual-note" placeholder="e.g. Forgot to clock in">
      </div>
      <div id="manual-entry-error"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.addManualEntry()">Add Entry</button>
    </div>`;
  },

  /* ── Modal: Edit Log Entry ───────────── */

  editLogModal(log, users) {
    const u       = users.find(u => u.id === log.userId);
    const dateStr = log.clockIn.slice(0, 10);
    const inTime  = log.clockIn.slice(11, 16);
    const outTime = log.clockOut ? log.clockOut.slice(11, 16) : '';
    return `
    <div class="form-stack">
      <div class="alert alert-info" style="font-size:.82rem">
        Editing entry for <strong>${Utils.esc(u?.name || 'Unknown')}</strong>.
        Changes are saved immediately and marked as modified.
      </div>
      <div class="field-group">
        <label class="field-label">Date</label>
        <input class="field-input" type="date" id="edit-date" value="${dateStr}" max="${Utils.todayStr()}">
      </div>
      <div class="form-row">
        <div class="field-group">
          <label class="field-label">Clock In</label>
          <input class="field-input" type="time" id="edit-in" value="${inTime}">
        </div>
        <div class="field-group">
          <label class="field-label">Clock Out</label>
          <input class="field-input" type="time" id="edit-out" value="${outTime}" ${!log.clockOut ? 'placeholder="Still active"' : ''}>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Note <span style="color:var(--muted);font-weight:400">(optional)</span></label>
        <input class="field-input" type="text" id="edit-note" value="${Utils.esc(log.manualNote || '')}" placeholder="Reason for edit">
      </div>
      <div id="edit-log-error"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.saveEditLog('${log.id}')">Save Changes</button>
    </div>`;
  },

  /* ── Admin Tab: Disputes ──────────────── */

  _adminDisputesTab(disputes, users, logs) {
    const pending  = disputes.filter(d => d.status === 'pending');
    const resolved = disputes.filter(d => d.status !== 'pending').sort((a,b)=>new Date(b.resolvedAt)-new Date(a.resolvedAt));

    return `
    <div>
      ${pending.length === 0
        ? `<div class="alert alert-success" style="margin-bottom:20px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="flex-shrink:0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            No pending disputes — everything is up to date.
           </div>`
        : `<div style="margin-bottom:28px">
            <div class="section-header" style="margin-bottom:16px"><h2>Pending Disputes (${pending.length})</h2></div>
            ${pending.map(d => this._adminDisputeCard(d, users, logs, true)).join('')}
          </div>`
      }
      ${resolved.length > 0 ? `
        <div>
          <div class="section-header" style="margin-bottom:16px"><h2>Resolved Disputes</h2></div>
          ${resolved.slice(0,15).map(d => this._adminDisputeCard(d, users, logs, false)).join('')}
        </div>` : ''}
    </div>`;
  },

  /* ── Shared: header ───────────────────── */

  _header(user, activeLog) {
    return `
    <header class="app-header">
      <div class="header-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <span>TimeKeeper</span>
      </div>
      <div class="header-user">
        ${activeLog ? '<div class="status-dot active"></div>' : '<div class="status-dot"></div>'}
        <span class="header-user-name">${Utils.esc(user.name)}</span>
        <span class="badge ${user.role==='admin'?'badge-admin':'badge-employee'}">${user.role}</span>
        <button class="btn btn-ghost btn-sm" onclick="App.logout()">Sign Out</button>
      </div>
    </header>`;
  },

  /* ── Clocked IN state ─────────────────── */

  _clockInState(log) {
    return `
    <div class="clock-status-row">
      <div class="status-dot active"></div>
      <div class="clock-status-label">Currently Working</div>
    </div>
    <div class="clock-timer" id="live-timer">00:00:00</div>
    <div class="clock-subtitle">Clocked in at ${Utils.formatTime(log.clockIn)}</div>
    <button class="btn-clock-out" onclick="App.clockOut()">Clock Out</button>`;
  },

  /* ── Clocked OUT state ────────────────── */

  _clockOutState() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
    return `
    <div class="clock-status-row">
      <div class="status-dot"></div>
      <div class="clock-status-label">Not Clocked In</div>
    </div>
    <div class="clock-date">${dateStr}</div>
    <div class="clock-date-sub">${now.getFullYear()}</div>
    <button class="btn-clock-in" onclick="App.clockIn()">Clock In</button>`;
  },

  /* ── Log row (employee) ───────────────── */

  _logRow(log, disputes) {
    const dispute    = disputes.find(d => d.logId === log.id);
    const hasPending = dispute && dispute.status === 'pending';
    const canDispute = log.clockOut && !hasPending && dispute?.status !== 'pending';
    return `
    <tr>
      <td class="td-muted text-sm">${Utils.formatDateShort(log.clockIn)}</td>
      <td>${Utils.formatTime(log.clockIn)}</td>
      <td>${log.clockOut ? Utils.formatTime(log.clockOut) : '<span class="badge badge-active">Active</span>'}</td>
      <td>${log.clockOut ? Utils.formatDuration(log.duration) : '—'}</td>
      <td>
        ${log.modified ? '<span class="badge badge-modified">Modified</span>' : ''}
        ${hasPending   ? '<span class="badge badge-pending">Dispute Pending</span>' : ''}
        ${dispute && dispute.status === 'approved' ? '<span class="badge badge-approved">Approved</span>' : ''}
        ${dispute && dispute.status === 'rejected' ? '<span class="badge badge-rejected">Rejected</span>' : ''}
        ${!log.modified && !dispute && log.clockOut ? '' : ''}
      </td>
      <td class="td-actions">
        ${log.clockOut && !hasPending && !(dispute && dispute.status==='pending')
          ? `<button class="btn btn-ghost btn-sm" onclick="App.openRaiseDispute('${log.id}')">Raise Dispute</button>`
          : hasPending
          ? `<button class="btn btn-ghost btn-sm" onclick="App.cancelDispute('${dispute.id}')">Cancel</button>`
          : ''}
      </td>
    </tr>`;
  },

  /* ── Employee dispute card ────────────── */

  _employeeDisputeCard(dispute, logs) {
    const log = logs.find(l => l.id === dispute.logId);
    const statusColors = { pending:'badge-pending', approved:'badge-approved', rejected:'badge-rejected' };
    return `
    <div class="dispute-card">
      <div class="dispute-card-header">
        <div class="dispute-card-meta">
          <span class="dispute-card-user">Dispute — ${Utils.formatDateShort(log?.clockIn)}</span>
          <span class="badge ${statusColors[dispute.status]}">${dispute.status}</span>
        </div>
        <span class="dispute-card-date text-xs text-muted">${Utils.formatDateShort(dispute.createdAt)}</span>
      </div>
      <div class="dispute-card-body">
        <div class="dispute-times">
          <div class="dispute-time-block">
            <label>Original Time</label>
            <div class="time-val">${Utils.formatTime(log?.clockIn)} — ${Utils.formatTime(log?.clockOut)}</div>
          </div>
          <div class="dispute-time-block">
            <label>Requested Change</label>
            <div class="time-val">${Utils.formatTime(dispute.requestedIn)} — ${Utils.formatTime(dispute.requestedOut)}</div>
          </div>
        </div>
        <div><div class="dispute-reason-label">Reason</div><div class="dispute-reason-text">${Utils.esc(dispute.reason)}</div></div>
        ${dispute.adminNote ? `<div style="margin-top:12px"><div class="dispute-reason-label">Admin Note</div><div class="dispute-reason-text">${Utils.esc(dispute.adminNote)}</div></div>` : ''}
      </div>
    </div>`;
  },

  /* ── Admin dispute card ───────────────── */

  _adminDisputeCard(dispute, users, logs, showActions) {
    const user = users.find(u => u.id === dispute.userId);
    const log  = logs.find(l => l.id === dispute.logId);
    const statusColors = { pending:'badge-pending', approved:'badge-approved', rejected:'badge-rejected' };
    return `
    <div class="dispute-card">
      <div class="dispute-card-header">
        <div class="dispute-card-meta">
          <div class="user-avatar" style="width:28px;height:28px;font-size:.65rem">${Utils.initials(user?.name||'?')}</div>
          <span class="dispute-card-user">${Utils.esc(user?.name||'Unknown')}</span>
          <span class="badge ${statusColors[dispute.status]}">${dispute.status}</span>
        </div>
        <span class="dispute-card-date text-xs">${Utils.formatDateShort(dispute.createdAt)}</span>
      </div>
      <div class="dispute-card-body">
        <div class="dispute-times">
          <div class="dispute-time-block">
            <label>Original Time</label>
            <div class="time-val">${Utils.formatDateTime(log?.clockIn)} — ${Utils.formatDateTime(log?.clockOut)}</div>
          </div>
          <div class="dispute-time-block">
            <label>Requested Change</label>
            <div class="time-val">${Utils.formatDateTime(dispute.requestedIn)} — ${Utils.formatDateTime(dispute.requestedOut)}</div>
          </div>
        </div>
        <div><div class="dispute-reason-label">Reason</div><div class="dispute-reason-text">${Utils.esc(dispute.reason)}</div></div>
        ${dispute.adminNote ? `<div style="margin-top:12px"><div class="dispute-reason-label">Admin Note</div><div class="dispute-reason-text">${Utils.esc(dispute.adminNote)}</div></div>` : ''}
      </div>
      ${showActions ? `
      <div class="dispute-card-footer">
        <button class="btn btn-outline btn-sm" onclick="App.openRejectDispute('${dispute.id}')">Reject</button>
        <button class="btn btn-primary btn-sm" onclick="App.openResolveDispute('${dispute.id}')">Review & Approve</button>
      </div>` : ''}
    </div>`;
  },

  /* ══════════════════════════════════════
     MODALS
  ══════════════════════════════════════ */

  raiseDisputeModal(log) {
    return `
    <div class="form-stack">
      <div class="alert alert-info" style="font-size:.82rem">
        You are requesting a correction for your time entry on <strong>${Utils.formatDate(log.clockIn)}</strong>.
        Your request will be reviewed by an admin.
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Original Entry</div>
        <div class="modal-info-grid">
          <div class="modal-info-item"><label>Clock In</label><div class="val">${Utils.formatDateTime(log.clockIn)}</div></div>
          <div class="modal-info-item"><label>Clock Out</label><div class="val">${Utils.formatDateTime(log.clockOut)}</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Requested Correction</div>
        <div class="form-row">
          <div class="field-group">
            <label class="field-label" for="req-in">Correct Clock In</label>
            <input class="field-input" type="datetime-local" id="req-in" value="${Utils.toDatetimeLocal(log.clockIn)}">
          </div>
          <div class="field-group">
            <label class="field-label" for="req-out">Correct Clock Out</label>
            <input class="field-input" type="datetime-local" id="req-out" value="${Utils.toDatetimeLocal(log.clockOut)}">
          </div>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label" for="dispute-reason">Reason for Correction</label>
        <textarea class="field-input" id="dispute-reason" placeholder="Explain why this time entry needs correction..." rows="3"></textarea>
      </div>
      <div id="dispute-error"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.submitDispute('${log.id}')">Submit Dispute</button>
    </div>`;
  },

  resolveDisputeModal(dispute, log, user) {
    return `
    <div class="form-stack">
      <div class="alert alert-info" style="font-size:.82rem">
        Reviewing dispute from <strong>${Utils.esc(user?.name||'Unknown')}</strong>. You may adjust the times before approving.
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Employee's Requested Times</div>
        <div class="modal-info-grid">
          <div class="modal-info-item"><label>Requested In</label><div class="val">${Utils.formatDateTime(dispute.requestedIn)}</div></div>
          <div class="modal-info-item"><label>Requested Out</label><div class="val">${Utils.formatDateTime(dispute.requestedOut)}</div></div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Set Corrected Times</div>
        <div class="form-row">
          <div class="field-group">
            <label class="field-label" for="approved-in">Clock In</label>
            <input class="field-input" type="datetime-local" id="approved-in" value="${Utils.toDatetimeLocal(dispute.requestedIn)}">
          </div>
          <div class="field-group">
            <label class="field-label" for="approved-out">Clock Out</label>
            <input class="field-input" type="datetime-local" id="approved-out" value="${Utils.toDatetimeLocal(dispute.requestedOut)}">
          </div>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label" for="admin-note">Admin Note (optional)</label>
        <textarea class="field-input" id="admin-note" placeholder="Add a note for the employee..." rows="2"></textarea>
      </div>
      <div id="resolve-error"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.approveDispute('${dispute.id}')">Approve & Update Time</button>
    </div>`;
  },

  rejectDisputeModal(dispute, user) {
    return `
    <div class="form-stack">
      <div class="alert alert-warning" style="font-size:.82rem">
        You are rejecting the dispute from <strong>${Utils.esc(user?.name||'Unknown')}</strong>. The original time entry will remain unchanged.
      </div>
      <div class="field-group">
        <label class="field-label" for="reject-note">Reason for Rejection</label>
        <textarea class="field-input" id="reject-note" placeholder="Explain why this dispute is rejected..." rows="3"></textarea>
      </div>
      <div id="reject-error"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="App.confirmRejectDispute('${dispute.id}')">Reject Dispute</button>
    </div>`;
  },

  addEmployeeModal() {
    return `
    <div class="form-stack">
      <div class="form-row">
        <div class="field-group">
          <label class="field-label" for="emp-name">Full Name</label>
          <input class="field-input" type="text" id="emp-name" placeholder="Jane Smith">
        </div>
        <div class="field-group">
          <label class="field-label" for="emp-username">Username</label>
          <input class="field-input" type="text" id="emp-username" placeholder="jane.smith">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label" for="emp-password">Password</label>
        <div class="field-input-wrap">
          <input class="field-input" type="password" id="emp-password" placeholder="Minimum 6 characters">
          <button type="button" class="field-toggle" onclick="Views._togglePw('emp-password', this)">Show</button>
        </div>
      </div>
      <div id="add-emp-error"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.addEmployee()">Add Employee</button>
    </div>`;
  },

  changePasswordModal(user) {
    return `
    <div class="form-stack">
      <div class="alert alert-info" style="font-size:.82rem">
        Changing password for <strong>${Utils.esc(user.name)}</strong> (${Utils.esc(user.username)}).
      </div>
      <div class="field-group">
        <label class="field-label" for="new-password">New Password</label>
        <div class="field-input-wrap">
          <input class="field-input" type="password" id="new-password" placeholder="Minimum 6 characters">
          <button type="button" class="field-toggle" onclick="Views._togglePw('new-password', this)">Show</button>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label" for="confirm-password">Confirm Password</label>
        <div class="field-input-wrap">
          <input class="field-input" type="password" id="confirm-password" placeholder="Re-enter password">
          <button type="button" class="field-toggle" onclick="Views._togglePw('confirm-password', this)">Show</button>
        </div>
      </div>
      <div id="chpw-error"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="App.changePassword('${user.id}')">Update Password</button>
    </div>`;
  },

  /* ── Weekly Hours Card ───────────────── */

  _weeklyCard(logs) {
    const breakdown  = Utils.getWeekBreakdown(logs);
    const totalMin   = Utils.getWeekTotalMinutes(logs);
    const status     = Utils.weekStatus(totalMin);
    const limitMin   = 1800;  // 30h in minutes
    const pct        = Math.min(100, Math.round((totalMin / limitMin) * 100));
    const remaining  = Math.max(0, limitMin - totalMin);
    const maxDayMin  = Math.max(480, ...breakdown.map(d => d.minutes)); // floor = 8h

    const theme = {
      normal:   { color: 'var(--green)',   bg: 'var(--green-bg)',   icon: '', msg: null },
      caution:  { color: 'var(--accent)',  bg: 'var(--accent-light)', icon: 'ℹ', msg: `${Utils.formatDuration(remaining)} remaining until 30h limit.` },
      warning:  { color: 'var(--orange)',  bg: 'var(--orange-bg)',  icon: '⚠', msg: `Close to 30h limit — only ${Utils.formatDuration(remaining)} left this week.` },
      exceeded: { color: 'var(--red)',     bg: 'var(--red-bg)',     icon: '⚠', msg: `30h weekly limit reached. ${Utils.formatDuration(totalMin - limitMin)} over.` }
    }[status];

    return `
    <div class="week-card">
      <div class="week-header">
        <span class="week-title">This Week</span>
        <span class="week-range">${Utils.getWeekLabel()}</span>
      </div>
      <div class="week-days">
        ${breakdown.map(day => {
          const barW = day.minutes ? Math.round((day.minutes / maxDayMin) * 100) : 0;
          const barColor = day.isToday ? 'var(--accent)' : 'var(--primary)';
          return `
          <div class="week-day${day.isToday ? ' today' : ''}${day.isFuture ? ' future' : ''}">
            <span class="week-day-label">${day.label}</span>
            <div class="week-bar-wrap">
              <div class="week-bar" style="width:${barW}%;background:${barColor}"></div>
            </div>
            <span class="week-day-val">${day.minutes ? Utils.formatDuration(day.minutes) : day.isFuture ? '' : '—'}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="week-footer">
        <div class="week-total-row">
          <div class="week-progress-wrap">
            <div class="week-progress-fill" style="width:${pct}%;background:${theme.color}"></div>
          </div>
          <span class="week-total-label" style="color:${theme.color}">
            ${Utils.formatDuration(totalMin)}<span class="week-limit-label"> / 30h</span>
          </span>
        </div>
        ${theme.msg ? `
        <div class="week-msg" style="background:${theme.bg};color:${theme.color}">
          <span class="week-msg-icon">${theme.icon}</span>${theme.msg}
        </div>` : ''}
      </div>
    </div>`;
  },

  /* ── Admin Tab: Settings ─────────────── */

  _adminSettingsTab() {
    const cfg        = GitHub.getConfig();
    const connected  = GitHub.isConfigured();
    return `
    <div>
      <div class="section-header" style="margin-bottom:4px">
        <h2>GitHub Integration</h2>
        ${connected
          ? '<span class="badge badge-active">Connected</span>'
          : '<span class="badge badge-inactive">Not Connected</span>'}
      </div>
      <p class="text-sm text-muted" style="margin-bottom:24px">
        Every save writes encrypted data to <code>data/users.txt</code>, <code>data/logs.txt</code>,
        and <code>data/disputes.txt</code> in your GitHub repo via the GitHub API.
      </p>

      <div style="margin-bottom:24px">
        <div class="alert alert-info" style="font-size:.83rem;margin-bottom:12px;flex-direction:column;align-items:flex-start;gap:10px">
          <div><strong>Option A — Classic token (easiest)</strong></div>
          <ol style="padding-left:18px;line-height:1.9;font-size:.82rem">
            <li>Go to <strong>github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)</strong></li>
            <li>Click <strong>Generate new token (classic)</strong></li>
            <li>Tick the <strong><code>repo</code></strong> scope (top checkbox)</li>
            <li>Generate &amp; copy the token — paste it below</li>
          </ol>
        </div>
        <div class="alert alert-info" style="font-size:.83rem;flex-direction:column;align-items:flex-start;gap:10px">
          <div><strong>Option B — Fine-grained token</strong></div>
          <ol style="padding-left:18px;line-height:1.9;font-size:.82rem">
            <li>Go to <strong>Personal access tokens → Fine-grained tokens → Generate new token</strong></li>
            <li>Set <strong>Repository access</strong> → Only select repositories → pick <strong>${GitHub.getConfig()?.repo || 'your repo'}</strong></li>
            <li>Under <strong>Repository permissions</strong> set <strong>Contents → Read and write</strong></li>
            <li>Generate &amp; copy the token — paste it below</li>
          </ol>
        </div>
      </div>

      <div class="card" style="max-width:500px">
        <div class="card-body">
          <div class="form-stack">
            <div class="field-group">
              <label class="field-label">Personal Access Token</label>
              <div class="field-input-wrap">
                <input class="field-input" type="password" id="gh-token"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value="${cfg ? '•'.repeat(24) : ''}">
                <button type="button" class="field-toggle" onclick="Views._togglePw('gh-token',this)">Show</button>
              </div>
            </div>
            <div class="form-row">
              <div class="field-group">
                <label class="field-label">Owner / Username</label>
                <input class="field-input" type="text" id="gh-owner"
                  placeholder="your-username"
                  value="${cfg ? Utils.esc(cfg.owner) : ''}">
              </div>
              <div class="field-group">
                <label class="field-label">Repository Name</label>
                <input class="field-input" type="text" id="gh-repo"
                  placeholder="clockify"
                  value="${cfg ? Utils.esc(cfg.repo) : ''}">
              </div>
            </div>
            <div id="gh-status"></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-outline" onclick="App.testGitHubConnection()">Test Connection</button>
              <button class="btn btn-primary" onclick="App.saveGitHubConfig()">Save & Connect</button>
              ${connected ? `
              <button class="btn btn-ghost" onclick="App.syncFromGitHub()">↕ Sync Now</button>
              <button class="btn btn-ghost" style="color:var(--red)" onclick="App.disconnectGitHub()">Disconnect</button>` : ''}
            </div>
          </div>
        </div>
      </div>

      ${connected ? `
      <div class="card" style="max-width:500px;margin-top:24px">
        <div class="card-body">
          <div class="modal-section-title" style="margin-bottom:8px">Auto-configure for all employees</div>
          <p class="text-sm text-muted" style="margin-bottom:16px;line-height:1.7">
            Generate a <code>config.js</code> file with the GitHub connection embedded (encrypted).
            Commit it to your repo once — every employee who visits the site will
            automatically connect to GitHub with <strong>no manual setup</strong> on their end.
          </p>
          ${GitHub.isSharedConfig()
            ? `<div class="alert alert-success" style="font-size:.82rem;margin-bottom:14px">
                ✓ <strong>Shared config is active.</strong> Employees auto-connect via <code>config.js</code>.
               </div>`
            : `<div class="alert alert-warning" style="font-size:.82rem;margin-bottom:14px">
                Employees visiting from other devices won't connect until you deploy <code>config.js</code>.
               </div>`}
          <button class="btn btn-primary btn-sm" onclick="App.generateConfig()">Download config.js</button>
          <p class="text-xs text-muted" style="margin-top:10px;line-height:1.6">
            After downloading: <code>git add js/config.js &amp;&amp; git commit -m "add shared config" &amp;&amp; git push</code>
          </p>
        </div>
      </div>
      <div class="alert alert-warning" style="margin-top:16px;font-size:.82rem;max-width:500px">
        <strong>Security note:</strong> The token inside <code>config.js</code> is AES-encrypted
        but is still accessible to anyone with repo access. Use a <strong>fine-grained token</strong>
        scoped only to this repo with <em>Contents: Read &amp; write</em> only.
      </div>` : ''}
    </div>`;
  },

  /* ── Helpers ──────────────────────────── */

  _greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  },

  _hmFormat(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0 && m === 0) return '0h';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  },

  _togglePw(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text';     btn.textContent = 'Hide'; }
    else                        { inp.type = 'password'; btn.textContent = 'Show'; }
  }
};
