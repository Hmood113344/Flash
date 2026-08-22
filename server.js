const express = require("express");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;

const {
    CONFIG,
    Personnel,
    Violation,
    Vehicle,
    getSettings,
    generatePlate,
} = require("./config");

const app = express();
app.use(express.json());
app.use(session({
    secret: CONFIG.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// ══════════════════════════════════════════════════════════════════════════
// Discord OAuth
// ══════════════════════════════════════════════════════════════════════════
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: CONFIG.DISCORD_CLIENT_ID,
    clientSecret: CONFIG.DISCORD_CLIENT_SECRET,
    callbackURL: CONFIG.DISCORD_CALLBACK_URL,
    scope: ["identify", "guilds.members.read"],
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

app.get("/auth/discord", passport.authenticate("discord"));
app.get("/auth/discord/callback",
    passport.authenticate("discord", { failureRedirect: "/" }),
    (req, res) => res.redirect("/")
);
app.get("/auth/logout", (req, res) => {
    req.logout(() => res.redirect("/"));
});

function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "غير مسجّل دخول" });
}

// ── التحقق من رتب العسكر عبر Discord API (بوت التوكن) ──
async function fetchGuildMember(discordId) {
    try {
        const r = await fetch(
            `https://discord.com/api/v10/guilds/${CONFIG.GUILD_ID}/members/${discordId}`,
            { headers: { Authorization: `Bot ${CONFIG.BOT_TOKEN}` } }
        );
        if (!r.ok) return null;
        return await r.json();
    } catch (e) {
        return null;
    }
}

async function isMilitary(discordId) {
    const member = await fetchGuildMember(discordId);
    if (!member || !member.roles) return false;
    return member.roles.some(r => CONFIG.MILITARY_ROLE_IDS.includes(r));
}

// ══════════════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════════════

// معلومات المستخدم الحالي + حالته
app.get("/api/me", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    if (settings.disableLogin) {
        return res.json({ blocked: true, reason: "الدخول مغلق حالياً من قبل الإدارة" });
    }
    const military = await isMilitary(req.user.id);
    if (!military) {
        return res.json({ blocked: true, reason: "هذا الموقع مخصص لمنسوبي الجهات العسكرية فقط" });
    }

    let p = await Personnel.findOne({ discord: req.user.id });
    if (!p) {
        p = await Personnel.create({
            discord: req.user.id,
            discordTag: req.user.username,
        });
    }

    const isAdmin = settings.adminList.includes(req.user.id);

    res.json({
        blocked: false,
        discordId: req.user.id,
        discordTag: req.user.username,
        avatar: req.user.avatar
            ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
            : null,
        registeredName: p.registeredName,
        unit: p.unit,
        rank: p.rank,
        points: p.points,
        notes: p.notes,
        isBlocked: p.isBlocked,
        isAdmin,
        maintenance: settings.isMaintenance,
        violationsDisabled: settings.disableViolations,
    });
});

// حفظ الاسم واليونت أول مرة (أو تعديلهم)
app.post("/api/profile/setup", ensureAuth, async (req, res) => {
    const { name, unit } = req.body;
    if (!name || !unit) return res.status(400).json({ error: "أكمل الاسم واليونت" });
    const p = await Personnel.findOneAndUpdate(
        { discord: req.user.id },
        { registeredName: name, unit },
        { new: true, upsert: true }
    );
    res.json({ ok: true, registeredName: p.registeredName, unit: p.unit });
});

// أنواع المخالفات والمركبات المتاحة
app.get("/api/violations/meta", ensureAuth, async (req, res) => {
    const vehicles = await Vehicle.find().sort({ name: 1 });
    res.json({
        types: CONFIG.VIOLATION_TYPES,
        vehicles: vehicles.map(v => v.name),
    });
});

// تسجيل مخالفة جديدة
app.post("/api/violations/submit", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    if (settings.disableViolations) {
        return res.status(403).json({ error: "تسجيل المخالفات مغلق حالياً" });
    }
    const p = await Personnel.findOne({ discord: req.user.id });
    if (!p || !p.registeredName || !p.unit) {
        return res.status(400).json({ error: "أكمل بياناتك (الاسم واليونت) أولاً" });
    }
    if (p.isBlocked) {
        return res.status(403).json({ error: "أنت موقوف عن تسجيل مخالفات جديدة" });
    }
    const { violationType, vehicle } = req.body;
    if (!violationType || !vehicle) {
        return res.status(400).json({ error: "أكمل نوع المخالفة والمركبة" });
    }

    const v = await Violation.create({
        reporterDiscord: req.user.id,
        reporterTag: req.user.username,
        reporterName: p.registeredName,
        reporterUnit: p.unit,
        violationType,
        vehicle,
        plateNumber: generatePlate(),
        status: "pending",
    });

    res.json({ ok: true, violation: v });
});

// مخالفاتي (المسجّلة مني)
app.get("/api/violations/mine", ensureAuth, async (req, res) => {
    const list = await Violation.find({ reporterDiscord: req.user.id }).sort({ createdAt: -1 });
    res.json({ list });
});

// ── لوحة الإدارة (كبار المسؤولين فقط) ──
async function ensureAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (!settings.adminList.includes(req.user.id)) {
        return res.status(403).json({ error: "ليست لديك صلاحية" });
    }
    req.settings = settings;
    next();
}

app.get("/api/admin/pending", ensureAdmin, async (req, res) => {
    const list = await Violation.find({ status: "pending" }).sort({ createdAt: 1 });
    res.json({ list });
});

app.get("/api/admin/settings", ensureAdmin, async (req, res) => {
    res.json({ settings: req.settings });
});

app.post("/api/admin/settings", ensureAdmin, async (req, res) => {
    const { isMaintenance, disableLogin, disableViolations } = req.body;
    const s = req.settings;
    if (typeof isMaintenance === "boolean") s.isMaintenance = isMaintenance;
    if (typeof disableLogin === "boolean") s.disableLogin = disableLogin;
    if (typeof disableViolations === "boolean") s.disableViolations = disableViolations;
    await s.save();
    res.json({ ok: true });
});

// قبول مخالفة → صاحبها ياخذ نقطتين
app.post("/api/admin/violations/:id/approve", ensureAdmin, async (req, res) => {
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    v.status = "approved";
    v.reviewedBy = req.user.id;
    v.reviewedByTag = req.user.username;
    v.reviewedAt = new Date();
    await v.save();
    await Personnel.findOneAndUpdate(
        { discord: v.reporterDiscord },
        { $inc: { points: CONFIG.POINTS_ON_APPROVE } }
    );
    res.json({ ok: true });
});

// رفض مخالفة (لازم سبب) → صاحبها ياخذ نقطة وحده، والسبب ما يظهر الا للإدارة
app.post("/api/admin/violations/:id/reject", ensureAdmin, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
        return res.status(400).json({ error: "لازم تكتب سبب الرفض" });
    }
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    v.status = "rejected";
    v.rejectReason = reason.trim();
    v.reviewedBy = req.user.id;
    v.reviewedByTag = req.user.username;
    v.reviewedAt = new Date();
    await v.save();
    await Personnel.findOneAndUpdate(
        { discord: v.reporterDiscord },
        { $inc: { points: CONFIG.POINTS_ON_REJECT } }
    );
    res.json({ ok: true });
});

// بحث/عرض العسكريين + إضافة ملاحظة
app.get("/api/admin/personnel", ensureAdmin, async (req, res) => {
    const q = (req.query.q || "").trim();
    const filter = q
        ? { $or: [{ registeredName: new RegExp(q, "i") }, { unit: new RegExp(q, "i") }, { discordTag: new RegExp(q, "i") }] }
        : {};
    const list = await Personnel.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ list });
});

app.post("/api/admin/personnel/:discord/note", ensureAdmin, async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "اكتب الملاحظة" });
    const p = await Personnel.findOneAndUpdate(
        { discord: req.params.discord },
        { $push: { notes: { text: text.trim(), addedBy: req.user.id, addedByTag: req.user.username } } },
        { new: true }
    );
    if (!p) return res.status(404).json({ error: "غير موجود" });
    res.json({ ok: true, notes: p.notes });
});

app.post("/api/admin/personnel/:discord/block", ensureAdmin, async (req, res) => {
    const { blocked } = req.body;
    const p = await Personnel.findOneAndUpdate(
        { discord: req.params.discord },
        { isBlocked: !!blocked },
        { new: true }
    );
    if (!p) return res.status(404).json({ error: "غير موجود" });
    res.json({ ok: true, isBlocked: p.isBlocked });
});

// ══════════════════════════════════════════════════════════════════════════
// الواجهة (صفحة واحدة SPA)
// ══════════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${CONFIG.SITE_NAME}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Tahoma', 'Segoe UI', sans-serif; }
    body {
        background: linear-gradient(160deg, #050f1e 0%, #0a1930 100%);
        color: #e2e8f0;
        min-height: 100vh;
    }
    .wrap { max-width: 920px; margin: 0 auto; padding: 24px 16px; }
    .card {
        background: rgba(15,25,45,0.85);
        border: 1px solid rgba(59,130,246,0.25);
        border-radius: 14px;
        padding: 20px;
        margin-bottom: 18px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    }
    h1, h2, h3 { color: #60a5fa; margin-bottom: 12px; }
    .btn {
        display: inline-block;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #fff; border: none; border-radius: 10px;
        padding: 12px 22px; font-size: 15px; cursor: pointer;
        transition: 0.2s;
    }
    .btn:hover { filter: brightness(1.15); }
    .btn.danger { background: linear-gradient(135deg, #dc2626, #991b1b); }
    .btn.gray { background: #334155; }
    .btn.sm { padding: 7px 14px; font-size: 13px; }
    input, select, textarea {
        width: 100%; padding: 10px 12px; border-radius: 8px;
        border: 1px solid rgba(59,130,246,0.3); background: rgba(5,15,30,0.9);
        color: #fff; margin-bottom: 10px; font-size: 14px;
    }
    label { display: block; margin-bottom: 6px; color: #93c5fd; font-size: 13px; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .badge {
        display: inline-block; padding: 3px 10px; border-radius: 20px;
        font-size: 12px; font-weight: bold;
    }
    .badge.pending { background: #78350f; color: #fbbf24; }
    .badge.approved { background: #064e3b; color: #34d399; }
    .badge.rejected { background: #4c0519; color: #fb7185; }
    .stat { text-align: center; padding: 14px; background: rgba(5,15,30,0.6); border-radius: 10px; }
    .stat .num { font-size: 26px; font-weight: bold; color: #60a5fa; }
    .stat .lbl { font-size: 12px; color: #94a3b8; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .center { text-align: center; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px; border-bottom: 1px solid rgba(59,130,246,0.15); text-align: right; }
    .avatar { width: 70px; height: 70px; border-radius: 50%; border: 3px solid #2563eb; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .tab { padding: 8px 16px; border-radius: 8px; background: #1e293b; cursor: pointer; font-size: 13px; }
    .tab.active { background: #2563eb; }
    .id-card {
        background: linear-gradient(135deg, #0f172a, #1e3a5f);
        border: 2px solid #3b82f6; border-radius: 16px; padding: 20px;
        max-width: 380px; margin: 0 auto;
    }
    .hidden { display: none !important; }
    #toast {
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: #1e293b; padding: 10px 20px; border-radius: 10px;
        border: 1px solid #3b82f6; z-index: 999; display: none;
    }
</style>
</head>
<body>
<div class="wrap" id="app">
    <div class="card center">جارِ التحميل...</div>
</div>
<div id="toast"></div>

<script>
let ME = null;

async function api(url, opts) {
    const r = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'خطأ');
    return data;
}

function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2500);
}

async function init() {
    try {
        ME = await api('/api/me');
    } catch (e) {
        renderLogin();
        return;
    }
    if (ME.blocked) { renderBlocked(ME.reason); return; }
    if (!ME.registeredName || !ME.unit) { renderSetup(); return; }
    renderDashboard();
}

function renderLogin() {
    document.getElementById('app').innerHTML = \`
        <div class="card center" style="margin-top:60px;">
            <h1>${CONFIG.SITE_NAME}</h1>
            <p style="color:#94a3b8;margin-bottom:20px;">نظام تسجيل المخالفات لمنسوبي الجهات العسكرية</p>
            <a class="btn" href="/auth/discord">تسجيل الدخول عبر ديسكورد</a>
        </div>\`;
}

function renderBlocked(reason) {
    document.getElementById('app').innerHTML = \`
        <div class="card center" style="margin-top:60px;">
            <h2 style="color:#fb7185;">🚫 غير مصرح</h2>
            <p style="color:#94a3b8;margin-top:10px;">\${reason}</p>
            <a class="btn gray" href="/auth/logout" style="margin-top:16px;">تسجيل خروج</a>
        </div>\`;
}

function renderSetup() {
    document.getElementById('app').innerHTML = \`
        <div class="card" style="margin-top:40px;">
            <h2>أكمل بياناتك العسكرية</h2>
            <label>الاسم المسجل في السيرفر</label>
            <input id="setup-name" placeholder="مثال: عبدالله الحربي">
            <label>اليونت العسكري</label>
            <input id="setup-unit" placeholder="مثال: الدورية الأولى">
            <button class="btn" onclick="doSetup()">حفظ ومتابعة</button>
        </div>\`;
}

async function doSetup() {
    const name = document.getElementById('setup-name').value.trim();
    const unit = document.getElementById('setup-unit').value.trim();
    if (!name || !unit) return toast('أكمل الحقول');
    try {
        await api('/api/profile/setup', { method: 'POST', body: JSON.stringify({ name, unit }) });
        init();
    } catch (e) { toast(e.message); }
}

function renderDashboard() {
    document.getElementById('app').innerHTML = \`
        <div class="card row">
            <div class="row" style="gap:14px;">
                \${ME.avatar ? \`<img class="avatar" src="\${ME.avatar}">\` : ''}
                <div>
                    <h2 style="margin-bottom:2px;">\${ME.registeredName}</h2>
                    <div style="color:#94a3b8;font-size:13px;">\${ME.unit} • \${ME.rank}</div>
                </div>
            </div>
            <div class="row" style="gap:8px;">
                \${ME.isAdmin ? '<button class="btn gray sm" onclick="renderAdmin()">لوحة الإدارة</button>' : ''}
                <a class="btn gray sm" href="/auth/logout">خروج</a>
            </div>
        </div>

        \${ME.maintenance ? '<div class="card" style="border-color:#f59e0b;color:#fbbf24;">⚠️ الموقع في وضع الصيانة حالياً</div>' : ''}

        <div class="grid3">
            <div class="stat"><div class="num">\${ME.points}</div><div class="lbl">النقاط</div></div>
            <div class="stat"><div class="num" id="mine-count">-</div><div class="lbl">مخالفاتي</div></div>
            <div class="stat"><div class="num">\${ME.isBlocked ? '🚫' : '✅'}</div><div class="lbl">الحالة</div></div>
        </div>

        <div class="card">
            <div class="row">
                <h3>مخالفاتي المسجلة</h3>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="renderCard()">بطاقتي</button>
                    \${!ME.violationsDisabled ? '<button class="btn sm" onclick="renderNewViolation()">+ تسجيل مخالفة جديدة</button>' : ''}
                </div>
            </div>
            <div id="notes-box" style="margin:10px 0;"></div>
            <div id="mine-list">جارِ التحميل...</div>
        </div>
    \`;
    loadMine();
    renderNotes();
}

function renderNotes() {
    const box = document.getElementById('notes-box');
    if (!ME.notes || ME.notes.length === 0) { box.innerHTML = ''; return; }
    box.innerHTML = '<div style="font-size:13px;color:#93c5fd;margin-bottom:6px;">ملاحظات عليك:</div>' +
        ME.notes.map(n => \`<div style="background:rgba(5,15,30,0.6);padding:8px;border-radius:8px;margin-bottom:6px;font-size:13px;">\${n.text}</div>\`).join('');
}

async function loadMine() {
    const { list } = await api('/api/violations/mine');
    document.getElementById('mine-count').textContent = list.length;
    const box = document.getElementById('mine-list');
    if (list.length === 0) { box.innerHTML = '<p style="color:#64748b;">لا توجد مخالفات مسجلة بعد</p>'; return; }
    box.innerHTML = \`<table><tr><th>النوع</th><th>المركبة</th><th>اللوحة</th><th>الحالة</th></tr>\` +
        list.map(v => \`<tr>
            <td>\${v.violationType}</td>
            <td>\${v.vehicle}</td>
            <td>\${v.plateNumber}</td>
            <td><span class="badge \${v.status}">\${v.status === 'pending' ? 'قيد المراجعة' : v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span></td>
        </tr>\`).join('') + '</table>';
}

async function renderNewViolation() {
    const { types, vehicles } = await api('/api/violations/meta');
    document.getElementById('app').innerHTML = \`
        <div class="card">
            <h2>تسجيل مخالفة جديدة</h2>
            <label>نوع المخالفة</label>
            <select id="v-type">\${types.map(t => \`<option>\${t}</option>\`).join('')}</select>
            <label>المركبة</label>
            <select id="v-vehicle">\${vehicles.length ? vehicles.map(v => \`<option>\${v}</option>\`).join('') : '<option disabled>لا توجد مركبات مضافة</option>'}</select>
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn" onclick="submitViolation()">إرسال</button>
                <button class="btn gray" onclick="renderDashboard()">رجوع</button>
            </div>
        </div>\`;
}

async function submitViolation() {
    const violationType = document.getElementById('v-type').value;
    const vehicle = document.getElementById('v-vehicle').value;
    try {
        await api('/api/violations/submit', { method: 'POST', body: JSON.stringify({ violationType, vehicle }) });
        toast('تم الإرسال، بانتظار قبول الإدارة');
        renderDashboard();
    } catch (e) { toast(e.message); }
}

function renderCard() {
    document.getElementById('app').innerHTML = \`
        <div style="margin-top:30px;">
            <div class="id-card">
                \${ME.avatar ? \`<img class="avatar" src="\${ME.avatar}" style="display:block;margin:0 auto 12px;">\` : ''}
                <div class="center" style="font-size:18px;font-weight:bold;color:#93c5fd;">\${ME.registeredName}</div>
                <div class="center" style="font-size:13px;color:#64748b;margin-bottom:14px;">${CONFIG.SITE_NAME} • بطاقة تعريف عسكرية</div>
                <table>
                    <tr><td>اليونت</td><td>\${ME.unit}</td></tr>
                    <tr><td>الرتبة</td><td>\${ME.rank}</td></tr>
                    <tr><td>النقاط</td><td>\${ME.points}</td></tr>
                    <tr><td>الحالة</td><td>\${ME.isBlocked ? 'موقوف' : 'فعّال'}</td></tr>
                </table>
            </div>
            <div class="center" style="margin-top:16px;"><button class="btn gray sm" onclick="renderDashboard()">رجوع</button></div>
        </div>\`;
}

// ══════════════ لوحة الإدارة ══════════════
async function renderAdmin() {
    document.getElementById('app').innerHTML = \`
        <div class="card row">
            <h2>لوحة الإدارة</h2>
            <button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button>
        </div>
        <div class="tabs">
            <div class="tab active" onclick="adminTab('pending', this)">المخالفات المعلّقة</div>
            <div class="tab" onclick="adminTab('personnel', this)">العسكريون</div>
            <div class="tab" onclick="adminTab('settings', this)">الإعدادات</div>
        </div>
        <div id="admin-content"></div>
    \`;
    adminTab('pending');
}

function adminTab(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    if (name === 'pending') loadPending();
    if (name === 'personnel') loadPersonnel();
    if (name === 'settings') loadSettings();
}

async function loadPending() {
    const box = document.getElementById('admin-content');
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    const { list } = await api('/api/admin/pending');
    if (list.length === 0) { box.innerHTML = '<div class="card center" style="color:#64748b;">لا توجد مخالفات معلّقة</div>'; return; }
    box.innerHTML = list.map(v => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${v.reporterName}</b> <span style="color:#64748b;font-size:12px;">(\${v.reporterUnit})</span>
                    <div style="color:#93c5fd;margin-top:4px;">\${v.violationType}</div>
                    <div style="color:#64748b;font-size:13px;">المركبة: \${v.vehicle} • اللوحة: \${v.plateNumber}</div>
                </div>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="approveV('\${v._id}')">قبول</button>
                    <button class="btn danger sm" onclick="rejectV('\${v._id}')">رفض</button>
                </div>
            </div>
        </div>\`).join('');
}

async function approveV(id) {
    try { await api('/api/admin/violations/' + id + '/approve', { method: 'POST' }); toast('تم القبول'); loadPending(); }
    catch (e) { toast(e.message); }
}

function rejectV(id) {
    const reason = prompt('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب');
    api('/api/admin/violations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
        .then(() => { toast('تم الرفض'); loadPending(); })
        .catch(e => toast(e.message));
}

async function loadPersonnel() {
    const box = document.getElementById('admin-content');
    box.innerHTML = \`
        <div class="card">
            <input id="p-search" placeholder="بحث بالاسم / اليونت / التاق" onkeyup="if(event.key==='Enter') searchPersonnel()">
            <button class="btn sm" onclick="searchPersonnel()">بحث</button>
        </div>
        <div id="p-list"></div>\`;
    searchPersonnel();
}

async function searchPersonnel() {
    const q = document.getElementById('p-search') ? document.getElementById('p-search').value : '';
    const { list } = await api('/api/admin/personnel?q=' + encodeURIComponent(q));
    document.getElementById('p-list').innerHTML = list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:#64748b;font-size:12px;">\${p.unit || ''}</span>
                    <div style="font-size:13px;color:#94a3b8;">النقاط: \${p.points} \${p.isBlocked ? '• 🚫 موقوف' : ''}</div>
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="addNote('\${p.discord}')">ملاحظة</button>
                    <button class="btn sm \${p.isBlocked ? '' : 'danger'}" onclick="toggleBlock('\${p.discord}', \${!p.isBlocked})">\${p.isBlocked ? 'إلغاء الإيقاف' : 'إيقاف'}</button>
                </div>
            </div>
        </div>\`).join('') || '<div class="card center" style="color:#64748b;">لا نتائج</div>';
}

function addNote(discordId) {
    const text = prompt('اكتب الملاحظة:');
    if (!text || !text.trim()) return;
    api('/api/admin/personnel/' + discordId + '/note', { method: 'POST', body: JSON.stringify({ text }) })
        .then(() => toast('تمت الإضافة'))
        .catch(e => toast(e.message));
}

function toggleBlock(discordId, blocked) {
    api('/api/admin/personnel/' + discordId + '/block', { method: 'POST', body: JSON.stringify({ blocked }) })
        .then(() => { toast('تم التحديث'); searchPersonnel(); })
        .catch(e => toast(e.message));
}

async function loadSettings() {
    const { settings } = await api('/api/admin/settings');
    document.getElementById('admin-content').innerHTML = \`
        <div class="card">
            <div class="row"><span>وضع الصيانة</span><input type="checkbox" id="s-maint" \${settings.isMaintenance ? 'checked' : ''}></div>
            <div class="row" style="margin-top:10px;"><span>إغلاق تسجيل الدخول</span><input type="checkbox" id="s-login" \${settings.disableLogin ? 'checked' : ''}></div>
            <div class="row" style="margin-top:10px;"><span>إغلاق تسجيل المخالفات</span><input type="checkbox" id="s-viol" \${settings.disableViolations ? 'checked' : ''}></div>
            <button class="btn" style="margin-top:14px;" onclick="saveSettings()">حفظ الإعدادات</button>
        </div>\`;
}

async function saveSettings() {
    const body = {
        isMaintenance: document.getElementById('s-maint').checked,
        disableLogin: document.getElementById('s-login').checked,
        disableViolations: document.getElementById('s-viol').checked,
    };
    try { await api('/api/admin/settings', { method: 'POST', body: JSON.stringify(body) }); toast('تم الحفظ'); }
    catch (e) { toast(e.message); }
}

init();
</script>
</body>
</html>`);
});

app.listen(CONFIG.PORT, "0.0.0.0", () => {
    console.log(`🚀 ${CONFIG.SITE_NAME} server running on port ${CONFIG.PORT}`);
});
