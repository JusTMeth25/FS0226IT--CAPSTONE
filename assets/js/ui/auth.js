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

      const section = document.createElement('section');
      section.className = 'auth-page';

      const card = document.createElement('div');
      card.className = 'glass-panel auth-card';

      const tabs = document.createElement('div');
      tabs.className = 'auth-tabs';
      tabs.innerHTML = `
        <button id="auth-show-login" class="btn btn-secondary"><i class="ph-fill ph-lock"></i> Login</button>
        <button id="auth-show-register" class="btn btn-secondary"><i class="ph-fill ph-sparkle"></i> Registrati</button>
      `;
      card.appendChild(tabs);

      const view = document.createElement('div');
      view.id = 'auth-view';
      card.appendChild(view);

      section.appendChild(card);
      container.appendChild(section);

      const loginTab = tabs.querySelector('#auth-show-login');
      const registerTab = tabs.querySelector('#auth-show-register');
      const setActiveTab = (which) => {
        loginTab.classList.toggle('btn-tab-active', which === 'login');
        registerTab.classList.toggle('btn-tab-active', which === 'register');
      };

      // Handlers
      loginTab.addEventListener('click', () => { setActiveTab('login'); renderLogin(view); });
      registerTab.addEventListener('click', () => { setActiveTab('register'); renderRegister(view); });

      // If already authenticated show profile, altrimenti login di default
      if (Auth.isAuthenticated()) {
        tabs.style.display = 'none';
        renderProfile(view);
      } else {
        setActiveTab('login');
        renderLogin(view);
      }
    }
  };

  // UI fragments
  function renderLogin(target) {
    target.innerHTML = `
      <h3 class="auth-form-title"><i class="ph-fill ph-lock"></i> Accedi</h3>
      <form id="auth-login-form" class="auth-form">
        <div class="auth-field">
          <label class="filter-label" for="auth-login-user">Username o Email</label>
          <input class="ai-input" id="auth-login-user" name="usernameOrEmail" required>
        </div>
        <div class="auth-field">
          <label class="filter-label" for="auth-login-pass">Password</label>
          <input class="ai-input" id="auth-login-pass" name="password" type="password" required>
        </div>
        <button type="submit" class="btn btn-primary auth-submit">Accedi</button>
        <div id="auth-login-msg" class="auth-message"></div>
      </form>
      <p class="auth-switch">Non hai un account? <button type="button" id="auth-to-register" class="auth-switch-link">Registrati</button></p>
    `;
    const form = target.querySelector('#auth-login-form');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form).entries());
      const res = Auth.login(f);
      const msg = target.querySelector('#auth-login-msg');
      if (!res.ok) {
        msg.textContent = res.err === 'invalid_credentials' ? 'Credenziali non valide' : 'Compila tutti i campi';
        msg.className = 'auth-message auth-message-error';
        window.VinylDexSound.error();
      } else {
        msg.textContent = 'Login effettuato';
        msg.className = 'auth-message auth-message-success';
        window.VinylDexSound.success();
        // Update header e naviga alla home
        updateHeaderForUser();
        if (window.VinylDexRouter) window.location.hash = '#home';
      }
    });
    target.querySelector('#auth-to-register').addEventListener('click', () => renderRegister(target));
  }

  function renderRegister(target) {
    target.innerHTML = `
      <h3 class="auth-form-title"><i class="ph-fill ph-sparkle"></i> Crea un Account</h3>
      <form id="auth-register-form" class="auth-form">
        <div class="auth-field">
          <label class="filter-label" for="auth-register-username">Username</label>
          <input class="ai-input" id="auth-register-username" name="username" required>
        </div>
        <div class="auth-field">
          <label class="filter-label" for="auth-register-email">Email</label>
          <input class="ai-input" id="auth-register-email" name="email" type="email" required>
        </div>
        <div class="auth-field">
          <label class="filter-label" for="auth-register-pass">Password</label>
          <input class="ai-input" id="auth-register-pass" name="password" type="password" required>
        </div>
        <button type="submit" class="btn btn-primary auth-submit">Crea Account</button>
        <div id="auth-register-msg" class="auth-message"></div>
      </form>
      <p class="auth-switch">Hai già un account? <button type="button" id="auth-to-login" class="auth-switch-link">Accedi</button></p>
    `;
    const form = target.querySelector('#auth-register-form');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form).entries());
      const res = Auth.register(f);
      const msg = target.querySelector('#auth-register-msg');
      if (!res.ok) {
        msg.textContent = res.err === 'user_exists' ? 'Utente già esistente' : 'Compila tutti i campi';
        msg.className = 'auth-message auth-message-error';
        window.VinylDexSound.error();
      } else {
        msg.textContent = 'Registrazione effettuata. Benvenuto!';
        msg.className = 'auth-message auth-message-success';
        window.VinylDexSound.success();
        updateHeaderForUser();
        if (window.VinylDexRouter) window.location.hash = '#home';
      }
    });
    target.querySelector('#auth-to-login').addEventListener('click', () => renderLogin(target));
  }

  function renderProfile(target) {
    const user = Auth.currentUser();
    target.innerHTML = `
      <div class="auth-profile">
        <div class="auth-profile-avatar"><i class="ph-fill ph-vinyl-record"></i></div>
        <div>
          <div class="auth-profile-username">${user.username}</div>
          <div class="auth-profile-email">${user.email}</div>
        </div>
        <button id="auth-logout" class="btn btn-secondary">Logout</button>
      </div>
    `;
    target.querySelector('#auth-logout').addEventListener('click', () => {
      Auth.logout();
      updateHeaderForUser();
      if (window.VinylDexRouter) window.location.hash = '#home';
    });
  }

  // Header integration: mostra il badge utente+logout se autenticato,
  // altrimenti lascia il bottone statico "Accedi" (#btn-signin, già presente
  // nella topbar) come unico punto di ingresso al login, per evitare doppioni.
  function updateHeaderForUser() {
    const headerInner = document.querySelector('.header-inner');
    if (!headerInner) return;
    // Remove existing auth area
    const existing = document.getElementById('header-auth-area');
    if (existing) existing.remove();

    const signinBtn = document.getElementById('btn-signin');

    if (Auth.isAuthenticated()) {
      if (signinBtn) signinBtn.style.display = 'none';

      const authArea = document.createElement('div');
      authArea.id = 'header-auth-area';
      authArea.style.display = 'flex';
      authArea.style.alignItems = 'center';
      authArea.style.gap = '8px';

      const user = Auth.currentUser();
      const badge = document.createElement('div');
      badge.className = 'user-badge';
      badge.innerHTML = `<span style="font-weight:800">${user.username}</span> <button id="header-logout" class="btn">Logout</button>`;
      authArea.appendChild(badge);
      badge.querySelector('#header-logout').addEventListener('click', () => {
        Auth.logout();
        updateHeaderForUser();
        window.location.hash = '#home';
      });

      headerInner.appendChild(authArea);
    } else if (signinBtn) {
      signinBtn.style.display = '';
    }
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