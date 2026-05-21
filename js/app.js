// ── APP.JS ──
// Entry point & logika claim
// Note: riwayatPollInterval didefinisikan di ui.js

async function doClaim() {
  const user = getLoggedInUser();

  // Harus login dulu
  if (!user) {
    showAuthModal(() => doClaim());
    return;
  }

  // Admin utama bypass limit claim
  const isMainAdmin = user.id === 'admin-1';
  if (!isMainAdmin) {
    const claimed = await hasUserClaimed();
    if (claimed) {
      showToast('Kamu sudah pernah claim!', 'error');
      return;
    }
  }

  const btn = document.getElementById('btn-claim-main');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Memproses...';
  }

  await new Promise(r => setTimeout(r, 900));

  const result = await doClaimAPI(getDeviceId(), user.id, user.username);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '⚡ Claim Sekarang';
  }

  if (result.error === 'already_claimed') {
    showToast('Kamu sudah pernah claim!', 'error');
    await renderDashboard();
    return;
  }

  if (result.error === 'cooldown') {
    showToast(result.message || 'Masih cooldown, tunggu dulu!', 'error');
    return;
  }

  if (result.error === 'stok_habis') {
    showToast('Stok habis!', 'error');
    await renderDashboard();
    return;
  }

  if (!result.ok) {
    showToast('Terjadi kesalahan, coba lagi.', 'error');
    return;
  }

  // ── ANIMASI CLAIM BERHASIL ──
  showToast('Berhasil claim akun! 🎉');
  await updateStats();

  // Tampilkan card hasil claim dengan animasi pop-in
  const heroEl = document.getElementById('hero-section');
  heroEl.innerHTML = buildClaimCardHTML(result.claimData, true);

  // Setelah 3.5 detik → animasi keluar
  setTimeout(() => {
    const card = heroEl.querySelector('.account-result');
    if (card) {
      card.classList.add('pop-out');
      setTimeout(() => {
        // Setelah animasi keluar → tampilkan banner "cek riwayat"
        heroEl.innerHTML = buildClaimedBannerHTML();
      }, 450);
    }
  }, 3500);
}

// ── INIT ──
(async function init() {
  if (getAdminSession()) {
    isAdminLoggedIn = true;
  }
  renderTopbarUser();
  await renderDashboard();
})();

// ── Polling cek revoke akses (setiap 10 detik) ──
let _aksesCheckInterval = null;

function startAksesPolling() {
  if (_aksesCheckInterval) clearInterval(_aksesCheckInterval);
  _aksesCheckInterval = setInterval(async () => {
    const user = getLoggedInUser();
    if (!user) return;
    if (user.id === 'admin-1') return;

    const status = await checkUserAkses(user.id);
    if (!status) return;

    // Cek expired
    if (status.isExpired) {
      clearInterval(_aksesCheckInterval);
      _aksesCheckInterval = null;
      showRevokeOverlay('expired');
      return;
    }

    // Cek dinonaktifkan manual oleh admin
    if (!status.isActive) {
      clearInterval(_aksesCheckInterval);
      _aksesCheckInterval = null;
      showRevokeOverlay('deactivated');
      return;
    }

    // Cek noLimit dicabut
    if (user.noLimit && !status.noLimit) {
      setLoggedInUser({ ...user, noLimit: false });
      showRevokeAlert('akses');
    }
  }, 10000);
}

// ── Overlay fullscreen saat expired / dinonaktifkan ──
function showRevokeOverlay(type) {
  const isExpired = type === 'expired';
  const msg = isExpired
    ? 'AKUN ANDA TELAH EXPIRED DAN OTOMATIS DINONAKTIFKAN'
    : 'AKUN ANDA TELAH DINONAKTIFKAN OLEH ADMIN';
  const sub = 'SILAHKAN HUBUNGI ADMIN UTAMA UNTUK MENGAKTIFKAN KEMBALI AKUN ANDA';

  // Buat overlay
  let el = document.getElementById('revoke-fullscreen-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'revoke-fullscreen-overlay';
    document.body.appendChild(el);
  }
  el.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(0,0,0,0.92);
    display:flex;align-items:center;justify-content:center;
    animation:fadeInOverlay .3s ease;
  `;

  el.innerHTML = `
    <style>
      @keyframes fadeInOverlay { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
      @keyframes pulseIcon { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
      #revoke-fullscreen-overlay .rfo-icon { animation: pulseIcon 1.2s ease infinite; }
    </style>
    <div style="
      text-align:center;max-width:420px;width:90%;padding:40px 32px;
      background:linear-gradient(135deg,#1a0505,#1e1e2e);
      border:2px solid rgba(239,68,68,0.5);
      border-radius:20px;box-shadow:0 0 60px rgba(239,68,68,0.2);
    ">
      <div class="rfo-icon" style="font-size:72px;margin-bottom:16px;line-height:1;">🚨</div>
      <div style="font-size:11px;font-weight:800;letter-spacing:3px;color:#ef4444;margin-bottom:12px;">ANNOUNCEMENT</div>
      <div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:10px;line-height:1.5;">${msg}</div>
      <div style="font-size:13px;color:#94a3b8;line-height:1.7;margin-bottom:28px;">${sub}</div>
      <div id="revoke-countdown" style="font-size:14px;font-weight:700;color:#f59e0b;letter-spacing:1px;">
        LOGOUT OTOMATIS DALAM <span id="revoke-secs">3</span>
      </div>
    </div>
  `;
  el.style.display = 'flex';

  // Countdown 3→2→1 lalu logout
  let secs = 3;
  const tick = setInterval(() => {
    secs--;
    const secsEl = document.getElementById('revoke-secs');
    if (secsEl) secsEl.textContent = secs;
    if (secs <= 0) {
      clearInterval(tick);
      el.style.display = 'none';
      logoutUser();
      renderTopbarUser();
      renderDashboard();
    }
  }, 1000);
}

function showRevokeAlert(type) {
  // Hanya untuk notif noLimit dicabut (yang lain pakai showRevokeOverlay)
  let el = document.getElementById('revoke-alert-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'revoke-alert-overlay';
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;
      align-items:center;justify-content:center;z-index:9999;
    `;
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div style="
      background:var(--card-bg,#1e1e2e);border-radius:16px;padding:32px 28px;
      max-width:340px;width:90%;text-align:center;
      box-shadow:0 8px 32px rgba(0,0,0,.6);
      border:1px solid rgba(239,68,68,0.3);
    ">
      <div style="font-size:48px;margin-bottom:12px;">😤</div>
      <div style="font-size:15px;font-weight:800;color:#ef4444;margin-bottom:10px;letter-spacing:.5px;">AKSES LU UDH DIHAPUS BG</div>
      <div style="font-size:13px;color:var(--text-secondary,#aaa);line-height:1.6;margin-bottom:24px;">
        No Limit lu udh dicabut sama admin.<br>Minta lagi sana ama <strong style="color:#a78bfa">Admin Yori</strong>! 😂
      </div>
      <button onclick="document.getElementById('revoke-alert-overlay').style.display='none'" style="
        background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;
        border:none;border-radius:10px;padding:10px 28px;font-size:14px;
        font-weight:600;cursor:pointer;width:100%;
      ">Oke Bos</button>
    </div>
  `;
  el.style.display = 'flex';
}

// Start polling saat user login (semua user kecuali admin-1 yg permanen)
(function initAksesPolling() {
  const user = getLoggedInUser();
  if (user && user.id !== 'admin-1') startAksesPolling();
})();
