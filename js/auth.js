const Auth = {
  SESSION_KEY: 'tk_session',

  login(username, password) {
    const user = DB.getUserByUsername(username.trim().toLowerCase());
    if (!user || !user.active) return { ok: false, error: 'Invalid username or password.' };
    if (user.passwordHash !== Crypto.hash(password)) return { ok: false, error: 'Invalid username or password.' };
    const session = { userId: user.id, role: user.role, loginAt: new Date().toISOString() };
    sessionStorage.setItem(this.SESSION_KEY, Crypto.encrypt(session));
    return { ok: true, user };
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  getSession() {
    const raw = sessionStorage.getItem(this.SESSION_KEY);
    return raw ? Crypto.decrypt(raw) : null;
  },

  getCurrentUser() {
    const s = this.getSession();
    if (!s) return null;
    return DB.getUserById(s.userId) || null;
  },

  isLoggedIn() { return !!this.getSession(); },
  isAdmin()    { const u = this.getCurrentUser(); return u && u.role === 'admin'; }
};
