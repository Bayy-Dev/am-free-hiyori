// ── AM CLAIM SERVER ──
// Express backend: serve static files + API baca/tulis JSON

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Path file data ──
const DATA_DIR      = path.join(__dirname, 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const HISTORY_FILE  = path.join(DATA_DIR, 'history.json');
const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) || {}; } catch { return {}; }
}
function writeSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Helper baca/tulis JSON ──
function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Middleware ──
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html, css/, js/

// ════════════════════════════════════════
//  API: AUTH (Login / Register)
// ════════════════════════════════════════

// POST daftar akun baru — selalu 'member', admin dikelola lewat panel
app.post('/api/register', (req, res) => {
  const { username, password, deviceId } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ error: 'Username minimal 3 karakter' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    return res.status(400).json({ error: 'Username hanya boleh huruf, angka, dan underscore' });
  }
  if (password.length < 1) {
    return res.status(400).json({ error: 'Password tidak boleh kosong' });
  }

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Username sudah digunakan' });
  }

  // Cek apakah device ini sudah pernah daftar akun sebelumnya
  const deviceAlreadyRegistered = deviceId && users.some(u => u.deviceId === deviceId);
  // Akun pertama dari device ini langsung aktif, akun berikutnya pending
  const isActive = !deviceAlreadyRegistered;

  const user = {
    id:        Date.now().toString(36) + Math.random().toString(36).slice(2),
    username:  username.trim(),
    password,
    role:      'member',
    isActive,
    noLimit:   false,
    deviceId:  deviceId || null,
    createdAt: Date.now(),
  };
  users.push(user);
  writeJSON(USERS_FILE, users);

  if (!isActive) {
    // Akun ke-2 dst dari device yang sama → pending aktivasi
    return res.json({ ok: true, pendingActivation: true, user: { id: user.id, username: user.username, role: user.role, isActive: false } });
  }

  // Akun pertama dari device ini → langsung aktif & auto-login
  res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role, isActive: true, noLimit: false } });
});

// POST login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const users = readJSON(USERS_FILE);
  let user  = users.find(u =>
    u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );

  if (!user) return res.status(401).json({ error: 'Username atau password salah' });

  // Cek expired — admin & member: set isActive=false, block login
  if (user.id !== 'admin-1' && user.expiredAt && Date.now() > user.expiredAt) {
    const allUsers = readJSON(USERS_FILE);
    const uidx     = allUsers.findIndex(u => u.id === user.id);
    if (uidx !== -1 && allUsers[uidx].isActive !== false) {
      allUsers[uidx].isActive = false;
      writeJSON(USERS_FILE, allUsers);
    }
    return res.status(403).json({ error: 'Akun kamu sudah expired dan dinonaktifkan. Hubungi Admin Utama untuk mengaktifkan kembali.' });
  }

  // Block login jika nonaktif (expired atau dinonaktifkan admin)
  if (!user.isActive) {
    return res.status(403).json({ error: 'Akun kamu dinonaktifkan. Hubungi Admin Utama untuk mengaktifkan kembali.' });
  }

  res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role || 'member', isActive: user.isActive, noLimit: user.noLimit || false, expiredAt: user.expiredAt || null } });
});

// ════════════════════════════════════════
//  API: MANAGE USERS (admin panel)
// ════════════════════════════════════════

// GET semua user (tanpa password)
app.get('/api/users', (req, res) => {
  const users = readJSON(USERS_FILE).map(u => ({
    id:        u.id,
    username:  u.username,
    password:  u.password || '-',
    role:      u.role || 'member',
    isActive:  u.isActive !== undefined ? u.isActive : (u.role === 'admin' ? true : false),
    noLimit:   u.noLimit  || false,
    deviceId:  u.deviceId || null,
    expiredAt: u.expiredAt || null,
    createdAt: u.createdAt,
  }));
  res.json(users);
});

// PUT ubah role user
app.put('/api/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }

  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan' });

  // Lindungi akun admin utama
  if (users[idx].id === 'admin-1') {
    return res.status(403).json({ error: 'Admin utama tidak bisa diubah' });
  }

  users[idx].role = role;
  writeJSON(USERS_FILE, users);
  res.json({ ok: true });
});

// POST tambah akun baru oleh admin (bisa set role)
app.post('/api/admin/add-user', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ error: 'Username minimal 3 karakter' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    return res.status(400).json({ error: 'Username hanya boleh huruf, angka, dan _' });
  }
  if (password.length < 1) {
    return res.status(400).json({ error: 'Password tidak boleh kosong' });
  }

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Username sudah digunakan' });
  }

  const newUser = {
    id:        Date.now().toString(36) + Math.random().toString(36).slice(2),
    username:  username.trim(),
    password,
    role:      ['admin','member'].includes(role) ? role : 'admin',
    isActive:  true,  // user dibuat admin langsung aktif
    noLimit:   false,
    createdAt: Date.now(),
  };
  users.push(newUser);
  writeJSON(USERS_FILE, users);
  res.json({ ok: true, user: { id: newUser.id, username: newUser.username, role: newUser.role, isActive: true } });
});

// DELETE hapus user
app.delete('/api/users/:id', (req, res) => {
  if (req.params.id === 'admin-1') {
    return res.status(403).json({ error: 'Admin utama tidak bisa dihapus' });
  }
  const users = readJSON(USERS_FILE).filter(u => u.id !== req.params.id);
  writeJSON(USERS_FILE, users);
  res.json({ ok: true });
});

// PUT update data user (username, password, role)
app.put('/api/users/:id', (req, res) => {
  const { username, password, role } = req.body;
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan' });

  // Validasi & update username
  if (username !== undefined) {
    const u = username.trim();
    if (u.length < 3) return res.status(400).json({ error: 'Username minimal 3 karakter' });
    if (!/^[a-zA-Z0-9_]+$/.test(u)) return res.status(400).json({ error: 'Username hanya huruf, angka, dan _' });
    const conflict = users.find(x => x.id !== req.params.id && x.username.toLowerCase() === u.toLowerCase());
    if (conflict) return res.status(409).json({ error: 'Username sudah digunakan' });
    users[idx].username = u;
  }

  // Update password (opsional — kosong = tidak diubah)
  if (password && password.length > 0) {
    users[idx].password = password;
  }

  // Update role — admin-1 tidak bisa diubah rolenya
  if (role && ['admin', 'member'].includes(role)) {
    if (users[idx].id === 'admin-1') {
      return res.status(403).json({ error: 'Role admin utama tidak bisa diubah' });
    }
    users[idx].role = role;
  }

  // Update isActive
  if (typeof req.body.isActive === 'boolean') {
    users[idx].isActive = req.body.isActive;
  }

  // Update noLimit
  if (typeof req.body.noLimit === 'boolean') {
    users[idx].noLimit = req.body.noLimit;
  }

  // Reset deviceId
  if (req.body.hasOwnProperty('deviceId')) {
    users[idx].deviceId = req.body.deviceId; // null = reset
  }

  writeJSON(USERS_FILE, users);
  res.json({ ok: true, user: { id: users[idx].id, username: users[idx].username, role: users[idx].role, isActive: users[idx].isActive, noLimit: users[idx].noLimit } });
});

// ════════════════════════════════════════
//  API: CLEAR ALL (admin only)
// ════════════════════════════════════════

app.post('/api/admin/clear-all', (req, res) => {
  // Hapus semua history claim
  writeJSON(HISTORY_FILE, []);

  // Hapus semua akun AM
  writeJSON(ACCOUNTS_FILE, []);

  // Hapus semua sessions
  writeJSON(SESSIONS_FILE, []);

  // Hapus semua user kecuali admin, reset deviceId semua user
  const users = readJSON(USERS_FILE);
  const cleaned = users
    .filter(u => u.role === 'admin') // hanya simpan admin
    .map(u => ({ ...u, deviceId: null })); // reset deviceId admin juga
  writeJSON(USERS_FILE, cleaned);

  res.json({ ok: true });
});

// ════════════════════════════════════════
//  API: ACCOUNTS
// ════════════════════════════════════════

// GET semua akun
app.get('/api/accounts', (req, res) => {
  res.json(readJSON(ACCOUNTS_FILE));
});

// POST tambah akun baru (admin)
app.post('/api/accounts', (req, res) => {
  const { email, keterangan } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email wajib diisi' });
  }
  // Auto-generate emailAccess dari email jika tidak dikirim
  const emailAccess = req.body.emailAccess || ('https://generator.email/' + email.trim());

  const accounts = readJSON(ACCOUNTS_FILE);
  if (accounts.find(a => a.email === email)) {
    return res.status(409).json({ error: 'Email sudah ada di daftar' });
  }

  const newAccount = {
    id:          Date.now().toString(36) + Math.random().toString(36).slice(2),
    email,
    emailAccess,
    keterangan:  keterangan || '',
    claimed:     false,
    addedAt:     Date.now(),
  };

  accounts.push(newAccount);
  writeJSON(ACCOUNTS_FILE, accounts);
  res.json({ ok: true, account: newAccount });
});

// DELETE hapus akun
app.delete('/api/accounts/:id', (req, res) => {
  const accounts = readJSON(ACCOUNTS_FILE).filter(a => a.id !== req.params.id);
  writeJSON(ACCOUNTS_FILE, accounts);
  res.json({ ok: true });
});

// ════════════════════════════════════════
//  API: CLAIM
// ════════════════════════════════════════

// POST proses claim dari user
app.post('/api/claim', (req, res) => {
  const { deviceId, userId, username } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId wajib ada' });

  const sessions = readJSON(SESSIONS_FILE);

  // Cek noLimit user
  const users = readJSON(USERS_FILE);
  const claimUser = userId ? users.find(u => u.id === userId) : null;
  const isNoLimit = claimUser && claimUser.noLimit === true;
  const isMainAdmin = userId === 'admin-1'; // Admin utama bypass semua limit

  // Cek sudah pernah claim via deviceId ATAU userId
  if (!isNoLimit && !isMainAdmin) {
    if (sessions.find(s => s.sessionId === deviceId)) {
      return res.status(409).json({ error: 'already_claimed' });
    }
    if (userId && sessions.find(s => s.userId === userId)) {
      return res.status(409).json({ error: 'already_claimed' });
    }
  } else if (isNoLimit && !isMainAdmin) {
    // noLimit: cek cooldown 3 jam
    const COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 jam
    const lastClaim = sessions
      .filter(s => s.userId === userId)
      .sort((a, b) => b.date - a.date)[0];
    if (lastClaim) {
      const elapsed = Date.now() - lastClaim.date;
      if (elapsed < COOLDOWN_MS) {
        const sisaMs  = COOLDOWN_MS - elapsed;
        const sisaJam = Math.floor(sisaMs / 3600000);
        const sisaMin = Math.floor((sisaMs % 3600000) / 60000);
        return res.status(429).json({
          error: 'cooldown',
          message: `Masih cooldown! Bisa claim lagi dalam ${sisaJam}j ${sisaMin}m`,
        });
      }
    }
  }
  // isMainAdmin: skip semua cek limit & cooldown

  const accounts  = readJSON(ACCOUNTS_FILE);
  const available = accounts.filter(a => !a.claimed);

  if (available.length === 0) {
    return res.status(410).json({ error: 'stok_habis' });
  }

  // Ambil akun pertama tersedia
  const pick = available[0];
  const idx  = accounts.findIndex(a => a.id === pick.id);
  accounts[idx].claimed   = true;
  accounts[idx].claimedAt = Date.now();
  writeJSON(ACCOUNTS_FILE, accounts);

  // Format tanggal
  const now     = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const displayName = username || ('Pengguna ' + deviceId.slice(0, 6));

  const claimData = {
    email:       pick.email,
    emailAccess: pick.emailAccess,
    keterangan:  pick.keterangan,
    date:        dateStr,
    id:          pick.id,
  };

  // Simpan ke sessions.json
  sessions.unshift({
    sessionId:   deviceId,
    sessionName: 'session.' + deviceId.slice(0, 8),
    email:       pick.email,
    accountId:   pick.id,
    date:        dateStr,
    createdAt:   Date.now(),
    userId:      userId  || null,
    username:    displayName,
  });
  writeJSON(SESSIONS_FILE, sessions);

  // Simpan ke history.json
  const history = readJSON(HISTORY_FILE);
  history.unshift({
    ...claimData,
    deviceId:  deviceId.slice(0, 8) + '...',
    username:  displayName,
    createdAt: Date.now(),
  });
  writeJSON(HISTORY_FILE, history);

  res.json({ ok: true, claimData });
});

// ════════════════════════════════════════
//  API: SESSIONS
// ════════════════════════════════════════

// GET semua session (admin)
app.get('/api/sessions', (req, res) => {
  res.json(readJSON(SESSIONS_FILE));
});

// POST kembalikan akun ke sistem by sessionId (akun jadi available lagi)
app.post('/api/sessions/return', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId wajib ada' });

  const sessions  = readJSON(SESSIONS_FILE);
  // Cari by sessionId ATAU by accountId (fallback)
  const mySession = sessions.find(s => s.sessionId === sessionId);
  if (!mySession) return res.status(404).json({ error: 'Session tidak ditemukan' });

  // Hapus session ini saja
  writeJSON(SESSIONS_FILE, sessions.filter(s => s.sessionId !== sessionId));

  // Reset akun AM terkait jadi available
  const accounts = readJSON(ACCOUNTS_FILE);
  const idx = accounts.findIndex(a => a.id === mySession.accountId);
  if (idx !== -1) {
    accounts[idx].claimed   = false;
    accounts[idx].claimedAt = null;
    writeJSON(ACCOUNTS_FILE, accounts);
  }

  // Hapus dari history
  const history = readJSON(HISTORY_FILE).filter(h => h.id !== mySession.accountId);
  writeJSON(HISTORY_FILE, history);

  res.json({ ok: true });
});

// POST hapus dari my claim admin (akun tetap claimed, cuma hidden dari list admin)
app.post('/api/sessions/hide', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId wajib ada' });

  const sessions  = readJSON(SESSIONS_FILE);
  const mySession = sessions.find(s => s.sessionId === sessionId);
  if (!mySession) return res.status(404).json({ error: 'Session tidak ditemukan' });

  // Tandai sebagai hidden (hapus dari view admin tapi akun tetap claimed)
  const updated = sessions.map(s =>
    s.sessionId === sessionId ? { ...s, hiddenByAdmin: true } : s
  );
  writeJSON(SESSIONS_FILE, updated);

  res.json({ ok: true });
});

// DELETE hapus session + reset akun terkait
app.delete('/api/sessions/:id', (req, res) => {
  const sessionId = req.params.id;

  const sessions = readJSON(SESSIONS_FILE);
  const deleted  = sessions.find(s => s.sessionId === sessionId);

  if (!deleted) return res.status(404).json({ error: 'Session tidak ditemukan' });

  // Hapus session
  writeJSON(SESSIONS_FILE, sessions.filter(s => s.sessionId !== sessionId));

  // Reset status akun
  const accounts = readJSON(ACCOUNTS_FILE);
  const idx = accounts.findIndex(a => a.id === deleted.accountId);
  if (idx !== -1) {
    accounts[idx].claimed   = false;
    accounts[idx].claimedAt = null;
    writeJSON(ACCOUNTS_FILE, accounts);
  }

  // Hapus dari history
  const history = readJSON(HISTORY_FILE).filter(h => h.id !== deleted.accountId);
  writeJSON(HISTORY_FILE, history);

  res.json({ ok: true });
});

// ════════════════════════════════════════
//  API: HISTORY
// ════════════════════════════════════════

// GET history global
app.get('/api/history', (req, res) => {
  res.json(readJSON(HISTORY_FILE));
});

// ════════════════════════════════════════
//  API: MAINTENANCE
// ════════════════════════════════════════

app.get('/api/settings', (req, res) => {
  res.json(readSettings());
});

app.post('/api/settings/maintenance', (req, res) => {
  const { maintenance } = req.body;
  if (typeof maintenance !== 'boolean') return res.status(400).json({ error: 'Invalid' });
  const s = readSettings();
  s.maintenance = maintenance;
  writeSettings(s);
  res.json({ ok: true, maintenance });
});

// ════════════════════════════════════════
//  API: EXPIRED USER
// ════════════════════════════════════════

app.put('/api/users/:id/expired', (req, res) => {
  const { days } = req.body; // null = permanen, angka = hari
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (users[idx].id === 'admin-1') return res.status(403).json({ error: 'Admin utama tidak bisa di-set expired' });

  if (days === null || days === 0) {
    users[idx].expiredAt = null; // permanen
  } else {
    // days bisa float (misal 0.5 = 12 jam, 1/1440 = 1 menit)
    users[idx].expiredAt = Date.now() + (parseFloat(days) * 24 * 60 * 60 * 1000);
  }
  writeJSON(USERS_FILE, users);
  res.json({ ok: true, expiredAt: users[idx].expiredAt });
});

// ════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════

// ── Pastikan admin-1 selalu ada saat server start ──
function ensureAdminUser() {
  const users = readJSON(USERS_FILE);
  const hasAdmin = users.find(u => u.id === 'admin-1');
  if (!hasAdmin) {
    users.unshift({
      id:        'admin-1',
      username:  'adm',
      password:  'adm',
      role:      'admin',
      isActive:  true,
      noLimit:   true,
      createdAt: Date.now(),
    });
    writeJSON(USERS_FILE, users);
    console.log('✅  Akun admin utama (adm/adm) telah dibuat otomatis.');
  }
}

// GET cek status akses user (untuk notif revoke)
app.get('/api/users/:id/akses', (req, res) => {
  const users = readJSON(USERS_FILE);
  let user  = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  // Cek expired — admin & member: set isActive=false
  const nowExpired = user.id !== 'admin-1' && user.expiredAt && Date.now() > user.expiredAt;
  if (nowExpired && user.isActive !== false) {
    const allUsers = readJSON(USERS_FILE);
    const uidx     = allUsers.findIndex(u => u.id === user.id);
    if (uidx !== -1) {
      allUsers[uidx].isActive = false;
      writeJSON(USERS_FILE, allUsers);
      user = allUsers[uidx];
    }
  }

  const isExpired = nowExpired || (!user.isActive && user.expiredAt && user.expiredAt <= Date.now());

  res.json({
    isActive:  user.isActive || false,
    noLimit:   user.noLimit  || false,
    role:      user.role     || 'member',
    expiredAt: user.expiredAt || null,
    isExpired: !!isExpired,
    isDeactivated: !user.isActive && !isExpired, // dinonaktifkan manual oleh admin
  });
});

app.listen(PORT, () => {
  ensureAdminUser();
  console.log(`\n✅  AM Claim Server jalan di: http://localhost:${PORT}`);
  console.log(`📁  Data tersimpan di folder: ${DATA_DIR}\n`);
});


// ════════════════════════════════════════
//  API: RESTOCK (trigger userbot)
// ════════════════════════════════════════

const RESTOCK_TRIGGER = path.join(__dirname, 'data', 'restock_trigger.json');
const RESTOCK_STATUS  = path.join(__dirname, 'data', 'restock_status.json');

// POST /api/restock — admin minta restock
app.post('/api/restock', (req, res) => {
  // Cek apakah sedang running
  let status = {};
  try { status = JSON.parse(fs.readFileSync(RESTOCK_STATUS, 'utf8')); } catch {}
  if (status.running) {
    return res.status(409).json({ error: 'Restock sedang berjalan, tunggu sebentar...' });
  }

  const jumlah = parseInt(req.body.jumlah) || 10;

  // Tulis trigger
  fs.writeFileSync(RESTOCK_TRIGGER, JSON.stringify({
    trigger: true,
    jumlah,
    requestedAt: Date.now(),
  }), 'utf8');

  // Set status running
  fs.writeFileSync(RESTOCK_STATUS, JSON.stringify({
    running: true,
    startedAt: Date.now(),
    jumlah,
    done: false,
    result: null,
  }), 'utf8');

  res.json({ ok: true, message: 'Restock dimulai...' });
});

// GET /api/restock/status — cek progress
app.get('/api/restock/status', (req, res) => {
  try {
    const status = JSON.parse(fs.readFileSync(RESTOCK_STATUS, 'utf8'));
    res.json(status);
  } catch {
    res.json({ running: false, done: false, result: null });
  }
});

// GET /api/restock/trigger — dicek userbot via HTTP polling
app.get('/api/restock/trigger', (req, res) => {
  try {
    const t = JSON.parse(fs.readFileSync(RESTOCK_TRIGGER, 'utf8'));
    res.json(t);
  } catch {
    res.json({ trigger: false });
  }
});

// POST /api/restock/done — dipanggil userbot setelah selesai
app.post('/api/restock/done', (req, res) => {
  const { added, skipped, failed } = req.body;
  fs.writeFileSync(RESTOCK_STATUS, JSON.stringify({
    running: false,
    done: true,
    doneAt: Date.now(),
    result: { added: added || 0, skipped: skipped || 0, failed: failed || 0 },
  }), 'utf8');
  // Hapus trigger
  try { fs.unlinkSync(RESTOCK_TRIGGER); } catch {}
  res.json({ ok: true });
});
