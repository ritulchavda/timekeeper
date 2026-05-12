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

  /* ── Download JSON ──────────────────── */

  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
};
