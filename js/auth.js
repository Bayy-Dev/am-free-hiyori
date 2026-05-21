// ── AUTH MODULE ──
// Mengelola login & register modal

let _authCallback = null;

// ── Tampilkan modal auth ──
function showAuthModal(onSuccess) {
  _authCallback = onSuccess || null;
  document.getElementById('auth-overlay').style.display = 'flex';
  switchAuthTab('login');
  // Reset semua form
  const fields = ['auth-username','auth-password','reg-username','reg-password'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('input-error'); }
  });
  document.getElementById('auth-login-error').textContent    = '';
  document.getElementById('auth-register-error').textContent = '';
  setTimeout(() => document.getElementById('auth-overlay').classList.add('active'), 10);
}

function hideAuthModal() {
  const overlay = document.getElementById('auth-overlay');
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
  _authCallback = null;
}

// ── Tab switcher ──
function switchAuthTab(tab) {
  document.getElementById('auth-login-form').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('auth-login-error').textContent    = '';
  document.getElementById('auth-register-error').textContent = '';
}

// ══════════════════════════════════════════
//  VALIDATION HELPERS
// ══════════════════════════════════════════

function showFieldError(inputId, errId, msg) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errId);
  if (input)  input.classList.add('input-error');
  if (err)    err.textContent = msg;
}

function clearFieldErrors(fields) {
  fields.forEach(({ inputId, errId }) => {
    const input = document.getElementById(inputId);
    const err   = document.getElementById(errId);
    if (input) input.classList.remove('input-error');
    if (err)   err.textContent = '';
  });
}

// Realtime validation — hapus error saat user mengetik
// (dipasang setelah DOM ready, saat DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
  ['auth-username','auth-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      el.classList.remove('input-error');
      const errEl = document.getElementById('auth-login-error');
      if (errEl) errEl.textContent = '';
    });
  });
  ['reg-username','reg-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      el.classList.remove('input-error');
      const errEl = document.getElementById('auth-register-error');
      if (errEl) errEl.textContent = '';
    });
  });
});

// ── Submit Login ──
async function submitLogin() {
  const usernameEl = document.getElementById('auth-username');
  const passwordEl = document.getElementById('auth-password');
  const errEl      = document.getElementById('auth-login-error');
  const btn        = document.getElementById('btn-submit-login');

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  // Clear error
  errEl.textContent = '';
  usernameEl.classList.remove('input-error');
  passwordEl.classList.remove('input-error');

  // Validasi
  if (!username) {
    usernameEl.classList.add('input-error');
    errEl.textContent = '⚠ Username tidak boleh kosong';
    usernameEl.focus();
    return;
  }
  if (!password) {
    passwordEl.classList.add('input-error');
    errEl.textContent = '⚠ Password tidak boleh kosong';
    passwordEl.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Memproses...';

  const result = await loginAPI(username, password);
  btn.disabled  = false;
  btn.innerHTML = 'Masuk';

  if (result.error) {
    const isDeactivated = result.error.toLowerCase().includes('dinonaktifkan') || result.error.toLowerCase().includes('expired');
    if (isDeactivated) {
      // Alert khusus akun nonaktif/expired
      errEl.innerHTML = '';
      showDeactivatedLoginAlert(result.error);
    } else {
      errEl.textContent = '⚠ ' + result.error;
      usernameEl.classList.add('input-error');
      passwordEl.classList.add('input-error');
    }
    return;
  }

  // Sukses
  setLoggedInUser(result.user);
  hideAuthModal();
  renderTopbarUser();
  renderDashboard();
  if (typeof updateDurasiAksesCard === 'function') updateDurasiAksesCard();
  showToast(`Halo, ${result.user.username}! 👋`);

  // Start polling cek akses (untuk notif revoke & expired)
  // Admin utama (admin-1) tidak perlu dicek
  if (result.user.id !== 'admin-1' && typeof startAksesPolling === 'function') {
    startAksesPolling();
  }

  if (_authCallback) _authCallback();
}

// ── Submit Register ──
async function submitRegister() {
  const usernameEl = document.getElementById('reg-username');
  const passwordEl = document.getElementById('reg-password');
  const errEl      = document.getElementById('auth-register-error');
  const btn        = document.getElementById('btn-submit-register');

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  // Clear error
  errEl.textContent = '';
  usernameEl.classList.remove('input-error');
  passwordEl.classList.remove('input-error');

  // Validasi sisi client
  if (!username) {
    usernameEl.classList.add('input-error');
    errEl.textContent = '⚠ Username tidak boleh kosong';
    usernameEl.focus();
    return;
  }
  if (username.length < 3) {
    usernameEl.classList.add('input-error');
    errEl.textContent = '⚠ Username minimal 3 karakter';
    usernameEl.focus();
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    usernameEl.classList.add('input-error');
    errEl.textContent = '⚠ Username hanya boleh huruf, angka, dan _';
    usernameEl.focus();
    return;
  }
  if (!password) {
    passwordEl.classList.add('input-error');
    errEl.textContent = '⚠ Password tidak boleh kosong';
    passwordEl.focus();
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span>Mendaftar...';

  const result = await registerAPI(username, password);
  btn.disabled  = false;
  btn.innerHTML = 'Daftar Sekarang';

  if (result.error) {
    errEl.textContent = '⚠ ' + result.error;
    if (result.error.includes('Username')) usernameEl.classList.add('input-error');
    return;
  }

  // Jika akun butuh aktivasi admin
  if (result.pendingActivation) {
    hideAuthModal();
    showPendingActivationAlert(result.user.username);
    return;
  }

  // Auto-login setelah register (fallback)
  setLoggedInUser(result.user);
  hideAuthModal();
  renderTopbarUser();
  renderDashboard();
  if (typeof updateDurasiAksesCard === 'function') updateDurasiAksesCard();
  showToast(`Akun berhasil dibuat! Selamat datang, ${result.user.username}! 🎉`);

  if (_authCallback) _authCallback();
}

// ── Tampilkan alert akun pending aktivasi ──
function showPendingActivationAlert(username) {
  // Buat overlay alert
  let el = document.getElementById('pending-activation-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pending-activation-overlay';
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;
      align-items:center;justify-content:center;z-index:9999;
    `;
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div style="
      background:var(--card-bg,#1e1e2e);border-radius:16px;padding:32px 28px;
      max-width:340px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.5);
    ">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      <div style="font-size:18px;font-weight:700;color:var(--text-primary,#fff);margin-bottom:8px;">
        AKUN BERHASIL DIBUAT
      </div>
      <div style="font-size:13px;color:#f59e0b;font-weight:600;margin-bottom:12px;">
        TAPI BELUM AKTIF
      </div>
      <div style="font-size:13px;color:var(--text-secondary,#aaa);line-height:1.6;margin-bottom:24px;">
        Hei <strong style="color:var(--text-primary,#fff)">${username}</strong>!<br>
        Akunmu sudah terdaftar tapi perlu diaktifkan dulu.<br>
        Minta <strong style="color:#a78bfa">Admin Yori</strong> untuk mengaktifkannya ya!
      </div>
      <button onclick="document.getElementById('pending-activation-overlay').style.display='none'" style="
        background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;
        border:none;border-radius:10px;padding:10px 28px;font-size:14px;
        font-weight:600;cursor:pointer;width:100%;
      ">Oke, Siap!</button>
    </div>
  `;
  el.style.display = 'flex';
}

// ── Alert login akun nonaktif/expired ──
function showDeactivatedLoginAlert(msg) {
  let el = document.getElementById('deactivated-login-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'deactivated-login-overlay';
    document.body.appendChild(el);
  }
  el.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(0,0,0,0.88);
    display:flex;align-items:center;justify-content:center;
  `;
  el.innerHTML = `
    <div style="
      text-align:center;max-width:380px;width:90%;padding:36px 28px;
      background:linear-gradient(135deg,#1a0505,#1e1e2e);
      border:2px solid rgba(239,68,68,0.5);border-radius:20px;
      box-shadow:0 0 50px rgba(239,68,68,0.15);
    ">
      <div style="font-size:60px;margin-bottom:14px;">🚨</div>
      <div style="font-size:12px;font-weight:800;letter-spacing:3px;color:#ef4444;margin-bottom:10px;">AKSES DITOLAK</div>
      <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:10px;">AKUN ANDA TELAH DINONAKTIFKAN</div>
      <div style="font-size:12px;color:#94a3b8;line-height:1.7;margin-bottom:24px;">
        HUBUNGI ADMIN UTAMA UNTUK MENGAKTIFKAN KEMBALI AKUN ANDA
      </div>
      <button onclick="document.getElementById('deactivated-login-overlay').style.display='none'" style="
        background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;
        border:none;border-radius:10px;padding:10px 28px;
        font-size:14px;font-weight:600;cursor:pointer;width:100%;
      ">Oke</button>
    </div>
  `;
  el.style.display = 'flex';
}
