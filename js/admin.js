// ── ADMIN MODULE ──
// Login, logout, tambah/hapus akun, kelola session

const ADMIN_PASSWORD = 'bayyzofc1';
let isAdminLoggedIn  = false;
let adminActiveTab   = 'accounts'; // 'accounts' | 'sessions'

function adminLogin() {
  const pw = document.getElementById('admin-pw-input').value;
  if (pw === ADMIN_PASSWORD) {
    isAdminLoggedIn = true;
    setAdminSession(true);
    document.getElementById('admin-login-section').style.display = 'none';
    document.getElementById('admin-panel-section').style.display = 'block';
    switchAdminTab('accounts');
    showToast('Selamat datang, Admin! 👋');
  } else {
    const errEl = document.getElementById('admin-error');
    errEl.textContent = 'Password salah!';
    setTimeout(() => errEl.textContent = '', 2000);
  }
}

function adminLogout() {
  isAdminLoggedIn = false;
  setAdminSession(false);
  document.getElementById('admin-login-section').style.display = 'block';
  document.getElementById('admin-panel-section').style.display = 'none';
  document.getElementById('admin-pw-input').value = '';
  showToast('Berhasil keluar.', 'error');
  // Redirect ke dashboard supaya gak auto-bypass login lagi
  showPage('dashboard');
}


// Tampilkan/sembunyikan dropdown durasi saat role berubah
function onRoleChange() {
  const role = document.getElementById('new-user-role')?.value;
  const durWrap = document.getElementById('admin-durasi-wrap');
  if (durWrap) durWrap.style.display = (role === 'admin') ? 'block' : 'none';
}

// Nilai custom durasi dalam hari (disimpan sementara)
let _customDurasiDays = null;

function onDurasiChange(sel) {
  const inlineEl = document.getElementById('custom-durasi-inline');
  if (sel.value === 'custom') {
    if (inlineEl) {
      inlineEl.style.display = 'block';
      const valInput = document.getElementById('custom-durasi-val');
      if (valInput) { valInput.value = ''; setTimeout(() => valInput.focus(), 50); }
    }
    _customDurasiDays = null;
  } else {
    if (inlineEl) inlineEl.style.display = 'none';
    _customDurasiDays = null;
  }
}

// Inisialisasi form user berdasarkan role current user
function initUserForm() {
  const user = getLoggedInUser();
  const isMainAdmin = user && user.id === 'admin-1';
  const roleWrap = document.getElementById('role-wrap');
  const title = document.getElementById('add-user-form-title');
  if (isMainAdmin) {
    // Admin utama bisa pilih role
    if (roleWrap) roleWrap.style.display = 'block';
    if (title) title.textContent = '👥 Tambah User';
    onRoleChange();
  } else {
    // Admin biasa hanya bisa tambah member
    if (roleWrap) roleWrap.style.display = 'none';
    if (title) title.textContent = '👤 Tambah Member';
    const durWrap = document.getElementById('admin-durasi-wrap');
    if (durWrap) durWrap.style.display = 'none';
  }
}
// ── TAB SWITCHING ──
function switchAdminTab(tab) {
  adminActiveTab = tab;
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('tab-accounts').style.display = tab === 'accounts' ? 'block' : 'none';
  document.getElementById('tab-sessions').style.display = tab === 'sessions' ? 'block' : 'none';
  document.getElementById('tab-users').style.display    = tab === 'users'    ? 'block' : 'none';
  document.getElementById('tab-debug').style.display    = tab === 'debug'    ? 'block' : 'none';

  if (tab === 'accounts') renderAdminPanel();
  if (tab === 'sessions') renderSessionPanel();
  if (tab === 'users')    { renderUserPanel(); initUserForm(); }
  if (tab === 'debug')    renderDebugPanel();
}

async function renderAdminPanel() {
  const accounts = await getAccounts();
  document.getElementById('admin-count').textContent = accounts.length;

  const list = document.getElementById('admin-account-list');
  if (accounts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">Belum ada akun ditambahkan</div>
      </div>`;
    return;
  }

  list.innerHTML = accounts.map(a => `
    <div class="account-item">
      <div class="account-status ${a.claimed ? 'status-taken' : 'status-available'}"></div>
      <div class="account-info">
        <div class="account-email">${escHtml(a.email)}</div>
        <div class="account-keterangan">
          ${escHtml(a.keterangan) || '-'} &middot;
          ${a.claimed ? '🔴 Sudah diklaim' : '🟢 Tersedia'}
        </div>
      </div>
      <div class="account-actions">
        <button class="btn-delete" onclick="deleteAccount('${escHtml(a.id)}')">Hapus</button>
      </div>
    </div>
  `).join('');
}

// ── SESSION PANEL ──
async function renderSessionPanel() {
  const sessions = await getSessions();
  const list     = document.getElementById('session-list');
  document.getElementById('session-count').textContent = sessions.length;

  if (sessions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🕳️</div>
        <div class="empty-text">Belum ada session aktif</div>
      </div>`;
    return;
  }

  list.innerHTML = sessions.map(s => `
    <div class="session-item" id="sess-${escHtml(s.sessionId)}">
      <div class="session-icon">🖥️</div>
      <div class="session-info">
        <div class="session-name">${escHtml(s.sessionName)}</div>
        <div class="session-meta">
          <span class="session-badge">📧 ${escHtml(s.email)}</span>
          <span class="session-badge muted">🕐 ${escHtml(s.date)}</span>
        </div>
        <div class="session-id-text">ID: ${escHtml(s.sessionId)}</div>
      </div>
      <div class="account-actions">
        <button class="btn-delete" onclick="adminDeleteSession('${escHtml(s.sessionId)}')">
          🗑 Hapus Session
        </button>
      </div>
    </div>
  `).join('');
}

async function adminDeleteSession(sessionId) {
  if (!confirm(`Hapus session "${sessionId.slice(0,8)}..."?\n\nUser tersebut akan bisa claim ulang.`)) return;

  const result = await deleteSessionAPI(sessionId);
  if (result.ok) {
    showToast('Session berhasil dihapus. User bisa claim ulang.', 'success');
  } else {
    showToast('Gagal hapus session: ' + (result.error || 'unknown'), 'error');
  }

  await renderSessionPanel();
  await renderAdminPanel();
  await updateStats();
}

// ── ADD ACCOUNT ──
async function addAccount() {
  const email  = document.getElementById('input-email').value.trim();
  const access = 'https://generator.email/' + email;
  const ket    = document.getElementById('input-keterangan').value.trim();

  if (!email || !access) {
    showToast('Email & URL akses wajib diisi!', 'error');
    return;
  }

  const result = await addAccountAPI(email, access, ket);

  if (result.error === 'Email sudah ada di daftar') {
    showToast('Email sudah ada di daftar!', 'error');
    return;
  }

  if (!result.ok) {
    showToast('Gagal tambah akun: ' + (result.error || 'unknown'), 'error');
    return;
  }

  document.getElementById('input-email').value      = '';

  document.getElementById('input-keterangan').value = '';

  await renderAdminPanel();
  await updateStats();
  showToast('Akun berhasil ditambahkan! ✅');
}

// ════════════════════════════════════════
//  KEMBALIKAN / HAPUS AKUN (admin-1 only)
// ════════════════════════════════════════

async function adminReturnAccount(sessionId, cardIdx) {
  const user = getLoggedInUser();
  if (!user || user.id !== 'admin-1') {
    showToast('Hanya admin utama yang bisa kembalikan akun!', 'error');
    return;
  }

  if (!confirm('Kembalikan akun ini ke sistem?\n\nAkun akan tersedia lagi untuk diklaim orang lain.')) return;

  const result = await returnAccountAPI(sessionId);
  if (!result.ok) {
    showToast('Gagal kembalikan akun: ' + (result.error || 'unknown'), 'error');
    return;
  }

  showToast('✅ Akun berhasil dikembalikan ke sistem!');
  await updateStats();
  await renderMyClaim();
}

async function adminDeleteMyClaim(sessionId, cardIdx) {
  const user = getLoggedInUser();
  if (!user || user.id !== 'admin-1') return;

  if (!confirm('Hapus akun ini dari daftar My Claim?\n\nAkun tetap tercatat sebagai claimed di sistem.')) return;

  const result = await deleteMyClaimAPI(sessionId);
  if (!result.ok) {
    showToast('Gagal hapus: ' + (result.error || 'unknown'), 'error');
    return;
  }

  showToast('🗑 Dihapus dari My Claim.');
  await renderMyClaim();
}

function deleteAccount(id) {
  if (!confirm('Yakin mau hapus akun ini?')) return;
  deleteAccountAPI(id).then(() => {
    renderAdminPanel();
    updateStats();
    showToast('Akun dihapus.', 'error');
  });
}

// ════════════════════════════════════════
//  KELOLA USER
// ════════════════════════════════════════

async function renderUserPanel() {
  const users = await getUsers();
  const list  = document.getElementById('user-list');
  document.getElementById('user-count').textContent = users.length;
  const currentUser = getLoggedInUser();
  const isCurrentMainAdmin = currentUser && currentUser.id === 'admin-1';

  if (users.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <div class="empty-text">Belum ada user terdaftar</div>
      </div>`;
    return;
  }

  // Urutkan: admin-1 paling atas → admin lain (terbaru di atas) → member (terbaru di atas)
  const sortedUsers = [...users].sort((a, b) => {
    if (a.id === 'admin-1') return -1;
    if (b.id === 'admin-1') return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  list.innerHTML = sortedUsers.map(u => {
    const isMainAdmin = u.id === 'admin-1';
    const isAdmin     = u.role === 'admin';
    // Admin utama selalu aktif; admin lain ikut nilai isActive (bisa false kalau expired)
    const isActive    = u.id === 'admin-1' ? true : (u.isActive === true);
    const noLimit     = u.noLimit  === true;
    const isExpiredNow = u.expiredAt && Date.now() > u.expiredAt;
    const statusColor = isActive ? '#22c55e' : '#ef4444';
    const statusText  = isActive ? 'Aktif' : 'Nonaktif';
    return `
      <div class="user-item" id="user-${escHtml(u.id)}" style="flex-wrap:wrap;gap:8px;">
        <div class="user-avatar-sm ${isAdmin ? 'avatar-admin' : ''}">
          ${escHtml(u.username.charAt(0).toUpperCase())}
        </div>
        <div class="user-info" style="flex:1;min-width:120px;">
          <div class="user-name">
            ${escHtml(u.username)}
            ${isMainAdmin ? '<span class="user-tag main-admin">★ Admin Utama</span>' : ''}
          </div>
          <div class="user-role-label" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>
              <span class="user-role-dot ${isAdmin ? 'dot-admin' : 'dot-member'}"></span>
              ${isAdmin ? 'Admin' : 'Member'}
            </span>
            ${!isMainAdmin ? `
              <span style="font-size:10px;font-weight:600;color:${statusColor};">● ${statusText}</span>
              ${noLimit ? '<span style="font-size:10px;font-weight:600;color:#a78bfa;">♾ No Limit</span>' : ''}
              ${u.expiredAt ? (() => {
                const sisa = Math.ceil((u.expiredAt - Date.now()) / (1000*60*60*24));
                const color = sisa <= 0 ? '#ef4444' : sisa <= 3 ? '#f59e0b' : '#94a3b8';
                const label = sisa <= 0 ? '⚠ Expired' : `⏳ ${sisa}h lagi`;
                return '<span style="font-size:10px;font-weight:600;color:' + color + ';">' + label + '</span>';
              })() : '<span style="font-size:10px;color:#94a3b8;">♾ Permanen</span>'}
            ` : ''}
          </div>
        </div>
        <div class="account-actions" style="flex-wrap:wrap;gap:6px;">
          ${isMainAdmin ? '<span style="font-size:11px;color:var(--muted);">Terlindungi</span>' :
            isCurrentMainAdmin ? `
              <button class="btn-edit" onclick="adminEditUser('${escHtml(u.id)}', '${escHtml(u.username)}', '${escHtml(u.role)}', ${isActive}, ${noLimit}, ${u.expiredAt || 'null'})">✏️ Edit</button>
              <button class="btn-delete" onclick="adminDeleteUser('${escHtml(u.id)}', '${escHtml(u.username)}')">Hapus</button>
            ` : (isAdmin ? '<span style="font-size:11px;color:var(--muted);">—</span>' : `
              <button class="btn-edit" onclick="adminEditUserLimited('${escHtml(u.id)}', '${escHtml(u.username)}', ${isActive}, ${noLimit})">✏️ Edit</button>
            `)
          }
        </div>
      </div>
    `;
  }).join('');

  // Start countdown timers realtime
  startCountdownTimers();
}

async function adminAddUser() {
  const username = document.getElementById('new-user-username').value.trim();
  const password = document.getElementById('new-user-password').value;
  const errEl    = document.getElementById('add-user-error');
  errEl.textContent = '';

  // Tentukan role berdasarkan apakah admin utama atau biasa
  const currentUser = getLoggedInUser();
  const isMainAdmin = currentUser && currentUser.id === 'admin-1';
  const roleEl = document.getElementById('new-user-role');
  const role = isMainAdmin && roleEl ? roleEl.value : 'member';

  if (!username || !password) {
    errEl.textContent = '⚠ Username dan password wajib diisi';
    return;
  }
  if (username.length < 3) {
    errEl.textContent = '⚠ Username minimal 3 karakter';
    return;
  }

  const result = await addAdminUserAPI(username, password, role);
  if (result.error) {
    errEl.textContent = '⚠ ' + result.error;
    return;
  }

  // Set durasi untuk admin jika admin utama memilih role admin
  if (isMainAdmin && role === 'admin') {
    let durasi = 0;
    const sel    = document.getElementById('new-user-durasi');
    const selVal = sel ? sel.value : '0';

    if (selVal === 'custom') {
      // Ambil dari inline fields
      const val  = parseFloat(document.getElementById('custom-durasi-val')?.value || '0');
      const type = document.getElementById('custom-durasi-type')?.value || 'hari';
      if (val > 0) {
        if (type === 'menit')     durasi = val / (60 * 24);
        else if (type === 'jam')  durasi = val / 24;
        else                      durasi = val;
      }
    } else {
      durasi = parseFloat(selVal) || 0;
    }

    if (durasi > 0) {
      await setExpiredAPI(result.user.id, durasi);
    }

    // Reset custom fields
    _customDurasiDays = null;
    const inlineEl = document.getElementById('custom-durasi-inline');
    if (inlineEl) inlineEl.style.display = 'none';
    if (sel) sel.value = '1';
  }

  // Member exp otomatis permanen (tidak perlu set expiredAt)

  document.getElementById('new-user-username').value = '';
  document.getElementById('new-user-password').value = '';
  if (roleEl) roleEl.value = 'admin';
  onRoleChange();

  await renderUserPanel();
  const roleLabel = role === 'admin' ? 'Admin' : 'Member';
  showToast(`User ${username} (${roleLabel}) berhasil ditambahkan! ✅`);
}

async function adminToggleRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'member' : 'admin';
  const label   = newRole === 'admin' ? 'Admin' : 'Member';
  if (!confirm(`Ubah role user ini menjadi ${label}?`)) return;

  const result = await updateUserRoleAPI(userId, newRole);
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }

  await renderUserPanel();
  showToast(`Role berhasil diubah menjadi ${label}! ✅`);
}

// ════════════════════════════════════════
//  EDIT USER MODAL
// ════════════════════════════════════════

// ── Edit User: Custom durasi handler ──
function onEditDurasiChange(sel) {
  const wrap  = document.getElementById('edit-custom-durasi-wrap');
  const errEl = document.getElementById('edit-custom-durasi-error');
  if (sel.value === 'custom') {
    wrap.style.display = 'block';
    if (errEl) errEl.textContent = '';
  } else {
    wrap.style.display = 'none';
  }
}

// Hitung total menit dari input custom edit modal
function getEditDurasiDays() {
  const sel = document.getElementById('edit-user-expired');
  if (sel.value === 'custom') {
    const val  = parseFloat(document.getElementById('edit-custom-durasi-val').value);
    const type = document.getElementById('edit-custom-durasi-type').value;
    const errEl = document.getElementById('edit-custom-durasi-error');
    if (!val || val <= 0) {
      if (errEl) errEl.textContent = '⚠ Masukkan angka yang valid';
      return null; // invalid
    }
    if (errEl) errEl.textContent = '';
    // Kembalikan dalam hari (float)
    if (type === 'days')    return val;
    if (type === 'hours')   return val / 24;
    if (type === 'minutes') return val / 1440;
  }
  return parseInt(sel.value) || 0; // 0 = permanen
}

function adminEditUser(userId, username, role, isActive, noLimit, expiredAt) {
  document.getElementById('edit-user-id').value       = userId;
  document.getElementById('edit-user-username').value = username;
  document.getElementById('edit-user-password').value = '';
  document.getElementById('edit-user-role').value     = role;
  document.getElementById('edit-user-error').textContent = '';
  document.getElementById('edit-user-subtitle').textContent = `Mengedit: ${username}`;
  document.getElementById('edit-user-username').classList.remove('input-error');

  // Set toggle STATUS
  setToggle('status', isActive === true);
  // Set toggle AKSES
  setToggle('akses', noLimit === true);

  // Set durasi — tampilkan sisa waktu / info expired
  const expSel  = document.getElementById('edit-user-expired');
  const expInfo = document.getElementById('edit-expired-info');
  const editCustomWrap2 = document.getElementById('edit-custom-durasi-wrap');
  if (editCustomWrap2) editCustomWrap2.style.display = 'none';
  expSel.value  = '0'; // default permanen
  if (expiredAt) {
    const sisaMs   = expiredAt - Date.now();
    const sisaHari = Math.ceil(sisaMs / (1000 * 60 * 60 * 24));
    if (sisaMs > 0) {
      expInfo.innerHTML = `<span style="color:#f59e0b;">⏳ Sisa: ${sisaHari} hari &mdash; expired ${new Date(expiredAt).toLocaleDateString('id-ID')}</span><br><span style="color:var(--muted);font-size:10px;">Set durasi baru di bawah untuk memperbarui</span>`;
    } else {
      expInfo.innerHTML = `<span style="color:#ef4444;">⚠ Sudah expired! Set durasi baru untuk mengaktifkan kembali.</span>`;
    }
  } else {
    expInfo.textContent = 'Akun permanen, tidak ada batas waktu';
    expInfo.style.color = 'var(--muted)';
  }

  // Tampilkan durasi untuk semua role
  document.getElementById('edit-expired-wrap').style.display = 'block';
  // Reset custom wrap
  const editCustomWrap = document.getElementById('edit-custom-durasi-wrap');
  if (editCustomWrap) editCustomWrap.style.display = 'none';

  const overlay = document.getElementById('edit-user-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
  document.getElementById('edit-user-username').focus();
}


// Edit terbatas untuk admin biasa — hanya status dan limit
function adminEditUserLimited(userId, username, isActive, noLimit) {
  document.getElementById('edit-user-id').value = userId;
  document.getElementById('edit-user-username').value = username;
  document.getElementById('edit-user-password').value = '';
  document.getElementById('edit-user-role').value = 'member';
  document.getElementById('edit-user-error').textContent = '';
  document.getElementById('edit-user-subtitle').textContent = `Mengedit: ${username}`;

  // Sembunyikan field yang tidak boleh diubah admin biasa
  document.getElementById('edit-user-username').disabled = true;
  document.getElementById('edit-user-password').disabled = true;
  const roleWrapEdit = document.getElementById('edit-user-role')?.parentElement;
  if (roleWrapEdit) roleWrapEdit.style.display = 'none';

  setToggle('status', isActive === true);
  setToggle('akses', noLimit === true);

  const expInfo = document.getElementById('edit-expired-info');
  if (expInfo) { expInfo.textContent = 'Member permanen'; expInfo.style.color = 'var(--muted)'; }
  const expWrap = document.getElementById('edit-expired-wrap');
  if (expWrap) expWrap.style.display = 'none';

  const overlay = document.getElementById('edit-user-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
}
function closeEditUserModal() {
  const overlay = document.getElementById('edit-user-overlay');
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
  // Reset disabled state
  const usernameEl = document.getElementById('edit-user-username');
  const passwordEl = document.getElementById('edit-user-password');
  if (usernameEl) usernameEl.disabled = false;
  if (passwordEl) passwordEl.disabled = false;
  const roleWrapEdit = document.getElementById('edit-user-role')?.parentElement;
  if (roleWrapEdit) roleWrapEdit.style.display = 'block';
  const expWrap = document.getElementById('edit-expired-wrap');
  if (expWrap) expWrap.style.display = 'block';
}

async function adminSaveEditUser() {
  const userId      = document.getElementById('edit-user-id').value;
  const username    = document.getElementById('edit-user-username').value.trim();
  const password    = document.getElementById('edit-user-password').value;
  const role        = document.getElementById('edit-user-role').value;
  const errEl       = document.getElementById('edit-user-error');
  const btn         = document.getElementById('btn-save-edit-user');

  errEl.textContent = '';
  document.getElementById('edit-user-username').classList.remove('input-error');

  // Validasi client-side
  if (!username) {
    document.getElementById('edit-user-username').classList.add('input-error');
    errEl.textContent = '⚠ Username tidak boleh kosong';
    return;
  }
  if (username.length < 3) {
    document.getElementById('edit-user-username').classList.add('input-error');
    errEl.textContent = '⚠ Username minimal 3 karakter';
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    document.getElementById('edit-user-username').classList.add('input-error');
    errEl.textContent = '⚠  Username hanya huruf, angka, dan _';
    return;
  }
  if (password && password.length < 1) {
    errEl.textContent = '⚠ Password tidak boleh kosong jika diisi';
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span>Menyimpan...';

  const isActive = document.getElementById('toggle-status').classList.contains('on');
  const noLimit  = document.getElementById('toggle-akses').classList.contains('on');

  const payload = { username, role, isActive, noLimit };
  if (password) payload.password = password;

  const result = await updateUserAPI(userId, payload);

  btn.disabled  = false;
  btn.innerHTML = 'Simpan Perubahan';

  if (result.error) {
    errEl.textContent = '⚠ ' + result.error;
    if (result.error.includes('Username')) {
      document.getElementById('edit-user-username').classList.add('input-error');
    }
    return;
  }

  // Set durasi untuk semua role (termasuk admin)
  const expiredDays = getEditDurasiDays();
  if (expiredDays === null) {
    // Validasi gagal (custom input kosong)
    btn.disabled  = false;
    btn.innerHTML = 'Simpan Perubahan';
    return;
  }
  await setExpiredAPI(userId, expiredDays === 0 ? null : expiredDays);

  closeEditUserModal();
  await renderUserPanel();
  showToast(`User ${result.user.username} berhasil diperbarui! ✅`);
}

async function adminDeleteUser(userId, username) {
  if (!confirm(`Hapus user "${username}"?\nUser ini tidak bisa login lagi.`)) return;

  const result = await deleteUserAPI(userId);
  if (result.error) {
    showToast(result.error, 'error');
    return;
  }

  await renderUserPanel();
  showToast(`User ${username} berhasil dihapus.`, 'error');
}

// ── Aktifkan user ──
async function adminActivateUser(userId, username) {
  const result = await updateUserAPI(userId, { isActive: true });
  if (result.error) { showToast(result.error, 'error'); return; }
  await renderUserPanel();
  showToast(`✅ Akun "${username}" berhasil diaktifkan!`);
}

// ── Nonaktifkan user ──
async function adminDeactivateUser(userId, username) {
  if (!confirm(`Nonaktifkan akun "${username}"?\nUser tidak bisa login sampai diaktifkan lagi.`)) return;
  const result = await updateUserAPI(userId, { isActive: false });
  if (result.error) { showToast(result.error, 'error'); return; }
  await renderUserPanel();
  showToast(`🚫 Akun "${username}" dinonaktifkan.`, 'error');
}

// ── Toggle No Limit ──
async function adminToggleNoLimit(userId, currentNoLimit) {
  const newVal = !currentNoLimit;
  const label  = newVal ? 'mengaktifkan' : 'menonaktifkan';
  if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} No Limit untuk user ini?`)) return;
  const result = await updateUserAPI(userId, { noLimit: newVal });
  if (result.error) { showToast(result.error, 'error'); return; }
  await renderUserPanel();
  showToast(newVal ? '♾ No Limit diaktifkan!' : '♾ No Limit dinonaktifkan.', newVal ? 'success' : 'error');
}

// ── Toggle switch helpers (Edit User modal) ──
function setToggle(type, isOn) {
  const el    = document.getElementById(`toggle-${type}`);
  const label = document.getElementById(`edit-${type}-label`);
  if (!el || !label) return;
  if (isOn) {
    el.classList.add('on');
    label.textContent = type === 'status' ? 'Aktif' : 'No Limit';
    label.style.color = '#22c55e';
  } else {
    el.classList.remove('on');
    label.textContent = type === 'status' ? 'Nonaktif' : '1x Claim';
    label.style.color = '#ef4444';
  }
}

function toggleEditSwitch(type) {
  const el  = document.getElementById(`toggle-${type}`);
  const isOn = el.classList.contains('on');
  setToggle(type, !isOn);
}

// ════════════════════════════════════════
//  TAB DEBUG
// ════════════════════════════════════════

// ════════════════════════════════════════
//  RESTOCK VIA USERBOT
// ════════════════════════════════════════


// ── RESTOCK VIA FILE TXT ──
function previewRestockFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const preview = document.getElementById('restock-file-preview');
  const btn     = document.getElementById('btn-restock-file');

  const reader = new FileReader();
  reader.onload = (e) => {
    const lines  = e.target.result.split('\n')
      .map(l => l.trim())
      .filter(l => l.includes('@') && l.includes('.'));

    if (lines.length === 0) {
      preview.innerHTML = '<span style="color:#ef4444;">⚠ Tidak ada email valid ditemukan di file ini.</span>';
      btn.disabled = true;
      btn.style.opacity = '.5';
      btn.style.cursor  = 'not-allowed';
      return;
    }

    const max = Math.min(lines.length, 70);
    preview.innerHTML = `
      <span style="color:#22c55e;">✅ ${max} email siap diimport</span>
      ${lines.length > 70 ? '<span style="color:#f59e0b;"> (maks 70, sisanya diabaikan)</span>' : ''}
      <div style="margin-top:6px;max-height:80px;overflow-y:auto;background:rgba(0,0,0,.2);border-radius:6px;padding:6px 8px;">
        ${lines.slice(0, max).map(e => `<div style="color:#94a3b8;font-size:11px;">${e}</div>`).join('')}
      </div>`;
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor  = 'pointer';
    btn._emailList    = lines.slice(0, max); // simpan di elemen
  };
  reader.readAsText(file);
}

async function adminRestockFile() {
  const btn      = document.getElementById('btn-restock-file');
  const preview  = document.getElementById('restock-file-preview');
  const emails   = btn._emailList;
  const fileInput = document.getElementById('restock-txt-input');

  if (!emails || emails.length === 0) {
    showToast('Pilih file .txt dulu!', 'error');
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Mengimport...';

  let added = 0, skipped = 0;

  for (const email of emails) {
    try {
      const res  = await addAccountAPI(email, 'https://generator.email/' + email, 'Restock via file');
      if (res.ok) { added++; }
      else        { skipped++; }
    } catch (_) { skipped++; }
  }

  btn.disabled  = false;
  btn.innerHTML = '⚡ Import Sekarang';
  btn._emailList = null;
  if (fileInput) { fileInput.value = ''; }
  preview.innerHTML = '';

  showToast(`✅ Import selesai! +${added} akun baru. ${skipped > 0 ? skipped + ' duplikat dilewati.' : ''}`, added > 0 ? 'success' : 'error');
  await renderAccountPanel();
  await updateStats();
}

let restockPolling = null;

async function adminRestock() {
  const btn = document.getElementById('btn-restock');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Memulai...';

  try {
    const res  = await fetch('/api/restock', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jumlah: 10 }),
    });
    const data = await res.json();

    if (!data.ok) {
      showToast('❌ ' + (data.error || 'Gagal memulai restock'), 'error');
      btn.disabled  = false;
      btn.innerHTML = '🤖 Restock via Bot (10 akun)';
      return;
    }

    showToast('⚙️ Restock dimulai! Userbot sedang bekerja...');
    btn.innerHTML = '<span class="spinner"></span> Restock berjalan...';

    // Polling status tiap 3 detik
    restockPolling = setInterval(async () => {
      try {
        const s    = await fetch('/api/restock/status').then(r => r.json());
        if (s.done) {
          clearInterval(restockPolling);
          restockPolling = null;
          btn.disabled  = false;
          btn.innerHTML = '🤖 Restock via Bot (10 akun)';

          const { added, skipped, failed } = s.result || {};
          if (added > 0) {
            showToast(`✅ Restock berhasil! +${added} akun AM baru masuk!`);
          } else {
            showToast(`⚠️ Restock selesai — Tambah: ${added}, Skip: ${skipped}, Gagal: ${failed}`, 'error');
          }
          // Refresh tab akun
          await renderAdminPanel();
          await updateStats();
        }
      } catch (_) {}
    }, 3000);

  } catch (err) {
    showToast('❌ Error: ' + err.message, 'error');
    btn.disabled  = false;
    btn.innerHTML = '🤖 Restock via Bot (10 akun)';
  }
}

async function renderDebugPanel() {
  const users       = await getUsers();
  const list        = document.getElementById('debug-user-list');
  const currentUser = getLoggedInUser();
  const isMainAdmin = currentUser && currentUser.id === 'admin-1';

  // Tampilkan/sembunyikan Danger Zone & Maintenance
  const dangerZone = document.getElementById('danger-zone-section');
  if (dangerZone) dangerZone.style.display = isMainAdmin ? 'block' : 'none';
  const maintSection = document.getElementById('maintenance-section');
  if (maintSection) maintSection.style.display = isMainAdmin ? 'block' : 'none';
  const restockSection = document.getElementById('restock-section');
  if (restockSection) restockSection.style.display = isMainAdmin ? 'block' : 'none';
  const restockFileSection = document.getElementById('restock-file-section');
  if (restockFileSection) restockFileSection.style.display = isMainAdmin ? 'block' : 'none';
  const backupSection = document.getElementById('backup-section');
  if (backupSection) backupSection.style.display = isMainAdmin ? 'block' : 'none';
  if (isMainAdmin) loadMaintenanceStatus();

  document.getElementById('debug-count').textContent = users.length;

  if (users.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada user</div></div>`;
    return;
  }

  // Urutkan: admin-1 paling atas
  // Urutkan: admin-1 paling atas → admin lain (terbaru di atas) → member (terbaru di atas)
  const sorted = [...users].sort((a, b) => {
    if (a.id === 'admin-1') return -1;
    if (b.id === 'admin-1') return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  list.innerHTML = sorted.map(u => {
    const isThisMainAdmin = u.id === 'admin-1';
    const isAdmin         = u.role === 'admin';
    const uid             = escHtml(u.id);

    // Hitung EXP
    let expLabel = '♾ Permanen';
    let expColor = '#94a3b8';
    let hasCountdown = false;
    if (u.expiredAt) {
      const sisaMs = u.expiredAt - Date.now();
      if (sisaMs <= 0) {
        expLabel = '⚠ Expired';
        expColor = '#ef4444';
      } else {
        hasCountdown = true;
        expColor = sisaMs < 3 * 24 * 3600 * 1000 ? '#f59e0b' : '#22c55e';
        expLabel = formatCountdown(sisaMs); // initial value, akan diupdate timer
      }
    }

    // Admin lain liat admin-1 → blur + lock
    if (isThisMainAdmin && !isMainAdmin) {
      return `
        <div class="debug-user-card" style="position:relative;overflow:hidden;min-height:110px;">
          <div style="filter:blur(6px);user-select:none;pointer-events:none;">
            <div class="debug-user-header">
              <span class="debug-username">████</span>
              <span class="debug-badge badge-mainadmin">★ ADMIN UTAMA</span>
            </div>
            <div class="debug-info-grid">
              <div class="debug-info-row"><span class="debug-label">USERNAME</span><span class="debug-value">████████</span></div>
              <div class="debug-info-row"><span class="debug-label">PASSWORD</span><span class="debug-value">••••••••</span></div>
              <div class="debug-info-row"><span class="debug-label">DEVICE ID</span><span class="debug-value mono">████████████████</span></div>
              <div class="debug-info-row"><span class="debug-label">EXP</span><span class="debug-value">♾ Permanen</span></div>
            </div>
          </div>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);border-radius:12px;gap:6px;">
            <span style="font-size:28px;animation:pulse-lock 1.5s infinite;">🔒</span>
            <span style="font-size:11px;color:#94a3b8;">Hanya Admin Utama yang bisa melihat</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="debug-user-card${isThisMainAdmin ? ' debug-card-mainadmin' : ''}">
        <div class="debug-user-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="debug-avatar${isAdmin ? ' avatar-admin' : ''}">${escHtml(u.username.charAt(0).toUpperCase())}</div>
            <span class="debug-username">${escHtml(u.username)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${isThisMainAdmin ? '<span class="debug-badge badge-mainadmin">★ ADMIN UTAMA</span>' : isAdmin ? '<span class="debug-badge badge-admin">ADMIN</span>' : '<span class="debug-badge badge-member">MEMBER</span>'}
            ${!isThisMainAdmin ? `<button class="btn-reset-device" onclick="adminResetDevice('${uid}', '${escHtml(u.username)}')">Reset Device</button>` : ''}
          </div>
        </div>
        <div class="debug-info-grid">
          <div class="debug-info-row">
            <span class="debug-label">USERNAME</span>
            <span class="debug-value">${escHtml(u.username)}</span>
          </div>
          <div class="debug-info-row">
            <span class="debug-label">PASSWORD</span>
            <span class="debug-value" style="display:flex;align-items:center;gap:8px;">
              <span id="pw-val-${uid}" class="mono" style="letter-spacing:2px;">••••••••</span>
              <button class="eye-btn" onclick="toggleDebugPw('${uid}', '${escHtml(u.password || '')}')" title="Tampilkan/sembunyikan password">
                <svg id="eye-icon-${uid}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </span>
          </div>
          <div class="debug-info-row">
            <span class="debug-label">DEVICE ID</span>
            <span class="debug-value mono" style="word-break:break-all;font-size:11px;">${escHtml(u.deviceId || '-')}</span>
          </div>
          <div class="debug-info-row">
            <span class="debug-label">EXP</span>
            <span class="debug-value exp-val-${uid}" style="color:${expColor};font-weight:600;" data-expired-at="${u.expiredAt || ''}">${expLabel}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  // Start countdown timers untuk exp di debug panel
  startCountdownTimers();
}
function toggleDebugPw(uid, rawPw) {
  const valEl  = document.getElementById('pw-val-' + uid);
  const iconEl = document.getElementById('eye-icon-' + uid);
  if (!valEl) return;
  const isHidden = valEl.textContent === '••••••••';
  if (isHidden) {
    valEl.textContent = rawPw || '-';
    valEl.style.letterSpacing = '0';
    iconEl.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    valEl.textContent = '••••••••';
    valEl.style.letterSpacing = '2px';
    iconEl.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

async function adminResetDevice(userId, username) {
  if (!confirm(`Reset deviceId user "${username}"?\nUser ini bisa daftar akun baru dan langsung aktif.`)) return;
  const result = await updateUserAPI(userId, { deviceId: null });
  if (result.error) { showToast(result.error, 'error'); return; }
  await renderDebugPanel();
  showToast(`✅ DeviceId "${username}" berhasil direset!`);
}

async function adminClearAll() {
  if (!confirm('⚠️ RESET SEMUA DATA?\n\n• Semua riwayat claim dihapus\n• Semua akun AM dihapus\n• Semua user dihapus (kecuali admin)\n• Semua deviceId direset\n\nTidak bisa dibatalkan!')) return;
  const result = await clearAllAPI();
  if (result.error) { showToast('Gagal: ' + result.error, 'error'); return; }
  await renderDebugPanel();
  await renderAdminPanel();
  await renderSessionPanel();
  await updateStats();
  showToast('✅ Semua data berhasil direset!');
}

// ════════════════════════════════════════
//  MAINTENANCE TOGGLE
// ════════════════════════════════════════

async function loadMaintenanceStatus() {
  const settings = await getSettingsAPI().catch(() => ({}));
  const isOn = settings && settings.maintenance;
  const el   = document.getElementById('toggle-maintenance');
  const lbl  = document.getElementById('maintenance-label');
  if (!el || !lbl) return;
  if (isOn) {
    el.classList.add('on');
    lbl.textContent = 'ON';
    lbl.style.color = '#22c55e';
  } else {
    el.classList.remove('on');
    lbl.textContent = 'OFF';
    lbl.style.color = '#ef4444';
  }
}

async function adminToggleMaintenance() {
  const el  = document.getElementById('toggle-maintenance');
  const lbl = document.getElementById('maintenance-label');
  const isOn = el.classList.contains('on');
  el.classList.toggle('on', !isOn);
  const newVal = !isOn;
  const result = await setMaintenanceAPI(newVal);
  if (result.error) { showToast('Gagal: ' + result.error, 'error'); return; }
  if (newVal) {
    el.classList.add('on');
    lbl.textContent = 'ON';
    lbl.style.color = '#22c55e';
    showToast('🔧 Mode maintenance ON — user tidak bisa akses dashboard');
  } else {
    el.classList.remove('on');
    lbl.textContent = 'OFF';
    lbl.style.color = '#ef4444';
    showToast('✅ Mode maintenance OFF — site normal kembali');
  }
}

// ════════════════════════════════════════
//  BACKUP AKUN — IMPORT & EXPORT
// ════════════════════════════════════════

async function adminExportBackup() {
  try {
    const accounts = await getAccounts();
    const blob = new Blob([JSON.stringify(accounts, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const now  = new Date();
    const tgl  = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    a.href     = url;
    a.download = `backup_akun_am_${tgl}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✅ Export berhasil! ${accounts.length} akun tersimpan.`);
  } catch (err) {
    showToast('❌ Gagal export: ' + err.message, 'error');
  }
}

function adminImportBackup() {
  document.getElementById('backup-file-input').click();
}

async function handleBackupFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Reset input biar bisa pilih file yang sama lagi
  event.target.value = '';

  let accounts;
  try {
    const text = await file.text();
    accounts   = JSON.parse(text);
    if (!Array.isArray(accounts)) throw new Error('Format tidak valid');
  } catch (err) {
    showToast('❌ File tidak valid: ' + err.message, 'error');
    return;
  }

  const emails = accounts.map(a => a.email).filter(Boolean);
  if (emails.length === 0) {
    showToast('❌ Tidak ada email ditemukan di file backup', 'error');
    return;
  }

  if (!confirm(`Import ${emails.length} akun dari file backup?\nAkun yang sudah ada akan di-skip.`)) return;

  let added = 0, skipped = 0, failed = 0;
  const btn = document.querySelectorAll('#backup-section button')[0];
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Mengimport...';

  for (const acc of accounts) {
    if (!acc.email) continue;
    try {
      const res = await addAccountAPI(acc.email, acc.emailAccess || ('https://generator.email/' + acc.email), acc.keterangan || '');
      if (res.ok)                                               added++;
      else if ((res.error || '').includes('sudah ada'))        skipped++;
      else                                                      failed++;
    } catch { failed++; }
  }

  btn.disabled  = false;
  btn.innerHTML = '📂 Import Backup';

  await renderAdminPanel();
  await updateStats();
  showToast(`✅ Import selesai! Tambah: ${added} | Skip: ${skipped} | Gagal: ${failed}`);
}
