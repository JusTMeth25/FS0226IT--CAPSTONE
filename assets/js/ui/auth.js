/**
 * VinylDex - Auth UI (client-only MVP)
 *
 * - Renders Login / Register views into SPA container
 * - Persists users and session into VinylDexStorage (LocalStorage)
 * - Exposes window.VinylDexAuth API: render(container), login, logout, register, currentUser, isAuthenticated
 * - Dispatches 'vinyldex:auth:changed' custom event on login/logout/register
 *
 * Note: No backend yet. Passwords are base64-encoded for minimal obfuscation only (NOT secure).
 */

(function () {
  const storage = new window.VinylDexStorage();

  // Storage keys
  const USERS_KEY = 'auth_users';
  const SESSION_KEY = 'auth_session';

  // Utils
  function uid(prefix = 'u') {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  }
  function encodePassword(pw) {
    try { return btoa(pw); } catch (e) { return pw; }
  }

  // Low-level persistence
  function getUsers() {
    return storage.get(USERS_KEY, []);
  }
  function saveUsers(list) {
    return storage.set(USERS_KEY, list);
  }
  function getSession() {
    return storage.get(SESSION_KEY, null);
  }
  function setSession(obj) {
    return storage.set(SESSION_KEY, obj);
  }
  function clearSession() {
    return storage.remove(SESSION_KEY);
  }

  // Public API object
  const Auth = {
    isAuthenticated() {
      return !!getSession();
    },
    currentUser() {
      const s = getSession();
      return s ? s.user : null;
    },
    register({ username, email, password }) {
      const users = getUsers();
      if (!username || !email || !password) return { ok: false, err: 'missing_fields' };
      if (users.find(u => u.username === username || u.email === email)) {
        return { ok: false, err: 'user_exists' };
      }
      const user = {
        id: uid('user'),
        username,
        email,
        password: encodePassword(password),
        createdAt: Date.now()
      };
      users.push(user);
      saveUsers(users);
      // auto-login after register
      const token = uid('tok');
      setSession({ token, user: { id: user.id, username: user.username, email: user.email } });
      window.dispatchEvent(new CustomEvent('vinyldex:auth:changed', { detail: { state: 'login', user: Auth.currentUser() } }));
      return { ok: true, user: Auth.currentUser() };
    },
    login({ usernameOrEmail, password }) {
      const users = getUsers();
      if (!usernameOrEmail || !password) return { ok: false, err: 'missing_fields' };
      const enc = encodePassword(password);
      const user = users.find(u => (u.username === usernameOrEmail || u.email === usernameOrEmail) && u.password === enc);
      if (!user) return { ok: false, err: 'invalid_credentials' };
      const token = uid('tok');
      setSession({ token, user: { id: user.id, username: user.username, email: user.email } });
      window.dispatchEvent(new CustomEvent('vinyldex:auth:changed', { detail: { state: 'login', user: Auth.currentUser() } }));
      return { ok: true, user: Auth.currentUser() };
    },
    logout() {
      const prev = Auth.currentUser();
      clearSession();
      window.dispatchEvent(new CustomEvent('vinyldex:auth:changed', { detail: { state: 'logout', user: null } }));
      return { ok: true, prev };
    },

    // Renders auth view into provided container element
    render(container, params = {}) {
      if (!container) return;
      container.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'auth-panel';

      const nav = document.createElement('div');
      nav.className = 'auth-nav';
      nav.innerHTML = `<button id="auth-show-login" class="btn">Login</button> <button id="auth-show-register" class="btn">Register</button>`;
      wrapper.appendChild(nav);

      const view = document.createElement('div');
      view.id = 'auth-view';
      view.style.marginTop = '12px';
      wrapper.appendChild(view);

      container.appendChild(wrapper);

      // Handlers
      wrapper.querySelector('#auth-show-login').addEventListener('click', () => renderLogin(view));
      wrapper.querySelector('#auth-show-register').addEventListener('click', () => renderRegister(view));

      // If already authenticated show profile
      if (Auth.isAuthenticated()) {
        renderProfile(view);
      } else {
        // Default: show login
        renderLogin(view);
      }
    }
  };

  // UI fragments
  function renderLogin(target) {
    target.innerHTML = `
      <h2>Accedi</h2>
      <form id="auth-login-form" class="form">
        <label>Username o Email<input name="usernameOrEmail" required></label>
        <label>Password<input name="password" type="password" required></label>
        <div style="margin-top:10px;">
          <button type="submit" class="btn">Login</button>
          <button type="button" id="auth-to-register" class="btn">Vai a Register</button>
        </div>
        <div id="auth-login-msg" class="meta" style="margin-top:8px;color:var(--text-secondary);"></div>
      </form>
    `;
    const form = target.querySelector('#auth-login-form');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form).entries());
      const res = Auth.login(f);
      const msg = target.querySelector('#auth-login-msg');
      if (!res.ok) {
        msg.textContent = res.err === 'invalid_credentials' ? 'Credenziali non valide' : 'Compila tutti i campi';
      } else {
        msg.textContent = 'Login effettuato';
        // Update header and navigate home
        updateHeaderForUser();
        if (window.VinylDexRouter) window.location.hash = '#home';
      }
    });
    target.querySelector('#auth-to-register').addEventListener('click', () => renderRegister(target));
  }

  function renderRegister(target) {
    target.innerHTML = `
      <h2>Registrati</h2>
      <form id="auth-register-form" class="form">
        <label>Username<input name="username" required></label>
        <label>Email<input name="email" type="email" required></label>
        <label>Password<input name="password" type="password" required></label>
        <div style="margin-top:10px;">
          <button type="submit" class="btn">Register</button>
          <button type="button" id="auth-to-login" class="btn">Vai a Login</button>
        </div>
        <div id="auth-register-msg" class="meta" style="margin-top:8px;color:var(--text-secondary);"></div>
      </form>
    `;
    const form = target.querySelector('#auth-register-form');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form).entries());
      const res = Auth.register(f);
      const msg = target.querySelector('#auth-register-msg');
      if (!res.ok) {
        msg.textContent = res.err === 'user_exists' ? 'Utente già esistente' : 'Compila tutti i campi';
      } else {
        msg.textContent = 'Registrazione effettuata. Benvenuto!';
        updateHeaderForUser();
        if (window.VinylDexRouter) window.location.hash = '#home';
      }
    });
    target.querySelector('#auth-to-login').addEventListener('click', () => renderLogin(target));
  }

  function renderProfile(target) {
    const user = Auth.currentUser();
    target.innerHTML = `
      <h2>Profilo</h2>
      <div><strong>${user.username}</strong> • ${user.email}</div>
      <div style="margin-top:12px;">
        <button id="auth-logout" class="btn">Logout</button>
      </div>
    `;
    target.querySelector('#auth-logout').addEventListener('click', () => {
      Auth.logout();
      updateHeaderForUser();
      if (window.VinylDexRouter) window.location.hash = '#home';
      // Re-render profile area as login
      renderLogin(target);
    });
  }

  // Header integration: show login/register or user badge
  function updateHeaderForUser() {
    const headerInner = document.querySelector('.header-inner');
    if (!headerInner) return;
    // Remove existing auth area
    const existing = document.getElementById('header-auth-area');
    if (existing) existing.remove();

    const authArea = document.createElement('div');
    authArea.id = 'header-auth-area';
    authArea.style.marginLeft = 'auto';
    authArea.style.display = 'flex';
    authArea.style.alignItems = 'center';
    authArea.style.gap = '8px';

    if (Auth.isAuthenticated()) {
      const user = Auth.currentUser();
      const badge = document.createElement('div');
      badge.className = 'user-badge';
      badge.innerHTML = `<span style="font-weight:800">${user.username}</span> <button id="header-logout" class="btn">Logout</button>`;
      authArea.appendChild(badge);
      badge.querySelector('#header-logout').addEventListener('click', () => {
        Auth.logout();
        updateHeaderForUser();
      });
    } else {
      const loginLink = document.createElement('a');
      loginLink.href = '#login';
      loginLink.className = 'nav-link';
      loginLink.textContent = 'Login / Register';
      authArea.appendChild(loginLink);
    }

    // Append to header-inner (right side). Insert before any existing container end
    headerInner.appendChild(authArea);
  }

  // Initial header patch on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateHeaderForUser);
  } else {
    setTimeout(updateHeaderForUser, 30);
  }

  // Expose
  window.VinylDexAuth = Auth;

})();