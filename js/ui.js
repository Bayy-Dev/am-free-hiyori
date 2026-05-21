// ── UI MODULE ──
// Render halaman, toast, helper tampilan

let historyActiveTab     = 'my';
let riwayatPollInterval  = null;

// ── TOAST ──
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── TOPBAR USER ──
function renderTopbarUser() {
  const user = getLoggedInUser();
  const el   = document.getElementById('topbar-user');
  if (!el) return;

  // Update nav visibility
  updateNavForAuthState(!!user);
  // Tampilkan/sembunyikan tombol Admin berdasarkan role
  updateAdminNavVisibility(user && user.role === 'admin');
  // Update mobile user menu info
  if (user) updateMobileUserMenu(user);

  if (user) {
    const isAdmin = user.role === 'admin';
    el.innerHTML = `
      <div class="topbar-user-info">
        <div class="topbar-avatar ${isAdmin ? 'avatar-admin' : ''}">${escHtml(user.username.charAt(0).toUpperCase())}</div>
        <span class="topbar-username">${escHtml(user.username)}${isAdmin ? ' <span class="role-badge">Admin</span>' : ''}</span>
        <button class="btn-topbar-logout" onclick="handleLogout()">Keluar</button>
      </div>`;
  } else {
    el.innerHTML = `
      <button class="btn-topbar-login" onclick="showAuthModal()">Masuk / Daftar</button>`;
    // Tutup mobile user menu kalau ada
    const mum = document.getElementById('mobile-user-menu');
    if (mum) mum.style.display = 'none';
  }
}

// Tampilkan/sembunyikan tombol Admin di nav berdasarkan role
function updateAdminNavVisibility(isAdmin) {
  const topbarBtn = document.getElementById('nav-btn-admin');
  const bottomBtn = document.getElementById('nav-admin');
  if (topbarBtn) topbarBtn.style.display = isAdmin ? '' : 'none';
  if (bottomBtn) bottomBtn.style.display = isAdmin ? '' : 'none';
}

// Tampilkan/sembunyikan Riwayat & Login mobile berdasarkan status login
function updateNavForAuthState(isLoggedIn) {
  // Topbar desktop
  const historyBtn = document.getElementById('nav-btn-history');
  if (historyBtn) historyBtn.style.display = isLoggedIn ? '' : 'none';

  // Bottom nav mobile
  const historyMobile = document.getElementById('nav-history');
  const loginMobile   = document.getElementById('nav-login-mobile');
  const userMobile    = document.getElementById('nav-user-mobile');
  if (historyMobile) historyMobile.style.display = isLoggedIn ? '' : 'none';
  if (loginMobile)   loginMobile.style.display   = isLoggedIn ? 'none' : '';
  if (userMobile)    userMobile.style.display     = isLoggedIn ? '' : 'none';
}

function handleLogout() {
  logoutUser();
  setAdminSession(false);
  renderTopbarUser();
  showPage('dashboard');
  renderDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Berhasil keluar.', 'error');
}

// ── MOBILE USER MENU ──
function toggleMobileUserMenu() {
  const menu = document.getElementById('mobile-user-menu');
  if (!menu) return;
  const isVisible = menu.style.display !== 'none';
  menu.style.display = isVisible ? 'none' : 'block';
}

function updateMobileUserMenu(user) {
  const mumAvatar   = document.getElementById('mum-avatar');
  const mumUsername = document.getElementById('mum-username');
  const mumRole     = document.getElementById('mum-role');
  const navAvatar   = document.getElementById('nav-avatar-mobile');
  const navLabel    = document.getElementById('nav-user-label-mobile');

  if (!user) return;

  const initial  = user.username.charAt(0).toUpperCase();
  const isAdmin  = user.role === 'admin';
  const roleName = isAdmin ? '👑 Admin' : '👤 Member';

  if (mumAvatar)   { mumAvatar.textContent = initial; mumAvatar.className = 'mum-avatar' + (isAdmin ? ' is-admin' : ''); }
  if (mumUsername) mumUsername.textContent = user.username;
  if (mumRole)     mumRole.textContent     = roleName;
  if (navAvatar)   { navAvatar.textContent = initial; navAvatar.className = 'nav-icon nav-avatar-mobile' + (isAdmin ? ' is-admin' : ''); }
  if (navLabel)    navLabel.textContent    = user.username.length > 8 ? user.username.slice(0,7) + '…' : user.username;
}

// ── PAGE NAVIGATION ──
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.topbar-nav .nav-btn').forEach((b, i) => {
    const pages = ['dashboard', 'history', 'admin'];
    b.classList.toggle('active', pages[i] === name);
  });

  // Stop polling sebelumnya
  if (riwayatPollInterval) { clearInterval(riwayatPollInterval); riwayatPollInterval = null; }

  if (name === 'dashboard') renderDashboard();
  if (name === 'history')   renderHistory();
  if (name === 'admin') {
    const user = getLoggedInUser();
    if (!user) {
      showToast('Login dulu untuk akses admin!', 'error');
      showPage('dashboard');
      showAuthModal();
      return;
    } else if (user.role !== 'admin') {
      showToast('Kamu tidak punya akses admin!', 'error');
      showPage('dashboard');
      return;
    }
    // User adalah admin — cek apakah admin utama atau biasa
    const isMainAdmin = user.id === 'admin-1';
    if (isMainAdmin) {
      // Admin utama butuh password panel
      if (isAdminLoggedIn || getAdminSession()) {
        isAdminLoggedIn = true;
        document.getElementById('admin-login-section').style.display = 'none';
        document.getElementById('admin-panel-section').style.display = 'block';
        switchAdminTab('accounts');
      } else {
        document.getElementById('admin-login-section').style.display = 'block';
        document.getElementById('admin-panel-section').style.display = 'none';
      }
    } else {
      // Admin biasa — langsung masuk tanpa password panel
      isAdminLoggedIn = true;
      setAdminSession(true);
      document.getElementById('admin-login-section').style.display = 'none';
      document.getElementById('admin-panel-section').style.display = 'block';
      switchAdminTab('accounts');
    }
  }
}

// ── STATS ──
async function updateStats() {
  const accounts  = await getAccounts();
  const available = accounts.filter(a => !a.claimed).length;
  const claimed   = accounts.filter(a =>  a.claimed).length;
  document.getElementById('stat-total').textContent   = accounts.length;
  document.getElementById('stat-avail').textContent   = available;
  document.getElementById('stat-claimed').textContent = claimed;
  document.getElementById('stat-left').textContent    = available;

  // Tampilkan Total User hanya untuk admin
  const currentUser   = getLoggedInUser();
  const statCardUsers = document.getElementById('stat-card-users');
  if (currentUser && currentUser.role === 'admin' && statCardUsers) {
    try {
      const users = await getUsers();
      document.getElementById('stat-users').textContent = users.length;
      statCardUsers.style.display = 'block';
    } catch (_) {}
  } else if (statCardUsers) {
    statCardUsers.style.display = 'none';
  }

  // Tampilkan Durasi Akses untuk user yang login
  updateDurasiAksesCard();
}

// ── Durasi Akses card — realtime countdown ──
let _durasiInterval = null;

function updateDurasiAksesCard() {
  const user = getLoggedInUser();
  const card = document.getElementById('stat-card-durasi');
  const el   = document.getElementById('stat-durasi');
  if (!card || !el) return;

  if (!user) {
    card.style.display = 'none';
    if (_durasiInterval) { clearInterval(_durasiInterval); _durasiInterval = null; }
    return;
  }

  card.style.display = 'block';

  // Stop interval lama dulu
  if (_durasiInterval) { clearInterval(_durasiInterval); _durasiInterval = null; }

  function tick() {
    const u = getLoggedInUser();
    if (!u) { card.style.display = 'none'; clearInterval(_durasiInterval); return; }

    if (!u.expiredAt) {
      // Permanen
      el.textContent  = 'Permanen';
      el.style.color  = '#22c55e';
      el.style.fontSize = '20px';
      return;
    }

    const sisa = u.expiredAt - Date.now();

    if (sisa <= 0) {
      el.innerHTML   = '<span style="color:#ef4444;">Expired</span>';
      el.style.color = '#ef4444';
      clearInterval(_durasiInterval);
      _durasiInterval = null;
      return;
    }

    const totalSec = Math.floor(sisa / 1000);
    const days = Math.floor(totalSec / 86400);
    const h    = Math.floor((totalSec % 86400) / 3600);
    const m    = Math.floor((totalSec % 3600)  / 60);
    const s    = totalSec % 60;
    const pad  = n => String(n).padStart(2, '0');

    // Warna: permanen=hijau, hari/jam=kuning, menit/detik=merah
    let color, text;
    if (days > 0) {
      color = '#f59e0b'; // kuning
      text  = `${days}h ${pad(h)}j ${pad(m)}m ${pad(s)}d`;
    } else if (h > 0) {
      color = '#f59e0b'; // kuning
      text  = `${pad(h)}j ${pad(m)}m ${pad(s)}d`;
    } else if (m > 0) {
      color = '#ef4444'; // merah
      text  = `${pad(m)}m ${pad(s)}d`;
    } else {
      color = '#ef4444'; // merah
      text  = `${pad(s)}d`;
    }

    el.textContent  = text;
    el.style.color  = color;
    el.style.fontSize = days > 0 ? '16px' : '18px';
  }

  tick();
  _durasiInterval = setInterval(tick, 1000);
}

// ── CLAIM CARD HTML BUILDER ──
function buildClaimCardHTML(claimData, animated = false) {
  return `
    <div class="account-result ${animated ? 'pop-in' : ''}">
      <div style="color:var(--green);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;font-weight:700;">✅ Akun Kamu</div>
      <div class="result-row">
        <div class="result-label">Email Akun</div>
        <div class="result-value">${escHtml(claimData.email)}</div>
        <button class="btn-copy" onclick="copyText('${escHtml(claimData.email)}', this)">📋 Copy Email</button>
      </div>
      ${claimData.keterangan ? `
      <div class="result-row">
        <div class="result-label">Keterangan</div>
        <div class="result-value" style="font-size:13px;color:var(--muted);">${escHtml(claimData.keterangan)}</div>
      </div>` : ''}
      <div class="result-row">
        <div class="result-label">Diklaim pada</div>
        <div style="font-size:13px;color:var(--muted);">${escHtml(claimData.date)}</div>
      </div>
      <a href="${escHtml(claimData.emailAccess)}" target="_blank" rel="noopener" class="btn-access">📧 Buka Akses Email</a>
    </div>
  `;
}

// ── CLAIMED BANNER (setelah animasi / kunjungan berikutnya) ──
function buildClaimedBannerHTML() {
  return `
    <div class="claim-success-banner">
      <div class="claim-success-banner-icon">✅</div>
      <div class="claim-success-banner-body">
        <div class="claim-success-banner-title">KAMU SUDAH CLAIM!</div>
        <div class="claim-success-banner-desc">UNTUK MELIHAT KEMBALI DATA AM, BISA CEK DI HALAMAN RIWAYAT</div>
      </div>
      <button class="claim-success-banner-btn"
        onclick="showPage('history'); setTimeout(() => switchHistoryTab('my'), 80)">
        Lihat Data →
      </button>
    </div>
  `;
}

// ── DASHBOARD ──
async function renderDashboard() {
  await updateStats();
  const heroEl    = document.getElementById('hero-section');

  // Cek maintenance (skip untuk admin)
  const user = getLoggedInUser();
  if (!user || user.role !== 'admin') {
    const settings = await getSettingsAPI().catch(() => ({}));
    if (settings && settings.maintenance) {
      heroEl.innerHTML = `
        <div class="claimed-banner">
          <div class="claimed-icon">🔧</div>
          <div class="claimed-title">Sedang Maintenance</div>
          <div class="claimed-desc">Sistem sedang dalam perbaikan. Silakan coba beberapa saat lagi.</div>
        </div>
      `;
      return;
    }
  }

  const isClaimed = user && user.role !== 'admin' && await hasUserClaimed();
  
  if (isClaimed) {
    heroEl.innerHTML = buildClaimedBannerHTML();
    return;
  }

  const accounts  = await getAccounts();
  const available = accounts.filter(a => !a.claimed).length;

  if (available === 0) {
    heroEl.innerHTML = `
      <div class="claimed-banner">
        <div class="claimed-icon">😔</div>
        <div class="claimed-title">Stok Habis</div>
        <div class="claimed-desc">Semua akun sudah diklaim. Pantau terus ya, admin bakal nambahin stok!</div>
      </div>
    `;
  } else {
    heroEl.innerHTML = `
      <div class="hero-claim">
        <div class="hero-title">Claim Akun Premium</div>
        <div class="hero-desc">Tersedia <strong>${available} akun</strong> Alight Motion Premium siap diambil. Gratis, sekali per perangkat!</div>
        <button class="btn-claim" id="btn-claim-main" onclick="doClaim()">⚡ Claim Sekarang</button>
      </div>
    `;
  }
}

// ════════════════════════════════════════
//  HISTORY PAGE
// ════════════════════════════════════════

async function renderHistory() {
  historyActiveTab = historyActiveTab || 'my';
  switchHistoryTab(historyActiveTab);
}

function switchHistoryTab(tab) {
  historyActiveTab = tab;

  // Stop polling lama
  if (riwayatPollInterval) { clearInterval(riwayatPollInterval); riwayatPollInterval = null; }

  document.querySelectorAll('.history-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('htab-my').style.display  = tab === 'my'  ? 'block' : 'none';
  document.getElementById('htab-all').style.display = tab === 'all' ? 'block' : 'none';

  if (tab === 'my')  renderMyClaim();
  if (tab === 'all') {
    renderRiwayatClaim();
    // Polling setiap 5 detik
    riwayatPollInterval = setInterval(renderRiwayatClaim, 5000);
  }
}

// ── MY CLAIM ──
async function renderMyClaim() {
  const el   = document.getElementById('htab-my');
  const user = getLoggedInUser();

  if (!user) {
    el.innerHTML = `
      <div class="my-claim-login-prompt">
        <div class="empty-icon">🔐</div>
        <div class="empty-text" style="margin-bottom:16px;">Login untuk melihat data claim kamu</div>
        <button class="btn-primary" style="max-width:220px;margin:0 auto;" onclick="showAuthModal(() => switchHistoryTab('my'))">
          Masuk / Daftar
        </button>
      </div>
    `;
    return;
  }

  // Admin-1: tampilkan LIST semua claim
  if (user.id === 'admin-1') {
    await renderAdminMyClaims(el, user);
    return;
  }

  // User biasa: tampilkan 1 claim
  const claimData = await getUserClaim();
  if (!claimData) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">Kamu belum pernah claim</div>
        <button class="btn-claim" style="margin-top:18px;padding:13px 28px;max-width:260px;" onclick="showPage('dashboard')">
          ⚡ Claim Sekarang
        </button>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="my-claim-card">
      <div class="my-claim-badge">✅ Akun Kamu — ${escHtml(user.username)}</div>
      <div class="my-claim-section">
        <div class="my-claim-label">📧 Email Akun</div>
        <div class="my-claim-value">${escHtml(claimData.email)}</div>
        <button class="btn-copy" onclick="copyText('${escHtml(claimData.email)}', this)" style="margin-top:8px;">📋 Copy Email</button>
      </div>
      ${claimData.keterangan ? `
      <div class="my-claim-section">
        <div class="my-claim-label">📝 Keterangan</div>
        <div class="my-claim-value" style="font-size:14px;color:var(--text2);">${escHtml(claimData.keterangan)}</div>
      </div>` : ''}
      <div class="my-claim-section">
        <div class="my-claim-label">📅 Diklaim pada</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px;">${escHtml(claimData.date)}</div>
      </div>
      <a href="${escHtml(claimData.emailAccess)}" target="_blank" rel="noopener" class="btn-access" style="margin-top:4px;">
        🔗 Buka Akses Email
      </a>
    </div>
  `;
}

// ── ADMIN MY CLAIMS — list semua claim admin-1 ──
async function renderAdminMyClaims(el, user) {
  const claims = await getAdminClaims();

  if (claims.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">Belum ada akun yang diklaim</div>
        <button class="btn-claim" style="margin-top:18px;padding:13px 28px;max-width:260px;" onclick="showPage('dashboard')">
          ⚡ Claim Sekarang
        </button>
      </div>
    `;
    return;
  }

  const cardsHTML = claims.map((c, i) => `
    <div class="my-claim-card" id="admin-claim-card-${i}" style="margin-bottom:14px;">
      <div class="my-claim-badge">✅ Akun #${i + 1} — ${escHtml(user.username)}</div>

      <div class="my-claim-section">
        <div class="my-claim-label">📧 Email Akun</div>
        <div class="my-claim-value">${escHtml(c.email)}</div>
        <button class="btn-copy" onclick="copyText('${escHtml(c.email)}', this)" style="margin-top:8px;">📋 Copy Email</button>
      </div>

      ${c.keterangan ? `
      <div class="my-claim-section">
        <div class="my-claim-label">📝 Keterangan</div>
        <div class="my-claim-value" style="font-size:14px;color:var(--text2);">${escHtml(c.keterangan)}</div>
      </div>` : ''}

      <div class="my-claim-section">
        <div class="my-claim-label">📅 Diklaim pada</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px;">${escHtml(c.date)}</div>
      </div>

      ${c.emailAccess ? `
      <a href="${escHtml(c.emailAccess)}" target="_blank" rel="noopener" class="btn-access" style="margin-top:4px;">
        🔗 Buka Akses Email
      </a>` : ''}

      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn-return-account" style="flex:1;" onclick="adminReturnAccount('${escHtml(c.sessionId)}', ${i})">
          🔄 Kembalikan
        </button>
        <button class="btn-delete-claim" style="flex:1;" onclick="adminDeleteMyClaim('${escHtml(c.sessionId)}', ${i})">
          🗑 Hapus
        </button>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;text-align:center;">
      ${claims.length} akun pernah diklaim
    </div>
    ${cardsHTML}
  `;
}

// ── RIWAYAT CLAIM (realtime feed) ──
async function renderRiwayatClaim() {
  const el       = document.getElementById('htab-all');
  const sessions = await getSessions();

  if (sessions.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📡</div>
        <div class="empty-text">Belum ada yang claim</div>
      </div>
    `;
    return;
  }

  const feedHTML = sessions.map((s, i) => `
    <div class="feed-item" style="animation-delay:${i * 0.04}s">
      <div class="feed-dot"></div>
      <div class="feed-content">
        <span class="feed-name">${escHtml(s.username || 'Seseorang')}</span>
        <span class="feed-action"> telah mengklaim AM Premium</span>
      </div>
      <div class="feed-time">${timeAgo(s.createdAt)}</div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="feed-header">
      <div class="feed-pulse"></div>
      <span>Live · Auto update tiap 5 detik</span>
    </div>
    <div class="feed-list">${feedHTML}</div>
  `;
}

// ── HISTORY (lama, tidak dipakai langsung) ──
async function renderHistory_old() {
  const list    = document.getElementById('history-list');
  const history = await getHistory();

  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">Belum ada riwayat claim</div>
      </div>`;
    return;
  }

  list.innerHTML = history.map(h => `
    <div class="history-item">
      <div class="history-icon">📧</div>
      <div class="history-info">
        <div class="history-email">${escHtml(h.email)}</div>
        <div class="history-date">${escHtml(h.date)}</div>
        ${h.keterangan ? `<div class="history-date">${escHtml(h.keterangan)}</div>` : ''}
      </div>
      <div class="history-badge">Claimed</div>
    </div>
  `).join('');
}

// ── Countdown timer helpers ──
let _countdownInterval = null;

function formatCountdown(ms) {
  if (ms <= 0) return null; // null = expired, dihandle di tick
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const h    = Math.floor((totalSec % 86400) / 3600);
  const m    = Math.floor((totalSec % 3600)  / 60);
  const s    = totalSec % 60;
  const pad  = n => String(n).padStart(2, '0');
  if (days > 0) return `${days}h ${pad(h)}j ${pad(m)}m ${pad(s)}d`;
  return `${pad(h)}j ${pad(m)}m ${pad(s)}d`;
}

function startCountdownTimers() {
  if (_countdownInterval) {
    clearInterval(_countdownInterval);
    _countdownInterval = null;
  }
  function tick() {
    document.querySelectorAll('[data-expired-at]').forEach(el => {
      const expAt = parseInt(el.dataset.expiredAt);
      if (!expAt) return;
      const sisa  = expAt - Date.now();
      const label = formatCountdown(sisa);
      if (!label) {
        // Expired — tampilkan icon peringatan merah
        el.innerHTML = '<span style="color:#ef4444;font-weight:700;">&#9888; EXPIRED</span>';
        el.style.color = '#ef4444';
      } else {
        el.textContent = label;
        el.style.color  = sisa < 24 * 3600 * 1000 ? '#ef4444'
                        : sisa < 3  * 24 * 3600 * 1000 ? '#f59e0b'
                        : '#22c55e';
      }
    });
  }
  tick();
  _countdownInterval = setInterval(tick, 1000);
}

// ── Time Ago helper ──
function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)    return 'baru saja';
  if (diff < 3600)  return Math.floor(diff / 60) + ' menit lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
  return Math.floor(diff / 86400) + ' hari lalu';
}

// ── Copy text ──
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = '✅ Tersalin!';
    setTimeout(() => btn.textContent = original, 1500);
  });
}

// ── Inject CSS untuk btn-return-account (sekali) ──
(function injectReturnBtnCSS() {
  if (document.getElementById('return-btn-style')) return;
  const s = document.createElement('style');
  s.id = 'return-btn-style';
  s.textContent = `
    .btn-return-account {
      width: 100%;
      margin-top: 12px;
      background: rgba(248,113,113,0.1);
      border: 1px solid rgba(248,113,113,0.3);
      color: #f87171;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      padding: 12px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-return-account:hover {
      background: rgba(248,113,113,0.2);
    }
    .btn-delete-claim {
      width: 100%;
      background: rgba(100,100,120,0.15);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--muted, #6b6b8a);
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      padding: 12px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-delete-claim:hover {
      background: rgba(100,100,120,0.3);
      color: #e8e8f0;
    }
  `;
  document.head.appendChild(s);
})();

// ── XSS protection ──
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
