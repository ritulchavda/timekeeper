const Utils = {
  /* ── Formatting ─────────────────────── */

  formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  },

  formatDateShort(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  },

  formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  formatDuration(minutes) {
    if (minutes === null || minutes === undefined) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  },

  formatTimerHMS(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  toDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  fromDatetimeLocal(val) {
    if (!val) return null;
    return new Date(val).toISOString();
  },

  todayStr() {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  },

  isSameDay(iso1, iso2) {
    return iso1.slice(0,10) === iso2.slice(0,10);
  },

  /* ── Stats helpers ──────────────────── */

  getTodayMinutes(logs) {
    const today = this.todayStr();
    return logs
      .filter(l => l.clockOut && l.clockIn.slice(0,10) === today)
      .reduce((acc, l) => acc + (l.duration || 0), 0);
  },

  getWeekMinutes(logs) {
    const now  = new Date();
    const dow  = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dow);
    weekStart.setHours(0,0,0,0);
    return logs
      .filter(l => l.clockOut && new Date(l.clockIn) >= weekStart)
      .reduce((acc, l) => acc + (l.duration || 0), 0);
  },

  /* ── Initials ───────────────────────── */

  initials(name) {
    return (name || '?')
      .split(' ')
      .slice(0,2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  },

  /* ── Escape HTML ────────────────────── */

  esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  },

  /* ── Weekly Hours ───────────────────── */

  getWeekStart(date) {
    const d = date ? new Date(date) : new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  },

  getWeekLabel() {
    const s = this.getWeekStart();
    const e = new Date(s); e.setDate(s.getDate() + 6);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(s)} – ${fmt(e)}`;
  },

  getWeekBreakdown(logs) {
    const start = this.getWeekStart();
    const today = this.todayStr();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toLocaleDateString('en-CA');
      const minutes = logs
        .filter(l => l.clockOut && l.clockIn.slice(0, 10) === dateStr)
        .reduce((a, l) => a + (l.duration || 0), 0);
      return {
        label:    d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr,
        isToday:  dateStr === today,
        isFuture: dateStr > today,
        minutes
      };
    });
  },

  getWeekTotalMinutes(logs) {
    const start = this.getWeekStart();
    const end   = new Date(start); end.setDate(start.getDate() + 7);
    return logs
      .filter(l => l.clockOut && new Date(l.clockIn) >= start && new Date(l.clockIn) < end)
      .reduce((a, l) => a + (l.duration || 0), 0);
  },

  weekStatus(totalMinutes) {
    const h = totalMinutes / 60;
    if (h >= 30) return 'exceeded';
    if (h >= 25) return 'warning';
    if (h >= 20) return 'caution';
    return 'normal';
  },

  /* ── File download ──────────────────── */

  downloadJSON(data, filename) {
    this.downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
  },

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
};
