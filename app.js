
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const crypto = require("crypto");
const mongoose = require("mongoose");
const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    AttachmentBuilder,
} = require("discord.js");

const CONFIG = {
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || "",
    DISCORD_CALLBACK_URL: process.env.DISCORD_CALLBACK_URL || "",
    BOT_TOKEN: process.env.BOT_TOKEN || "",
    GUILD_ID: process.env.GUILD_ID || "",
    MONGO_URI: process.env.MONGO_URI || "",

    SITE_NAME: "فلاش",
    SITE_URL: process.env.SITE_URL || (process.env.DISCORD_CALLBACK_URL ? process.env.DISCORD_CALLBACK_URL.replace(/\/auth\/discord\/callback.*$/, "") : "https://flash1-gtsp.onrender.com"),
    SESSION_SECRET: process.env.SESSION_SECRET || "غيّر_هذا_السر_2026",
    PORT: process.env.PORT || 7700,

    ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@moi.sa.com",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "Admin@12345",
    OWNER_EMAIL: (process.env.OWNER_EMAIL || "hmood@admin.moi").toLowerCase(),
    OWNER_PASSWORD: process.env.OWNER_PASSWORD || "",
    BOT_ADMIN_IDS: (process.env.BOT_ADMIN_IDS || "").split(",").map(x => x.trim()).filter(Boolean),

    SUPPORT_CHANNEL_ID: process.env.SUPPORT_CHANNEL_ID || "",
    SUPPORT_PING_ROLE_ID: process.env.SUPPORT_PING_ROLE_ID || "",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    SUPPORT_AI_MODEL: process.env.SUPPORT_AI_MODEL || "claude-sonnet-4-6",

    MILITARY_RANKS: [
    "جندي", "جندي اول", "عريف", "وكيل رقيب", "رقيب", "رقيب اول", "رئيس رقباء",
    "ملازم", "ملازم اول", "نقيب", "رائد",
    "مقدم", "عقيد", "عميد",
    "لواء", "فريق", "فريق اول",
],
    DEFAULT_POINTS_PER_RANK: 20,

    DEFAULT_LEAVE_BALANCE: 10,

    VIOLATION_TYPES: [
        "تجاوز السرعة المحددة",
        "القيادة العكسية",
        "التفحيط / القيادة المتهورة",
        "تظليل كتم",
        "تظليل نيكل",
        "صدم مركبات امنيه/مواطنين",
        "هروب من رجال الامن",
        "الهروب من نقطة تفتيش",
    ],

    POINTS_ON_APPROVE: 1,
    POINTS_ON_REJECT: 1,
    MAX_PENDING_ITEMS: 5,
    MAX_VEHICLES_ADD: 60,
    MAX_PHOTO_MB: 3,

    ANTI_DRUGS_ROLE_ID: "1500064767082233926",
    REPORT_POINTS_APPROVE: 2,
    REPORT_POINTS_REJECT: 1,

    PATROL_ROLE_ID: process.env.PATROL_ROLE_ID || "1500064443537686588",
    ROAD_SECURITY_ROLE_ID: process.env.ROAD_SECURITY_ROLE_ID || "1533192878510178304",

    SECTORS: {
        patrol: "الدوريات",
        roadSecurity: "أمن الطرق",
        antiDrugs: "مكافحة المخدرات",
    },

    MILITARY_POLICE_ROLE_ID: process.env.MILITARY_POLICE_ROLE_ID || "1545415273438249010",
    MP_SUMMON_VOICE_URL: "https://discord.com/channels/1497233353030766662/1545415195243843644",
    MP_REPORT_POINTS_APPROVE: 1,

    WARNING_PENALTIES: [
        { id: "deduct5",          label: "خصم 5 نقاط",                        type: "points",  value: 5 },
        { id: "deduct10",         label: "خصم 10 نقاط",                       type: "points",  value: 10 },
        { id: "resetPoints",      label: "تصفير النقاط بالكامل",              type: "resetPoints" },
        { id: "demote1",          label: "تنزيل رتبة واحدة",                  type: "demote",  ranks: 1 },
        { id: "demote2",          label: "تنزيل رتبتين",                      type: "demote",  ranks: 2 },
        { id: "demoteToFirst",    label: "تنزيل للرتبة الأولى (جندي)",        type: "demoteToFirst" },
        { id: "suspend3",         label: "إيقاف 3 أيام",                      type: "suspend", days: 3 },
        { id: "suspend5",         label: "إيقاف 5 أيام",                      type: "suspend", days: 5 },
        { id: "suspend7",         label: "إيقاف 7 أيام",                      type: "suspend", days: 7 },
        { id: "demote1_suspend3", label: "تنزيل رتبة واحدة + إيقاف 3 أيام",   type: "combo",   ranks: 1, days: 3 },
        { id: "deduct10_suspend5",label: "خصم 10 نقاط + إيقاف 5 أيام",        type: "combo",   value: 10, days: 5 },
        { id: "dismiss",          label: "فصل نهائي من الخدمة العسكرية",      type: "dismiss" },
    ],
};

mongoose.connect(CONFIG.MONGO_URI)
    .then(async () => { console.log("✅ MongoDB connected"); await ensureSeniorAccount(); await ensureCardNumbers(); await ensureSectorFields(); })
    .catch(err => console.log("❌ MongoDB error:", err));

const PersonnelSchema = new mongoose.Schema({
    discord: { type: String, required: true, unique: true },
    discordTag: String,
    registeredName: { type: String, default: null },
    unit: { type: String, default: null },
    rank: { type: String, default: "جندي" },
    points: { type: Number, default: 0 },
    notes: [{
        text: String, image: { type: String, default: null },
        imageChannelId: { type: String, default: null }, imageMessageId: { type: String, default: null },
        reviewDeadline: { type: Date, default: null },
        reviewNotified: { type: Boolean, default: false },
        addedBy: String, addedByTag: String,
        createdAt: { type: Date, default: Date.now }
    }],
    summon: {
        status: { type: String, enum: ["none", "pending", "approved"], default: "none" },
        mode: { type: String, default: null },
        timeLabel: { type: String, default: null },
        unlockAt: { type: Date, default: null },
        requestedBy: { type: String, default: null }, requestedByTag: { type: String, default: null },
        setBy: { type: String, default: null }, setByTag: { type: String, default: null }, setAt: { type: Date, default: null },
        enteredAt: { type: Date, default: null },
    },
    warnings: [{
        kind: { type: String, enum: ["warning", "notice", "note-review"], default: "warning" },
        reason: String,
        issuedBy: String, issuedByTag: String,
        acknowledged: { type: Boolean, default: false },
        acknowledgedAt: Date,
        warningNumber: { type: Number, default: null },
        pointsDeducted: { type: Number, default: 0 },
        penaltyType: { type: String, default: null },
        penaltyLabel: { type: String, default: null },
        noteReviewTargetDiscord: { type: String, default: null },
        noteReviewTargetName: { type: String, default: null },
        noteReviewNoteId: { type: String, default: null },
        noteReviewText: { type: String, default: null },
        noteReviewSectorLabel: { type: String, default: null },
        createdAt: { type: Date, default: Date.now }
    }],
    isBlocked: { type: Boolean, default: false },
    blockUntil: { type: Date, default: null },
    isDismissed: { type: Boolean, default: false },
    leaveBalance: { type: Number, default: 10 },
    cardNumber: { type: String, default: null, index: true },
    sector: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});
const Personnel = mongoose.model("Personnel", PersonnelSchema);

async function genCardNumber() {
    for (let i = 0; i < 30; i++) {
        const n = String(Math.floor(10000000 + Math.random() * 90000000));
        if (!(await Personnel.findOne({ cardNumber: n }, { _id: 1 }).lean())) return n;
    }
    return String(Date.now()).slice(-8);
}
async function ensureCardNumbers() {
    try {
        const cond = { $or: [{ cardNumber: null }, { cardNumber: "" }] };
        const missing = await Personnel.find(cond, { _id: 1 }).limit(1000).lean();
        for (const m of missing) {
            await Personnel.updateOne({ _id: m._id, ...cond }, { $set: { cardNumber: await genCardNumber() } });
        }
    } catch (e) { console.error("❌ فشل توليد أرقام البطاقات:", e.message); }
}

async function ensureSectorFields() {
    try {
        const accs = await Account.find({ status: "approved" }, { uid: 1, sector: 1 }).lean();
        const bySector = {};
        for (const a of accs) { const k = a.sector || ""; (bySector[k] = bySector[k] || []).push(a.uid); }
        for (const [k, uids] of Object.entries(bySector)) {
            await Personnel.updateMany({ discord: { $in: uids }, sector: { $ne: k || null } }, { $set: { sector: k || null } });
        }
    } catch (e) { console.error("❌ فشل مزامنة القطاعات:", e.message); }
}

const AccountSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: String,
    age: Number,
    nationality: String,
    passwordHash: String,
    passwordEnc: String,
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    isSenior: { type: Boolean, default: false },
    isOwner: { type: Boolean, default: false },
    tempSenior: { type: Boolean, default: false },
    sector: { type: String, default: null },
    isMP: { type: Boolean, default: false },
    isOfficer: { type: Boolean, default: false },
    officerRank: { type: String, default: null },
    answers: { available: { type: Boolean, default: false }, capable: { type: Boolean, default: false }, terms: { type: Boolean, default: false } },
    rejectReason: { type: String, default: null },
    reviewedBy: String, reviewedByTag: String, reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },
});
const Account = mongoose.model("Account", AccountSchema);

function newUid() { return "u" + crypto.randomBytes(9).toString("hex"); }
function hashPassword(pw) {
    const salt = crypto.randomBytes(16);
    const h = crypto.scryptSync(pw, salt, 64);
    return salt.toString("hex") + ":" + h.toString("hex");
}
function verifyPassword(pw, stored) {
    if (!stored || typeof stored !== "string") return false;
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex) return false;
    const calc = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
    const hb = Buffer.from(hashHex, "hex");
    return hb.length === calc.length && crypto.timingSafeEqual(hb, calc);
}
const ACC_ENC_KEY = crypto.createHash("sha256").update("acc-key:" + CONFIG.SESSION_SECRET).digest();
function encryptText(t) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", ACC_ENC_KEY, iv);
    const enc = Buffer.concat([c.update(String(t), "utf8"), c.final()]);
    return [iv, c.getAuthTag(), enc].map(x => x.toString("base64")).join(":");
}
function decryptText(str) {
    try {
        const [iv, tag, enc] = String(str || "").split(":").map(x => Buffer.from(x, "base64"));
        const d = crypto.createDecipheriv("aes-256-gcm", ACC_ENC_KEY, iv);
        d.setAuthTag(tag);
        return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
    } catch (e) { return null; }
}

const seniorUids = new Set();
const ownerUids = new Set();
let STEALTH_MODE = false;
async function refreshSeniors() {
    const list = await Account.find({ $or: [{ isSenior: true }, { isOwner: true }], status: "approved" }, { uid: 1, isOwner: 1 }).lean();
    seniorUids.clear(); ownerUids.clear();
    list.forEach(a => { seniorUids.add(a.uid); if (a.isOwner) ownerUids.add(a.uid); });
}
function isOwnerUid(userId) { return ownerUids.has(userId); }
function hiddenOwnerIds(req) {
    if (req && req.user && ownerUids.has(req.user.id)) return [];
    return Array.from(ownerUids);
}
async function ensureOwnerAccount() {
    try {
        if (!CONFIG.OWNER_PASSWORD) { console.log("ℹ️ OWNER_PASSWORD غير موجود بمتغيرات البيئة — حساب المالك ما انشأ"); return; }
        const email = CONFIG.OWNER_EMAIL;
        let acc = await Account.findOne({ email });
        if (!acc) {
            acc = await Account.create({
                uid: newUid(), email, fullName: "كبير المسؤولين", age: 30, nationality: "سعودي",
                passwordHash: hashPassword(CONFIG.OWNER_PASSWORD), passwordEnc: encryptText(CONFIG.OWNER_PASSWORD),
                status: "approved", isSenior: true, isOwner: true,
                answers: { available: true, capable: true, terms: true },
            });
        } else if (!acc.isOwner) {
            acc.isOwner = true; acc.isSenior = true; acc.status = "approved"; acc.tempSenior = false; acc.sector = null; acc.isMP = false;
            acc.passwordHash = hashPassword(CONFIG.OWNER_PASSWORD); acc.passwordEnc = encryptText(CONFIG.OWNER_PASSWORD);
            await acc.save();
        }
        await Personnel.findOneAndUpdate(
            { discord: acc.uid },
            { $set: { registeredName: acc.fullName, discordTag: acc.fullName }, $setOnInsert: { unit: "غير محدد" } },
            { upsert: true }
        );
    } catch (e) { console.error("❌ فشل إنشاء حساب المالك:", e.message); }
}
function safeEqual(a, b) {
    const ha = crypto.createHash("sha256").update(String(a)).digest();
    const hb = crypto.createHash("sha256").update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}
async function createFreshSeniorAccount() {
    const defEmail = CONFIG.ADMIN_EMAIL.toLowerCase();
    const at = defEmail.indexOf("@");
    const domain = at >= 0 ? defEmail.slice(at + 1) : "moi.sa.com";
    let email = null;
    for (let i = 0; i < 20; i++) {
        const cand = "senior-" + crypto.randomBytes(3).toString("hex") + "@" + domain;
        if (!(await Account.findOne({ email: cand }, { _id: 1 }).lean())) { email = cand; break; }
    }
    if (!email) email = "senior-" + Date.now() + "@" + domain;
    const pw = CONFIG.ADMIN_PASSWORD;
    const acc = await Account.create({
        uid: newUid(), email, fullName: "كبير المسؤولين", age: 30, nationality: "سعودي",
        passwordHash: hashPassword(pw), passwordEnc: encryptText(pw),
        status: "approved", isSenior: true, tempSenior: true,
        answers: { available: true, capable: true, terms: true },
    });
    await refreshSeniors();
    await logEvent({ action: "إنشاء حساب كبير مسؤولين جديد", actorId: acc.uid, actorTag: acc.fullName, details: email });
    return acc;
}
async function ensureSeniorAccount() {
    try {
        await ensureOwnerAccount();
        await refreshSeniors();
        if (!seniorUids.size) console.log("ℹ️ ما فيه حسابات كبار مسؤولين — سجّل دخول بإيميل وكلمة المرور الافتراضية (ADMIN_EMAIL / ADMIN_PASSWORD) وينشأ لك حساب جديد");
    } catch (e) { console.error("❌ فشل تحميل حسابات كبار المسؤولين:", e.message); }
}

const ViolationSchema = new mongoose.Schema({
    reporterDiscord: String,
    reporterTag: String,
    reporterName: String,
    reporterUnit: String,
    violationType: String,
    vehicle: String,
    vehiclePhoto: { type: String, default: null },
    plateNumber: String,
    photo: { type: String, default: null },
    photoChannelId: { type: String, default: null },
    photoMessageId: { type: String, default: null },
    status: { type: String, default: "pending" },
    rejectReason: { type: String, default: null },
    reviewedBy: String,
    reviewedByTag: String,
    reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },

    kind: { type: String, enum: ["violation", "report"], default: "violation" },
    reportCategory: { type: String, default: null },
    suspectName: { type: String, default: null },
    arrestLocation: { type: String, default: null },
    stopReason: { type: String, default: null },
    seizedItems: { type: String, default: null },
    securityActions: { type: [String], default: [] },

    drugType: { type: String, default: null },
    drugQuantity: { type: String, default: null },
    concealMethod: { type: String, default: null },
});
ViolationSchema.index({ status: 1, reviewedAt: -1 });
ViolationSchema.index({ reporterDiscord: 1, createdAt: -1 });
const Violation = mongoose.model("Violation", ViolationSchema);

const PromotionRequestSchema = new mongoose.Schema({
    sector: String,
    sectorLabel: String,
    targetDiscord: String,
    targetTag: String,
    targetName: String,
    fromRank: String,
    toRank: String,
    direction: { type: String, enum: ["up", "down"] },
    reason: { type: String, default: null },
    requestedBy: String,
    requestedByTag: String,
    status: { type: String, default: "pending" },
    rejectReason: { type: String, default: null },
    reviewedBy: String,
    reviewedByTag: String,
    reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },
});
PromotionRequestSchema.index({ sector: 1, status: 1, createdAt: -1 });
const PromotionRequest = mongoose.model("PromotionRequest", PromotionRequestSchema);

const MPReportSchema = new mongoose.Schema({
    reporterDiscord: String, reporterTag: String, reporterName: String, reporterRank: String,
    dutyReport: String,
    patrolsCount: { type: Number, default: 0 },
    summonsCount: { type: Number, default: 0 },
    incidents: { type: String, default: "" },
    notesIssued: [{
        discord: String, tag: String, name: String,
        kind: { type: String, enum: ["note", "warning"], default: "note" },
        reason: String,
    }],
    generalNotes: { type: String, default: "" },
    status: { type: String, default: "pending" },
    rejectReason: { type: String, default: null },
    reviewedBy: String, reviewedByTag: String, reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },
});
MPReportSchema.index({ status: 1, createdAt: -1 });
const MPReport = mongoose.model("MPReport", MPReportSchema);

const LeaveRequestSchema = new mongoose.Schema({
    discord: String,
    discordTag: String,
    name: String,
    unit: String,
    rank: String,
    sector: String,
    sectorLabel: String,
    reason: String,
    days: { type: Number, required: true },
    status: { type: String, default: "pending" },
    rejectReason: { type: String, default: null },
    reviewedBy: String,
    reviewedByTag: String,
    reviewedAt: Date,
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endedByTag: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
});
LeaveRequestSchema.index({ discord: 1, createdAt: -1 });
LeaveRequestSchema.index({ sector: 1, status: 1, createdAt: -1 });
const LeaveRequest = mongoose.model("LeaveRequest", LeaveRequestSchema);

const VehicleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    photo: { type: String, default: null },
    addedBy: String,
    createdAt: { type: Date, default: Date.now }
});
const Vehicle = mongoose.model("Vehicle", VehicleSchema);

const LogSchema = new mongoose.Schema({
    discordId: { type: String, default: null },
    discordTag: { type: String, default: null },
    actorId: { type: String, default: null },
    actorTag: { type: String, default: null },
    action: String,
    site: { type: String, default: "فلاش" },
    accountNumber: { type: String, default: null },
    details: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});
const DeviceSessionSchema = new mongoose.Schema({
    uid: String, sid: String, ip: String, ua: String,
    loginAt: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false }
});
DeviceSessionSchema.index({ uid: 1 });
const DeviceSession = mongoose.model("DeviceSession", DeviceSessionSchema);
const Log = mongoose.model("Log", LogSchema);

const SettingsSchema = new mongoose.Schema({
    isMaintenance: { type: Boolean, default: false },
    disableLogin: { type: Boolean, default: false },
    disableViolations: { type: Boolean, default: false },
    logClearUsed: { type: Boolean, default: false },
    interviewLogClearUsed: { type: Boolean, default: false },
    ownerLockdown: { type: Boolean, default: false },
    stealthMode: { type: Boolean, default: false },
    adminList: { type: [String], default: [] },
    rankThresholds: { type: Map, of: Number, default: {} },
    sectorLeadership: {
        patrol: {
            commanderId: { type: String, default: null }, commanderName: { type: String, default: null },
            deputyId: { type: String, default: null }, deputyName: { type: String, default: null },
            personnelOfficerId: { type: String, default: null }, personnelOfficerName: { type: String, default: null },
        },
        roadSecurity: {
            commanderId: { type: String, default: null }, commanderName: { type: String, default: null },
            deputyId: { type: String, default: null }, deputyName: { type: String, default: null },
            personnelOfficerId: { type: String, default: null }, personnelOfficerName: { type: String, default: null },
        },
        antiDrugs: {
            commanderId: { type: String, default: null }, commanderName: { type: String, default: null },
            deputyId: { type: String, default: null }, deputyName: { type: String, default: null },
            personnelOfficerId: { type: String, default: null }, personnelOfficerName: { type: String, default: null },
        },
    },
    mpLeadership: {
        commanderId: { type: String, default: null }, commanderName: { type: String, default: null },
        deputyId: { type: String, default: null }, deputyName: { type: String, default: null },
        personnelOfficerId: { type: String, default: null }, personnelOfficerName: { type: String, default: null },
    },
    highCommand: { type: [{ id: String, name: String }], default: [] },
    violationsOfficerId: { type: String, default: null },
    violationsOfficerName: { type: String, default: null },
    violationsChannelId: String,
    notesChannelId: String,
    warningPenalties: { type: Array, default: [] },
    leaveBalanceDefault: { type: Number, default: 10 },
    lockSavedLogin: { type: Boolean, default: false },
    officersLocked: { type: Boolean, default: false },
}, { minimize: false });
const Settings = mongoose.model("Settings", SettingsSchema);

async function getSettings() {
    let s = await Settings.findOne();
    if (!s) {
        s = await Settings.create({ warningPenalties: CONFIG.WARNING_PENALTIES });
    } else if (!s.warningPenalties || s.warningPenalties.length === 0) {
        s.warningPenalties = CONFIG.WARNING_PENALTIES;
        s.markModified("warningPenalties");
        await s.save();
    }
    STEALTH_MODE = !!s.stealthMode;
    return s;
}

async function logEvent({ action, discordId = null, discordTag = null, actorId = null, actorTag = null, site = "فلاش", accountNumber = null, details = "" }) {
    if (STEALTH_MODE && actorId && isOwnerUid(actorId)) return;
    try { await Log.create({ action, discordId, discordTag, actorId, actorTag, site, accountNumber, details }); } catch (e) { }
}

function generatePlate() {
    const letters = "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ";
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${pick()} ${pick()} ${pick()} - ${num}`;
}

function rankIndex(rank) {
    const i = CONFIG.MILITARY_RANKS.indexOf(rank);
    return i === -1 ? 0 : i;
}

function isSeniorAdmin(userId) {
    return seniorUids.has(userId);
}
function isBotAdmin(discordUserId) {
    return CONFIG.BOT_ADMIN_IDS.includes(discordUserId);
}

async function isAnyAdmin(userId) {
    if (isSeniorAdmin(userId)) return true;
    const settings = await getSettings();
    return settings.adminList.includes(userId);
}

async function getThreshold(rank, settings) {
    const s = settings || await getSettings();
    const t = s.rankThresholds && typeof s.rankThresholds.get === "function" ? s.rankThresholds.get(rank) : undefined;
    return (t !== undefined && t !== null) ? t : CONFIG.DEFAULT_POINTS_PER_RANK;
}

async function rankProgress(p, settings) {
    const idx = rankIndex(p.rank);
    const isMax = idx >= CONFIG.MILITARY_RANKS.length - 1;
    const nextRank = isMax ? null : CONFIG.MILITARY_RANKS[idx + 1];
    const threshold = isMax ? 0 : await getThreshold(p.rank, settings);
    const remaining = isMax ? 0 : Math.max(0, threshold - p.points);
    return { currentRank: p.rank, nextRank, threshold, remaining };
}

const agingNoteCheckThrottle = new Map();
const AGING_CHECK_COOLDOWN_MS = 60 * 60 * 1000;
async function checkAgingNotesForSector(sectorKey, sectorLabel, settings) {
    const sl = (settings.sectorLeadership || {})[sectorKey] || {};
    const notifyIds = [sl.commanderId, sl.deputyId].filter(Boolean);
    if (!notifyIds.length) return;
    const ids = await getSectorMemberIds(sectorKey);
    if (!ids || !ids.length) return;
    const now = new Date();
    const people = await Personnel.find({ discord: { $in: ids }, "notes.0": { $exists: true } });
    for (const p of people) {
        let changed = false;
        for (const n of p.notes) {
            if (!n.reviewNotified && n.reviewDeadline && n.reviewDeadline <= now) {
                n.reviewNotified = true;
                changed = true;
                for (const targetId of notifyIds) {
                    await Personnel.findOneAndUpdate({ discord: targetId }, { $push: { warnings: {
                        kind: "note-review",
                        reason: `📋 وصلت ملاحظة على ${p.registeredName || p.discordTag} إلى 5 أيام بدون إجراء.`,
                        noteReviewTargetDiscord: p.discord,
                        noteReviewTargetName: p.registeredName || p.discordTag,
                        noteReviewNoteId: n._id.toString(),
                        noteReviewText: n.text,
                        noteReviewSectorLabel: sectorLabel,
                        issuedBy: "system", issuedByTag: "النظام",
                    } } });
                }
            }
        }
        if (changed) await p.save();
    }
}

async function autoEndActiveLeave(discordId) {
    const leave = await LeaveRequest.findOne({ discord: discordId, status: "approved" });
    if (!leave) return;
    const now = new Date();
    const expired = leave.endDate && leave.endDate <= now;
    leave.status = "completed";
    leave.endedAt = now;
    leave.endedByTag = expired ? "تلقائي (انتهت المدة)" : "تلقائي (دخول للموقع أثناء الإجازة)";
    await leave.save();
    await logEvent({
        action: "إنهاء إجازة تلقائي", discordId: leave.discord, discordTag: leave.discordTag,
        actorId: "system", actorTag: "النظام", details: leave.endedByTag,
    });
}

function getSectorRole(userId, settings) {
    const sl = settings.sectorLeadership || {};
    for (const key of Object.keys(CONFIG.SECTORS)) {
        const sec = sl[key];
        if (!sec) continue;
        if (sec.commanderId === userId) return { sector: key, sectorLabel: CONFIG.SECTORS[key], role: "commander" };
        if (sec.deputyId === userId) return { sector: key, sectorLabel: CONFIG.SECTORS[key], role: "deputy" };
    }
    return null;
}

function getPersonnelOfficerSector(userId, settings) {
    const sl = settings.sectorLeadership || {};
    for (const key of Object.keys(CONFIG.SECTORS)) {
        const sec = sl[key];
        if (sec && sec.personnelOfficerId === userId) return { sector: key, sectorLabel: CONFIG.SECTORS[key] };
    }
    return null;
}

function isJuniorRank(rank) {
    return rankIndex(rank) <= rankIndex("رئيس رقباء");
}

function getMPRole(userId, settings) {
    const sl = settings.mpLeadership || {};
    if (sl.commanderId === userId) return "commander";
    if (sl.deputyId === userId) return "deputy";
    return null;
}
function isMPPersonnelOfficer(userId, settings) {
    const sl = settings.mpLeadership || {};
    return !!(sl.personnelOfficerId && sl.personnelOfficerId === userId);
}
function isHighCommand(userId, settings) {
    return !!(settings.highCommand || []).find(m => m.id === userId);
}
function isViolationsOfficer(userId, settings) {
    return !!(settings.violationsOfficerId && settings.violationsOfficerId === userId);
}
function computeSummonUnlockAt(mode, hour, minute, ampm) {
    if (mode !== "scheduled") return new Date();
    let h = parseInt(hour, 10) % 12;
    if (ampm === "مساء") h += 12;
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(h, parseInt(minute, 10) || 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d;
}
function isSummonBlocking(p) {
    return !!(p && p.summon && p.summon.status === "approved");
}

function sectorRoleId(sectorKey) {
    if (sectorKey === "patrol") return CONFIG.PATROL_ROLE_ID;
    if (sectorKey === "roadSecurity") return CONFIG.ROAD_SECURITY_ROLE_ID;
    if (sectorKey === "antiDrugs") return CONFIG.ANTI_DRUGS_ROLE_ID;
    return null;
}

let guildMembersFetch = { time: 0, promise: null };
async function ensureGuildMembersFetched(guild) {
    const now = Date.now();
    if (guildMembersFetch.promise && (now - guildMembersFetch.time) < 30000) {
        return guildMembersFetch.promise;
    }
    guildMembersFetch.time = now;
    guildMembersFetch.promise = guild.members.fetch().catch(e => { guildMembersFetch.promise = null; throw e; });
    return guildMembersFetch.promise;
}
async function getSectorMemberIds(sectorKey) {
    try {
        const list = await Account.find({ status: "approved", sector: sectorKey }, { uid: 1 }).lean();
        return list.map(a => a.uid);
    } catch (e) {
        console.error("❌ فشل جلب أعضاء القطاع:", e.message);
        return null;
    }
}

async function pointsForReachingRank(rankName, settings) {
    const idx = rankIndex(rankName);
    if (idx <= 0) return 0;
    const prevRank = CONFIG.MILITARY_RANKS[idx - 1];
    return await getThreshold(prevRank, settings);
}

async function checkAutoPromotion(discordId) {
    const settings = await getSettings();
    const p = await Personnel.findOne({ discord: discordId });
    if (!p) return;
    let promoted = false;
    let guard = 0;
    const startRank = p.rank;
    while (guard++ < CONFIG.MILITARY_RANKS.length) {
        const idx = rankIndex(p.rank);
        if (idx >= CONFIG.MILITARY_RANKS.length - 1) break;
        const threshold = await getThreshold(p.rank, settings);
        if (threshold <= 0 || p.points < threshold) break;
        const oldRank = p.rank;
        p.rank = CONFIG.MILITARY_RANKS[idx + 1];
        p.points -= threshold;
        promoted = true;
        await logEvent({ action: "ترقية تلقائية", discordId, discordTag: p.discordTag, actorId: "نظام تلقائي", actorTag: "🤖 نظام تلقائي", details: `${oldRank} ← ${p.rank} (وصل للنقاط المطلوبة)` });
    }
    if (promoted) {
        p.warnings.push({
            kind: "notice",
            reason: `🎉 مبروك! تمت ترقيتك تلقائياً من ${startRank} إلى ${p.rank} لوصولك للنقاط المطلوبة.`,
            issuedBy: "نظام تلقائي", issuedByTag: "🤖 نظام تلقائي",
        });
        await p.save();
        notifyHighCommandOfAutoPromotion(p, startRank, p.rank).catch(() => {});
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

const pendingMessages = new Map();
let botReady = false;

async function isMilitary(uid) {
    try {
        const a = await Account.findOne({ uid, status: "approved" }).lean();
        if (!a) return { ok: false, reason: "حسابك غير مقبول" };
        return { ok: true, isAntiDrugs: a.sector === "antiDrugs" };
    } catch (e) {
        console.error("❌ isMilitary خطأ:", e.message);
        return { ok: false, reason: e.message };
    }
}

async function sendSummonDM(discordId, timeLabel) {
    if (!botReady) return;
    try {
        const user = await client.users.fetch(discordId);
        const embed = new EmbedBuilder()
            .setTitle("📣 لديك استدعاء")
            .setColor(0xf59e0b)
            .setDescription(`عليك استدعاء من الشرطة العسكرية.\n**الوقت:** ${timeLabel || "الآن"}`)
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("🚪 دخول الاستدعاء").setStyle(ButtonStyle.Link).setURL(CONFIG.MP_SUMMON_VOICE_URL),
        );
        await user.send({ content: `<@${discordId}>`, embeds: [embed], components: [row] });
    } catch (e) {
        console.error("❌ فشل إرسال رسالة الاستدعاء الخاصة:", e.message);
    }
}

async function isMilitaryPoliceMember(uid) {
    try {
        const a = await Account.findOne({ uid, status: "approved" }, { isMP: 1 }).lean();
        return !!(a && a.isMP);
    } catch (e) { return false; }
}
async function getMilitaryPoliceMemberIds() {
    try {
        const list = await Account.find({ status: "approved", isMP: true }, { uid: 1 }).lean();
        return list.map(a => a.uid);
    } catch (e) {
        console.error("❌ فشل جلب أعضاء الشرطة العسكرية:", e.message);
        return null;
    }
}

async function getMemberSectorKey(uid) {
    try {
        const a = await Account.findOne({ uid, status: "approved" }, { sector: 1 }).lean();
        return a ? (a.sector || null) : null;
    } catch (e) {
        console.error("❌ getMemberSectorKey خطأ:", e.message);
        return null;
    }
}

function buildViolationEmbed(v) {
    if (v.kind === "report") {
        const fields = [
            { name: "اسم العسكري", value: v.reporterName || "-", inline: true },
            { name: "اليونت", value: v.reporterUnit || "-", inline: true },
            { name: "نوع التقرير", value: v.reportCategory || "-", inline: true },
            { name: "اسم المتهم", value: v.suspectName || "-", inline: true },
            { name: "موقع الضبط", value: v.arrestLocation || "-", inline: true },
            { name: "المركبة", value: v.vehicle || "-", inline: true },
            { name: "سبب الاستيقاف", value: v.stopReason || "-", inline: false },
        ];
        if (v.reportCategory === "مخدرات") {
            fields.push(
                { name: "نوع المخدر المضبوط", value: v.drugType || "-", inline: true },
                { name: "الكمية المضبوطة", value: v.drugQuantity || "-", inline: true },
                { name: "طريقة إخفاء المخدر", value: v.concealMethod || "-", inline: false },
            );
        } else {
            fields.push({ name: "المضبوطات", value: v.seizedItems || "-", inline: false });
        }
        fields.push({ name: "الإجراءات الأمنية المتخذة", value: (v.securityActions && v.securityActions.length) ? v.securityActions.map(a => `- ${a}`).join("\n") : "-", inline: false });
        return new EmbedBuilder()
            .setTitle(`🧪 تقرير مكافحة مخدرات جديد (${v.reportCategory || "-"}) — بانتظار المراجعة`)
            .setColor(0xf59e0b)
            .addFields(fields)
            .setFooter({ text: `ID: ${v._id}` })
            .setTimestamp(v.createdAt);
    }
    return new EmbedBuilder()
        .setTitle("🚨 مخالفة جديدة بانتظار المراجعة")
        .setColor(0xf59e0b)
        .addFields(
            { name: "اسم العسكري", value: v.reporterName || "-", inline: true },
            { name: "اليونت", value: v.reporterUnit || "-", inline: true },
            { name: "نوع المخالفة", value: v.violationType, inline: false },
            { name: "المركبة", value: v.vehicle, inline: true },
            { name: "لوحة السيارة", value: v.plateNumber, inline: true },
        )
        .setFooter({ text: `ID: ${v._id}` })
        .setTimestamp(v.createdAt);
}

function buildViolationButtons(id, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`approve_${id}`).setLabel("قبول").setStyle(ButtonStyle.Success).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`reject_${id}`).setLabel("رفض").setStyle(ButtonStyle.Danger).setDisabled(disabled),
    );
}

async function notifyHighCommandOfPromotion(doc) {
    if (!botReady) return;
    const settings = await getSettings();
    const members = settings.highCommand || [];
    if (!members.length) return;
    const embed = new EmbedBuilder()
        .setTitle("🎖️ يوجد تقرير ترقية عسكرية")
        .setColor(0xf59e0b)
        .addFields(
            { name: "الفرد", value: doc.targetName || doc.targetTag, inline: true },
            { name: "القطاع", value: doc.sectorLabel, inline: true },
            { name: "الاتجاه", value: doc.direction === "up" ? "⬆️ ترقية" : "⬇️ تنزيل", inline: true },
            { name: "من رتبة", value: doc.fromRank, inline: true },
            { name: "إلى رتبة", value: doc.toRank, inline: true },
            { name: "مقدّم الطلب", value: doc.requestedByTag || "-", inline: false },
            { name: "السبب", value: doc.reason || "-", inline: false },
        )
        .setFooter({ text: `ID: ${doc._id}` })
        .setTimestamp(doc.createdAt || new Date());
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("🔵 اضغط هنا لدخول فلاش").setStyle(ButtonStyle.Link).setURL(CONFIG.SITE_URL),
    );
    for (const m of members) {
        try {
            const user = await client.users.fetch(m.id);
            await user.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error("❌ فشل إرسال إشعار الترقية لعضو القيادة العليا:", m.id, e.message);
        }
    }
}

async function notifyHighCommandOfPoints(doc) {
    if (!botReady) return;
    const settings = await getSettings();
    const members = settings.highCommand || [];
    if (!members.length) return;
    const embed = new EmbedBuilder()
        .setTitle("✏️ تعديل نقاط عسكري")
        .setColor(0x3b82f6)
        .addFields(
            { name: "الفرد", value: doc.targetName || doc.targetTag, inline: true },
            { name: "من نقاط", value: String(doc.oldPoints), inline: true },
            { name: "إلى نقاط", value: String(doc.newPoints), inline: true },
            { name: "الفرق", value: (doc.delta >= 0 ? "+" : "") + doc.delta, inline: true },
            { name: "بواسطة", value: doc.actorTag || "-", inline: false },
            { name: "السبب", value: doc.reason || "-", inline: false },
        )
        .setTimestamp(new Date());
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("🔵 اضغط هنا لدخول فلاش").setStyle(ButtonStyle.Link).setURL(CONFIG.SITE_URL),
    );
    for (const m of members) {
        try {
            const user = await client.users.fetch(m.id);
            await user.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error("❌ فشل إرسال إشعار تعديل النقاط لعضو القيادة العليا:", m.id, e.message);
        }
    }
}

async function notifyHighCommandOfAutoPromotion(p, fromRank, toRank) {
    if (!botReady) return;
    const settings = await getSettings();
    const members = settings.highCommand || [];
    if (!members.length) return;
    const embed = new EmbedBuilder()
        .setTitle("🤖 ترقية تلقائية بوصول النقاط")
        .setColor(0x22c55e)
        .addFields(
            { name: "الفرد", value: p.registeredName || p.discordTag, inline: true },
            { name: "من رتبة", value: fromRank, inline: true },
            { name: "إلى رتبة", value: toRank, inline: true },
        )
        .setFooter({ text: "وصل للنقاط المطلوبة للترقية تلقائياً" })
        .setTimestamp(new Date());
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("🔵 اضغط هنا لدخول فلاش").setStyle(ButtonStyle.Link).setURL(CONFIG.SITE_URL),
    );
    for (const m of members) {
        try {
            const user = await client.users.fetch(m.id);
            await user.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error("❌ فشل إرسال إشعار الترقية التلقائية لعضو القيادة العليا:", m.id, e.message);
        }
    }
}

async function postViolationToChannel(v, rawPhoto) {
    const settings = await getSettings();
    if (!botReady || !settings.violationsChannelId) {
        if (rawPhoto) { v.photo = rawPhoto; await v.save().catch(() => {}); }
        return;
    }
    try {
        const channel = await client.channels.fetch(settings.violationsChannelId);
        const embed = buildViolationEmbed(v);
        const components = [buildViolationButtons(v._id.toString())];
        const files = [];
        if (rawPhoto && rawPhoto.startsWith("data:image")) {
            const base64Data = rawPhoto.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");
            const ext = rawPhoto.includes("image/png") ? "png" : "jpg";
            const fname = `violation_${v._id}.${ext}`;
            files.push(new AttachmentBuilder(buffer, { name: fname }));
        }
        const msg = await channel.send({ embeds: [embed], components, files });
        pendingMessages.set(v._id.toString(), { channelId: msg.channelId, messageId: msg.id });
        if (rawPhoto) {
            v.photoChannelId = msg.channelId;
            v.photoMessageId = msg.id;
            await v.save();
        }
    } catch (e) {
        console.error("❌ فشل إرسال المخالفة للقناة:", e.message);
        if (rawPhoto) { v.photo = rawPhoto; await v.save().catch(() => {}); }
    }
}

function buildNoteEmbed(personnelName, personnelDiscord, text, addedByTag) {
    return new EmbedBuilder()
        .setTitle("📝 ملاحظة جديدة")
        .setColor(0xfacc15)
        .addFields(
            { name: "العسكري", value: personnelName || personnelDiscord, inline: true },
            { name: "بواسطة", value: addedByTag || "-", inline: true },
            { name: "النص", value: text || "-", inline: false },
        )
        .setTimestamp();
}
async function postNoteToChannel(personnelDiscord, personnelName, text, addedByTag, rawImage) {
    const settings = await getSettings();
    if (!botReady || !settings.notesChannelId || !rawImage) return null;
    try {
        const channel = await client.channels.fetch(settings.notesChannelId);
        const embed = buildNoteEmbed(personnelName, personnelDiscord, text, addedByTag);
        const files = [];
        if (rawImage.startsWith("data:image")) {
            const base64Data = rawImage.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");
            const ext = rawImage.includes("image/png") ? "png" : "jpg";
            files.push(new AttachmentBuilder(buffer, { name: `note_${Date.now()}.${ext}` }));
        }
        const msg = await channel.send({ embeds: [embed], files });
        return { channelId: msg.channelId, messageId: msg.id };
    } catch (e) {
        console.error("❌ فشل إرسال الملاحظة للقناة:", e.message);
        return null;
    }
}
async function pushNoteWithImage({ discord, text, image, actorId, actorTag }) {
    const p = await Personnel.findOne({ discord });
    if (!p) return null;
    p.notes.push({ text, image, addedBy: actorId, addedByTag: actorTag, reviewDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    const note = p.notes[p.notes.length - 1];
    await p.save();
    const uploaded = await postNoteToChannel(p.discord, p.registeredName || p.discordTag || p.discord, text, actorTag, image);
    if (uploaded) {
        note.imageChannelId = uploaded.channelId;
        note.imageMessageId = uploaded.messageId;
        note.image = null;
        await p.save();
    }
    return p;
}


async function syncViolationMessage(v) {
    const ref = pendingMessages.get(v._id.toString());
    if (!ref) return;
    try {
        const channel = await client.channels.fetch(ref.channelId);
        const msg = await channel.messages.fetch(ref.messageId);
        const color = v.status === "approved" ? 0x22c55e : v.status === "rejected" ? 0xef4444 : 0xf59e0b;
        const isReport = v.kind === "report";
        const title = v.status === "approved" ? (isReport ? "✅ تقرير مكافحة مخدرات مقبول" : "✅ مخالفة مقبولة")
            : v.status === "rejected" ? (isReport ? "❌ تقرير مكافحة مخدرات مرفوض" : "❌ مخالفة مرفوضة")
            : (isReport ? `🧪 تقرير مكافحة مخدرات جديد (${v.reportCategory || "-"}) — بانتظار المراجعة` : "🚨 مخالفة جديدة بانتظار المراجعة");
        const oldEmbed = msg.embeds[0] ? EmbedBuilder.from(msg.embeds[0]) : buildViolationEmbed(v);
        const embed = oldEmbed.setColor(color).setTitle(title);
        await msg.edit({ embeds: [embed], components: [buildViolationButtons(v._id.toString(), v.status !== "pending")] });
    } catch (e) { }
    if (v.status !== "pending") pendingMessages.delete(v._id.toString());
}

async function approveViolation(v, actorId, actorTag) {
    const reporter = await Personnel.findOne({ discord: v.reporterDiscord });
    if (isSummonBlocking(reporter)) return { blocked: true };
    v.status = "approved"; v.reviewedBy = actorId; v.reviewedByTag = actorTag; v.reviewedAt = new Date();
    await v.save();
    const pts = v.kind === "report" ? CONFIG.REPORT_POINTS_APPROVE : CONFIG.POINTS_ON_APPROVE;
    await Personnel.findOneAndUpdate({ discord: v.reporterDiscord }, { $inc: { points: pts } });
    await checkAutoPromotion(v.reporterDiscord);
    await syncViolationMessage(v);
    const label = v.kind === "report" ? `تقرير مكافحة مخدرات (${v.reportCategory})` : v.violationType;
    await logEvent({ action: v.kind === "report" ? "قبول تقرير" : "قبول مخالفة", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId, actorTag, details: `${label} — ${v.reporterName}` });
    return { blocked: false };
}

async function rejectViolation(v, actorId, actorTag, reason) {
    const reporter = await Personnel.findOne({ discord: v.reporterDiscord });
    if (isSummonBlocking(reporter)) return { blocked: true };
    v.status = "rejected"; v.rejectReason = reason; v.reviewedBy = actorId; v.reviewedByTag = actorTag; v.reviewedAt = new Date();
    await v.save();
    const pts = v.kind === "report" ? CONFIG.REPORT_POINTS_REJECT : CONFIG.POINTS_ON_REJECT;
    await Personnel.findOneAndUpdate({ discord: v.reporterDiscord }, { $inc: { points: -pts } });
    await Personnel.updateOne({ discord: v.reporterDiscord, points: { $lt: 0 } }, { $set: { points: 0 } });
    await syncViolationMessage(v);
    const rlabel = v.kind === "report" ? `تقرير مكافحة مخدرات (${v.reportCategory})` : v.violationType;
    await logEvent({ action: v.kind === "report" ? "رفض تقرير" : "رفض مخالفة", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId, actorTag, details: `${rlabel} — ${v.reporterName} — السبب: ${reason}` });
    return { blocked: false };
}

const commands = [
    new SlashCommandBuilder()
        .setName("حظر")
        .setDescription("حظر عسكري من الموقع (كبار المسؤولين فقط)")
        .addUserOption(o => o.setName("اللاعب").setDescription("العسكري المطلوب حظره").setRequired(true))
        .addStringOption(o => o.setName("السبب").setDescription("سبب الحظر").setRequired(true)),

    new SlashCommandBuilder()
        .setName("فك-حظر")
        .setDescription("فك حظر عسكري عن الموقع (كبار المسؤولين فقط)")
        .addUserOption(o => o.setName("اللاعب").setDescription("العسكري المطلوب فك حظره").setRequired(true)),
].map(c => c.toJSON());

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(CONFIG.BOT_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID), { body: commands });
        console.log("✅ تم تسجيل أوامر السلاش");
    } catch (e) {
        console.log("❌ خطأ بتسجيل الأوامر:", e);
    }
}

client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;

            if (commandName === "حظر") {
                if (!isBotAdmin(interaction.user.id)) {
                    return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
                }
                const target = interaction.options.getUser("اللاعب");
                const reason = interaction.options.getString("السبب");
                await Personnel.findOneAndUpdate(
                    { discord: target.id },
                    {
                        $set: { isBlocked: true },
                        $push: { notes: { text: `🚫 حظر من الموقع — السبب: ${reason}`, addedBy: interaction.user.id, addedByTag: interaction.user.username } },
                        $setOnInsert: { discordTag: target.username },
                    },
                    { upsert: true }
                );
                await logEvent({ action: "حظر عسكري (أمر)", discordId: target.id, discordTag: target.username, actorId: interaction.user.id, actorTag: interaction.user.username, details: `السبب: ${reason}` });
                return interaction.reply({ content: `🚫 تم حظر <@${target.id}> من الموقع.\n📝 السبب: ${reason}`, ephemeral: true });
            }

            if (commandName === "فك-حظر") {
                if (!isBotAdmin(interaction.user.id)) {
                    return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
                }
                const target = interaction.options.getUser("اللاعب");
                const p = await Personnel.findOneAndUpdate({ discord: target.id }, { isBlocked: false }, { new: true });
                if (!p) return interaction.reply({ content: "❌ هذا اللاعب غير مسجل بالنظام أصلاً.", ephemeral: true });
                await logEvent({ action: "فك حظر عسكري (أمر)", discordId: target.id, discordTag: target.username, actorId: interaction.user.id, actorTag: interaction.user.username });
                return interaction.reply({ content: `✅ تم فك حظر <@${target.id}> من الموقع.`, ephemeral: true });
            }
            return;
        }

        if (interaction.isButton()) {
            const id = interaction.customId;

            if (id.startsWith("approve_") || id.startsWith("reject_")) {
                const [action, vid] = id.split("_");
                const allowed = await isAnyAdmin(interaction.user.id);
                const isDiscordAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
                if (!allowed && !isDiscordAdmin) {
                    return interaction.reply({ content: "🚫 ما تملك صلاحية.", ephemeral: true });
                }
                const v = await Violation.findById(vid);
                if (!v || v.status !== "pending") {
                    return interaction.reply({ content: "هذه المخالفة تمت مراجعتها مسبقاً.", ephemeral: true });
                }
                if (action === "approve") {
                    await approveViolation(v, interaction.user.id, interaction.user.username);
                    return interaction.deferUpdate();
                }
                if (action === "reject") {
                    const modal = new ModalBuilder().setCustomId(`rejectmodal_${vid}`).setTitle("سبب الرفض");
                    const input = new TextInputBuilder()
                        .setCustomId("reason").setLabel("اكتب سبب رفض المخالفة")
                        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    return interaction.showModal(modal);
                }
                return;
            }

            return;
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith("rejectmodal_")) {
                const vid = interaction.customId.split("_")[1];
                const reason = interaction.fields.getTextInputValue("reason");
                const v = await Violation.findById(vid);
                if (!v || v.status !== "pending") {
                    return interaction.reply({ content: "هذه المخالفة تمت مراجعتها مسبقاً.", ephemeral: true });
                }
                await rejectViolation(v, interaction.user.id, interaction.user.username, reason);
                return interaction.reply({ content: "✅ تم رفض المخالفة وحفظ السبب.", ephemeral: true });
            }
        }
    } catch (e) {
        console.error("❌ خطأ بالتفاعل:", e);
    }
});

const activeVehicleSessions = new Set();
client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith("-")) return;
    const [cmd] = message.content.slice(1).trim().split(/\s+/);
    if (cmd !== "مركبات") return;

    const senior = isBotAdmin(message.author.id);
    if (!senior) return;
    if (activeVehicleSessions.has(message.author.id)) {
        return message.reply("عندك جلسة إضافة مركبات شغالة حالياً، أكملها أول.");
    }
    activeVehicleSessions.add(message.author.id);
    const filter = m => m.author.id === message.author.id;
    try {
        await message.reply(`كم عدد المركبات اللي تبي تضيفها؟ (الأقصى ${CONFIG.MAX_VEHICLES_ADD})`);
        const countCollected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const countMsg = countCollected.first();
        const count = parseInt(countMsg.content.trim());
        if (isNaN(count) || count < 1 || count > CONFIG.MAX_VEHICLES_ADD) {
            activeVehicleSessions.delete(message.author.id);
            return message.reply(`❌ الرقم غير صحيح. لازم يكون بين 1 و ${CONFIG.MAX_VEHICLES_ADD}.`);
        }
        countMsg.delete().catch(() => {});
        const added = [];
        for (let i = 1; i <= count; i++) {
            const p = await message.channel.send(`🚗 اكتب اسم المركبة رقم ${i} من ${count} (يمديك ترفق صورة مع الرسالة):`);
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
            const nameMsg = collected.first();
            const name = nameMsg.content.trim();
            const photo = nameMsg.attachments.first()?.url || null;
            nameMsg.delete().catch(() => {});
            p.delete().catch(() => {});
            if (!name) { i--; continue; }
            try {
                await Vehicle.create({ name, photo, addedBy: message.author.id });
                added.push(name);
            } catch (e) {
                await message.channel.send(`⚠️ المركبة "${name}" موجودة مسبقاً، تم تجاوزها.`);
            }
        }
        await message.channel.send(`✅ تم إضافة ${added.length} مركبة:\n${added.map(n => `• ${n}`).join("\n") || "لا شيء"}`);
    } catch (e) {
        await message.channel.send("⏱️ انتهى الوقت، تم إلغاء العملية.");
    } finally {
        activeVehicleSessions.delete(message.author.id);
    }
});

client.once("ready", async () => {
    console.log(`🤖 البوت شغال: ${client.user.tag}`);
    botReady = true;
    await registerCommands();
});

if (CONFIG.BOT_TOKEN) {
    client.login(CONFIG.BOT_TOKEN).catch(e => console.log("❌ فشل تسجيل دخول البوت:", e.message));
} else {
    console.log("⚠️ BOT_TOKEN غير موجود — البوت لن يعمل، تحقق من متغيرات البيئة");
}

const app = express();

["get", "post", "put", "delete", "patch"].forEach(method => {
    const original = app[method].bind(app);
    app[method] = (path, ...handlers) => {
        const wrapped = handlers.map(h => {
            if (typeof h !== "function") return h;
            return (req, res, next) => {
                Promise.resolve(h(req, res, next)).catch(err => {
                    console.error(`❌ خطأ في ${method.toUpperCase()} ${path}:`, err);
                    if (!res.headersSent) res.status(500).json({ error: "صار خطأ بالسيرفر، حاول مرة ثانية", ok: false });
                });
            };
        });
        return original(path, ...wrapped);
    };
});

app.use(express.json({ limit: "8mb" }));
const sessionStore = new session.MemoryStore();
app.use(session({ secret: CONFIG.SESSION_SECRET, resave: false, saveUninitialized: false, store: sessionStore }));
app.use(passport.initialize());
app.use(passport.session());

const sseClients = new Set();
function sseBroadcast(event, data, filter) {
    const payload = "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";
    for (const c of sseClients) {
        if (filter && !filter(c)) continue;
        try { c.res.write(payload); } catch (e) { sseClients.delete(c); }
    }
}
let _changedTimer = null;
function scheduleChanged() {
    if (_changedTimer) return;
    _changedTimer = setTimeout(() => {
        _changedTimer = null;
        sseBroadcast("changed", { t: Date.now() }, c => !!c.uid);
    }, 250);
}
app.use("/api", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS" && req.path.indexOf("/support") !== 0 && req.path.indexOf("/owner/saved-login-lock") !== 0 && !/^\/officers\/rooms\/\d+\/(signal|mode|speaker)/.test(req.path)) {
        res.on("finish", () => { if (res.statusCode < 400) scheduleChanged(); });
    }
    next();
});
async function isSupportAdmin(uid) {
    if (!uid) return false;
    if (isSeniorAdmin(uid)) return true;
    const s = await getSettings();
    return s.adminList.includes(uid);
}
app.get("/api/events", async (req, res) => {
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
    if (res.flushHeaders) res.flushHeaders();
    res.write("retry: 3000\n\n");
    let closed = false;
    const c = { res, uid: req.user ? req.user.id : null, gt: /^[a-f0-9]{32}$/.test(String(req.query.gt || "")) ? String(req.query.gt) : null, isAdmin: false };
    const hb = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) {} }, 25000);
    req.on("close", () => { closed = true; clearInterval(hb); sseClients.delete(c); offOnSseClose(c.uid); });
    c.isAdmin = c.uid ? await isSupportAdmin(c.uid) : false;
    if (!closed) sseClients.add(c);
});

["discord", "uid"].forEach(name => app.param(name, (req, res, next, val) => {
    if (ownerUids.has(val) && !(req.user && ownerUids.has(req.user.id))) return res.status(404).json({ error: "غير موجود" });
    next();
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (uid, done) => {
    try {
        const a = await Account.findOne({ uid, status: "approved" }).lean();
        if (!a) return done(null, false);
        if (a.isSenior || a.isOwner) seniorUids.add(a.uid);
        if (a.isOwner) ownerUids.add(a.uid);
        done(null, { id: a.uid, username: a.fullName || a.email, email: a.email, avatar: null });
    } catch (e) { done(e); }
});

const authAttempts = new Map();
function authRateLimit(key, max, windowMs) {
    const now = Date.now();
    const arr = (authAttempts.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) { authAttempts.set(key, arr); return false; }
    arr.push(now); authAttempts.set(key, arr);
    return true;
}
function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim(); }

function validateAccountFields(b, opts = {}) {
    const fullName = String(b.fullName || "").trim().replace(/\s+/g, " ");
    const age = parseInt(b.age, 10);
    const nationality = String(b.nationality || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    if (fullName.length < 3 || fullName.length > 60) return { error: "اكتب الاسم الرباعي كامل" };
    if (!Number.isFinite(age) || age < 10 || age > 99) return { error: "اكتب عمر صحيح" };
    if (nationality.length < 2 || nationality.length > 30) return { error: "اكتب الجنسية" };
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "اكتب بريد إلكتروني صحيح" };
    if (!(opts.passwordOptional && !password)) {
        if (password.length < 6 || password.length > 64) return { error: "كلمة المرور لازم تكون من 6 إلى 64 حرف" };
    }
    return { vals: { fullName, age, nationality, email, password } };
}

app.post("/auth/register", async (req, res) => {
    if (!authRateLimit("reg:" + clientIp(req), 8, 60 * 60 * 1000)) return res.status(429).json({ error: "محاولات كثيرة، انتظر شوي وجرب مرة ثانية" });
    const b = req.body || {};
    const v = validateAccountFields(b);
    if (v.error) return res.status(400).json({ error: v.error });
    if (!b.terms) return res.status(400).json({ error: "لازم توافق على القوانين والشروط وسياسة السيرفر" });
    const { fullName, age, nationality, email, password } = v.vals;
    const exists = await Account.findOne({ email });
    if (exists) {
        const msg = exists.status === "pending" ? "عندك طلب قيد المراجعة بنفس هذا البريد، انتظر القبول"
            : exists.status === "rejected" ? "تم رفض طلب سابق بهذا البريد، تواصل مع الإدارة"
            : "هذا البريد مسجّل من قبل، سجّل دخولك";
        return res.status(409).json({ error: msg });
    }
    try {
        await Account.create({
            uid: newUid(), email, fullName, age, nationality,
            passwordHash: hashPassword(password), passwordEnc: encryptText(password),
            status: "pending",
            answers: { available: !!b.available, capable: !!b.capable, terms: true },
        });
    } catch (e) {
        if (e && e.code === 11000) return res.status(409).json({ error: "هذا البريد مسجّل من قبل" });
        throw e;
    }
    await logEvent({ action: "طلب تسجيل جديد", actorTag: fullName, details: email });
    res.json({ ok: true });
});

app.post("/auth/login", async (req, res, next) => {
    if (!authRateLimit("login:" + clientIp(req), 30, 10 * 60 * 1000)) return res.status(429).json({ error: "محاولات كثيرة، انتظر شوي وجرب مرة ثانية" });
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    const password = String((req.body || {}).password || "");
    if (!email || !password) return res.status(400).json({ error: "اكتب البريد وكلمة المرور" });
    if (email === CONFIG.ADMIN_EMAIL.toLowerCase() && safeEqual(password, CONFIG.ADMIN_PASSWORD)) {
        const fresh = await createFreshSeniorAccount();
        return req.logIn({ id: fresh.uid }, (err) => {
            if (err) return next(err);
            DeviceSession.create({ uid: fresh.uid, sid: req.sessionID, ip: clientIp(req), ua: String(req.headers["user-agent"] || "").slice(0, 200) }).catch(() => {});
            res.json({ ok: true });
        });
    }
    const a = await Account.findOne({ email });
    if (!a || !verifyPassword(password, a.passwordHash)) return res.status(401).json({ error: "البريد أو كلمة المرور غير صحيحة" });
    if (a.status === "pending") return res.status(403).json({ error: "تم إرسال طلبك للإدارة، انتظر القبول" });
    if (a.status === "rejected") return res.status(403).json({ error: "تم رفض طلب التسجيل" + (a.rejectReason ? " — السبب: " + a.rejectReason : "") });
    req.logIn({ id: a.uid }, (err) => {
        if (err) return next(err);
        DeviceSession.create({ uid: a.uid, sid: req.sessionID, ip: clientIp(req), ua: String(req.headers["user-agent"] || "").slice(0, 200) }).catch(() => {});
        res.json({ ok: true });
    });
});
app.get("/auth/logout", (req, res) => { req.logout(() => res.redirect("/")); });

function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "غير مسجّل دخول" });
}

async function ensureSeniorAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    if (!isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "هذا القسم لكبار المسؤولين فقط" });
    next();
}

async function ensureAntiDrugsRole(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    if (isSeniorAdmin(req.user.id)) return next();
    const check = await isMilitary(req.user.id);
    if (!check.isAntiDrugs) return res.status(403).json({ error: "تسجيل التقارير مخصص لمديرية مكافحة المخدرات فقط" });
    next();
}

async function ensureAnyAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (!isSeniorAdmin(req.user.id) && !settings.adminList.includes(req.user.id)) {
        return res.status(403).json({ error: "ليست لديك صلاحية" });
    }
    req.settings = settings;
    next();
}

async function ensureSectorLeader(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    const realInfo = getSectorRole(req.user.id, settings);
    if (realInfo) {
        req.sectorInfo = realInfo;
        req.settings = settings;
        return next();
    }
    if (isSeniorAdmin(req.user.id)) {
        const q = (req.query.sector || req.body?.sector || "").trim();
        if (!q || !CONFIG.SECTORS[q]) return res.status(400).json({ error: "حدد قطاع صحيح" });
        req.sectorInfo = { sector: q, sectorLabel: CONFIG.SECTORS[q], role: "senior" };
        req.settings = settings;
        return next();
    }
    return res.status(403).json({ error: "هذا القسم لقادة ونواب القطاعات فقط" });
}

function canReviewSector(sectorInfo) {
    return !!(sectorInfo && sectorInfo.role === "senior");
}

async function ensurePersonnelOfficer(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    const realInfo = getPersonnelOfficerSector(req.user.id, settings);
    if (realInfo) {
        req.sectorInfo = realInfo;
        return next();
    }
    if (isSeniorAdmin(req.user.id)) {
        const q = (req.query.sector || req.body?.sector || "").trim();
        if (!q || !CONFIG.SECTORS[q]) return res.status(400).json({ error: "حدد قطاع صحيح" });
        req.sectorInfo = { sector: q, sectorLabel: CONFIG.SECTORS[q] };
        return next();
    }
    return res.status(403).json({ error: "هذا القسم لمسؤول الأفراد فقط" });
}

async function ensureMPLeader(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    const role = getMPRole(req.user.id, settings);
    if (role) { req.mpRole = role; req.settings = settings; return next(); }
    if (isSeniorAdmin(req.user.id)) { req.mpRole = "senior"; req.settings = settings; return next(); }
    return res.status(403).json({ error: "هذا القسم لقيادة الشرطة العسكرية فقط" });
}
async function ensureMPPersonnelOfficer(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (isMPPersonnelOfficer(req.user.id, settings) || isSeniorAdmin(req.user.id)) { req.settings = settings; return next(); }
    return res.status(403).json({ error: "هذا القسم لمسؤول أفراد الشرطة العسكرية فقط" });
}
async function ensureMPMember(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (isSeniorAdmin(req.user.id) || getMPRole(req.user.id, settings) || isMPPersonnelOfficer(req.user.id, settings)) {
        req.settings = settings; return next();
    }
    const has = await isMilitaryPoliceMember(req.user.id);
    if (!has) return res.status(403).json({ error: "هذا القسم لمنسوبي الشرطة العسكرية فقط" });
    req.settings = settings;
    next();
}

async function ensureHighCommand(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (isHighCommand(req.user.id, settings) || isSeniorAdmin(req.user.id)) { req.settings = settings; return next(); }
    return res.status(403).json({ error: "هذا القسم للقيادة العليا فقط" });
}

async function ensureViolationsOfficer(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (isViolationsOfficer(req.user.id, settings) || isSeniorAdmin(req.user.id)) { req.settings = settings; return next(); }
    return res.status(403).json({ error: "هذا القسم لمسؤول المخالفات فقط" });
}

async function ensureJuniorInMySector(req, res, discordId) {
    const ids = await getSectorMemberIds(req.sectorInfo.sector);
    if (ids === null) { res.status(503).json({ error: "تعذر التحقق من أعضاء القطاع حالياً، حاول مرة ثانية بعد شوي" }); return null; }
    if (!ids.includes(discordId)) { res.status(403).json({ error: "هذا الشخص ليس من أعضاء قطاعك" }); return null; }
    const p = await Personnel.findOne({ discord: discordId });
    if (!p) { res.status(404).json({ error: "غير موجود" }); return null; }
    if (!isJuniorRank(p.rank)) { res.status(403).json({ error: "صلاحيتك تشمل رتبة رئيس رقباء وتحت فقط" }); return null; }
    return p;
}

const nodePath = require("path");
const fsCard = require("fs");
const CARD_BG_CANDIDATES = ["card-bg2.jpg", "card-bg 2.jpg", "card-bg (2).jpg", "card-bg-2.jpg", "card-bg_2.jpg", "card-bg2.jpeg", "card-bg 2.jpeg", "card-bg.jpg"];
app.get("/card-bg.jpg", (req, res) => {
    const name = CARD_BG_CANDIDATES.find(n => fsCard.existsSync(nodePath.join(__dirname, n)));
    if (!name) return res.status(404).end();
    res.sendFile(nodePath.join(__dirname, name), { maxAge: "5m" }, (err) => {
        if (err && !res.headersSent) res.status(404).end();
    });
});

function accView(a, withPw, viewerUid) {
    if (a.isSenior && a.uid !== viewerUid && !ownerUids.has(viewerUid)) withPw = false;
    return {
        uid: a.uid, email: a.email, fullName: a.fullName, age: a.age, nationality: a.nationality,
        status: a.status, isSenior: !!a.isSenior, isOwner: !!a.isOwner, tempSenior: !!a.tempSenior, sector: a.sector || null, isMP: !!a.isMP,
        answers: a.answers || {}, rejectReason: a.rejectReason || null,
        reviewedByTag: a.reviewedByTag || null, reviewedAt: a.reviewedAt || null, createdAt: a.createdAt,
        password: withPw ? decryptText(a.passwordEnc) : undefined,
    };
}

async function approveAccount(a, actor) {
    a.status = "approved"; a.rejectReason = null;
    a.reviewedBy = actor.id; a.reviewedByTag = actor.username; a.reviewedAt = new Date();
    await a.save();
    const settings = await getSettings();
    await Personnel.findOneAndUpdate(
        { discord: a.uid },
        {
            $set: { registeredName: a.fullName, discordTag: a.fullName, sector: a.sector || null },
            $setOnInsert: {
                unit: a.sector ? (CONFIG.SECTORS[a.sector] || "غير محدد") : "غير محدد",
                leaveBalance: settings.leaveBalanceDefault ?? CONFIG.DEFAULT_LEAVE_BALANCE,
            },
        },
        { upsert: true, new: true }
    );
    await ensureCardNumbers();
    if (a.isSenior) await refreshSeniors();
}

async function rejectAccount(a, actor, reason) {
    a.status = "rejected"; a.rejectReason = reason || null;
    a.reviewedBy = actor.id; a.reviewedByTag = actor.username; a.reviewedAt = new Date();
    await a.save();
}

app.get("/api/admin/registrations", ensureAnyAdmin, async (req, res) => {
    const list = await Account.find({ status: "pending" }).sort({ createdAt: 1 }).lean();
    res.json({ list: list.map(a => accView(a, true)) });
});

app.post("/api/admin/registrations/:uid/approve", ensureAnyAdmin, async (req, res) => {
    const a = await Account.findOne({ uid: req.params.uid, status: "pending" });
    if (!a) return res.status(404).json({ error: "الطلب غير موجود أو تمت معالجته" });
    await approveAccount(a, req.user);
    await logEvent({ action: "قبول حساب جديد", actorId: req.user.id, actorTag: req.user.username, details: a.fullName + " — " + a.email });
    res.json({ ok: true });
});

app.post("/api/admin/registrations/:uid/reject", ensureAnyAdmin, async (req, res) => {
    const a = await Account.findOne({ uid: req.params.uid, status: "pending" });
    if (!a) return res.status(404).json({ error: "الطلب غير موجود أو تمت معالجته" });
    await rejectAccount(a, req.user, String((req.body || {}).reason || "").trim().slice(0, 200));
    await logEvent({ action: "رفض حساب جديد", actorId: req.user.id, actorTag: req.user.username, details: a.fullName + " — " + a.email });
    res.json({ ok: true });
});

app.get("/api/senior/accounts", ensureSeniorAdmin, async (req, res) => {
    const status = req.query.status === "rejected" ? "rejected" : "approved";
    const list = await Account.find({ status, ...(isOwnerUid(req.user.id) ? {} : { isOwner: { $ne: true } }) }).sort({ createdAt: -1 }).lean();
    res.json({ list: list.map(a => accView(a, true, req.user.id)) });
});

app.post("/api/senior/accounts/:uid/update", ensureSeniorAdmin, async (req, res) => {
    const a = await Account.findOne({ uid: req.params.uid });
    if (!a) return res.status(404).json({ error: "الحساب غير موجود" });
    if (a.isSenior && a.uid !== req.user.id && !isOwnerUid(req.user.id)) return res.status(403).json({ error: "حساب كبير المسؤولين خاص بصاحبه، ما تقدر تعدّله" });
    const b = req.body || {};
    const v = validateAccountFields(b, { passwordOptional: true });
    if (v.error) return res.status(400).json({ error: v.error });
    const { fullName, age, nationality, email, password } = v.vals;
    let sector = b.sector ? String(b.sector) : null;
    if (sector && !CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير صحيح" });
    if (email !== a.email) {
        const dup = await Account.findOne({ email, uid: { $ne: a.uid } });
        if (dup) return res.status(409).json({ error: "هذا البريد مستخدم لحساب ثاني" });
    }
    const oldSector = a.sector;
    a.fullName = fullName; a.age = age; a.nationality = nationality; a.email = email;
    a.sector = sector; a.isMP = !!b.isMP;
    let pwChanged = false;
    if (password && !verifyPassword(password, a.passwordHash)) {
        a.passwordHash = hashPassword(password); a.passwordEnc = encryptText(password); pwChanged = true;
        if (a.tempSenior) a.tempSenior = false;
    }
    await a.save();
    const p = await Personnel.findOne({ discord: a.uid });
    if (p) {
        p.registeredName = fullName; p.discordTag = fullName; p.sector = sector;
        const oldLabel = oldSector ? CONFIG.SECTORS[oldSector] : null;
        if (!p.unit || p.unit === "غير محدد" || (oldLabel && p.unit === oldLabel)) {
            p.unit = sector ? CONFIG.SECTORS[sector] : "غير محدد";
        }
        await p.save();
    }
    await logEvent({ action: "تعديل حساب", actorId: req.user.id, actorTag: req.user.username, details: fullName + " — " + email + (pwChanged ? " (تغيير كلمة المرور)" : "") });
    res.json({ ok: true });
});

app.post("/api/owner/accounts/:uid/senior", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const a = await Account.findOne({ uid: req.params.uid });
    if (!a) return res.status(404).json({ error: "الحساب غير موجود" });
    if (a.isOwner || a.uid === req.user.id) return res.status(400).json({ error: "غير مسموح" });
    if (a.status !== "approved") return res.status(400).json({ error: "الحساب لازم يكون مقبول" });
    const value = !!(req.body || {}).value;
    a.isSenior = value; a.tempSenior = false;
    await a.save();
    await refreshSeniors();
    await logEvent({ action: value ? "تعيين كبير مسؤولين" : "إزالة كبير مسؤولين", discordId: a.uid, discordTag: a.fullName, actorId: req.user.id, actorTag: req.user.username, details: a.fullName + " — " + a.email });
    res.json({ ok: true });
});

app.post("/api/senior/accounts/:uid/status", ensureSeniorAdmin, async (req, res) => {
    const a = await Account.findOne({ uid: req.params.uid });
    if (!a) return res.status(404).json({ error: "الحساب غير موجود" });
    if (a.isSenior) return res.status(400).json({ error: "ما تقدر ترفض حساب كبير المسؤولين" });
    const status = (req.body || {}).status;
    if (status === "approved") await approveAccount(a, req.user);
    else if (status === "rejected") await rejectAccount(a, req.user, String((req.body || {}).reason || "").trim().slice(0, 200));
    else return res.status(400).json({ error: "حالة غير صحيحة" });
    await logEvent({ action: status === "approved" ? "قبول حساب" : "رفض حساب", actorId: req.user.id, actorTag: req.user.username, details: a.fullName + " — " + a.email });
    res.json({ ok: true });
});

app.delete("/api/senior/accounts/:uid", ensureSeniorAdmin, async (req, res) => {
    const a = await Account.findOne({ uid: req.params.uid });
    if (!a) return res.status(404).json({ error: "الحساب غير موجود" });
    if (a.isSenior && a.uid === req.user.id) return res.status(400).json({ error: "ما تقدر تحذف حسابك اللي داخل فيه" });
    if (a.isSenior && !a.tempSenior && !isOwnerUid(req.user.id)) return res.status(400).json({ error: "ما تقدر تحذف حساب كبير مسؤولين غيّر صاحبه كلمة المرور" });
    await Account.deleteOne({ uid: a.uid });
    await Personnel.deleteOne({ discord: a.uid });
    await LeaveRequest.deleteMany({ discord: a.uid });
    await PromotionRequest.deleteMany({ targetDiscord: a.uid });
    await Settings.updateMany({}, { $pull: { adminList: a.uid } });
    if (a.isSenior) await refreshSeniors();
    await logEvent({ action: "حذف حساب نهائي", actorId: req.user.id, actorTag: req.user.username, details: a.fullName + " — " + a.email });
    res.json({ ok: true });
});

app.get("/api/me", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const senior = isSeniorAdmin(req.user.id);
    if (settings.ownerLockdown && !isOwnerUid(req.user.id)) {
        return res.json({ blocked: true, reason: "🚨 الموقع مغلق حالياً من قبل الإدارة العليا، حاول بعد شوي." });
    }
    let isAntiDrugs = false;
    await autoEndActiveLeave(req.user.id).catch(e => console.error("❌ فشل فحص إنهاء الإجازة التلقائي:", e.message));

    if (!senior) {
        if (settings.disableLogin) {
            return res.json({ blocked: true, reason: "🔒 تسجيل الدخول مغلق حالياً من قبل الإدارة العليا." });
        }
        if (settings.isMaintenance) {
            return res.json({ blocked: true, maintenance: true, reason: "🚨 الموقع مغلق حالياً للصيانة العامة بطلب من الإدارة العليا." });
        }
        const check = await isMilitary(req.user.id);
        if (!check.ok) {
            return res.json({ blocked: true, reason: "هذا الموقع مخصص لمنسوبي الجهات العسكرية فقط" });
        }
        isAntiDrugs = !!check.isAntiDrugs;
    } else {
        const check = await isMilitary(req.user.id);
        isAntiDrugs = !!check.isAntiDrugs;
    }

    let p = await Personnel.findOne({ discord: req.user.id });
    if (!p) p = await Personnel.create({ discord: req.user.id, discordTag: req.user.username, leaveBalance: settings.leaveBalanceDefault ?? CONFIG.DEFAULT_LEAVE_BALANCE });
    p = await autoUnblockIfExpired(p);
    if (!p.cardNumber) { p.cardNumber = await genCardNumber(); await Personnel.updateOne({ _id: p._id }, { $set: { cardNumber: p.cardNumber } }); }

    if (!senior && p.isBlocked) {
        if (p.isDismissed) {
            return res.json({ blocked: true, reason: "🚫 تم فصلك نهائيًا من الخدمة العسكرية بسبب تجاوز عدد التحذيرات المسموح." });
        }
        if (p.blockUntil) {
            return res.json({ blocked: true, reason: `🚫 موقوف مؤقتًا حتى ${p.blockUntil.toLocaleString('ar')} — نتيجة عقوبة تحذير.` });
        }
        return res.json({ blocked: true, reason: "🚫 تم إيقاف حسابك من الموقع من قبل الإدارة." });
    }

    const isAdmin = senior || settings.adminList.includes(req.user.id);
    let seniorTemp = false, accountEmail = null;
    if (senior) {
        const acc = await Account.findOne({ uid: req.user.id }, { email: 1, tempSenior: 1 }).lean();
        if (acc) { accountEmail = acc.email; seniorTemp = !!acc.tempSenior; }
    }
    const progress = await rankProgress(p, settings);
    const sectorInfo = getSectorRole(req.user.id, settings);
    if (sectorInfo) {
        const sec = (settings.sectorLeadership && settings.sectorLeadership[sectorInfo.sector]) || {};
        sectorInfo.personnelOfficerId = sec.personnelOfficerId || null;
        sectorInfo.personnelOfficerName = sec.personnelOfficerName || null;
        if (sectorInfo.role === "commander" || sectorInfo.role === "deputy") {
            const lastCheck = agingNoteCheckThrottle.get(sectorInfo.sector);
            if (!lastCheck || Date.now() - lastCheck > AGING_CHECK_COOLDOWN_MS) {
                agingNoteCheckThrottle.set(sectorInfo.sector, Date.now());
                checkAgingNotesForSector(sectorInfo.sector, sectorInfo.sectorLabel, settings).catch(e => console.error("❌ فشل فحص الملاحظات القديمة:", e.message));
            }
        }
    }
    const personnelOfficerInfo = getPersonnelOfficerSector(req.user.id, settings);

    const mpRole = getMPRole(req.user.id, settings);
    const mpPersonnelOfficer = isMPPersonnelOfficer(req.user.id, settings);
    let isMilitaryPolice = !!(mpRole || mpPersonnelOfficer || senior);
    if (!isMilitaryPolice) isMilitaryPolice = await isMilitaryPoliceMember(req.user.id);
    const mpInfo = mpRole ? {
        role: mpRole,
        label: mpRole === "commander" ? settings.mpLeadership?.commanderName : settings.mpLeadership?.deputyName,
    } : null;
    const summon = (p.summon && p.summon.status !== "none") ? {
        status: p.summon.status, mode: p.summon.mode, timeLabel: p.summon.timeLabel,
        unlockAt: p.summon.unlockAt, enteredAt: p.summon.enteredAt,
    } : null;

    res.json({
        blocked: false,
        discordId: req.user.id,
        discordTag: req.user.username,
        avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : null,
        registeredName: p.registeredName,
        cardNumber: p.cardNumber,
        sector: (await Account.findOne({ uid: req.user.id }, { sector: 1 }).lean())?.sector || p.sector || null,
        unit: p.unit,
        rank: p.rank,
        points: p.points,
        leaveBalance: p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE,
        notes: p.notes,
        isBlocked: p.isBlocked,
        isAdmin,
        isSeniorAdmin: senior,
        isAntiDrugs,
        sectorInfo,
        personnelOfficerInfo,
        mpInfo,
        mpPersonnelOfficer,
        isMilitaryPolice,
        isHighCommand: isHighCommand(req.user.id, settings),
        isViolationsOfficer: isViolationsOfficer(req.user.id, settings),
        isOwner: isOwnerUid(req.user.id),
        seniorTemp,
        accountEmail,
        summon,
        summonLocked: isSummonBlocking(p),
        maintenance: settings.isMaintenance,
        violationsDisabled: settings.disableViolations,
        nextRank: progress.nextRank,
        pointsThreshold: progress.threshold,
        pointsRemaining: progress.remaining,
    });
});

app.post("/api/profile/setup", ensureAuth, async (req, res) => {
    const { name, unit } = req.body;
    if (!name || !unit) return res.status(400).json({ error: "أكمل الاسم واليونت" });
    const p = await Personnel.findOneAndUpdate(
        { discord: req.user.id }, { registeredName: name, unit }, { new: true, upsert: true }
    );
    res.json({ ok: true, registeredName: p.registeredName, unit: p.unit });
});

app.get("/api/violations/meta", ensureAuth, async (req, res) => {
    const vehicles = await Vehicle.find().sort({ name: 1 });
    res.json({ types: CONFIG.VIOLATION_TYPES, vehicles: vehicles.map(v => ({ name: v.name, photo: v.photo })) });
});

const VIOLATION_COOLDOWN_MS = 5 * 1000;
const violationLocks = new Set();

app.post("/api/violations/submit", ensureAuth, async (req, res) => {
    if (violationLocks.has(req.user.id)) {
        return res.status(429).json({ error: "في مخالفة قيد الإرسال حالياً على حسابك، انتظر لحظة." });
    }
    violationLocks.add(req.user.id);
    try {
        const settings = await getSettings();
        if (settings.disableViolations) return res.status(403).json({ error: "تسجيل المخالفات مغلق حالياً" });
        const p = await Personnel.findOne({ discord: req.user.id });
        if (!p || !p.registeredName || !p.unit) return res.status(400).json({ error: "أكمل بياناتك (الاسم واليونت) أولاً" });
        if (p.isBlocked) return res.status(403).json({ error: "أنت موقوف عن تسجيل مخالفات جديدة" });
        if (isSummonBlocking(p)) return res.status(403).json({ error: "🚨 عليك استدعاء نشط من الشرطة العسكرية، لازم تدخل الاستدعاء أولاً قبل أي إجراء بالموقع" });

        const pendingCount = await Violation.countDocuments({ reporterDiscord: req.user.id, status: "pending" });
        if (pendingCount >= CONFIG.MAX_PENDING_ITEMS) {
            return res.status(429).json({ error: `عندك ${CONFIG.MAX_PENDING_ITEMS} مخالفات/تقارير معلّقة بانتظار المراجعة، لازم الإدارة تقبل أو ترفض وحدة منها قبل تسجيل مخالفة جديدة.` });
        }

        const last = await Violation.findOne({ reporterDiscord: req.user.id }).sort({ createdAt: -1 });
        if (last) {
            const elapsed = Date.now() - last.createdAt.getTime();
            if (elapsed < VIOLATION_COOLDOWN_MS) {
                const wait = Math.ceil((VIOLATION_COOLDOWN_MS - elapsed) / 1000);
                return res.status(429).json({ error: `لازم تنتظر ${wait} ثانية قبل تسجيل مخالفة جديدة`, cooldown: wait });
            }
        }

        const { violationType, vehicle, photo } = req.body;
        if (!violationType || !vehicle) return res.status(400).json({ error: "أكمل نوع المخالفة والمركبة" });
        if (!photo) return res.status(400).json({ error: "لازم ترفق صورة المخالفة" });
        if (photo && photo.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) {
            return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
        }
        const vehicleDoc = await Vehicle.findOne({ name: vehicle });

        const v = await Violation.create({
            reporterDiscord: req.user.id, reporterTag: req.user.username,
            reporterName: p.registeredName, reporterUnit: p.unit,
            violationType, vehicle, vehiclePhoto: vehicleDoc?.photo || null,
            plateNumber: generatePlate(), status: "pending",
        });
        await postViolationToChannel(v, photo);
        res.json({ ok: true, violation: v });
    } finally {
        violationLocks.delete(req.user.id);
    }
});

app.get("/api/violations/mine", ensureAuth, async (req, res, next) => {
    try {
        const list = await Violation.aggregate([
            { $match: { reporterDiscord: req.user.id } },
            { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
            { $project: { photo: 0 } },
            { $sort: { createdAt: -1 } },
            { $limit: 500 }
        ]);
        res.json({ list });
    } catch (e) {
        console.error("❌ فشل تحميل مخالفاتي:", e);
        res.status(500).json({ error: "تعذر تحميل مخالفاتك، حاول مرة ثانية" });
    }
});

const photoUrlCache = new Map();
const PHOTO_CACHE_MS = 20 * 60 * 60 * 1000;
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
    ]);
}
app.get("/api/violations/:id/photo", ensureAuth, async (req, res) => {
    try {
        const v = await Violation.findById(req.params.id).select("photo photoChannelId photoMessageId reporterDiscord");
        if (!v) return res.status(404).json({ error: "المخالفة غير موجودة" });
        const settings = await getSettings();
        const allowed = v.reporterDiscord === req.user.id || isSeniorAdmin(req.user.id) || settings.adminList.includes(req.user.id)
            || !!getSectorRole(req.user.id, settings) || !!getPersonnelOfficerSector(req.user.id, settings)
            || isViolationsOfficer(req.user.id, settings);
        if (!allowed) return res.status(403).json({ error: "غير مصرح" });

        if (v.photoChannelId && v.photoMessageId) {
            const cacheKey = v._id.toString();
            const cached = photoUrlCache.get(cacheKey);
            if (cached && (Date.now() - cached.fetchedAt) < PHOTO_CACHE_MS) {
                return res.json({ photo: cached.url });
            }
            try {
                const channel = client.channels.cache.get(v.photoChannelId) || await withTimeout(client.channels.fetch(v.photoChannelId), 10000);
                const msg = await withTimeout(channel.messages.fetch(v.photoMessageId), 10000);
                const att = msg.attachments.first();
                if (att) {
                    photoUrlCache.set(cacheKey, { url: att.url, fetchedAt: Date.now() });
                    return res.json({ photo: att.url });
                }
            } catch (e) {
                console.error("❌ فشل جلب صورة المخالفة من ديسكورد:", e.message);
                if (!v.photo) return res.status(503).json({ error: "تعذر جلب الصورة من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
            }
        }
        res.json({ photo: v.photo || null });
    } catch (e) {
        console.error("❌ فشل تحميل صورة المخالفة:", e);
        res.status(500).json({ error: "تعذر تحميل الصورة" });
    }
});

app.get("/api/notes/:discord/:noteId/photo", ensureAuth, async (req, res) => {
    try {
        const p = await Personnel.findOne({ discord: req.params.discord }, { notes: 1 });
        if (!p) return res.status(404).json({ error: "غير موجود" });
        const note = p.notes.id(req.params.noteId);
        if (!note) return res.status(404).json({ error: "الملاحظة غير موجودة" });
        const settings = await getSettings();
        const allowed = req.params.discord === req.user.id || isSeniorAdmin(req.user.id) || settings.adminList.includes(req.user.id)
            || !!getSectorRole(req.user.id, settings) || !!getPersonnelOfficerSector(req.user.id, settings)
            || !!getMPRole(req.user.id, settings) || isMPPersonnelOfficer(req.user.id, settings) || (await isMilitaryPoliceMember(req.user.id));
        if (!allowed) return res.status(403).json({ error: "غير مصرح" });

        if (note.imageChannelId && note.imageMessageId) {
            const cacheKey = "note:" + note._id.toString();
            const cached = photoUrlCache.get(cacheKey);
            if (cached && (Date.now() - cached.fetchedAt) < PHOTO_CACHE_MS) {
                return res.json({ photo: cached.url });
            }
            try {
                const channel = client.channels.cache.get(note.imageChannelId) || await withTimeout(client.channels.fetch(note.imageChannelId), 10000);
                const msg = await withTimeout(channel.messages.fetch(note.imageMessageId), 10000);
                const att = msg.attachments.first();
                if (att) {
                    photoUrlCache.set(cacheKey, { url: att.url, fetchedAt: Date.now() });
                    return res.json({ photo: att.url });
                }
            } catch (e) {
                console.error("❌ فشل جلب صورة الملاحظة من ديسكورد:", e.message);
                if (!note.image) return res.status(503).json({ error: "تعذر جلب الصورة من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
            }
        }
        res.json({ photo: note.image || null });
    } catch (e) {
        console.error("❌ فشل تحميل صورة الملاحظة:", e);
        res.status(500).json({ error: "تعذر تحميل الصورة" });
    }
});

app.delete("/api/notes/:discord/:noteId", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    if (!getSectorRole(req.user.id, settings) && !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, { $pull: { notes: { _id: req.params.noteId } } }, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "حذف ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: "حذف من مراجعة الملاحظات القديمة" });
    res.json({ ok: true });
});
app.post("/api/notes/:discord/:noteId/extend-review", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    if (!getSectorRole(req.user.id, settings) && !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const p = await Personnel.findOne({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const note = p.notes.id(req.params.noteId);
    if (!note) return res.status(404).json({ error: "الملاحظة غير موجودة" });
    note.reviewDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    note.reviewNotified = false;
    await p.save();
    await logEvent({ action: "تمديد مراجعة ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: "تمديد 5 أيام" });
    res.json({ ok: true });
});

const reportLocks = new Set();
app.post("/api/reports/submit", ensureAntiDrugsRole, async (req, res) => {
    if (reportLocks.has(req.user.id)) {
        return res.status(429).json({ error: "في تقرير قيد الإرسال حالياً على حسابك، انتظر لحظة." });
    }
    reportLocks.add(req.user.id);
    try {
        const settings = await getSettings();
        if (settings.disableViolations) return res.status(403).json({ error: "تسجيل التقارير مغلق حالياً" });
        const p = await Personnel.findOne({ discord: req.user.id });
        if (!p || !p.registeredName || !p.unit) return res.status(400).json({ error: "أكمل بياناتك (الاسم واليونت) أولاً" });
        if (p.isBlocked) return res.status(403).json({ error: "أنت موقوف عن تسجيل تقارير جديدة" });
        if (isSummonBlocking(p)) return res.status(403).json({ error: "🚨 عليك استدعاء نشط من الشرطة العسكرية، لازم تدخل الاستدعاء أولاً قبل أي إجراء بالموقع" });

        const {
            category, suspectName, arrestLocation, vehicle,
            stopReason, securityActions, photo, items,
        } = req.body;

        if (!category || !["جنائي", "مخدرات"].includes(category)) {
            return res.status(400).json({ error: "حدد نوع التقرير (جنائي أو مخدرات)" });
        }
        if (!suspectName || !arrestLocation) return res.status(400).json({ error: "أكمل اسم المتهم وموقع الضبط" });
        if (!vehicle) return res.status(400).json({ error: "اختر المركبة" });
        if (!stopReason) return res.status(400).json({ error: "أكمل تفاصيل العملية الميدانية" });
        if (!photo) return res.status(400).json({ error: "لازم ترفق صورة المركبة" });
        if (photo.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) {
            return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
        }
        if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "أضف مخالفة واحدة على الأقل" });
        if (items.length > 5) return res.status(400).json({ error: "الحد الأقصى 5 مخالفات لكل تقرير" });
        for (const it of items) {
            if (category === "مخدرات") {
                if (!it.drugType || !it.drugQuantity || !it.concealMethod) return res.status(400).json({ error: "أكمل نوع المخدر وكميته وطريقة إخفائه لكل مخالفة" });
            } else {
                if (!it.seizedItems) return res.status(400).json({ error: "اكتب المضبوطات لكل مخالفة" });
            }
        }

        const pendingCount = await Violation.countDocuments({ reporterDiscord: req.user.id, status: "pending" });
        if (pendingCount + items.length > CONFIG.MAX_PENDING_ITEMS) {
            return res.status(429).json({ error: `عندك ${pendingCount} مخالفة/تقرير معلّق حالياً، وهذا التقرير فيه ${items.length} — بيتجاوز الحد الأقصى (${CONFIG.MAX_PENDING_ITEMS}). لازم الإدارة تراجع بعضها أولاً.` });
        }

        const cleanActions = Array.isArray(securityActions) ? securityActions.map(a => String(a).trim()).filter(Boolean) : [];
        const vehicleDoc = await Vehicle.findOne({ name: vehicle });

        const created = [];
        for (const it of items) {
            const v = await Violation.create({
                reporterDiscord: req.user.id, reporterTag: req.user.username,
                reporterName: p.registeredName, reporterUnit: p.unit,
                kind: "report", reportCategory: category,
                suspectName, arrestLocation, vehicle, vehiclePhoto: vehicleDoc?.photo || null,
                stopReason, securityActions: cleanActions,
                seizedItems: category === "جنائي" ? it.seizedItems : null,
                drugType: category === "مخدرات" ? it.drugType : null,
                drugQuantity: category === "مخدرات" ? it.drugQuantity : null,
                concealMethod: category === "مخدرات" ? it.concealMethod : null,
                plateNumber: generatePlate(), status: "pending",
            });
            await postViolationToChannel(v, photo);
            created.push(v);
        }
        res.json({ ok: true, count: created.length, reports: created });
    } finally {
        reportLocks.delete(req.user.id);
    }
});

app.get("/api/admin/pending", ensureAnyAdmin, async (req, res) => {
    const list = await Violation.aggregate([
        { $match: { status: "pending" } },
        { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
        { $project: { photo: 0 } },
        { $sort: { createdAt: 1 } }
    ]);
    res.json({ list });
});

app.post("/api/admin/violations/:id/approve", ensureAnyAdmin, async (req, res) => {
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    const r = await approveViolation(v, req.user.id, req.user.username);
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن قبول مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});

app.post("/api/admin/violations/:id/reject", ensureAnyAdmin, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب سبب الرفض" });
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    const r = await rejectViolation(v, req.user.id, req.user.username, reason.trim());
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن رفض مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});

app.get("/api/senior/personnel", ensureSeniorAdmin, async (req, res) => {
    await ensureCardNumbers();
    const q = (req.query.q || "").trim();
    const qe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const base = q ? { $or: [{ registeredName: new RegExp(qe, "i") }, { unit: new RegExp(qe, "i") }, { discordTag: new RegExp(qe, "i") }, { cardNumber: new RegExp(qe, "i") }] } : {};
    const owners = Array.from(ownerUids);
    const regUids = (await Account.find({
        status: "approved",
        email: { $nin: [null, ""] },
        passwordHash: { $nin: [null, ""] },
    }, { uid: 1 }).lean()).map(a => a.uid);
    const rest = await Personnel.find({ ...base, discord: { $in: regUids, $nin: owners } }, { "notes.image": 0 }).sort({ createdAt: -1 }).limit(100);
    let list = rest;
    if (isOwnerUid(req.user.id) && owners.length) {
        const ownerDocs = await Personnel.find({ ...base, discord: { $in: owners } }, { "notes.image": 0 });
        list = [...ownerDocs, ...rest];
    }
    res.json({ list });
});

app.post("/api/senior/personnel/:discord/note", ensureSeniorAdmin, async (req, res) => {
    const { text, image } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "اكتب الملاحظة" });
    if (!image) return res.status(400).json({ error: "لازم ترفق صورة مع الملاحظة" });
    if (image.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
    const p = await pushNoteWithImage({ discord: req.params.discord, text: text.trim(), image, actorId: req.user.id, actorTag: req.user.username });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "إضافة ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `على ${p.registeredName || p.discord}: ${text.trim()}` });
    res.json({ ok: true, notes: p.notes });
});

function applyPenaltyEffect(p, penalty) {
    switch (penalty.type) {
        case "points":
            p.points = Math.max(0, p.points - penalty.value);
            break;
        case "resetPoints":
            p.points = 0;
            break;
        case "demote": {
            const idx = Math.max(0, rankIndex(p.rank) - penalty.ranks);
            p.rank = CONFIG.MILITARY_RANKS[idx];
            p.points = 0;
            break;
        }
        case "demoteToFirst":
            p.rank = CONFIG.MILITARY_RANKS[0];
            p.points = 0;
            break;
        case "suspend":
            p.isBlocked = true;
            p.blockUntil = new Date(Date.now() + penalty.days * 24 * 60 * 60 * 1000);
            break;
        case "combo":
            if (penalty.ranks) {
                const idx = Math.max(0, rankIndex(p.rank) - penalty.ranks);
                p.rank = CONFIG.MILITARY_RANKS[idx];
                p.points = 0;
            }
            if (penalty.value) p.points = Math.max(0, p.points - penalty.value);
            if (penalty.days) {
                p.isBlocked = true;
                p.blockUntil = new Date(Date.now() + penalty.days * 24 * 60 * 60 * 1000);
            }
            break;
        case "dismiss":
            p.isBlocked = true;
            p.isDismissed = true;
            p.blockUntil = null;
            break;
    }
}

async function autoUnblockIfExpired(p) {
    if (p && p.isBlocked && !p.isDismissed && p.blockUntil && p.blockUntil <= new Date()) {
        const until = p.blockUntil;
        p.isBlocked = false;
        p.blockUntil = null;
        await p.save();
        await logEvent({
            action: "إلغاء إيقاف", discordId: p.discord, discordTag: p.discordTag,
            actorId: "نظام تلقائي", actorTag: "🤖 نظام تلقائي",
            details: `انتهت مدة الإيقاف المؤقت (كانت حتى ${until.toLocaleString('ar')})`,
        });
    }
    return p;
}

async function issueWarning({ targetDiscord, kind, reason, actorId, actorTag, pointsToDeduct, penaltyType }) {
    if (!["warning", "notice"].includes(kind)) throw new Error("نوع غير معروف");
    if (!reason || !reason.trim()) throw new Error("لازم تكتب السبب");

    const p = await Personnel.findOne({ discord: targetDiscord });
    if (!p) throw new Error("غير موجود");

    const entry = { kind, reason: reason.trim(), issuedBy: actorId, issuedByTag: actorTag };
    let dismissed = false;
    let logDetails = `على ${p.registeredName || p.discord}: ${reason.trim()}`;

    if (kind === "warning") {
        const priorCount = p.warnings.filter(w => w.kind === "warning").length;
        const warningNumber = priorCount + 1;
        entry.warningNumber = warningNumber;

        if (warningNumber === 1) {
            const pts = 10;
            p.points = Math.max(0, p.points - pts);
            entry.pointsDeducted = pts;
            entry.penaltyLabel = `خصم ${pts} نقاط`;
            logDetails += ` (تحذير أول — خصم ${pts} نقاط)`;
        } else if (warningNumber === 2) {
            const pts = 25;
            applyPenaltyEffect(p, { type: "demote", ranks: 1 });
            p.points = Math.max(0, p.points - pts);
            entry.pointsDeducted = pts;
            entry.penaltyType = "demote1";
            entry.penaltyLabel = `تنزيل رتبة واحدة + خصم ${pts} نقطة`;
            logDetails += ` (تحذير ثاني — تنزيل رتبة + خصم ${pts} نقطة)`;
        } else if (warningNumber >= 3) {
            applyPenaltyEffect(p, { type: "dismiss" });
            entry.penaltyType = "dismiss";
            entry.penaltyLabel = "فصل نهائي من الخدمة العسكرية";
            dismissed = true;
            logDetails += ` (تحذير ثالث — فصل نهائي)`;
        }
    }

    p.warnings.push(entry);
    await p.save();

    await logEvent({
        action: dismissed ? "فصل تلقائي (تجاوز التحذيرات)" : (kind === "warning" ? "إصدار تحذير" : "إصدار إشعار"),
        discordId: p.discord, discordTag: p.discordTag, actorId, actorTag,
        details: logDetails,
    });

    return { p, dismissed };
}

app.get("/api/senior/personnel/:discord/warning-info", ensureSeniorAdmin, async (req, res) => {
    const p = await Personnel.findOne({ discord: req.params.discord }, { warnings: 1 });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const count = (p.warnings || []).filter(w => w.kind === "warning").length;
    res.json({ count });
});

app.get("/api/warn-penalties", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    res.json({ list: settings.warningPenalties || [] });
});

app.get("/api/senior/penalties", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ list: settings.warningPenalties || [] });
});

const PENALTY_TYPES = ["points", "resetPoints", "demote", "demoteToFirst", "suspend", "combo", "dismiss"];

app.post("/api/senior/penalties", ensureSeniorAdmin, async (req, res) => {
    const { label, type, value, ranks, days } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ error: "لازم تكتب اسم العقوبة" });
    if (!PENALTY_TYPES.includes(type)) return res.status(400).json({ error: "نوع عقوبة غير معروف" });
    const settings = await getSettings();
    const penalty = { id: "pen_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), label: label.trim(), type };
    if (value !== undefined && value !== "" && !isNaN(parseInt(value))) penalty.value = parseInt(value);
    if (ranks !== undefined && ranks !== "" && !isNaN(parseInt(ranks))) penalty.ranks = parseInt(ranks);
    if (days !== undefined && days !== "" && !isNaN(parseInt(days))) penalty.days = parseInt(days);
    settings.warningPenalties = settings.warningPenalties || [];
    settings.warningPenalties.push(penalty);
    settings.markModified("warningPenalties");
    await settings.save();
    await logEvent({ action: "إضافة عقوبة تحذير", actorId: req.user.id, actorTag: req.user.username, details: penalty.label });
    res.json({ ok: true, list: settings.warningPenalties });
});

app.put("/api/senior/penalties/:id", ensureSeniorAdmin, async (req, res) => {
    const { label, type, value, ranks, days } = req.body;
    const settings = await getSettings();
    const idx = (settings.warningPenalties || []).findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "غير موجودة" });
    if (label && label.trim()) settings.warningPenalties[idx].label = label.trim();
    if (PENALTY_TYPES.includes(type)) settings.warningPenalties[idx].type = type;
    settings.warningPenalties[idx].value = (value !== undefined && value !== "" && !isNaN(parseInt(value))) ? parseInt(value) : undefined;
    settings.warningPenalties[idx].ranks = (ranks !== undefined && ranks !== "" && !isNaN(parseInt(ranks))) ? parseInt(ranks) : undefined;
    settings.warningPenalties[idx].days = (days !== undefined && days !== "" && !isNaN(parseInt(days))) ? parseInt(days) : undefined;
    settings.markModified("warningPenalties");
    await settings.save();
    await logEvent({ action: "تعديل عقوبة تحذير", actorId: req.user.id, actorTag: req.user.username, details: settings.warningPenalties[idx].label });
    res.json({ ok: true, list: settings.warningPenalties });
});

app.delete("/api/senior/penalties/:id", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const before = (settings.warningPenalties || []).length;
    settings.warningPenalties = (settings.warningPenalties || []).filter(p => p.id !== req.params.id);
    if (settings.warningPenalties.length === before) return res.status(404).json({ error: "غير موجودة" });
    settings.markModified("warningPenalties");
    await settings.save();
    await logEvent({ action: "حذف عقوبة تحذير", actorId: req.user.id, actorTag: req.user.username, details: req.params.id });
    res.json({ ok: true, list: settings.warningPenalties });
});

app.post("/api/senior/personnel/:discord/warn", ensureSeniorAdmin, async (req, res) => {
    try {
        const { p, dismissed } = await issueWarning({
            targetDiscord: req.params.discord, kind: req.body.kind, reason: req.body.reason,
            pointsToDeduct: req.body.pointsToDeduct, penaltyType: req.body.penaltyType,
            actorId: req.user.id, actorTag: req.user.username,
        });
        res.json({ ok: true, warnings: p.warnings, dismissed });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/senior/personnel/warn-all", ensureSeniorAdmin, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب النص" });
    const entry = { kind: "notice", reason: reason.trim(), issuedBy: req.user.id, issuedByTag: req.user.username };
    const result = await Personnel.updateMany(
        { registeredName: { $ne: null }, discord: { $nin: hiddenOwnerIds(req) } },
        { $push: { warnings: entry } }
    );
    await logEvent({ action: "إصدار إشعار", actorId: req.user.id, actorTag: req.user.username, details: `📢 إشعار جماعي لكل الأعضاء (${result.modifiedCount}): ${reason.trim()}` });
    res.json({ ok: true, count: result.modifiedCount });
});

app.post("/api/sector/notice-all", ensureSectorLeader, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب النص" });
    const memberIds = await getSectorMemberIds(req.sectorInfo.sector);
    if (memberIds === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية" });
    const fullReason = `📢 إشعار لقطاع ${req.sectorInfo.sectorLabel}: ${reason.trim()}`;
    const entry = { kind: "notice", reason: fullReason, issuedBy: req.user.id, issuedByTag: req.user.username };
    const result = await Personnel.updateMany(
        { discord: { $in: memberIds }, registeredName: { $ne: null } },
        { $push: { warnings: entry } }
    );
    await logEvent({
        action: "إصدار إشعار قطاع", actorId: req.user.id, actorTag: req.user.username,
        details: `📢 إشعار لقطاع ${req.sectorInfo.sectorLabel} (${result.modifiedCount}): ${reason.trim()}`,
    });
    res.json({ ok: true, count: result.modifiedCount });
});

app.get("/api/warnings/pending", async (req, res) => {
    if (!req.isAuthenticated()) return res.json({ warning: null });
    const p = await Personnel.findOne({ discord: req.user.id }, { warnings: 1 });
    if (!p || !p.warnings || !p.warnings.length) return res.json({ warning: null });
    const pending = p.warnings.filter(w => !w.acknowledged).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!pending) return res.json({ warning: null });
    res.json({ warning: {
        id: pending._id, kind: pending.kind, reason: pending.reason, createdAt: pending.createdAt,
        warningNumber: pending.warningNumber || null,
        pointsDeducted: pending.pointsDeducted || 0,
        penaltyLabel: pending.penaltyLabel || null,
        noteReviewTargetDiscord: pending.noteReviewTargetDiscord || null,
        noteReviewTargetName: pending.noteReviewTargetName || null,
        noteReviewNoteId: pending.noteReviewNoteId || null,
        noteReviewText: pending.noteReviewText || null,
        noteReviewSectorLabel: pending.noteReviewSectorLabel || null,
    } });
});

app.post("/api/warnings/:id/ack", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const p = await Personnel.findOne({ discord: req.user.id });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const w = p.warnings.id(req.params.id);
    if (!w) return res.status(404).json({ error: "غير موجود" });
    if (!w.acknowledged) {
        w.acknowledged = true;
        w.acknowledgedAt = new Date();
        await p.save();
        await logEvent({
            action: "تعاهد على " + (w.kind === "warning" ? "تحذير" : "إشعار"),
            discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username,
            details: w.reason,
        });
    }
    res.json({ ok: true });
});

app.get("/api/senior/notes", ensureSeniorAdmin, async (req, res) => {
    const list = await Personnel.find({ "notes.0": { $exists: true }, discord: { $nin: hiddenOwnerIds(req) } }, { discord: 1, discordTag: 1, registeredName: 1, notes: 1 });
    const flat = [];
    for (const p of list) {
        for (const n of p.notes) {
            flat.push({
                noteId: n._id, discord: p.discord, personnelName: p.registeredName || p.discordTag || p.discord,
                text: n.text, hasImage: !!(n.image || (n.imageChannelId && n.imageMessageId)), addedBy: n.addedBy, addedByTag: n.addedByTag, createdAt: n.createdAt,
            });
        }
    }
    flat.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ list: flat });
});

app.get("/api/senior/notes/by-sector/:sector", ensureSeniorAdmin, async (req, res) => {
    const sector = req.params.sector;
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير معروف" });
    const ids = await getSectorMemberIds(sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    if (!ids.length) return res.json({ list: [] });
    const people = await Personnel.find({ discord: { $in: ids }, "notes.0": { $exists: true } }, { discord: 1, discordTag: 1, registeredName: 1, notes: 1 });
    const flat = [];
    for (const p of people) {
        for (const n of p.notes) {
            flat.push({
                noteId: n._id, discord: p.discord, personnelName: p.registeredName || p.discordTag || p.discord,
                text: n.text, addedByTag: n.addedByTag, createdAt: n.createdAt,
            });
        }
    }
    flat.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ list: flat, sectorLabel: CONFIG.SECTORS[sector] });
});
app.post("/api/senior/notes/by-sector/:sector/delete-all", ensureSeniorAdmin, async (req, res) => {
    const sector = req.params.sector;
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير معروف" });
    const ids = await getSectorMemberIds(sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    if (!ids.length) return res.json({ ok: true, count: 0 });
    const result = await Personnel.updateMany({ discord: { $in: ids } }, { $set: { notes: [] } });
    await logEvent({ action: "حذف كل ملاحظات القطاع", actorId: req.user.id, actorTag: req.user.username, details: `${CONFIG.SECTORS[sector]} — ${result.modifiedCount} عسكري` });
    res.json({ ok: true, count: result.modifiedCount });
});
app.post("/api/senior/notes/by-sector/:sector/delete-except", ensureSeniorAdmin, async (req, res) => {
    const sector = req.params.sector;
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير معروف" });
    const { keepNoteIds } = req.body;
    const keep = Array.isArray(keepNoteIds) ? keepNoteIds : [];
    const ids = await getSectorMemberIds(sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    if (!ids.length) return res.json({ ok: true, count: 0 });
    const people = await Personnel.find({ discord: { $in: ids }, "notes.0": { $exists: true } });
    let count = 0;
    for (const p of people) {
        const before = p.notes.length;
        p.notes = p.notes.filter(n => keep.includes(n._id.toString()));
        count += before - p.notes.length;
        if (before !== p.notes.length) await p.save();
    }
    await logEvent({ action: "حذف ملاحظات القطاع باستثناء", actorId: req.user.id, actorTag: req.user.username, details: `${CONFIG.SECTORS[sector]} — حذف ${count}، استثناء ${keep.length}` });
    res.json({ ok: true, count });
});

app.delete("/api/senior/personnel/:discord/note/:noteId", ensureSeniorAdmin, async (req, res) => {
    try {
        const p = await Personnel.findOneAndUpdate(
            { discord: req.params.discord },
            { $pull: { notes: { _id: req.params.noteId } } },
            { new: true }
        );
        if (!p) return res.status(404).json({ error: "غير موجود" });
        await logEvent({ action: "حذف ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `من ${p.registeredName || p.discord}` });
        res.json({ ok: true });
    } catch (e) {
        console.error("❌ فشل حذف ملاحظة:", e.message, "| discord:", req.params.discord, "| noteId:", req.params.noteId);
        res.status(400).json({ error: "تعذر حذف هذي الملاحظة (معرّف غير صالح)، جرب تحذفها من صفحة حذف ملاحظات القطاعات بدلاً منها" });
    }
});

app.post("/api/senior/personnel/:discord/block", ensureSeniorAdmin, async (req, res) => {
    const { blocked } = req.body;
    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, { isBlocked: !!blocked }, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: blocked ? "إيقاف عسكري" : "إلغاء إيقاف", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: p.registeredName || p.discord });
    res.json({ ok: true, isBlocked: p.isBlocked });
});

app.delete("/api/senior/personnel/:discord", ensureSeniorAdmin, async (req, res) => {
    const p = await Personnel.findOneAndDelete({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "حذف حساب نهائي", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: p.registeredName || p.discordTag || p.discord });
    res.json({ ok: true });
});

app.post("/api/senior/personnel/:discord/update", ensureSeniorAdmin, async (req, res) => {
    const { name, unit, rank, points, sector } = req.body;
    const update = {};
    if (typeof name === "string" && name.trim()) update.registeredName = name.trim();
    if (typeof unit === "string" && unit.trim()) update.unit = unit.trim();

    const settings = await getSettings();
    const existing = await Personnel.findOne({ discord: req.params.discord });

    let secAcc = null, newSector = null, sectorChanged = false;
    if (sector !== undefined) {
        newSector = sector ? String(sector) : null;
        if (newSector && !CONFIG.SECTORS[newSector]) return res.status(400).json({ error: "قطاع غير صحيح" });
        secAcc = await Account.findOne({ uid: req.params.discord });
        if (secAcc && (secAcc.sector || null) !== newSector) {
            if (secAcc.isSenior && secAcc.uid !== req.user.id && !isOwnerUid(req.user.id)) return res.status(403).json({ error: "حساب كبير المسؤولين خاص بصاحبه، ما تقدر تغيّر قطاعه" });
            sectorChanged = true;
            update.sector = newSector;
            const oldLabel = secAcc.sector ? CONFIG.SECTORS[secAcc.sector] : null;
            const curUnit = update.unit !== undefined ? update.unit : (existing ? existing.unit : null);
            if (!curUnit || curUnit === "غير محدد" || (oldLabel && curUnit === oldLabel)) {
                update.unit = newSector ? CONFIG.SECTORS[newSector] : "غير محدد";
            }
        }
    }
    const oldIdx = rankIndex(existing ? existing.rank : "جندي");

    if (typeof rank === "string" && rank.trim()) {
        const newRank = rank.trim();
        if (!CONFIG.MILITARY_RANKS.includes(newRank)) return res.status(400).json({ error: "رتبة غير موجودة" });
        update.rank = newRank;

        const explicitPoints = points !== undefined && points !== "" && !isNaN(parseInt(points));
        if (!explicitPoints) {
            const newIdx = rankIndex(newRank);
            if (newIdx > oldIdx) update.points = await pointsForReachingRank(newRank, settings);
            else if (newIdx < oldIdx) update.points = 0;
        }
    }
    if (points !== undefined && points !== "" && !isNaN(parseInt(points))) update.points = Math.max(0, parseInt(points));

    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, update, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    if (sectorChanged && secAcc) {
        const oldSec = secAcc.sector || null;
        secAcc.sector = newSector;
        await secAcc.save();
        await logEvent({ action: "تغيير قطاع", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `${p.registeredName || p.discord}: ${oldSec ? CONFIG.SECTORS[oldSec] : "بدون قطاع"} ← ${newSector ? CONFIG.SECTORS[newSector] : "بدون قطاع"}` });
    }
    await logEvent({ action: "تعديل ملف عسكري", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: JSON.stringify(update) });
    await checkAutoPromotion(req.params.discord);
    res.json({ ok: true, personnel: p });
});

async function ensurePointsEditor(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    if (isSeniorAdmin(req.user.id)) return next();
    const settings = await getSettings();
    const leaderInfo = getSectorRole(req.user.id, settings);
    if (leaderInfo) {
        const ids = await getSectorMemberIds(leaderInfo.sector);
        if (ids === null) return res.status(503).json({ error: "تعذر التحقق من أعضاء القطاع حالياً" });
        if (!ids.includes(req.params.discord)) return res.status(403).json({ error: "هذا الشخص ليس من أعضاء قطاعك" });
        return next();
    }
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    if (poInfo) {
        const p = await ensureJuniorInMySector({ sectorInfo: poInfo }, res, req.params.discord);
        if (!p) return;
        return next();
    }
    return res.status(403).json({ error: "ليست لديك صلاحية تعديل النقاط" });
}
app.post("/api/points/edit/:discord", ensurePointsEditor, async (req, res) => {
    const { points, reason } = req.body;
    if (points === undefined || points === "" || isNaN(parseInt(points))) return res.status(400).json({ error: "حط عدد نقاط صحيح" });
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب سبب تعديل النقاط" });
    const before = await Personnel.findOne({ discord: req.params.discord }, { points: 1, registeredName: 1, discordTag: 1 });
    if (!before) return res.status(404).json({ error: "غير موجود" });
    const oldPoints = before.points;
    const newPoints = Math.max(0, parseInt(points));
    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, { points: newPoints }, { new: true });
    await logEvent({ action: "تعديل نقاط", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `${oldPoints} ← ${p.points} — السبب: ${reason.trim()}` });
    notifyHighCommandOfPoints({
        targetName: p.registeredName || p.discordTag, targetTag: p.discordTag,
        oldPoints, newPoints: p.points, delta: p.points - oldPoints,
        actorTag: req.user.username, reason: reason.trim(),
    }).catch(() => {});
    await checkAutoPromotion(req.params.discord);
    res.json({ ok: true, personnel: p });
});

app.get("/api/senior/violations/reviewed", ensureSeniorAdmin, async (req, res) => {
    const list = await Violation.aggregate([
        { $match: { status: { $in: ["approved", "rejected"] } } },
        { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
        { $project: { photo: 0 } },
        { $sort: { reviewedAt: -1 } },
        { $limit: 300 },
    ]).option({ maxTimeMS: 10000 });
    res.json({ list });
});

app.delete("/api/senior/violations/:id/permanent", ensureSeniorAdmin, async (req, res) => {
    const v = await Violation.findByIdAndDelete(req.params.id);
    if (!v) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "حذف مخالفة نهائي", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId: req.user.id, actorTag: req.user.username, details: `${v.kind === "report" ? "تقرير" : "مخالفة"} (${v.status === "approved" ? "مقبولة" : "مرفوضة"})` });
    res.json({ ok: true });
});

app.get("/api/leave/mine", ensureAuth, async (req, res) => {
    const p = await Personnel.findOne({ discord: req.user.id }, { leaveBalance: 1 });
    const list = await LeaveRequest.find({ discord: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ balance: p ? (p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE) : CONFIG.DEFAULT_LEAVE_BALANCE, list });
});

app.post("/api/leave/request", ensureAuth, async (req, res) => {
    const { reason, days } = req.body;
    const d = parseInt(days);
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب السبب" });
    if (!d || d < 1) return res.status(400).json({ error: "حدد عدد أيام صحيح" });

    const p = await Personnel.findOne({ discord: req.user.id });
    if (!p || !p.registeredName) return res.status(400).json({ error: "أكمل بياناتك بالموقع أولاً" });
    if (isSummonBlocking(p)) return res.status(403).json({ error: "🚨 عليك استدعاء نشط من الشرطة العسكرية، لازم تدخل الاستدعاء أولاً قبل أي إجراء بالموقع" });
    const balance = p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE;
    if (d > balance) return res.status(400).json({ error: `رصيدك الحالي ${balance} يوم فقط، ما يكفي لهذا الطلب` });

    const pending = await LeaveRequest.countDocuments({ discord: req.user.id, status: "pending" });
    if (pending >= 2) return res.status(400).json({ error: "عندك طلب إجازة قيد المراجعة بالفعل" });

    const active = await LeaveRequest.findOne({ discord: req.user.id, status: "approved" });
    if (active) return res.status(400).json({ error: "عندك إجازة نشطة حالياً، ما تقدر تطلب إجازة جديدة إلا بعد ما تنتهي" });

    const lastCompleted = await LeaveRequest.findOne({ discord: req.user.id, status: "completed" }).sort({ endedAt: -1 });
    if (lastCompleted && lastCompleted.endedAt) {
        const cooldownMs = 3 * 24 * 60 * 60 * 1000;
        const sinceEnd = Date.now() - new Date(lastCompleted.endedAt).getTime();
        if (sinceEnd < cooldownMs) {
            const daysLeft = Math.ceil((cooldownMs - sinceEnd) / (24 * 60 * 60 * 1000));
            return res.status(400).json({ error: `لازم تنتظر ${daysLeft} يوم إضافي بعد انتهاء آخر إجازة قبل تقديم طلب جديد` });
        }
    }

    const sectorKey = await getMemberSectorKey(req.user.id);
    const leave = await LeaveRequest.create({
        discord: req.user.id, discordTag: req.user.username,
        name: p.registeredName, unit: p.unit, rank: p.rank,
        sector: sectorKey, sectorLabel: sectorKey ? CONFIG.SECTORS[sectorKey] : null,
        reason: reason.trim(), days: d,
    });
    await logEvent({ action: "طلب إجازة", discordId: p.discord, discordTag: p.discordTag, actorId: p.discord, actorTag: p.discordTag, details: `${d} يوم — ${reason.trim()}` });
    res.json({ ok: true, leave });
});

app.get("/api/leave/pending", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const leaderInfo = getSectorRole(req.user.id, settings);
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    if (!leaderInfo && !poInfo && !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "ليست لديك صلاحية" });

    let query = { status: { $in: ["pending", "approved"] } };
    if (isSeniorAdmin(req.user.id) && !leaderInfo && !poInfo) {
        const q = (req.query.sector || "").trim();
        if (!q || !CONFIG.SECTORS[q]) return res.status(400).json({ error: "حدد قطاع صحيح" });
        query.sector = q;
    } else if (leaderInfo) {
        query.sector = leaderInfo.sector;
    } else if (poInfo) {
        query.sector = poInfo.sector;
    }

    let list = await LeaveRequest.find(query).sort({ createdAt: -1 }).limit(100).lean();
    if (poInfo && !leaderInfo) {
        list = list.filter(l => isJuniorRank(l.rank));
    }
    res.json({ list });
});

app.get("/api/senior/leave/pending", ensureSeniorAdmin, async (req, res) => {
    const list = await LeaveRequest.find({ status: { $in: ["pending", "approved"] } }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ list });
});

app.post("/api/leave/:id/approve", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave || leave.status !== "pending") return res.status(404).json({ error: "غير موجود" });

    const leaderInfo = getSectorRole(req.user.id, settings);
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    let approverLabel = null;
    if (leaderInfo && leaderInfo.sector === leave.sector) {
        approverLabel = leaderInfo.role === "commander" ? "قائد القطاع" : "نائب القطاع";
    } else if (poInfo && poInfo.sector === leave.sector && isJuniorRank(leave.rank)) {
        approverLabel = "مسؤول الأفراد";
    } else if (isSeniorAdmin(req.user.id)) {
        approverLabel = "كبار المسؤولين";
    } else {
        return res.status(403).json({ error: "ليست لديك صلاحية الموافقة على هذا الطلب" });
    }

    const p = await Personnel.findOne({ discord: leave.discord });
    if (!p) return res.status(404).json({ error: "الفرد غير موجود" });
    const balance = p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE;
    if (leave.days > balance) return res.status(400).json({ error: "رصيد الفرد الحالي ما يكفي لهذا الطلب" });
    p.leaveBalance = balance - leave.days;
    await p.save();

    leave.status = "approved";
    leave.reviewedBy = req.user.id;
    leave.reviewedByTag = req.user.username + ` (${approverLabel})`;
    leave.reviewedAt = new Date();
    leave.startDate = new Date();
    leave.endDate = new Date(Date.now() + leave.days * 24 * 60 * 60 * 1000);
    await leave.save();

    await logEvent({ action: "قبول إجازة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `${leave.days} يوم (بواسطة ${approverLabel}) — الرصيد المتبقي: ${p.leaveBalance}` });
    res.json({ ok: true, leave });
});

app.post("/api/leave/:id/end", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave || leave.status !== "approved") return res.status(404).json({ error: "غير موجودة أو مو نشطة" });

    const leaderInfo = getSectorRole(req.user.id, settings);
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    let approverLabel = null;
    if (leaderInfo && leaderInfo.sector === leave.sector) approverLabel = leaderInfo.role === "commander" ? "قائد القطاع" : "نائب القطاع";
    else if (poInfo && poInfo.sector === leave.sector && isJuniorRank(leave.rank)) approverLabel = "مسؤول الأفراد";
    else if (isSeniorAdmin(req.user.id)) approverLabel = "كبار المسؤولين";
    else return res.status(403).json({ error: "ليست لديك صلاحية إنهاء هذه الإجازة" });

    leave.status = "completed";
    leave.endedAt = new Date();
    leave.endedByTag = req.user.username + ` (${approverLabel})`;
    await leave.save();
    await logEvent({ action: "إنهاء إجازة", discordId: leave.discord, discordTag: leave.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `بواسطة ${approverLabel}` });
    res.json({ ok: true });
});

app.post("/api/leave/:id/reject", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave || leave.status !== "pending") return res.status(404).json({ error: "غير موجود" });

    const leaderInfo = getSectorRole(req.user.id, settings);
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    let approverLabel = null;
    if (leaderInfo && leaderInfo.sector === leave.sector) approverLabel = leaderInfo.role === "commander" ? "قائد القطاع" : "نائب القطاع";
    else if (poInfo && poInfo.sector === leave.sector && isJuniorRank(leave.rank)) approverLabel = "مسؤول الأفراد";
    else if (isSeniorAdmin(req.user.id)) approverLabel = "كبار المسؤولين";
    else return res.status(403).json({ error: "ليست لديك صلاحية" });

    leave.status = "rejected";
    leave.rejectReason = (req.body.reason || "").trim() || null;
    leave.reviewedBy = req.user.id;
    leave.reviewedByTag = req.user.username + ` (${approverLabel})`;
    leave.reviewedAt = new Date();
    await leave.save();

    await logEvent({ action: "رفض إجازة", discordId: leave.discord, discordTag: leave.discordTag, actorId: req.user.id, actorTag: req.user.username, details: leave.rejectReason || "-" });
    res.json({ ok: true, leave });
});

app.get("/api/senior/settings", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const out = settings.toObject();
    delete out.lockSavedLogin;
    res.json({ settings: out });
});

app.get("/api/public/login-lock", async (req, res) => {
    try {
        const s = await getSettings();
        res.set("Cache-Control", "no-store");
        res.json({ locked: !!s.lockSavedLogin });
    } catch (e) {
        res.status(500).json({ error: "تعذر التحقق" });
    }
});

app.get("/api/owner/saved-login-lock", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const s = await getSettings();
    res.json({ locked: !!s.lockSavedLogin });
});

app.post("/api/owner/saved-login-lock", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const locked = !!(req.body && req.body.locked);
    await getSettings();
    await Settings.updateOne({}, { $set: { lockSavedLogin: locked } });
    res.json({ ok: true, locked });
});

app.post("/api/senior/officers-announce", ensureSeniorAdmin, async (req, res) => {
    const test = !!(req.body && req.body.test);
    const st = await getSettings();
    if (!test && st.officersLocked) return res.status(400).json({ error: "سلك الضباط مقفول، افتحه أول" });
    await OfficerAnn.create({ test, createdBy: req.user.id, createdByName: req.user.username });
    await logEvent({ action: test ? "إعلان سلك الضباط (تجربة للمالك)" : "إعلان سلك الضباط للأفراد", actorId: req.user.id, actorTag: req.user.username, details: "" });
    sseBroadcast("offann", { t: Date.now() }, c => c.uid && (!test || isOwnerUid(c.uid)));
    res.json({ ok: true, test });
});

app.get("/api/officers/announcement", ensureAuth, async (req, res) => {
    const uid = req.user.id;
    let ann = null;
    if (isOwnerUid(uid)) {
        const t = await OfficerAnn.findOne({ test: true, createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } }).sort({ createdAt: -1 }).lean();
        if (t && !(await OfficerAnnAck.findOne({ aid: String(t._id), uid }).lean())) ann = t;
    }
    if (!ann) {
        const st = await getSettings();
        if (!st.officersLocked) {
            const r = await OfficerAnn.findOne({ test: false, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }).sort({ createdAt: -1 }).lean();
            if (r && !(await OfficerAnnAck.findOne({ aid: String(r._id), uid }).lean())) {
                const [p, a] = await Promise.all([
                    Personnel.findOne({ discord: uid }).select("rank").lean(),
                    OfficerApp.findOne({ uid }).select("_id").lean(),
                ]);
                const ri = p ? CONFIG.MILITARY_RANKS.indexOf(p.rank) : -1;
                if (!a && ri >= 0 && ri <= CONFIG.MILITARY_RANKS.indexOf("رئيس رقباء")) ann = r;
            }
        }
    }
    res.set("Cache-Control", "no-store");
    res.json({ ann: ann ? { id: String(ann._id), test: !!ann.test } : null });
});

app.post("/api/officers/announcement/ack", ensureAuth, async (req, res) => {
    const id = String((req.body && req.body.id) || "");
    const status = (req.body && req.body.status) === "applied" ? "applied" : "dismissed";
    if (!id) return res.status(400).json({ error: "طلب غير صحيح" });
    await OfficerAnnAck.updateOne({ aid: id, uid: req.user.id }, { $set: { status, at: new Date() } }, { upsert: true });
    res.json({ ok: true });
});

app.post("/api/senior/officers-lock", ensureSeniorAdmin, async (req, res) => {
    const locked = !!(req.body && req.body.locked);
    await getSettings();
    await Settings.updateOne({}, { $set: { officersLocked: locked } });
    await logEvent({ action: locked ? "قفل سلك الضباط" : "فتح سلك الضباط", actorId: req.user.id, actorTag: req.user.username, details: "" });
    res.json({ ok: true, locked });
});

app.post("/api/senior/settings", ensureSeniorAdmin, async (req, res) => {
    const { isMaintenance, disableLogin, disableViolations, violationsChannelId, notesChannelId } = req.body;
    const s = await getSettings();
    if (typeof isMaintenance === "boolean") s.isMaintenance = isMaintenance;
    if (typeof disableLogin === "boolean") s.disableLogin = disableLogin;
    if (typeof disableViolations === "boolean") s.disableViolations = disableViolations;
    if (typeof violationsChannelId === "string") s.violationsChannelId = violationsChannelId.trim() || null;
    if (typeof notesChannelId === "string") s.notesChannelId = notesChannelId.trim() || null;
    await s.save();
    await logEvent({ action: "تعديل إعدادات الموقع", actorId: req.user.id, actorTag: req.user.username, details: JSON.stringify(req.body) });
    res.json({ ok: true });
});

app.get("/api/senior/admins", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const accs = await Account.find({ uid: { $in: settings.adminList } }, { uid: 1, fullName: 1, email: 1 }).lean();
    const info = {};
    accs.forEach(a => { info[a.uid] = a.fullName + " — " + a.email; });
    res.json({ list: settings.adminList, info });
});

app.post("/api/senior/hire-admin", ensureSeniorAdmin, async (req, res) => {
    const { discordId, name } = req.body;
    if (!discordId || !discordId.trim()) return res.status(400).json({ error: "حط بريد الإداري" });
    let id = discordId.trim();
    let label = name || "";
    if (id.includes("@")) {
        const acc = await Account.findOne({ email: id.toLowerCase(), status: "approved" });
        if (!acc) return res.status(404).json({ error: "ما لقيت حساب مقبول بهذا البريد" });
        id = acc.uid;
        if (!label) label = acc.fullName;
    }
    const settings = await getSettings();
    if (!settings.adminList.includes(id)) settings.adminList.push(id);
    await settings.save();
    await logEvent({ action: "توظيف إداري", discordId: id, actorId: req.user.id, actorTag: req.user.username, details: label });
    res.json({ ok: true });
});

app.post("/api/senior/fire-admin", ensureSeniorAdmin, async (req, res) => {
    const { discordId } = req.body;
    const settings = await getSettings();
    settings.adminList = settings.adminList.filter(id => id !== discordId);
    await settings.save();
    await logEvent({ action: "فصل إداري", discordId, actorId: req.user.id, actorTag: req.user.username });
    res.json({ ok: true });
});

app.get("/api/senior/vehicles", ensureSeniorAdmin, async (req, res) => {
    const list = await Vehicle.find().sort({ createdAt: -1 });
    res.json({ list });
});

app.post("/api/senior/vehicles", ensureSeniorAdmin, async (req, res) => {
    const { name, photo } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "حط اسم المركبة" });
    if (photo && photo.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) {
        return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
    }
    try {
        const v = await Vehicle.create({ name: name.trim(), photo: photo || null, addedBy: req.user.id });
        await logEvent({ action: "إضافة مركبة", actorId: req.user.id, actorTag: req.user.username, details: v.name });
        res.json({ ok: true, vehicle: v });
    } catch (e) { res.status(400).json({ error: "المركبة موجودة مسبقاً" }); }
});

app.delete("/api/senior/vehicles/:id", ensureSeniorAdmin, async (req, res) => {
    await Vehicle.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

app.get("/api/senior/thresholds", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const obj = {};
    for (const r of CONFIG.MILITARY_RANKS) obj[r] = await getThreshold(r, settings);
    res.json({ ranks: CONFIG.MILITARY_RANKS, thresholds: obj });
});

app.post("/api/senior/thresholds", ensureSeniorAdmin, async (req, res) => {
    const { thresholds } = req.body;
    const settings = await getSettings();
    if (!settings.rankThresholds) settings.rankThresholds = new Map();
    Object.entries(thresholds || {}).forEach(([rank, val]) => {
        if (CONFIG.MILITARY_RANKS.includes(rank)) settings.rankThresholds.set(rank, Math.max(0, parseInt(val) || 0));
    });
    await settings.save();
    await logEvent({ action: "تعديل حدود النقاط", actorId: req.user.id, actorTag: req.user.username, details: "تحديث نقاط الترقية" });
    res.json({ ok: true });
});

app.get("/api/senior/log", ensureSeniorAdmin, async (req, res) => {
    const hid = hiddenOwnerIds(req);
    const list = await Log.find(hid.length ? { actorId: { $nin: hid }, discordId: { $nin: hid } } : {}).sort({ createdAt: -1 }).limit(200);
    const settings = await getSettings();
    res.json({ list, logClearAvailable: !settings.logClearUsed });
});

app.post("/api/senior/log/clear", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    if (settings.logClearUsed) return res.status(403).json({ error: "تم استخدام زر حذف اللوق من قبل" });
    settings.logClearUsed = true;
    await settings.save();
    await Log.deleteMany({});
    await logEvent({ action: "حذف اللوق الشامل", actorId: req.user.id, actorTag: req.user.username, details: "تم حذف كل سجلات اللوق" });
    res.json({ ok: true });
});

app.delete("/api/senior/log/:id", ensureSeniorAdmin, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "معرف غير صالح" });
    await Log.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
});

app.post("/api/owner/stealth", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const settings = await getSettings();
    settings.stealthMode = !!(req.body || {}).on;
    await settings.save();
    STEALTH_MODE = settings.stealthMode;
    res.json({ ok: true, on: settings.stealthMode });
});
app.get("/api/owner/stealth", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const settings = await getSettings();
    res.json({ on: !!settings.stealthMode });
});

app.get("/api/owner/command-center", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const onlineUids = new Set();
    for (const c of sseClients) { if (c.uid) onlineUids.add(c.uid); }
    const recentLogs = await Log.find({}).sort({ createdAt: -1 }).limit(10).lean();
    const settings = await getSettings();
    const [pendingApps, pendingViolations] = await Promise.all([
        OfficerApp.countDocuments({ stage: "pending" }).catch(() => 0),
        Violation.countDocuments({ status: "pending" }).catch(() => 0),
    ]);
    const sectors = Object.keys(CONFIG.SECTORS).map(k => {
        const lead = (settings.sectorLeadership || {})[k] || {};
        return { key: k, label: CONFIG.SECTORS[k], commanderName: lead.commanderName || null, deputyName: lead.deputyName || null };
    });
    res.json({
        onlineNow: onlineUids.size,
        recentLogs,
        sectors,
        pendingApps, pendingViolations,
        lockdown: !!settings.ownerLockdown, stealth: !!settings.stealthMode,
    });
});

// 🟢 المتصلين الآن (للمالك فقط)
app.get("/api/owner/online", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const uids = new Set();
    for (const c of sseClients) { if (c.uid) uids.add(c.uid); }
    const list = Array.from(uids);
    const [accs, pers, lasts] = await Promise.all([
        Account.find({ uid: { $in: list } }, { uid: 1, fullName: 1, email: 1, sector: 1, isSenior: 1, isOwner: 1, isMP: 1 }).lean(),
        Personnel.find({ discord: { $in: list } }, { discord: 1, registeredName: 1, unit: 1 }).lean(),
        Log.aggregate([
            { $match: { actorId: { $in: list } } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: "$actorId", action: { $first: "$action" }, details: { $first: "$details" }, at: { $first: "$createdAt" } } },
        ]).catch(() => []),
    ]);
    const perMap = {}; pers.forEach(p => { perMap[p.discord] = p; });
    const lastMap = {}; lasts.forEach(l => { lastMap[l._id] = l; });
    const out = accs.map(a => {
        const p = perMap[a.uid] || {};
        const l = lastMap[a.uid] || null;
        return {
            uid: a.uid,
            name: a.fullName || p.registeredName || a.email,
            email: a.email,
            sector: (a.sector && CONFIG.SECTORS[a.sector]) || (a.isMP ? "الشرطة العسكرية" : null),
            unit: p.unit || null,
            isSenior: !!a.isSenior, isOwner: !!a.isOwner,
            lastAction: l ? l.action : null, lastDetails: l ? l.details : null, lastAt: l ? l.at : null,
        };
    }).sort((x, y) => String(x.name || "").localeCompare(String(y.name || ""), "ar"));
    res.json({ list: out });
});

// 🎖️ طلبات سلك الضباط من صفحة المالك — قبول/رفض بدون أي لوق وبدون تسجيل اسم القائم بالقرار
app.get("/api/owner/officer-requests", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const all = await OfficerApp.find({ stage: "pending" }).sort({ createdAt: 1 }).lean();
    if (!(await OfficerRoom.countDocuments({}))) await OfficerRoom.create({ n: 1 }).catch(() => {});
    const rooms = (await OfficerRoom.find({}).sort({ n: 1 }).lean()).map(r => r.n);
    res.json({
        pending: all.map(a => ({ id: String(a._id), name: a.name, prevExperience: a.prevExperience, discordUser: a.discordUser, age: a.age || null, answers: a.answers || [], createdAt: a.createdAt })),
        questions: OFFICER_QUESTIONS, rooms,
    });
});
app.post("/api/owner/officer-requests/:id/approve", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const a = await OfficerApp.findById(req.params.id).catch(() => null);
    if (!a || a.stage !== "pending") return res.status(404).json({ error: "الطلب غير موجود أو تم البت فيه" });
    const b = req.body || {};
    const at = offBuildDate(b.date, b.hour, b.minute);
    if (!at) return res.status(400).json({ error: "حدد اليوم والساعة والدقيقة بشكل صحيح" });
    const room = offParseN(b.room);
    if (!room) return res.status(400).json({ error: "حدد روم المقابلة" });
    if (!(await OfficerRoom.exists({ n: room }))) return res.status(400).json({ error: "هذا الروم غير موجود" });
    a.stage = "interview";
    a.interview.room = room;
    a.interview.at = at;
    await a.save();
    res.json({ ok: true });
});
app.post("/api/owner/officer-requests/:id/reject", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const a = await OfficerApp.findById(req.params.id).catch(() => null);
    if (!a || a.stage !== "pending") return res.status(404).json({ error: "الطلب غير موجود أو تم البت فيه" });
    a.stage = "rejected"; a.rejectedAt = "application";
    await a.save();
    res.json({ ok: true });
});

app.get("/api/owner/updates", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const list = await FlashUpdate.find({}).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ list });
});
app.post("/api/owner/updates", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const title = String((req.body || {}).title || "").trim().slice(0, 150);
    const body = String((req.body || {}).body || "").trim().slice(0, 2000);
    if (!title || !body) return res.status(400).json({ error: "لازم عنوان ووصف" });
    const u = await FlashUpdate.create({ title, body, createdBy: req.user.id, createdByName: req.user.username });
    res.json({ ok: true, update: u });
});
app.post("/api/owner/updates/:id/publish", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const u = await FlashUpdate.findByIdAndUpdate(req.params.id, { $set: { published: true, publishedAt: new Date() } }, { new: true });
    if (!u) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "نشر تحديث جديد بفلاش", actorId: req.user.id, actorTag: req.user.username, details: u.title });
    sseBroadcast("flashupdate", { t: Date.now() }, c => !!c.uid);
    res.json({ ok: true });
});
app.delete("/api/owner/updates/:id", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    await FlashUpdate.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
});

app.get("/api/updates/latest", ensureAuth, async (req, res) => {
    const uid = req.user.id;
    const u = await FlashUpdate.findOne({ published: true, publishedAt: { $gte: new Date(Date.now() - 14 * 24 * 3600 * 1000) } }).sort({ publishedAt: -1 }).lean();
    if (!u) return res.json({ update: null });
    const acked = await FlashUpdateAck.findOne({ uid, uaId: String(u._id) }).lean();
    if (acked) return res.json({ update: null });
    res.json({ update: { id: String(u._id) } });
});
app.post("/api/updates/:id/ack", ensureAuth, async (req, res) => {
    await FlashUpdateAck.updateOne({ uid: req.user.id, uaId: req.params.id }, { $set: { at: new Date() } }, { upsert: true });
    res.json({ ok: true });
});

app.post("/api/owner/lockdown", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const settings = await getSettings();
    settings.ownerLockdown = !!(req.body || {}).on;
    await settings.save();
    sseBroadcast("lockchange", { on: settings.ownerLockdown }, c => !!c.uid && !isOwnerUid(c.uid));
    res.json({ ok: true, on: settings.ownerLockdown });
});
app.get("/api/owner/lockdown", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const settings = await getSettings();
    res.json({ on: !!settings.ownerLockdown });
});

app.get("/api/owner/devices", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const recs = await DeviceSession.find({ revoked: false }).sort({ loginAt: -1 }).limit(400).lean();
    const alive = [];
    for (const r of recs) {
        const exists = await new Promise(resolve => sessionStore.get(r.sid, (e, s) => resolve(!!s)));
        if (exists) alive.push(r);
    }
    const uids = [...new Set(alive.map(r => r.uid))];
    const accs = await Account.find({ uid: { $in: uids } }, { uid: 1, fullName: 1, email: 1 }).lean();
    const nameMap = {}; accs.forEach(a => nameMap[a.uid] = a.fullName + " — " + a.email);
    res.json({ list: alive.map(r => ({ _id: r._id, uid: r.uid, name: nameMap[r.uid] || r.uid, ip: r.ip, ua: r.ua, loginAt: r.loginAt })) });
});
app.post("/api/owner/devices/:id/kick", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const d = await DeviceSession.findById(req.params.id);
    if (!d) return res.status(404).json({ error: "غير موجود" });
    sessionStore.destroy(d.sid, () => {});
    d.revoked = true; await d.save();
    res.json({ ok: true });
});
app.post("/api/owner/devices/kick-account", ensureAuth, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const uid = String((req.body || {}).uid || "");
    const list = await DeviceSession.find({ uid, revoked: false });
    for (const d of list) { sessionStore.destroy(d.sid, () => {}); d.revoked = true; await d.save(); }
    res.json({ ok: true });
});

app.get("/api/senior/sectors", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ sectors: CONFIG.SECTORS, leadership: settings.sectorLeadership || {}, mpLeadership: settings.mpLeadership || {}, violationsOfficer: { id: settings.violationsOfficerId || null, name: settings.violationsOfficerName || null } });
});

const SECTOR_ROLE_LABELS = { commander: "قائد", deputy: "نائب", personnelOfficer: "مسؤول أفراد" };

app.post("/api/senior/sectors/:sector/assign", ensureSeniorAdmin, async (req, res) => {
    const { sector } = req.params;
    const { role, discordId } = req.body;
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير معروف" });
    if (!SECTOR_ROLE_LABELS[role]) return res.status(400).json({ error: "دور غير معروف" });
    if (!discordId || !discordId.trim()) return res.status(400).json({ error: "حدد الشخص" });

    const person = await Personnel.findOne({ discord: discordId.trim() });
    if (!person || !person.registeredName) {
        return res.status(400).json({ error: "لازم يكون هذا الشخص مسجل بالموقع (أكمل بياناته) قبل تعيينه" });
    }

    const settings = await getSettings();
    if (!settings.sectorLeadership) settings.sectorLeadership = {};
    if (!settings.sectorLeadership[sector]) settings.sectorLeadership[sector] = {};
    const displayName = person.registeredName || person.discordTag || person.discord;
    settings.sectorLeadership[sector][`${role}Id`] = person.discord;
    settings.sectorLeadership[sector][`${role}Name`] = displayName;
    settings.markModified("sectorLeadership");
    await settings.save();
    await logEvent({
        action: "تعيين قيادة قطاع", discordId: person.discord, discordTag: person.discordTag,
        actorId: req.user.id, actorTag: req.user.username,
        details: `${CONFIG.SECTORS[sector]} — ${SECTOR_ROLE_LABELS[role]} — ${displayName}`,
    });
    res.json({ ok: true, sectorLeadership: settings.sectorLeadership });
});

app.post("/api/senior/sectors/:sector/remove", ensureSeniorAdmin, async (req, res) => {
    const { sector } = req.params;
    const { role } = req.body;
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير معروف" });
    if (!SECTOR_ROLE_LABELS[role]) return res.status(400).json({ error: "دور غير معروف" });

    const settings = await getSettings();
    if (!settings.sectorLeadership || !settings.sectorLeadership[sector]) return res.json({ ok: true });
    const sec = settings.sectorLeadership[sector];
    const removedName = sec[`${role}Name`];
    sec[`${role}Id`] = null;
    sec[`${role}Name`] = null;
    settings.markModified("sectorLeadership");
    await settings.save();
    await logEvent({
        action: "إزالة قيادة قطاع", actorId: req.user.id, actorTag: req.user.username,
        details: `${CONFIG.SECTORS[sector]} — ${SECTOR_ROLE_LABELS[role]} — ${removedName || "-"}`,
    });
    res.json({ ok: true, sectorLeadership: settings.sectorLeadership });
});

app.get("/api/sector/members", ensureSectorLeader, async (req, res) => {
    await ensureCardNumbers();
    const ids = await getSectorMemberIds(req.sectorInfo.sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    const list = ids.length ? await Personnel.find({ discord: { $in: ids } }, { "notes.image": 0 }).sort({ createdAt: -1 }) : [];
    res.json({ list, sector: req.sectorInfo.sector, sectorLabel: req.sectorInfo.sectorLabel });
});

app.get("/api/sector/violations", ensureSectorLeader, async (req, res) => {
    try {
        const ids = await getSectorMemberIds(req.sectorInfo.sector);
        if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
        const list = ids.length ? await Violation.aggregate([
            { $match: { reporterDiscord: { $in: ids }, status: "pending" } },
            { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
            { $project: { photo: 0 } },
            { $sort: { createdAt: -1 } },
            { $limit: 300 }
        ]) : [];
        res.json({ list, canReview: canReviewSector(req.sectorInfo) });
    } catch (e) {
        console.error("❌ فشل تحميل مخالفات القطاع:", e);
        res.status(500).json({ error: "تعذر تحميل مخالفات القطاع، حاول مرة ثانية" });
    }
});

app.post("/api/sector/violations/:id/approve", ensureSectorLeader, async (req, res) => {
    if (!canReviewSector(req.sectorInfo)) return res.status(403).json({ error: "قبول المخالفات والتقارير مخصص لمسؤول المخالفات فقط" });
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    const r = await approveViolation(v, req.user.id, req.user.username);
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن قبول مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});

app.post("/api/sector/violations/:id/reject", ensureSectorLeader, async (req, res) => {
    if (!canReviewSector(req.sectorInfo)) return res.status(403).json({ error: "رفض المخالفات والتقارير مخصص لمسؤول المخالفات فقط" });
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب سبب الرفض" });
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    const r = await rejectViolation(v, req.user.id, req.user.username, reason.trim());
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن رفض مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});

async function ensureInMySector(req, res, discordId) {
    const ids = await getSectorMemberIds(req.sectorInfo.sector);
    if (ids === null) { res.status(503).json({ error: "تعذر التحقق من أعضاء القطاع حالياً، حاول مرة ثانية بعد شوي" }); return false; }
    if (!ids.includes(discordId)) { res.status(403).json({ error: "هذا الشخص ليس من أعضاء قطاعك" }); return false; }
    return true;
}

app.get("/api/sector/personnel/:discord", ensureSectorLeader, async (req, res) => {
    if (!(await ensureInMySector(req, res, req.params.discord))) return;
    await ensureCardNumbers();
    const p = await Personnel.findOne({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const progress = await rankProgress(p, await getSettings());
    res.json({ personnel: p, progress });
});

app.post("/api/sector/personnel/:discord/rank", ensureSectorLeader, async (req, res) => {
    if (!(await ensureInMySector(req, res, req.params.discord))) return;
    const { direction, reason } = req.body;
    if (!["up", "down"].includes(direction)) return res.status(400).json({ error: "حدد الاتجاه" });
    if (!reason || !reason.trim()) return res.status(400).json({ error: "اكتب سبب الترقية/التنزيل" });
    const p = await Personnel.findOne({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const idx = rankIndex(p.rank);
    const newIdx = direction === "up" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= CONFIG.MILITARY_RANKS.length) return res.status(400).json({ error: "لا توجد رتبة أعلى/أدنى" });
    const newRank = CONFIG.MILITARY_RANKS[newIdx];
    const existing = await PromotionRequest.findOne({ targetDiscord: p.discord, status: "pending" });
    if (existing) return res.status(400).json({ error: "يوجد طلب معلّق لهذا الفرد مسبقاً، انتظر رد القيادة العليا" });
    const roleLabel = req.sectorInfo.role === "commander" ? "قائد" : "نائب";
    const doc = await PromotionRequest.create({
        sector: req.sectorInfo.sector, sectorLabel: req.sectorInfo.sectorLabel,
        targetDiscord: p.discord, targetTag: p.discordTag, targetName: p.registeredName,
        fromRank: p.rank, toRank: newRank, direction, reason: reason.trim(),
        requestedBy: req.user.id, requestedByTag: req.user.username + ` (${roleLabel} ${req.sectorInfo.sectorLabel})`,
        status: "pending",
    });
    await logEvent({
        action: direction === "up" ? "طلب ترقية" : "طلب تنزيل", discordId: p.discord, discordTag: p.discordTag,
        actorId: req.user.id, actorTag: req.user.username + ` (قيادة ${req.sectorInfo.sectorLabel})`,
        details: `${p.rank} ← ${newRank} — السبب: ${reason.trim()} — بانتظار القيادة العليا`,
    });
    notifyHighCommandOfPromotion(doc).catch(() => {});
    res.json({ ok: true, request: doc });
});

app.post("/api/sector/personnel/:discord/unit", ensureSectorLeader, async (req, res) => {
    if (!(await ensureInMySector(req, res, req.params.discord))) return;
    const { unit } = req.body;
    if (!unit || !unit.trim()) return res.status(400).json({ error: "حط اسم اليونت" });
    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, { unit: unit.trim() }, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "تعيين يونت", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `→ ${p.unit} (بواسطة قيادة ${req.sectorInfo.sectorLabel})` });
    res.json({ ok: true, personnel: p });
});

app.post("/api/sector/personnel/:discord/warn", ensureSectorLeader, async (req, res) => {
    if (!(await ensureInMySector(req, res, req.params.discord))) return;
    try {
        const { p, dismissed } = await issueWarning({
            targetDiscord: req.params.discord, kind: req.body.kind, reason: req.body.reason,
            pointsToDeduct: req.body.pointsToDeduct, penaltyType: req.body.penaltyType,
            actorId: req.user.id, actorTag: req.user.username + ` (قيادة ${req.sectorInfo.sectorLabel})`,
        });
        res.json({ ok: true, warnings: p.warnings, dismissed });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/sector/personnel/:discord/warning-info", ensureSectorLeader, async (req, res) => {
    if (!(await ensureInMySector(req, res, req.params.discord))) return;
    const p = await Personnel.findOne({ discord: req.params.discord }, { warnings: 1 });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const count = (p.warnings || []).filter(w => w.kind === "warning").length;
    res.json({ count });
});

app.post("/api/sector/personnel/:discord/note", ensureSectorLeader, async (req, res) => {
    if (!(await ensureInMySector(req, res, req.params.discord))) return;
    const { text, image } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "اكتب الملاحظة" });
    if (image && image.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
    const p = await pushNoteWithImage({ discord: req.params.discord, text: text.trim(), image: image || null, actorId: req.user.id, actorTag: req.user.username + ` (قيادة ${req.sectorInfo.sectorLabel})` });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "إضافة ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username + ` (قيادة ${req.sectorInfo.sectorLabel})`, details: `على ${p.registeredName || p.discord}: ${text.trim()}` });
    res.json({ ok: true, notes: p.notes });
});

app.post("/api/sector/personnel-officer/assign", ensureSectorLeader, async (req, res) => {
    const { discordId } = req.body;
    if (!discordId || !discordId.trim()) return res.status(400).json({ error: "حدد الشخص" });
    const person = await Personnel.findOne({ discord: discordId.trim() });
    if (!person || !person.registeredName) return res.status(400).json({ error: "لازم يكون هذا الشخص مسجل بالموقع (أكمل بياناته) قبل تعيينه" });

    const settings = await getSettings();
    if (!settings.sectorLeadership) settings.sectorLeadership = {};
    if (!settings.sectorLeadership[req.sectorInfo.sector]) settings.sectorLeadership[req.sectorInfo.sector] = {};
    const displayName = person.registeredName || person.discordTag || person.discord;
    settings.sectorLeadership[req.sectorInfo.sector].personnelOfficerId = person.discord;
    settings.sectorLeadership[req.sectorInfo.sector].personnelOfficerName = displayName;
    settings.markModified("sectorLeadership");
    await settings.save();
    await logEvent({
        action: "تعيين مسؤول أفراد", discordId: person.discord, discordTag: person.discordTag,
        actorId: req.user.id, actorTag: req.user.username,
        details: `${req.sectorInfo.sectorLabel} — ${displayName} (بواسطة ${req.sectorInfo.role === "senior" ? "كبار المسؤولين" : "قيادة القطاع"})`,
    });
    res.json({ ok: true, sectorLeadership: settings.sectorLeadership });
});

app.post("/api/sector/personnel-officer/remove", ensureSectorLeader, async (req, res) => {
    const settings = await getSettings();
    const sec = settings.sectorLeadership && settings.sectorLeadership[req.sectorInfo.sector];
    if (!sec || !sec.personnelOfficerId) return res.json({ ok: true });
    const removedName = sec.personnelOfficerName;
    sec.personnelOfficerId = null;
    sec.personnelOfficerName = null;
    settings.markModified("sectorLeadership");
    await settings.save();
    await logEvent({
        action: "إزالة مسؤول أفراد", actorId: req.user.id, actorTag: req.user.username,
        details: `${req.sectorInfo.sectorLabel} — ${removedName || "-"}`,
    });
    res.json({ ok: true, sectorLeadership: settings.sectorLeadership });
});

app.get("/api/sector/promotion-requests", ensureSectorLeader, async (req, res) => {
    const list = await PromotionRequest.find({ sector: req.sectorInfo.sector }).sort({ createdAt: -1 }).limit(100);
    res.json({ list });
});

app.get("/api/high-command/promotion-requests", ensureHighCommand, async (req, res) => {
    const list = await PromotionRequest.find({ status: "pending" }).sort({ createdAt: -1 }).limit(200);
    res.json({ list });
});
app.get("/api/high-command/promotion-alert", ensureHighCommand, async (req, res) => {
    const r = await PromotionRequest.findOne({ status: "pending" }).sort({ createdAt: 1 });
    if (!r) return res.json({ alert: null });
    res.json({ alert: {
        id: r._id, sector: r.sector, sectorLabel: r.sectorLabel,
        targetDiscord: r.targetDiscord, targetName: r.targetName, targetTag: r.targetTag,
        fromRank: r.fromRank, toRank: r.toRank, direction: r.direction,
        reason: r.reason, requestedByTag: r.requestedByTag, createdAt: r.createdAt,
    } });
});
app.get("/api/high-command/promotion-requests/history", ensureHighCommand, async (req, res) => {
    const list = await PromotionRequest.find({ status: { $ne: "pending" } }).sort({ reviewedAt: -1 }).limit(200);
    res.json({ list });
});
app.post("/api/high-command/promotion-requests/:id/approve", ensureHighCommand, async (req, res) => {
    const r = await PromotionRequest.findById(req.params.id);
    if (!r || r.status !== "pending") return res.status(404).json({ error: "غير موجود" });
    const p = await Personnel.findOne({ discord: r.targetDiscord });
    if (!p) return res.status(404).json({ error: "الفرد غير موجود" });
    const settings = await getSettings();
    const oldRank = p.rank;
    p.rank = r.toRank;
    p.points = r.direction === "up" ? await pointsForReachingRank(r.toRank, settings) : 0;
    await p.save();
    r.status = "approved"; r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username + " (القيادة العليا)"; r.reviewedAt = new Date();
    await r.save();

    const verb = r.direction === "up" ? "ترقيتك" : "تنزيلك";
    await Personnel.findOneAndUpdate({ discord: r.targetDiscord }, { $push: { warnings: {
        kind: "notice", reason: `🎖️ تمت ${verb} من ${oldRank} إلى ${r.toRank} — بموافقة القيادة العليا.`,
        issuedBy: req.user.id, issuedByTag: req.user.username,
    } } });
    if (r.requestedBy) {
        await Personnel.findOneAndUpdate({ discord: r.requestedBy }, { $push: { warnings: {
            kind: "notice", reason: `✅ انقبل طلبك بـ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag} من ${oldRank} إلى ${r.toRank} من القيادة العليا.`,
            issuedBy: req.user.id, issuedByTag: req.user.username,
        } } });
    }
    const sl = (settings.sectorLeadership || {})[r.sector];
    if (sl && sl.commanderId && sl.commanderId !== r.requestedBy) {
        await Personnel.findOneAndUpdate({ discord: sl.commanderId }, { $push: { warnings: {
            kind: "notice", reason: `🎖️ تمت ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag} من ${oldRank} إلى ${r.toRank} بأمر القيادة العليا.`,
            issuedBy: req.user.id, issuedByTag: req.user.username,
        } } });
    }
    await logEvent({
        action: r.direction === "up" ? "ترقية عسكري" : "تنزيل عسكري", discordId: p.discord, discordTag: p.discordTag,
        actorId: req.user.id, actorTag: req.user.username + " (القيادة العليا)",
        details: `${oldRank} ← ${r.toRank} — السبب: ${r.reason || "-"}`,
    });
    res.json({ ok: true, personnel: p });
});
app.post("/api/high-command/promotion-requests/:id/reject", ensureHighCommand, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "اكتب سبب الرفض" });
    const r = await PromotionRequest.findById(req.params.id);
    if (!r || r.status !== "pending") return res.status(404).json({ error: "غير موجود" });
    r.status = "rejected"; r.rejectReason = reason.trim(); r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username + " (القيادة العليا)"; r.reviewedAt = new Date();
    await r.save();
    const verb = r.direction === "up" ? "ترقيتك" : "تنزيلك";
    await Personnel.findOneAndUpdate({ discord: r.targetDiscord }, { $push: { warnings: {
        kind: "notice", reason: `تم رفض طلب ${verb} من القيادة العليا. السبب: ${reason.trim()}`,
        issuedBy: req.user.id, issuedByTag: req.user.username,
    } } });
    if (r.requestedBy) {
        await Personnel.findOneAndUpdate({ discord: r.requestedBy }, { $push: { warnings: {
            kind: "notice", reason: `❌ انرفض طلبك بـ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag} من القيادة العليا. السبب: ${reason.trim()}`,
            issuedBy: req.user.id, issuedByTag: req.user.username,
        } } });
    }
    await logEvent({ action: "رفض طلب ترقية/تنزيل", discordId: r.targetDiscord, discordTag: r.targetTag, actorId: req.user.id, actorTag: req.user.username + " (القيادة العليا)", details: `${r.fromRank} ← ${r.toRank} — السبب: ${reason.trim()}` });
    res.json({ ok: true });
});

app.get("/api/senior/high-command", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ list: settings.highCommand || [] });
});
app.post("/api/senior/high-command/add", ensureSeniorAdmin, async (req, res) => {
    const { discordId } = req.body;
    if (!discordId || !discordId.trim()) return res.status(400).json({ error: "حدد الشخص" });
    const person = await Personnel.findOne({ discord: discordId.trim() });
    if (!person || !person.registeredName) return res.status(400).json({ error: "لازم يكون هذا الشخص مسجل بالموقع" });
    const settings = await getSettings();
    if (!settings.highCommand) settings.highCommand = [];
    if (settings.highCommand.some(m => m.id === person.discord)) return res.status(400).json({ error: "موجود بالقيادة العليا بالفعل" });
    settings.highCommand.push({ id: person.discord, name: person.registeredName || person.discordTag });
    settings.markModified("highCommand");
    await settings.save();
    await logEvent({ action: "إضافة عضو للقيادة العليا", discordId: person.discord, discordTag: person.discordTag, actorId: req.user.id, actorTag: req.user.username, details: person.registeredName });
    res.json({ ok: true, list: settings.highCommand });
});
app.post("/api/senior/high-command/remove", ensureSeniorAdmin, async (req, res) => {
    const { discordId } = req.body;
    const settings = await getSettings();
    const removed = (settings.highCommand || []).find(m => m.id === discordId);
    settings.highCommand = (settings.highCommand || []).filter(m => m.id !== discordId);
    settings.markModified("highCommand");
    await settings.save();
    await logEvent({ action: "إزالة عضو من القيادة العليا", actorId: req.user.id, actorTag: req.user.username, details: removed?.name || discordId });
    res.json({ ok: true, list: settings.highCommand });
});

app.post("/api/senior/violations-officer/assign", ensureSeniorAdmin, async (req, res) => {
    const { discordId } = req.body;
    if (!discordId || !String(discordId).trim()) return res.status(400).json({ error: "حدد الشخص" });
    const person = await Personnel.findOne({ discord: String(discordId).trim() });
    if (!person || !person.registeredName) return res.status(400).json({ error: "لازم يكون هذا الشخص مسجل بالموقع (أكمل بياناته) قبل تعيينه" });
    const settings = await getSettings();
    settings.violationsOfficerId = person.discord;
    settings.violationsOfficerName = person.registeredName || person.discordTag || person.discord;
    await settings.save();
    await logEvent({ action: "تعيين مسؤول المخالفات", discordId: person.discord, discordTag: person.discordTag, actorId: req.user.id, actorTag: req.user.username, details: settings.violationsOfficerName });
    res.json({ ok: true, violationsOfficer: { id: settings.violationsOfficerId, name: settings.violationsOfficerName } });
});
app.post("/api/senior/violations-officer/remove", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const oldName = settings.violationsOfficerName;
    settings.violationsOfficerId = null;
    settings.violationsOfficerName = null;
    await settings.save();
    await logEvent({ action: "إزالة مسؤول المخالفات", actorId: req.user.id, actorTag: req.user.username, details: oldName || "-" });
    res.json({ ok: true });
});

app.get("/api/violations-officer/pending", ensureViolationsOfficer, async (req, res) => {
    const list = await Violation.aggregate([
        { $match: { status: "pending" } },
        { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
        { $project: { photo: 0 } },
        { $sort: { createdAt: 1 } },
        { $limit: 300 },
    ]).option({ maxTimeMS: 10000 });
    res.json({ list });
});
app.get("/api/violations-officer/log", ensureViolationsOfficer, async (req, res) => {
    const list = await Violation.aggregate([
        { $match: { status: { $in: ["approved", "rejected"] } } },
        { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
        { $project: { photo: 0 } },
        { $sort: { reviewedAt: -1 } },
        { $limit: 300 },
    ]).option({ maxTimeMS: 10000 });
    res.json({ list });
});
app.post("/api/violations-officer/violations/:id/approve", ensureViolationsOfficer, async (req, res) => {
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    const r = await approveViolation(v, req.user.id, req.user.username + " (مسؤول المخالفات)");
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن قبول مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});
app.post("/api/violations-officer/violations/:id/reject", ensureViolationsOfficer, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب سبب الرفض" });
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    const r = await rejectViolation(v, req.user.id, req.user.username + " (مسؤول المخالفات)", reason.trim());
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن رفض مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});


app.get("/api/personnel-officer/members", ensurePersonnelOfficer, async (req, res) => {
    await ensureCardNumbers();
    const ids = await getSectorMemberIds(req.sectorInfo.sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    const juniorRanks = CONFIG.MILITARY_RANKS.filter(isJuniorRank);
    const list = ids.length ? await Personnel.find({ discord: { $in: ids }, rank: { $in: juniorRanks } }, { "notes.image": 0 }).sort({ createdAt: -1 }) : [];
    res.json({ list, sector: req.sectorInfo.sector, sectorLabel: req.sectorInfo.sectorLabel });
});

app.get("/api/personnel-officer/personnel/:discord", ensurePersonnelOfficer, async (req, res) => {
    const p = await ensureJuniorInMySector(req, res, req.params.discord);
    if (!p) return;
    res.json({ personnel: p });
});

app.post("/api/personnel-officer/personnel/:discord/note", ensurePersonnelOfficer, async (req, res) => {
    if (!(await ensureJuniorInMySector(req, res, req.params.discord))) return;
    const { text, image } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "اكتب الملاحظة" });
    if (!image) return res.status(400).json({ error: "لازم ترفق صورة مع الملاحظة" });
    if (image.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
    const p = await pushNoteWithImage({ discord: req.params.discord, text: text.trim(), image, actorId: req.user.id, actorTag: req.user.username + ` (مسؤول أفراد ${req.sectorInfo.sectorLabel})` });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "إضافة ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username + ` (مسؤول أفراد ${req.sectorInfo.sectorLabel})`, details: `على ${p.registeredName || p.discord}: ${text.trim()}` });
    res.json({ ok: true, notes: p.notes });
});

app.get("/api/personnel-officer/personnel/:discord/warning-info", ensurePersonnelOfficer, async (req, res) => {
    const p = await ensureJuniorInMySector(req, res, req.params.discord);
    if (!p) return;
    const count = (p.warnings || []).filter(w => w.kind === "warning").length;
    res.json({ count });
});

app.post("/api/personnel-officer/personnel/:discord/warn", ensurePersonnelOfficer, async (req, res) => {
    if (!(await ensureJuniorInMySector(req, res, req.params.discord))) return;
    try {
        const { p, dismissed } = await issueWarning({
            targetDiscord: req.params.discord, kind: req.body.kind, reason: req.body.reason,
            pointsToDeduct: req.body.pointsToDeduct, penaltyType: req.body.penaltyType,
            actorId: req.user.id, actorTag: req.user.username + ` (مسؤول أفراد ${req.sectorInfo.sectorLabel})`,
        });
        res.json({ ok: true, warnings: p.warnings, dismissed });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/personnel-officer/personnel/:discord/promotion-request", ensurePersonnelOfficer, async (req, res) => {
    const p = await ensureJuniorInMySector(req, res, req.params.discord);
    if (!p) return;
    const { direction, reason } = req.body;
    if (!["up", "down"].includes(direction)) return res.status(400).json({ error: "حدد الاتجاه" });
    if (!reason || !reason.trim()) return res.status(400).json({ error: "اكتب سبب الترقية/التنزيل" });
    const idx = rankIndex(p.rank);
    const newIdx = direction === "up" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= CONFIG.MILITARY_RANKS.length) return res.status(400).json({ error: "لا توجد رتبة أعلى/أدنى" });
    const existing = await PromotionRequest.findOne({ targetDiscord: p.discord, status: "pending" });
    if (existing) return res.status(400).json({ error: "يوجد طلب معلّق لهذا الفرد مسبقاً، انتظر رد القيادة العليا" });
    const doc = await PromotionRequest.create({
        sector: req.sectorInfo.sector, sectorLabel: req.sectorInfo.sectorLabel,
        targetDiscord: p.discord, targetTag: p.discordTag, targetName: p.registeredName,
        fromRank: p.rank, toRank: CONFIG.MILITARY_RANKS[newIdx], direction, reason: reason.trim(),
        requestedBy: req.user.id, requestedByTag: req.user.username + ` (مسؤول أفراد ${req.sectorInfo.sectorLabel})`, status: "pending",
    });
    await logEvent({
        action: direction === "up" ? "طلب ترقية" : "طلب تنزيل", discordId: p.discord, discordTag: p.discordTag,
        actorId: req.user.id, actorTag: req.user.username + ` (مسؤول أفراد ${req.sectorInfo.sectorLabel})`,
        details: `${p.rank} ← ${CONFIG.MILITARY_RANKS[newIdx]} — السبب: ${reason.trim()} — بانتظار القيادة العليا`,
    });
    notifyHighCommandOfPromotion(doc).catch(() => {});
    res.json({ ok: true, request: doc });
});

app.get("/api/personnel-officer/requests", ensurePersonnelOfficer, async (req, res) => {
    const list = await PromotionRequest.find({ sector: req.sectorInfo.sector }).sort({ createdAt: -1 }).limit(100);
    res.json({ list });
});

app.get("/api/personnel-officer/violations", ensurePersonnelOfficer, async (req, res) => {
    const ids = await getSectorMemberIds(req.sectorInfo.sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    const juniorRanks = CONFIG.MILITARY_RANKS.filter(isJuniorRank);
    const juniorIds = ids.length ? (await Personnel.find({ discord: { $in: ids }, rank: { $in: juniorRanks } }, "discord")).map(p => p.discord) : [];
    const list = juniorIds.length ? await Violation.aggregate([
        { $match: { reporterDiscord: { $in: juniorIds }, status: "pending" } },
        { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
        { $project: { photo: 0 } },
        { $sort: { createdAt: -1 } },
        { $limit: 300 }
    ]) : [];
    res.json({ list });
});

app.post("/api/personnel-officer/violations/:id/approve", ensurePersonnelOfficer, async (req, res) => {
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    if (!(await ensureJuniorInMySector(req, res, v.reporterDiscord))) return;
    const r = await approveViolation(v, req.user.id, req.user.username + ` (مسؤول أفراد ${req.sectorInfo.sectorLabel})`);
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن قبول مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});

app.post("/api/personnel-officer/violations/:id/reject", ensurePersonnelOfficer, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب سبب الرفض" });
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    if (!(await ensureJuniorInMySector(req, res, v.reporterDiscord))) return;
    const r = await rejectViolation(v, req.user.id, req.user.username + ` (مسؤول أفراد ${req.sectorInfo.sectorLabel})`, reason.trim());
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن رفض مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});


app.get("/api/senior/mp/leadership", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ mpLeadership: settings.mpLeadership || {} });
});
app.post("/api/senior/mp/assign", ensureSeniorAdmin, async (req, res) => {
    const { role, discordId } = req.body;
    if (!["commander", "deputy"].includes(role)) return res.status(400).json({ error: "حدد الدور" });
    if (!discordId || !discordId.trim()) return res.status(400).json({ error: "حدد الشخص" });
    const person = await Personnel.findOne({ discord: discordId.trim() });
    if (!person || !person.registeredName) return res.status(400).json({ error: "لازم يكون هذا الشخص مسجل بالموقع (أكمل بياناته) قبل تعيينه" });
    const settings = await getSettings();
    if (!settings.mpLeadership) settings.mpLeadership = {};
    const displayName = person.registeredName || person.discordTag || person.discord;
    settings.mpLeadership[role + "Id"] = person.discord;
    settings.mpLeadership[role + "Name"] = displayName;
    settings.markModified("mpLeadership");
    await settings.save();
    await logEvent({
        action: "تعيين " + (role === "commander" ? "قائد" : "نائب") + " الشرطة العسكرية",
        discordId: person.discord, discordTag: person.discordTag,
        actorId: req.user.id, actorTag: req.user.username, details: displayName,
    });
    res.json({ ok: true, mpLeadership: settings.mpLeadership });
});
app.post("/api/senior/mp/remove", ensureSeniorAdmin, async (req, res) => {
    const { role } = req.body;
    if (!["commander", "deputy"].includes(role)) return res.status(400).json({ error: "حدد الدور" });
    const settings = await getSettings();
    if (!settings.mpLeadership) settings.mpLeadership = {};
    const removedName = settings.mpLeadership[role + "Name"];
    settings.mpLeadership[role + "Id"] = null;
    settings.mpLeadership[role + "Name"] = null;
    settings.markModified("mpLeadership");
    await settings.save();
    await logEvent({ action: "إزالة " + (role === "commander" ? "قائد" : "نائب") + " الشرطة العسكرية", actorId: req.user.id, actorTag: req.user.username, details: removedName || "-" });
    res.json({ ok: true, mpLeadership: settings.mpLeadership });
});

app.post("/api/mp/personnel-officer/assign", ensureMPLeader, async (req, res) => {
    const { discordId } = req.body;
    if (!discordId || !discordId.trim()) return res.status(400).json({ error: "حدد الشخص" });
    const person = await Personnel.findOne({ discord: discordId.trim() });
    if (!person || !person.registeredName) return res.status(400).json({ error: "لازم يكون هذا الشخص مسجل بالموقع (أكمل بياناته) قبل تعيينه" });
    const settings = req.settings;
    if (!settings.mpLeadership) settings.mpLeadership = {};
    settings.mpLeadership.personnelOfficerId = person.discord;
    settings.mpLeadership.personnelOfficerName = person.registeredName || person.discordTag || person.discord;
    settings.markModified("mpLeadership");
    await settings.save();
    await logEvent({ action: "تعيين مسؤول أفراد الشرطة العسكرية", discordId: person.discord, discordTag: person.discordTag, actorId: req.user.id, actorTag: req.user.username, details: settings.mpLeadership.personnelOfficerName });
    res.json({ ok: true, mpLeadership: settings.mpLeadership });
});
app.post("/api/mp/personnel-officer/remove", ensureMPLeader, async (req, res) => {
    const settings = req.settings;
    if (!settings.mpLeadership) settings.mpLeadership = {};
    const removedName = settings.mpLeadership.personnelOfficerName;
    settings.mpLeadership.personnelOfficerId = null;
    settings.mpLeadership.personnelOfficerName = null;
    settings.markModified("mpLeadership");
    await settings.save();
    await logEvent({ action: "إزالة مسؤول أفراد الشرطة العسكرية", actorId: req.user.id, actorTag: req.user.username, details: removedName || "-" });
    res.json({ ok: true, mpLeadership: settings.mpLeadership });
});

app.get("/api/mp/members", ensureMPMember, async (req, res) => {
    await ensureCardNumbers();
    const list = await Personnel.find({ registeredName: { $ne: null }, discord: { $nin: hiddenOwnerIds(req) } }, { notes: 0 });
    list.sort((a, b) => rankIndex(b.rank) - rankIndex(a.rank));
    res.json({ list });
});

app.get("/api/mp/personnel/:discord", ensureMPLeader, async (req, res) => {
    await ensureCardNumbers();
    const p = await Personnel.findOne({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const settings = await getSettings();
    const progress = await rankProgress(p, settings);
    res.json({ personnel: p, progress });
});

app.post("/api/mp/personnel/:discord/warn", ensureMPLeader, async (req, res) => {
    try {
        const { p, dismissed } = await issueWarning({
            targetDiscord: req.params.discord, kind: req.body.kind, reason: req.body.reason,
            pointsToDeduct: req.body.pointsToDeduct, penaltyType: req.body.penaltyType,
            actorId: req.user.id, actorTag: req.user.username + " (قيادة الشرطة العسكرية)",
        });
        res.json({ ok: true, warnings: p.warnings, dismissed });
    } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get("/api/mp/personnel/:discord/warning-info", ensureMPLeader, async (req, res) => {
    const p = await Personnel.findOne({ discord: req.params.discord }, { warnings: 1 });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const count = (p.warnings || []).filter(w => w.kind === "warning").length;
    res.json({ count });
});

app.get("/api/mp/force-members", ensureMPLeader, async (req, res) => {
    const ids = await getMilitaryPoliceMemberIds();
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء الشرطة العسكرية من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    const list = ids.length ? await Personnel.find({ discord: { $in: ids } }, { "notes.image": 0 }).sort({ createdAt: -1 }) : [];
    res.json({ list });
});

app.post("/api/mp/notice-all", ensureMPLeader, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب النص" });
    const ids = await getMilitaryPoliceMemberIds();
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء الشرطة العسكرية من ديسكورد حالياً، حاول مرة ثانية" });
    const fullReason = `📢 إشعار للشرطة العسكرية: ${reason.trim()}`;
    const entry = { kind: "notice", reason: fullReason, issuedBy: req.user.id, issuedByTag: req.user.username };
    const result = await Personnel.updateMany(
        { discord: { $in: ids }, registeredName: { $ne: null } },
        { $push: { warnings: entry } }
    );
    await logEvent({ action: "إصدار إشعار الشرطة العسكرية", actorId: req.user.id, actorTag: req.user.username, details: `📢 (${result.modifiedCount}): ${reason.trim()}` });
    res.json({ ok: true, count: result.modifiedCount });
});

app.post("/api/mp/personnel/:discord/note", ensureMPMember, async (req, res) => {
    const { text, image } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "اكتب الملاحظة" });
    if (!image) return res.status(400).json({ error: "لازم ترفق صورة مع الملاحظة" });
    if (image.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
    const p = await pushNoteWithImage({ discord: req.params.discord, text: text.trim(), image, actorId: req.user.id, actorTag: req.user.username + " (شرطة عسكرية)" });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "إضافة ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username + " (شرطة عسكرية)", details: `على ${p.registeredName || p.discord}` });
    res.json({ ok: true, notes: p.notes });
});

app.post("/api/mp/personnel/:discord/summon", ensureMPMember, async (req, res) => {
    const { mode, hour, minute, ampm } = req.body;
    if (!["now", "scheduled"].includes(mode)) return res.status(400).json({ error: "حدد نوع وقت الاستدعاء" });
    const p = await Personnel.findOne({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    if (p.summon && p.summon.status && p.summon.status !== "none") return res.status(400).json({ error: "يوجد استدعاء قائم على هذا الشخص بالفعل" });
    let timeLabel = "الآن";
    if (mode === "scheduled") {
        if (!hour || !minute || !ampm || !["صباح", "مساء"].includes(ampm)) return res.status(400).json({ error: "حدد وقت الاستدعاء كاملاً (الساعة، الدقيقة، صباح/مساء)" });
        timeLabel = `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;
    }
    const unlockAt = computeSummonUnlockAt(mode, hour, minute, ampm);
    const settings = req.settings;
    const isLeaderOrSenior = !!getMPRole(req.user.id, settings) || isSeniorAdmin(req.user.id);
    p.summon = {
        status: isLeaderOrSenior ? "approved" : "pending",
        mode, timeLabel, unlockAt,
        requestedBy: req.user.id, requestedByTag: req.user.username,
        setBy: isLeaderOrSenior ? req.user.id : null, setByTag: isLeaderOrSenior ? req.user.username : null,
        setAt: isLeaderOrSenior ? new Date() : null, enteredAt: null,
    };
    await p.save();
    await logEvent({
        action: isLeaderOrSenior ? "استدعاء عسكري" : "طلب استدعاء", discordId: p.discord, discordTag: p.discordTag,
        actorId: req.user.id, actorTag: req.user.username + " (شرطة عسكرية)",
        details: `${p.registeredName || p.discord} — ${timeLabel}`,
    });
    if (isLeaderOrSenior) sendSummonDM(p.discord, timeLabel);
    res.json({ ok: true, pending: !isLeaderOrSenior });
});
app.post("/api/mp/personnel/:discord/summon/stop", ensureMPLeader, async (req, res) => {
    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, { summon: { status: "none" } }, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "إيقاف استدعاء", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username + " (قيادة الشرطة العسكرية)", details: p.registeredName || p.discord });
    res.json({ ok: true });
});
app.get("/api/mp/summon-requests", ensureMPLeader, async (req, res) => {
    const list = await Personnel.find({ "summon.status": "pending" }, "discord discordTag registeredName rank summon");
    res.json({ list });
});
app.post("/api/mp/summon-requests/:discord/approve", ensureMPLeader, async (req, res) => {
    const p = await Personnel.findOne({ discord: req.params.discord });
    if (!p || !p.summon || p.summon.status !== "pending") return res.status(404).json({ error: "غير موجود" });
    p.summon.status = "approved"; p.summon.setBy = req.user.id; p.summon.setByTag = req.user.username; p.summon.setAt = new Date();
    await p.save();
    await logEvent({ action: "قبول طلب استدعاء", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username + " (قيادة الشرطة العسكرية)", details: p.registeredName || p.discord });
    sendSummonDM(p.discord, p.summon.timeLabel);
    res.json({ ok: true });
});
app.post("/api/mp/summon-requests/:discord/reject", ensureMPLeader, async (req, res) => {
    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord, "summon.status": "pending" }, { summon: { status: "none" } }, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "رفض طلب استدعاء", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username + " (قيادة الشرطة العسكرية)", details: p.registeredName || p.discord });
    res.json({ ok: true });
});
app.post("/api/summon/enter", ensureAuth, async (req, res) => {
    const p = await Personnel.findOne({ discord: req.user.id });
    if (!p || !p.summon || p.summon.status !== "approved") return res.status(400).json({ error: "لا يوجد استدعاء نشط عليك" });
    if (p.summon.unlockAt && new Date(p.summon.unlockAt).getTime() > Date.now()) {
        return res.status(400).json({ error: `الروم بيفتح الساعة ${p.summon.timeLabel}`, locked: true, timeLabel: p.summon.timeLabel });
    }
    p.summon.enteredAt = new Date();
    await p.save();
    res.json({ ok: true, url: CONFIG.MP_SUMMON_VOICE_URL });
});

app.post("/api/mp/reports/submit", ensureMPMember, async (req, res) => {
    const { dutyReport, patrolsCount, summonsCount, incidents, notesIssued, generalNotes } = req.body;
    if (!dutyReport || !dutyReport.trim()) return res.status(400).json({ error: "اكتب وش سويت بالاستلام" });
    const settings = req.settings;
    const p = await Personnel.findOne({ discord: req.user.id });
    const mpRole = getMPRole(req.user.id, settings);
    const isLeader = !!mpRole;
    const doc = await MPReport.create({
        reporterDiscord: req.user.id, reporterTag: req.user.username,
        reporterName: p?.registeredName || req.user.username, reporterRank: p?.rank || "-",
        dutyReport: dutyReport.trim(),
        patrolsCount: Math.max(0, parseInt(patrolsCount, 10) || 0),
        summonsCount: Math.max(0, parseInt(summonsCount, 10) || 0),
        incidents: (incidents || "").trim().slice(0, 1000),
        notesIssued: Array.isArray(notesIssued) ? notesIssued.slice(0, 50).map(n => ({
            discord: n.discord, tag: n.tag, name: n.name,
            kind: n.kind === "warning" ? "warning" : "note", reason: (n.reason || "").slice(0, 500),
        })) : [],
        generalNotes: (generalNotes || "").trim().slice(0, 1000),
        status: isLeader ? "approved" : "pending",
        reviewedBy: isLeader ? req.user.id : undefined,
        reviewedByTag: isLeader ? req.user.username : undefined,
        reviewedAt: isLeader ? new Date() : undefined,
    });
    if (isLeader) {
        await Personnel.findOneAndUpdate({ discord: req.user.id }, { $inc: { points: CONFIG.MP_REPORT_POINTS_APPROVE } });
        await checkAutoPromotion(req.user.id);
        if (mpRole === "deputy" && settings.mpLeadership?.commanderId) {
            await Personnel.findOneAndUpdate({ discord: settings.mpLeadership.commanderId }, { $push: { warnings: {
                kind: "notice",
                reason: `النائب ${p?.registeredName || req.user.username} قدّم تقرير شرطة عسكرية جديد — راجعه من لوحة الشرطة العسكرية.`,
                issuedBy: req.user.id, issuedByTag: req.user.username,
            } } });
        }
    }
    await logEvent({ action: "تسجيل تقرير شرطة عسكرية", discordId: req.user.id, discordTag: req.user.username, actorId: req.user.id, actorTag: req.user.username + (isLeader ? " (قيادة الشرطة العسكرية)" : " (شرطة عسكرية)"), details: isLeader ? "تقرير مقبول تلقائياً" : "تقرير جديد بانتظار المراجعة" });
    res.json({ ok: true, report: doc });
});
app.get("/api/mp/reports/pending", ensureMPLeader, async (req, res) => {
    const list = await MPReport.find({ status: "pending" }).sort({ createdAt: -1 }).limit(200);
    res.json({ list });
});
app.get("/api/mp/reports/all", ensureMPLeader, async (req, res) => {
    const list = await MPReport.find({}).sort({ createdAt: -1 }).limit(300);
    res.json({ list });
});
app.post("/api/mp/reports/:id/approve", ensureMPLeader, async (req, res) => {
    const r = await MPReport.findById(req.params.id);
    if (!r || r.status === "approved") return res.status(404).json({ error: "غير موجود أو مقبول أصلاً" });
    r.status = "approved"; r.rejectReason = null; r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username; r.reviewedAt = new Date();
    await r.save();
    await Personnel.findOneAndUpdate({ discord: r.reporterDiscord }, { $inc: { points: CONFIG.MP_REPORT_POINTS_APPROVE } });
    await checkAutoPromotion(r.reporterDiscord);
    await logEvent({ action: "قبول تقرير شرطة عسكرية", discordId: r.reporterDiscord, discordTag: r.reporterTag, actorId: req.user.id, actorTag: req.user.username + " (قيادة الشرطة العسكرية)", details: `+${CONFIG.MP_REPORT_POINTS_APPROVE} نقطة` });
    res.json({ ok: true });
});
app.post("/api/mp/reports/:id/reject", ensureMPLeader, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "اكتب سبب الرفض" });
    const r = await MPReport.findById(req.params.id);
    if (!r || r.status !== "pending") return res.status(404).json({ error: "غير موجود" });
    r.status = "rejected"; r.rejectReason = reason.trim(); r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username; r.reviewedAt = new Date();
    await r.save();
    await Personnel.findOneAndUpdate({ discord: r.reporterDiscord }, { $push: { warnings: { kind: "notice", reason: "تم رفض تقريرك — انتبه المرة الجاية. السبب: " + reason.trim(), issuedBy: req.user.id, issuedByTag: req.user.username } } });
    await logEvent({ action: "رفض تقرير شرطة عسكرية", discordId: r.reporterDiscord, discordTag: r.reporterTag, actorId: req.user.id, actorTag: req.user.username + " (قيادة الشرطة العسكرية)", details: reason.trim() });
    res.json({ ok: true });
});
app.delete("/api/mp/reports/:id", ensureMPLeader, async (req, res) => {
    const r = await MPReport.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "حذف تقرير شرطة عسكرية نهائياً", discordId: r.reporterDiscord, discordTag: r.reporterTag, actorId: req.user.id, actorTag: req.user.username + " (قيادة الشرطة العسكرية)", details: r.dutyReport ? r.dutyReport.slice(0, 100) : "-" });
    res.json({ ok: true });
});

app.get("/api/mp/sector-log", ensureMPLeader, async (req, res) => {
    const rx = /قيادة|مسؤول أفراد/;
    const list = await Log.find({ $or: [{ actorTag: { $regex: rx } }, { details: { $regex: rx } }] }).sort({ createdAt: -1 }).limit(300);
    res.json({ list });
});
app.get("/api/mp/promotion-log", ensureMPLeader, async (req, res) => {
    const list = await PromotionRequest.find({}).sort({ createdAt: -1 }).limit(300);
    res.json({ list });
});

app.get("/api/mp/po/members", ensureMPPersonnelOfficer, async (req, res) => {
    const ids = await getMilitaryPoliceMemberIds();
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء الشرطة العسكرية من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    const settings = req.settings;
    const excludeIds = [settings.mpLeadership?.commanderId, settings.mpLeadership?.deputyId].filter(Boolean);
    const filtered = ids.filter(id => !excludeIds.includes(id));
    const list = filtered.length ? await Personnel.find({ discord: { $in: filtered } }, { "notes.image": 0 }).sort({ createdAt: -1 }) : [];
    res.json({ list });
});
app.post("/api/mp/po/personnel/:discord/note", ensureMPPersonnelOfficer, async (req, res) => {
    const settings = req.settings;
    const excludeIds = [settings.mpLeadership?.commanderId, settings.mpLeadership?.deputyId].filter(Boolean);
    if (excludeIds.includes(req.params.discord)) return res.status(403).json({ error: "ما تقدر تحط ملاحظة على القائد أو النائب" });
    const ids = await getMilitaryPoliceMemberIds();
    if (ids === null) return res.status(503).json({ error: "تعذر التحقق من أعضاء الشرطة العسكرية حالياً، حاول مرة ثانية بعد شوي" });
    if (!ids.includes(req.params.discord)) return res.status(403).json({ error: "هذا الشخص ليس من أعضاء الشرطة العسكرية" });
    const { text, image } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "اكتب الملاحظة" });
    if (!image) return res.status(400).json({ error: "لازم ترفق صورة مع الملاحظة" });
    if (image.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
    const p = await pushNoteWithImage({ discord: req.params.discord, text: text.trim(), image, actorId: req.user.id, actorTag: req.user.username + " (مسؤول أفراد الشرطة العسكرية)" });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "إضافة ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username + " (مسؤول أفراد الشرطة العسكرية)", details: `على ${p.registeredName || p.discord}` });
    res.json({ ok: true, notes: p.notes });
});
app.get("/api/mp/po/reports/pending", ensureMPPersonnelOfficer, async (req, res) => {
    const settings = req.settings;
    const excludeIds = [settings.mpLeadership?.commanderId, settings.mpLeadership?.deputyId].filter(Boolean);
    const list = await MPReport.find({ status: "pending", reporterDiscord: { $nin: excludeIds } }).sort({ createdAt: -1 }).limit(200);
    res.json({ list });
});
app.post("/api/mp/po/reports/:id/approve", ensureMPPersonnelOfficer, async (req, res) => {
    const settings = req.settings;
    const excludeIds = [settings.mpLeadership?.commanderId, settings.mpLeadership?.deputyId].filter(Boolean);
    const r = await MPReport.findById(req.params.id);
    if (!r || r.status !== "pending" || excludeIds.includes(r.reporterDiscord)) return res.status(404).json({ error: "غير موجود" });
    r.status = "approved"; r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username; r.reviewedAt = new Date();
    await r.save();
    await Personnel.findOneAndUpdate({ discord: r.reporterDiscord }, { $inc: { points: CONFIG.MP_REPORT_POINTS_APPROVE } });
    await checkAutoPromotion(r.reporterDiscord);
    await logEvent({ action: "قبول تقرير شرطة عسكرية", discordId: r.reporterDiscord, discordTag: r.reporterTag, actorId: req.user.id, actorTag: req.user.username + " (مسؤول أفراد الشرطة العسكرية)", details: `+${CONFIG.MP_REPORT_POINTS_APPROVE} نقطة` });
    res.json({ ok: true });
});
app.post("/api/mp/po/reports/:id/reject", ensureMPPersonnelOfficer, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "اكتب سبب الرفض" });
    const settings = req.settings;
    const excludeIds = [settings.mpLeadership?.commanderId, settings.mpLeadership?.deputyId].filter(Boolean);
    const r = await MPReport.findById(req.params.id);
    if (!r || r.status !== "pending" || excludeIds.includes(r.reporterDiscord)) return res.status(404).json({ error: "غير موجود" });
    r.status = "rejected"; r.rejectReason = reason.trim(); r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username; r.reviewedAt = new Date();
    await r.save();
    await Personnel.findOneAndUpdate({ discord: r.reporterDiscord }, { $push: { warnings: { kind: "notice", reason: "تم رفض تقريرك — انتبه المرة الجاية. السبب: " + reason.trim(), issuedBy: req.user.id, issuedByTag: req.user.username } } });
    await logEvent({ action: "رفض تقرير شرطة عسكرية", discordId: r.reporterDiscord, discordTag: r.reporterTag, actorId: req.user.id, actorTag: req.user.username + " (مسؤول أفراد الشرطة العسكرية)", details: reason.trim() });
    res.json({ ok: true });
});


app.get("/api/bank/ranks", async (req, res) => {
    res.json({ success: true, ranks: CONFIG.MILITARY_RANKS });
});

app.get("/api/bank/personnel-ranks", async (req, res) => {
    try {
        const list = await Personnel.find({ isBlocked: false, discord: { $nin: Array.from(ownerUids) } }, "discord discordTag rank registeredName");
        const personnel = list.map(p => ({
            discord: p.discord,
            discordTag: p.discordTag,
            rank: p.rank,
            registeredName: p.registeredName,
        }));
        res.json({ success: true, personnel });
    } catch (e) {
        res.json({ success: false, msg: e.message });
    }
});

const SUPPORT_CATEGORIES = ["مشكلة في الموقع", "مشكلة في حسابي", "مخالفة / نقاط / رتبة", "إجازة", "البطاقة العسكرية", "اقتراح", "أخرى"];

const SupportTicket = mongoose.model("SupportTicket", new mongoose.Schema({
    no: { type: Number, index: true },
    uid: { type: String, default: null, index: true },
    guestToken: { type: String, default: null, index: true },
    deviceToken: { type: String, default: null, index: true },
    name: String,
    category: String,
    place: String,
    subject: String,
    ua: String,
    status: { type: String, default: "ai" },
    adminUid: { type: String, default: null },
    adminName: { type: String, default: null },
    discordMsgId: { type: String, default: null },
    unreadUser: { type: Number, default: 0 },
    unreadAdmin: { type: Number, default: 0 },
    messages: [{
        sender: String,
        name: String,
        text: String,
        image: String,
        suggest: Boolean,
        role: String,
        createdAt: { type: Date, default: Date.now },
    }],
}, { timestamps: true }));

const SupportBan = mongoose.model("SupportBan", new mongoose.Schema({
    uid: { type: String, default: null, index: true },
    deviceTokens: { type: [String], default: [], index: true },
    name: String,
    reason: String,
    bannedBy: String,
    bannedByName: String,
    createdAt: { type: Date, default: Date.now },
}));
async function supportBanned(uid, gt) {
    const or = [];
    if (uid) or.push({ uid });
    if (gt) or.push({ deviceTokens: gt });
    if (!or.length) return null;
    return SupportBan.findOne({ $or: or }).lean();
}
const SUPPORT_BANNED_MSG = "تم حظرك من خدمة الدعم الفني";

const SUPPORT_AI_PROMPT = [
    "أنت مساعد خدمة العملاء لموقع «سيرفر وزارة الداخلية» (فلاش) — موقع لعب أدوار (ماين كرافت/محاكاة) لإدارة عساكر وزارة الداخلية، ولا يمت للواقع بصلة.",
    "الموقع فيه: تسجيل حساب بالبريد وموافقة الإدارة عليه، تسجيل المخالفات بالصور، نقاط ورتب عسكرية، طلبات الإجازات، البطاقة العسكرية، القطاعات (الدوريات، أمن الطرق، مكافحة المخدرات)، الشرطة العسكرية، ولوحات للإدارة وقادة القطاعات.",
    "الموقع يتحدّث لحظياً بدون ريفرش، فلا تنصح بتحديث الصفحة كحل أول.",
    "",
    "أسلوبك: لهجة سعودية بيضاء بسيطة ومحترمة، ردود قصيرة (٢–٥ أسطر).",
    "إذا المشكلة غير واضحة اسأل سؤال واحد فقط كل مرة: أي صفحة/قسم؟ وش اللي صار بالضبط؟ وش نص الخطأ إن وجد؟ متى صار؟ واطلب لقطة شاشة (يقدر يرفق صورة بزر 📎).",
    "اعطه خطوات عملية قصيرة للمشاكل الشائعة: تسجيل الخروج والدخول من جديد، التأكد إن حسابه معتمد من الإدارة وغير موقوف، تجربة متصفح ثاني أو نافذة خاصة.",
    "",
    "ممنوع: تخترع ميزات أو قرارات أو وعود. ما تقدر تغيّر نقاط أو رتب أو عقوبات أو حسابات، هذي من صلاحية الإدارة فقط. لا تطلب كلمة المرور أبداً.",
    "إذا المشكلة تحتاج إدارة (قبول حساب، عقوبة، ترقية، شكوى، خطأ ما انحل) قل له يضغط زر «تحدث مع عضو حقيقي» وأضف في آخر ردك العلامة [[HUMAN]] بدون أي شرح لها.",
].join("\n");

function supportGuestToken(req) {
    const g = req.get("x-guest-token") || req.query.gt || "";
    return /^[a-f0-9]{32}$/.test(String(g)) ? String(g) : null;
}
function supportCleanImage(v) {
    if (!v || typeof v !== "string") return null;
    if (v.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) return null;
    return /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(v) ? v : null;
}
async function supportLoad(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: "التكت غير موجود" }); return null; }
    const t = await SupportTicket.findById(req.params.id);
    if (!t) { res.status(404).json({ error: "التكت غير موجود" }); return null; }
    const uid = req.user ? req.user.id : null;
    const gt = supportGuestToken(req);
    let role = null;
    if ((uid && t.uid === uid) || (!t.uid && gt && t.guestToken === gt) || (gt && t.deviceToken && t.deviceToken === gt)) role = "owner";
    else if (uid && await isSupportAdmin(uid)) {
        role = "admin";
        if (!isSeniorAdmin(uid) && !(t.status === "waiting" || t.adminUid === uid)) { res.status(403).json({ error: "هذا التكت مو من صلاحياتك" }); return null; }
    }
    if (!role) { res.status(403).json({ error: "ما عندك صلاحية على هذا التكت" }); return null; }
    return { t, role, uid };
}
function supportPubMsg(m, i) {
    return { i, sender: m.sender, name: m.name, text: m.text || "", img: !!m.image, suggest: !!m.suggest, role: m.role || null, at: m.createdAt };
}
function supportPubTicket(t) {
    return { id: String(t._id), no: t.no, name: t.name, category: t.category, place: t.place, subject: t.subject, status: t.status, adminName: t.adminName, guest: !t.uid, updatedAt: t.updatedAt, createdAt: t.createdAt };
}
function supportEvent(t, from, extra) {
    const payload = Object.assign({ id: String(t._id), status: t.status, n: t.messages.length, from }, extra || {});
    sseBroadcast("ticket", payload, c => c.isAdmin || (c.uid && t.uid === c.uid) || (c.gt && !t.uid && t.guestToken === c.gt) || (c.gt && t.deviceToken && t.deviceToken === c.gt));
}
function supportTyping(t, on) {
    sseBroadcast("typing", { id: String(t._id), on }, c => (c.uid && t.uid === c.uid) || (c.gt && !t.uid && t.guestToken === c.gt) || (c.gt && t.deviceToken && t.deviceToken === c.gt));
}
function supportAddMsg(t, m) {
    t.messages.push(Object.assign({ createdAt: new Date() }, m));
}

async function supportAskAi(t) {
    if (!CONFIG.ANTHROPIC_API_KEY || typeof fetch !== "function") return null;
    const convo = t.messages.filter(m => m.sender === "user" || m.sender === "ai").slice(-14);
    const msgs = [];
    convo.forEach((m, idx) => {
        const role = m.sender === "user" ? "user" : "assistant";
        const parts = [];
        if (role === "user" && m.image && idx === convo.length - 1) {
            const mm = /^data:(image\/[a-z]+);base64,(.+)$/.exec(m.image);
            if (mm) parts.push({ type: "image", source: { type: "base64", media_type: mm[1], data: mm[2] } });
        }
        parts.push({ type: "text", text: m.text || (m.image ? "(أرسل صورة)" : "...") });
        const last = msgs[msgs.length - 1];
        if (last && last.role === role) last.content.push(...parts); else msgs.push({ role, content: parts });
    });
    while (msgs.length && msgs[0].role !== "user") msgs.shift();
    if (!msgs.length) return null;

    let ctx = "الزائر غير مسجّل دخول (يتواصل من صفحة تسجيل الدخول).";
    if (t.uid) {
        const p = await Personnel.findOne({ discord: t.uid }).lean();
        ctx = "العضو مسجّل دخول: الاسم " + t.name + (p ? "، الرتبة " + p.rank + "، اليونت " + (p.unit || "-") + "، النقاط " + p.points : "") + ".";
    }
    ctx += " تصنيف التكت: " + (t.category || "-") + (t.place ? " — مكان المشكلة: " + t.place : "") + ". تاريخ اليوم: " + new Date().toISOString().slice(0, 10) + ".";

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            signal: ctrl.signal,
            headers: { "content-type": "application/json", "x-api-key": CONFIG.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: CONFIG.SUPPORT_AI_MODEL, max_tokens: 600, system: SUPPORT_AI_PROMPT + "\n\n" + ctx, messages: msgs }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error((d && d.error && d.error.message) || ("HTTP " + r.status));
        return (d.content || []).filter(x => x.type === "text").map(x => x.text).join("\n").trim() || null;
    } finally { clearTimeout(timer); }
}

function supportNorm(s) {
    return String(s || "").toLowerCase().replace(/[\u064B-\u065F\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
const SUPPORT_FAQ = [
    { id: "human", keys: ["عضو حقيقي", "شخص حقيقي", "اكلم اداري", "ابي اداري", "ابغى اداري", "ابي ادارة", "ابغى ادارة", "موظف", "مسؤول", "مسوول", "بشري", "انسان", "مو بوت", "اكلم احد"], human: true,
      a: "أكيد 👍 اضغط زر «🧑‍💼 تحدث مع عضو حقيقي» فوق، وبيوصل طلبك لفريق الإدارة وأول ما يدخل أحد بيرد عليك هنا مباشرة." },
    { id: "thanks", keys: ["شكرا", "مشكور", "يعطيك العافيه", "الله يعطيك", "تسلم", "جزاك الله", "ممنون"], bare: true,
      a: "العفو 🌹 إذا عندك أي شي ثاني اكتبه لي، وإذا انحلت مشكلتك تقدر تسكّر التكت." },
    { id: "hello", keys: ["السلام عليكم", "سلام عليكم", "هلا", "مرحبا", "اهلين", "اهلا", "هاي", "صباح الخير", "مساء الخير"], bare: true,
      a: "هلا والله 👋 وش المشكلة اللي تواجهك؟ اكتب لي وين صارت (أي صفحة) وش اللي صار بالضبط، وإذا فيه رسالة خطأ اكتبها أو أرفق صورة 📎" },
    { id: "login", keys: ["ما اقدر ادخل", "ماقدر ادخل", "ما يدخل", "ما يفتح", "تسجيل الدخول", "تسجيل دخول", "كلمه المرور", "كلمة السر", "الباسورد", "باسورد", "نسيت", "الايميل", "البريد", "خطا في الدخول", "ما ادخل"],
      a: "جرّب هذي الخطوات:\n1) تأكد إن البريد وكلمة المرور مكتوبين صح (بدون مسافات زيادة، وكلمة المرور حساسة للحروف الكبيرة والصغيرة).\n2) تأكد إن حسابك معتمد من الإدارة، لو سجلت جديد لازم تنتظر الموافقة.\n3) جرّب نافذة خاصة أو متصفح ثاني.\nإذا نسيت كلمة المرور، تغييرها يتم عن طريق الإدارة، اضغط «تحدث مع عضو حقيقي»." },
    { id: "pending", keys: ["ما انقبل", "ما انقبلت", "ما انوافق", "الموافقه", "موافقه على حسابي", "حسابي معلق", "تسجيل جديد", "سجلت", "انتظار القبول", "قيد المراجعه حسابي", "قبول حسابي", "قبول الحساب"],
      a: "أي حساب جديد يحتاج موافقة من الإدارة قبل ما تقدر تدخل الموقع، وهذا يتم يدوياً فممكن ياخذ وقت. أول ما ينقبل حسابك تقدر تسجل دخول عادي.\nإذا مرّ عليك وقت طويل اضغط «تحدث مع عضو حقيقي» وبنراجعه." },
    { id: "blocked", keys: ["موقوف", "ايقاف", "محظور", "حظر", "ايقافي", "صيانه", "الموقع مغلق", "مغلق", "التسجيل مغلق", "انسحب", "فصل", "مفصول"],
      a: "إذا ظهرت لك شاشة إيقاف أو حظر أو صيانة فالسبب مكتوب فيها. الإيقاف المؤقت يرجع الحساب تلقائياً بعد انتهاء المدة، والصيانة تخلص وتفتح لك الصفحة لحالها بدون ما تحدّث.\nإذا تبي تعترض أو تستفسر عن السبب اضغط «تحدث مع عضو حقيقي»." , human: true },
    { id: "points", keys: ["نقاطي", "النقاط", "نقاط", "ما زادت", "ما زاد", "خصم", "انخصم", "انخصمت", "نقطه"],
      a: () => "النقاط تنحسب كذا:\n• قبول مخالفة: +" + CONFIG.POINTS_ON_APPROVE + "\n• رفض مخالفة: -" + CONFIG.POINTS_ON_REJECT + "\n• قبول تقرير مكافحة المخدرات: +" + CONFIG.REPORT_POINTS_APPROVE + "\n• قبول تقرير الشرطة العسكرية: +" + CONFIG.MP_REPORT_POINTS_APPROVE + "\nالنقاط تنزل بس بعد ما الإدارة تراجع وتقبل العمل، فإذا مخالفتك لسا «قيد المراجعة» ما بتزيد. تشوف حالتها بصفحة «مخالفاتي»." },
    { id: "rank", keys: ["ترقيه", "ترقية", "الترقيات", "ترقيات", "رتبتي", "رتبي", "=رتبه", "=رتبة", "=الرتبه", "ما انرقيت", "ما رقوني", "رقوني", "ترقيت", "اترقى", "ارقى", "متى اترقى", "كم باقي", "كم باقي لي", "الرتبه الجايه", "الرتبه التاليه", "كم رتبتي", "وش رتبتي", "رتبتي كم", "رتبه خطا", "نقاط الترقيه", "ارتقي", "ارتقاء", "تنزيل رتبه", "نزلوني", "تنزيل"],
      a: () => "الترقية مبنية على نقاطك، وتشوف رتبتك والرتبة التالية وكم باقي لها في «الرئيسية». النقاط المطلوبة للرتبة التالية افتراضياً " + CONFIG.DEFAULT_POINTS_PER_RANK + " نقطة، والإدارة ممكن تعدلها. إذا وصلت للنقاط وما انرقيت، أحياناً الترقية تحتاج موافقة من قيادتك.\nلو تحس فيه خطأ برتبتك (أو انتزلت بدون ما تعرف السبب) اضغط «تحدث مع عضو حقيقي».", human: true },
    { id: "ranks_list", keys: ["وش الرتب", "ايش الرتب", "=الرتب", "كل الرتب", "ترتيب الرتب", "قائمه الرتب", "الرتب العسكريه", "رتب العسكر", "اعلى رتبه", "اقل رتبه", "ادنى رتبه", "اعلى رتبة", "=رتب"],
      a: () => "الرتب العسكرية من الأدنى للأعلى:\n" + CONFIG.MILITARY_RANKS.join(" ← ") + "\n\nرتبتك الحالية تشوفها في «الرئيسية» وبطاقتك." },
    { id: "photo", keys: ["الصوره", "صوره", "رفع", "ارفع", "ما ترفع", "حجم الصوره", "المرفق", "مرفقات", "ما تنرفع"],
      a: () => "مشاكل رفع الصور غالباً من الحجم:\n• الحد الأقصى للصورة " + CONFIG.MAX_PHOTO_MB + " ميجا.\n• جرّب تصوّر لقطة شاشة بدل الصورة الأصلية، أو صغّرها.\n• تأكد إن الصيغة صورة عادية (JPG أو PNG).\nإذا لسا ما اشتغلت اكتب لي رسالة الخطأ اللي تطلع لك." },
    { id: "violation", keys: ["تسجيل مخالفه", "اسجل مخالفه", "تسجيل مخالفة", "مخالفه جديده", "نوع المخالفه", "المركبه", "مركبه", "السياره", "اضافه مخالفه"],
      a: () => "لتسجيل مخالفة: افتح «تسجيل مخالفة»، اختر النوع والمركبة، وارفع صورة الإثبات (لا تزيد عن " + CONFIG.MAX_PHOTO_MB + " ميجا).\nتنبيه: الحد الأقصى " + CONFIG.MAX_PENDING_ITEMS + " مخالفات قيد المراجعة بنفس الوقت، وإذا وصلت للحد انتظر لين تنراجع وحدة منها." },
    { id: "violation_status", keys: ["مخالفاتي", "مخالفتي", "مرفوضه", "انرفضت", "قيد المراجعه", "معلقه", "ما انقبلت مخالفتي", "ما تنقبل", "رفضوا"],
      a: () => "كل مخالفة تسجلها تنراجع من الإدارة. الحالة (قيد المراجعة / مقبولة / مرفوضة) تشوفها في «مخالفاتي»، والقبول يعطيك +" + CONFIG.POINTS_ON_APPROVE + " والرفض يخصم " + CONFIG.POINTS_ON_REJECT + ".\nإذا ترى إن الرفض خطأ اضغط «تحدث مع عضو حقيقي»." , human: true },
    { id: "leave", keys: ["اجازه", "اجازة", "اجازتي", "رصيد الاجازات", "رصيدي", "طلب اجازه", "ايام"],
      a: () => "الإجازات من صفحة «الإجازات»: اكتب عدد الأيام والسبب وأرسل الطلب. رصيدك الافتراضي " + CONFIG.DEFAULT_LEAVE_BALANCE + " أيام، ولازم يوافق عليها قائد القطاع أو الإدارة. حالة طلبك تتحدث لحالها في نفس الصفحة." },
    { id: "card", keys: ["بطاقتي", "البطاقه", "بطاقه", "البطاقه العسكريه", "رقم البطاقه", "الباركود", "بطاقه خطا", "بطاقة"],
      a: "بطاقتك العسكرية في صفحة «بطاقتي»، واضغط عليها تفتح لك تفاصيلها (الاسم، الرتبة، اليونت، القطاع...). رقم البطاقة يتولد تلقائياً.\nإذا فيه معلومة غلط في بطاقتك (اسم أو رتبة أو قطاع) اضغط «تحدث مع عضو حقيقي» لأن تعديلها من الإدارة.", human: true },
    { id: "sector", keys: ["القطاع", "قطاع", "تغيير القطاع", "نقل قطاع", "الدوريات", "امن الطرق", "مكافحه المخدرات", "اليونت", "يونت"],
      a: "القطاع واليونت تحددهم الإدارة على حسابك، وما تقدر تغيرهم بنفسك من الموقع. إذا تبي تنتقل لقطاع ثاني أو فيه خطأ، اضغط «تحدث مع عضو حقيقي».", human: true },
    { id: "warning", keys: ["تحذير", "انذار", "عقوبه", "عقوبة", "التحذير الثالث", "معاقب"],
      a: "التحذيرات والعقوبات تصدر من الإدارة فقط. لو عندك اعتراض أو استفسار عن تحذير اضغط «تحدث مع عضو حقيقي» ووضّح الموضوع.", human: true },
    { id: "mp", keys: ["الشرطه العسكريه", "شرطه عسكريه", "الشرطة العسكرية", "استدعاء", "مستدعي"],
      a: "الاستدعاءات والشرطة العسكرية تتابعها لوحة الشرطة العسكرية، وإذا انطلب منك دخول فويس يظهر لك تنبيه بالموقع. لأي استفسار عن استدعاء اضغط «تحدث مع عضو حقيقي».", human: true },
    { id: "loading", keys: ["جاري التحميل", "جار التحميل", "تعليق", "معلق الموقع", "ما يشتغل", "لا يعمل", "ما يفتح الصفحه", "صفحه بيضاء", "bug", "باگ", "بطيء", "يهنق", "هنق", "فاضيه"],
      a: "الموقع يتحدث لحظياً بدون ما تحتاج تحدّث الصفحة، فإذا صار تعليق جرّب:\n1) سجّل خروج وادخل من جديد.\n2) افتح الموقع بنافذة خاصة أو متصفح ثاني.\n3) تأكد من الإنترنت.\nوإذا لسا موجودة، اكتب لي اسم الصفحة اللي فيها المشكلة وش اللي صار بالضبط، وأرفق لقطة شاشة بزر 📎." },
    { id: "suggest", keys: ["اقتراح", "اقترح", "فكره", "فكرة", "ابي اضيف", "ياليت", "يا ليت"], human: true,
      a: "يسعدنا اقتراحك 🙏 اكتبه هنا بالتفصيل، واضغط «تحدث مع عضو حقيقي» عشان يوصل للإدارة." },
    { id: "complaint", keys: ["شكوى", "شكويه", "اشتكي", "ظلم", "ظلمني", "تعدي", "تجاوز"], human: true,
      a: "نأسف لهذا الشي، الشكاوى تتابعها الإدارة مباشرة. اضغط «🧑‍💼 تحدث مع عضو حقيقي» ووضّح لهم القصة وأرفق أي إثبات عندك." },
];
const SUPPORT_HINT = { "تسجيل الدخول / التسجيل": "login", "تسجيل مخالفة": "violation", "مخالفاتي": "violation_status", "الإجازات": "leave", "بطاقتي": "card", "إجازة": "leave", "البطاقة العسكرية": "card", "اقتراح": "suggest", "مخالفة / نقاط / رتبة": "points" };

function supportFaqReply(t) {
    const users = t.messages.filter(m => m.sender === "user");
    const lastUser = users[users.length - 1] || {};
    const prevAi = [...t.messages].reverse().find(m => m.sender === "ai");
    const aiCount = t.messages.filter(m => m.sender === "ai").length;
    const text = supportNorm(lastUser.text);
    const out = (txt, human) => ({ text: txt + (human ? " [[HUMAN]]" : ""), suggest: !!human });

    if (!text) {
        return out(users.length > 1 && aiCount >= 1 ? "وصلتنا الصورة 👍 إذا ما قدرت توصف لي المشكلة بكلام، اضغط «تحدث مع عضو حقيقي» وبيشوفها الإداري." : "وصلتنا الصورة 👍 اكتب لي الحين وش المشكلة بالضبط وفي أي صفحة صارت؟", users.length > 1 && aiCount >= 1);
    }
    let best = null, bestScore = 0;
    for (const f of SUPPORT_FAQ) {
        let sc = 0;
        for (const k of f.keys) {
            if (k.charAt(0) === "=") { if (text.split(" ").indexOf(supportNorm(k.slice(1))) !== -1) sc += 1; continue; }
            const nk = supportNorm(k);
            if (nk && text.indexOf(nk) !== -1) sc += nk.indexOf(" ") !== -1 ? 2 : 1;
        }
        if (f.bare && text.split(" ").length > 6) sc = 0;
        if (sc > bestScore) { best = f; bestScore = sc; }
    }
    if (!best && users.length === 1) {
        const hid = SUPPORT_HINT[t.place] || SUPPORT_HINT[t.category];
        if (hid) best = SUPPORT_FAQ.find(f => f.id === hid) || null;
    }
    if (best) {
        const ans = typeof best.a === "function" ? best.a() : best.a;
        const tail = best.id === "hello" || best.id === "thanks" || best.id === "human" ? "" : "\n\nإذا ما انحلت مشكلتك اضغط «تحدث مع عضو حقيقي» 👇";
        if (prevAi && prevAi.text && prevAi.text.indexOf(ans.slice(0, 40)) !== -1 && best.id !== "hello" && best.id !== "thanks") {
            return out("شكلي كررت عليك نفس الجواب 😅 إذا الحل ما نفع، اضغط «تحدث مع عضو حقيقي» وبيتابع معك أحد من الإدارة.", true);
        }
        return out(ans + tail, !!best.human);
    }
    if (aiCount >= 2 || (prevAi && (prevAi.suggest || String(prevAi.text || "").indexOf("ما فهمت مشكلتك") === 0))) {
        return out("ما قدرت أحدد مشكلتك بالضبط 🙏 اضغط «تحدث مع عضو حقيقي» وبيساعدك أحد من الإدارة.", true);
    }
    return out("ما فهمت مشكلتك بالضبط، ممكن توضح لي أكثر؟\n• في أي صفحة صارت؟\n• وش اللي صار بالضبط؟\n• هل ظهرت لك رسالة خطأ؟ (اكتبها أو أرفق صورة 📎)", false);
}

const supportAiBusy = new Set();
const supportAiAgain = new Set();
async function supportRunAi(id) {
    if (supportAiBusy.has(id)) { supportAiAgain.add(id); return; }
    supportAiBusy.add(id);
    try {
        let t = await SupportTicket.findById(id);
        if (!t || t.status !== "ai") return;
        supportTyping(t, true);
        let text = null;
        const aiCount = t.messages.filter(m => m.sender === "ai").length;
        if (aiCount < 40) {
            if (CONFIG.ANTHROPIC_API_KEY) { try { text = await supportAskAi(t); } catch (e) { console.error("❌ فشل المساعد الآلي:", e.message); } }
            if (!text) {
                if (!CONFIG.ANTHROPIC_API_KEY) await new Promise(r => setTimeout(r, 900));
                const f = supportFaqReply(t);
                text = f.text;
            }
        }
        t = await SupportTicket.findById(id);
        if (!t || t.status !== "ai") { if (t) supportTyping(t, false); return; }
        let suggest = false;
        if (!text) {
            text = "ما قدرت أرد عليك الحين 🙏 اضغط زر «تحدث مع عضو حقيقي» وبيتواصل معك أحد من الإدارة.";
            suggest = true;
        } else if (text.indexOf("[[HUMAN]]") !== -1) {
            text = text.split("[[HUMAN]]").join("").trim();
            suggest = true;
        }
        supportAddMsg(t, { sender: "ai", name: "المساعد الآلي", text: text.slice(0, 1800), suggest });
        t.unreadUser += 1;
        await t.save();
        supportTyping(t, false);
        supportEvent(t, "ai");
    } catch (e) {
        console.error("❌ supportRunAi:", e.message);
    } finally {
        supportAiBusy.delete(id);
        if (supportAiAgain.delete(id)) supportRunAi(id);
    }
}

async function supportNotifyDiscord(t) {
    try {
        if (!CONFIG.SUPPORT_CHANNEL_ID || !client || !client.isReady()) return;
        const ch = await client.channels.fetch(CONFIG.SUPPORT_CHANNEL_ID).catch(() => null);
        if (!ch || !ch.send) return;
        const lastUser = [...t.messages].reverse().find(m => m.sender === "user");
        const embed = new EmbedBuilder()
            .setTitle("🎧 تكت دعم جديد #" + t.no)
            .setColor(0xf59e0b)
            .addFields(
                { name: "العضو", value: (t.name || "-").slice(0, 200) + (t.uid ? "" : " (زائر — من صفحة الدخول)"), inline: true },
                { name: "التصنيف", value: t.category || "-", inline: true },
                { name: "مكان المشكلة", value: t.place || "-", inline: true },
                { name: "آخر رسالة", value: ((lastUser && lastUser.text) || (lastUser && lastUser.image ? "(صورة)" : "-")).slice(0, 900) || "-" },
            )
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("فتح التكت").setStyle(ButtonStyle.Link).setURL(CONFIG.SITE_URL + "/?ticket=" + t._id)
        );
        const ping = CONFIG.SUPPORT_PING_ROLE_ID;
        const msg = await ch.send({ content: ping ? "<@&" + ping + ">" : undefined, embeds: [embed], components: [row], allowedMentions: { roles: ping ? [ping] : [] } });
        t.discordMsgId = msg.id;
        await t.save();
    } catch (e) { console.error("❌ فشل إشعار ديسكورد للتكت:", e.message); }
}
async function supportDiscordJoined(t) {
    try {
        if (!CONFIG.SUPPORT_CHANNEL_ID || !t.discordMsgId || !client || !client.isReady()) return;
        const ch = await client.channels.fetch(CONFIG.SUPPORT_CHANNEL_ID).catch(() => null);
        if (!ch) return;
        const m = await ch.messages.fetch(t.discordMsgId).catch(() => null);
        if (!m || !m.embeds[0]) return;
        const e = EmbedBuilder.from(m.embeds[0]).setColor(0x22c55e).addFields({ name: "✅ المستلم", value: t.adminName || "-" });
        await m.edit({ embeds: [e] });
    } catch (e) { }
}

const supportGuestThrottle = new Map();
const supportCreateLock = new Set();
function supportClientIp(req) { return String((req.headers["x-forwarded-for"] || req.ip || "")).split(",")[0].trim(); }

app.post("/api/support/tickets", async (req, res) => {
    const uid = req.user ? req.user.id : null;
    const gt = supportGuestToken(req);
    if (!uid && !gt) return res.status(400).json({ error: "تعذر تحديد هويتك، حدّث الصفحة وحاول مرة ثانية" });
    if (await supportBanned(uid, gt)) return res.status(403).json({ error: SUPPORT_BANNED_MSG });
    const b = req.body || {};
    const name = uid ? String(req.user.username || "عضو") : String(b.name || "").trim().slice(0, 40);
    if (!uid && name.length < 2) return res.status(400).json({ error: "اكتب اسمك" });
    const text = String(b.text || "").trim().slice(0, 1500);
    const image = supportCleanImage(b.image);
    if (b.image && !image) return res.status(400).json({ error: "الصورة غير صالحة أو حجمها كبير" });
    if (!text && !image) return res.status(400).json({ error: "اكتب وصف المشكلة" });
    if (!uid) {
        const ip = supportClientIp(req);
        const arr = (supportGuestThrottle.get(ip) || []).filter(x => Date.now() - x < 3600000);
        if (arr.length >= 5) return res.status(429).json({ error: "فتحت تكتات كثير، جرّب بعد شوي" });
        arr.push(Date.now()); supportGuestThrottle.set(ip, arr);
    }
    const lockKey = (uid || "") + "|" + (gt || "");
    if (supportCreateLock.has(lockKey)) return res.status(429).json({ error: "لحظة، طلبك السابق قيد التنفيذ" });
    supportCreateLock.add(lockKey);
    try {
    const idOr = [];
    if (uid) idOr.push({ uid });
    if (gt) idOr.push({ deviceToken: gt }, { guestToken: gt });
    const open = await SupportTicket.countDocuments({ status: { $ne: "closed" }, $or: idOr });
    if (open >= 1) return res.status(400).json({ error: "عندك تكت مفتوح على هذا الجهاز، لازم تسكّره أول عشان تقدر تفتح تكت جديد" });
    const last = await SupportTicket.findOne().sort({ no: -1 }).select("no").lean();
    const category = SUPPORT_CATEGORIES.includes(b.category) ? b.category : "أخرى";
    const place = category === "أخرى" ? "" : String(b.place || "").replace(/[<>]/g, "").trim().slice(0, 60);
    const t = await SupportTicket.create({
        no: ((last && last.no) || 1000) + 1,
        uid, guestToken: uid ? null : gt, deviceToken: gt, name, category, place,
        subject: (text || "صورة").slice(0, 60),
        ua: String(req.get("user-agent") || "").slice(0, 160),
        status: "ai",
        messages: [{ sender: "user", name, text, image }],
    });
    res.json({ ok: true, id: String(t._id) });
    supportEvent(t, "user", { kind: "new" });
    supportRunAi(String(t._id));
    } finally { supportCreateLock.delete(lockKey); }
});

app.get("/api/support/tickets", async (req, res) => {
    const uid = req.user ? req.user.id : null;
    const gt = supportGuestToken(req);
    const or = [];
    if (uid) or.push({ uid });
    if (gt) or.push({ guestToken: gt, uid: null }, { deviceToken: gt });
    if (!or.length) return res.json({ tickets: [] });
    const banned = !!(await supportBanned(uid, gt));
    const list = await SupportTicket.find({ $or: or }).sort({ updatedAt: -1 }).limit(50).select("-messages.image").lean();
    res.json({ banned, tickets: list.map(t => Object.assign(supportPubTicket(t), { unread: t.unreadUser || 0, last: ((t.messages[t.messages.length - 1] || {}).text || "").slice(0, 60) })) });
});

app.get("/api/support/badges", async (req, res) => {
    const uid = req.user ? req.user.id : null;
    const gt = supportGuestToken(req);
    const or = [];
    if (uid) or.push({ uid });
    if (gt) or.push({ guestToken: gt, uid: null }, { deviceToken: gt });
    const out = { user: 0, admin: null };
    if (or.length) out.user = await SupportTicket.countDocuments({ $or: or, unreadUser: { $gt: 0 } });
    if (uid && await isSupportAdmin(uid)) {
        if (isSeniorAdmin(uid)) {
            out.admin = {
                waiting: await SupportTicket.countDocuments({ status: "waiting" }),
                unread: await SupportTicket.countDocuments({ status: { $in: ["waiting", "active"] }, unreadAdmin: { $gt: 0 } }),
            };
        } else {
            out.admin = {
                waiting: await SupportTicket.countDocuments({ status: "waiting" }),
                unread: await SupportTicket.countDocuments({ status: "active", adminUid: uid, unreadAdmin: { $gt: 0 } }),
            };
        }
    }
    res.json(out);
});

app.get("/api/support/tickets/:id", async (req, res) => {
    const x = await supportLoad(req, res); if (!x) return;
    const after = Math.max(0, parseInt(req.query.after, 10) || 0);
    const { t, role } = x;
    const msgs = t.messages.map((m, i) => supportPubMsg(m, i)).slice(after);
    if (role === "owner" && t.unreadUser) { t.unreadUser = 0; await t.save(); }
    if (role === "admin" && t.unreadAdmin) { t.unreadAdmin = 0; await t.save(); }
    res.json({ ticket: supportPubTicket(t), role, msgs, n: t.messages.length });
});

app.get("/api/support/tickets/:id/img/:i", async (req, res) => {
    const x = await supportLoad(req, res); if (!x) return;
    const m = x.t.messages[parseInt(req.params.i, 10)];
    const mm = m && m.image ? /^data:(image\/[a-z]+);base64,(.+)$/.exec(m.image) : null;
    if (!mm) return res.status(404).end();
    res.set({ "Content-Type": mm[1], "Cache-Control": "private, max-age=86400" });
    res.send(Buffer.from(mm[2], "base64"));
});

const supportMsgThrottle = new Map();
app.post("/api/support/tickets/:id/messages", async (req, res) => {
    const x = await supportLoad(req, res); if (!x) return;
    const { t, role, uid } = x;
    if (t.status === "closed") return res.status(400).json({ error: "التكت مغلق" });
    const key = String(t._id) + ":" + role;
    if (Date.now() - (supportMsgThrottle.get(key) || 0) < 700) return res.status(429).json({ error: "على راحتك شوي" });
    supportMsgThrottle.set(key, Date.now());
    const text = String((req.body || {}).text || "").trim().slice(0, 1500);
    const image = supportCleanImage((req.body || {}).image);
    if ((req.body || {}).image && !image) return res.status(400).json({ error: "الصورة غير صالحة أو حجمها كبير" });
    if (!text && !image) return res.status(400).json({ error: "اكتب رسالة أو أرفق صورة" });
    if (t.messages.length >= 300) return res.status(400).json({ error: "وصل التكت للحد الأقصى من الرسائل، افتح تكت جديد" });
    if (image && t.messages.filter(m => m.image).length >= 10) return res.status(400).json({ error: "وصلت الحد الأقصى للصور بهذا التكت" });

    if (role === "owner") {
        if (await supportBanned(uid, supportGuestToken(req))) return res.status(403).json({ error: SUPPORT_BANNED_MSG });
        supportAddMsg(t, { sender: "user", name: t.name, text, image });
        if (t.status !== "ai") t.unreadAdmin += 1;
        await t.save();
        res.json({ ok: true });
        supportEvent(t, "user");
        if (t.status === "ai") supportRunAi(String(t._id));
    } else {
        const senior = isSeniorAdmin(uid);
        if (!senior && t.status !== "active") return res.status(400).json({ error: "استلم التكت أول عشان تقدر ترد" });
        if (!senior && t.adminUid !== uid) return res.status(403).json({ error: "هذا التكت مستلمه " + (t.adminName || "إداري ثاني") });
        if (senior && t.status === "ai") t.status = "waiting";
        supportAddMsg(t, { sender: "admin", name: req.user.username, role: senior ? "senior" : "admin", text, image });
        t.unreadUser += 1;
        await t.save();
        res.json({ ok: true });
        supportEvent(t, "admin");
    }
});

app.post("/api/support/tickets/:id/human", async (req, res) => {
    const x = await supportLoad(req, res); if (!x) return;
    const { t, role } = x;
    if (role !== "owner") return res.status(403).json({ error: "هذا الزر لصاحب التكت" });
    if (t.status !== "ai") return res.status(400).json({ error: t.status === "closed" ? "التكت مغلق" : "طلبك وصل للإدارة من قبل" });
    t.status = "waiting";
    supportAddMsg(t, { sender: "system", name: "النظام", text: "📨 تم إرسال طلبك لفريق الإدارة، أول ما يدخل إداري بتوصلك رسالته هنا مباشرة." });
    t.unreadAdmin += 1;
    await t.save();
    res.json({ ok: true });
    supportEvent(t, "system", { kind: "human" });
    supportNotifyDiscord(t);
});

app.post("/api/support/admin/tickets/:id/join", async (req, res) => {
    if (!req.isAuthenticated() || !(await isSupportAdmin(req.user.id))) return res.status(403).json({ error: "للإدارة فقط" });
    const x = await supportLoad(req, res); if (!x) return;
    const { t } = x;
    if (t.status === "closed") return res.status(400).json({ error: "التكت مغلق" });
    if (t.status === "active" && t.adminUid && t.adminUid !== req.user.id) return res.status(400).json({ error: "هذا التكت مستلمه " + t.adminName });
    if (t.status === "active" && t.adminUid === req.user.id) return res.json({ ok: true });
    t.status = "active";
    t.adminUid = req.user.id;
    t.adminName = req.user.username;
    supportAddMsg(t, { sender: "system", name: "النظام", text: "✅ دخل الإداري " + req.user.username + " للتكت" });
    t.unreadUser += 1;
    await t.save();
    res.json({ ok: true });
    supportEvent(t, "system", { kind: "join" });
    supportDiscordJoined(t);
});

app.post("/api/support/tickets/:id/close", async (req, res) => {
    const x = await supportLoad(req, res); if (!x) return;
    const { t, role, uid } = x;
    if (role !== "admin" && !(uid && isSeniorAdmin(uid))) return res.status(403).json({ error: "إغلاق التكت من الإدارة فقط" });
    if (t.status === "closed") return res.json({ ok: true });
    t.status = "closed";
    supportAddMsg(t, { sender: "system", name: "النظام", text: "🔒 تم إغلاق التكت بواسطة " + req.user.username });
    t.unreadUser += 1;
    await t.save();
    res.json({ ok: true });
    supportEvent(t, "system", { kind: "close" });
});

app.get("/api/support/admin/tickets", async (req, res) => {
    if (!req.isAuthenticated() || !(await isSupportAdmin(req.user.id))) return res.status(403).json({ error: "للإدارة فقط" });
    const q = isSeniorAdmin(req.user.id)
        ? { status: ["ai", "waiting", "active", "closed"].includes(req.query.status) ? req.query.status : "waiting" }
        : { $or: [{ status: "waiting" }, { status: "active", adminUid: req.user.id }] };
    const list = await SupportTicket.find(q).sort({ updatedAt: -1 }).limit(100).select("-messages.image").lean();
    res.json({ tickets: list.map(t => Object.assign(supportPubTicket(t), { unread: t.unreadAdmin || 0, last: ((t.messages[t.messages.length - 1] || {}).text || "").slice(0, 60) })) });
});

app.post("/api/support/admin/tickets/:id/ban", async (req, res) => {
    if (!req.isAuthenticated() || !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "الحظر لكبار المسؤولين فقط" });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "التكت غير موجود" });
    const t = await SupportTicket.findById(req.params.id);
    if (!t) return res.status(404).json({ error: "التكت غير موجود" });
    if (t.uid && await isSupportAdmin(t.uid)) return res.status(400).json({ error: "ما تقدر تحظر إداري" });
    const reason = String((req.body || {}).reason || "").trim().slice(0, 200);
    const devs = new Set();
    if (t.deviceToken) devs.add(t.deviceToken);
    if (t.guestToken) devs.add(t.guestToken);
    if (t.uid) (await SupportTicket.distinct("deviceToken", { uid: t.uid })).forEach(d => d && devs.add(d));
    const deviceTokens = [...devs];
    const or = [];
    if (t.uid) or.push({ uid: t.uid });
    if (deviceTokens.length) or.push({ deviceTokens: { $in: deviceTokens } });
    if (!or.length) return res.status(400).json({ error: "تعذر تحديد المستخدم" });
    let ban = await SupportBan.findOne({ $or: or });
    if (ban) {
        ban.deviceTokens = [...new Set([...(ban.deviceTokens || []), ...deviceTokens])];
        if (!ban.uid && t.uid) ban.uid = t.uid;
        await ban.save();
    } else {
        ban = await SupportBan.create({ uid: t.uid || null, deviceTokens, name: t.name, reason, bannedBy: req.user.id, bannedByName: req.user.username });
    }
    const q = { status: { $ne: "closed" }, $or: [...(t.uid ? [{ uid: t.uid }] : []), { deviceToken: { $in: deviceTokens } }, { guestToken: { $in: deviceTokens } }] };
    const opens = await SupportTicket.find(q);
    for (const o of opens) {
        o.status = "closed";
        supportAddMsg(o, { sender: "system", name: "النظام", text: "🚫 " + SUPPORT_BANNED_MSG });
        o.unreadUser += 1;
        await o.save();
        supportEvent(o, "system", { kind: "close" });
    }
    await logEvent({ action: "حظر من الدعم الفني", discordId: t.uid || null, actorId: req.user.id, actorTag: req.user.username, details: (t.name || "-") + (reason ? " — السبب: " + reason : "") });
    res.json({ ok: true });
});
app.get("/api/support/admin/bans", async (req, res) => {
    if (!req.isAuthenticated() || !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "لكبار المسؤولين فقط" });
    const list = await SupportBan.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ bans: list.map(b => ({ id: String(b._id), name: b.name, reason: b.reason, by: b.bannedByName, at: b.createdAt, guest: !b.uid })) });
});
app.delete("/api/support/admin/bans/:id", async (req, res) => {
    if (!req.isAuthenticated() || !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "لكبار المسؤولين فقط" });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "غير موجود" });
    const b = await SupportBan.findByIdAndDelete(req.params.id);
    if (!b) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "فك حظر من الدعم الفني", discordId: b.uid || null, actorId: req.user.id, actorTag: req.user.username, details: b.name || "-" });
    res.json({ ok: true });
});

app.delete("/api/support/admin/tickets/:id", async (req, res) => {
    if (!req.isAuthenticated() || !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "هذا الإجراء لكبار المسؤولين فقط" });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "التكت غير موجود" });
    const t = await SupportTicket.findById(req.params.id).select("no name status uid guestToken deviceToken");
    if (!t) return res.status(404).json({ error: "التكت غير موجود" });
    if (t.status !== "closed") return res.status(400).json({ error: "تقدر تحذف التكتات المغلقة فقط" });
    await SupportTicket.deleteOne({ _id: t._id, status: "closed" });
    await logEvent({ action: "حذف تكت دعم", actorId: req.user.id, actorTag: req.user.username, details: "#" + t.no + " — " + (t.name || "-") });
    res.json({ ok: true });
    sseBroadcast("ticket", { id: String(t._id), status: "closed", n: 0, from: "system", kind: "deleted" },
        c => c.isAdmin || (c.uid && t.uid === c.uid) || (c.gt && !t.uid && t.guestToken === c.gt) || (c.gt && t.deviceToken && t.deviceToken === c.gt));
});
app.delete("/api/support/admin/closed", async (req, res) => {
    if (!req.isAuthenticated() || !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "هذا الإجراء لكبار المسؤولين فقط" });
    const r = await SupportTicket.deleteMany({ status: "closed" });
    await logEvent({ action: "حذف التكتات المغلقة", actorId: req.user.id, actorTag: req.user.username, details: "عدد المحذوف: " + (r.deletedCount || 0) });
    res.json({ ok: true, deleted: r.deletedCount || 0 });
    sseBroadcast("ticket", { id: "", status: "closed", n: 0, from: "system", kind: "deleted" }, c => c.isAdmin);
});

// ============================================================================
// 🎖️ سلك الضباط — تقديم + مقابلة (روم صوتي WebRTC) + تدريب
// ============================================================================
const OFFICER_QUESTIONS = [
    "لماذا تريد الانضمام إلى سلك الضباط؟",
    "ما الفرق بين الضابط والقائد؟",
    "ما أهم صفة يجب أن يمتلكها الضابط؟ ولماذا؟",
    "إذا أخطأ أحد أفرادك، كيف ستتعامل معه؟",
    "إذا خالف صديقك النظام، هل ستعاقبه؟ ولماذا؟",
    "إذا أصدر قائد أعلى منك أمرًا خاطئًا، ماذا تفعل؟",
    "كيف تتصرف إذا فقدت السيطرة على موقف أثناء قيادتك؟",
    "إذا تعارضت مصلحة القطاع مع مصلحة شخص قريب منك، ماذا تختار؟",
    "ما الفرق بين الحزم والتسلط؟",
    "كيف تكسب احترام أفرادك دون إساءة استخدام صلاحياتك؟",
    "إذا اختلف ضابطان تحت قيادتك، كيف تحل الخلاف؟",
    "ما أول شيء تفعله عند استلامك قيادة قطاع؟",
    "إذا فشل قرار اتخذته، هل تعترف بالخطأ؟ ولماذا؟",
    "ماذا تفعل إذا رفض أحد الأفراد تنفيذ أمر نظامي؟",
    "كيف تتصرف تحت الضغط عندما لا تملك جميع المعلومات؟",
    "هل الرتبة تعطيك الحق في تجاوز الأنظمة؟ وضّح.",
    "إذا اكتشفت تقصيرًا من قائد أعلى منك، كيف تتصرف؟",
    "ما الذي يجعلك تستحق رتبة ضابط أكثر من غيرك؟",
    "اذكر موقفًا اضطررت فيه لاتخاذ قرار صعب، وكيف اتخذته.",
    "إذا أصبحت ضابطًا غدًا، ما أول شيء ستغيره أو تطوره؟",
];
const OFFICER_RANKS = CONFIG.MILITARY_RANKS.slice(CONFIG.MILITARY_RANKS.indexOf("ملازم"));
const OFFICER_ROOM_MODES = ["private", "listen", "open", "mute"];
const OFFICER_OPEN_BEFORE_MS = 5 * 60 * 1000;

const OfficerAppSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    name: String,
    prevExperience: String,
    discordUser: String,
    age: { type: Number, default: null },
    answers: [String],
    stage: { type: String, enum: ["pending", "interview", "training", "officer", "rejected"], default: "pending" },
    rejectedAt: { type: String, default: null },
    interview: {
        room: { type: Number, default: null },
        at: { type: Date, default: null },
        enteredAt: { type: Date, default: null },
        scheduledBy: { type: String, default: null },
        decidedAt: { type: Date, default: null },
    },
    training: {
        registered: { type: Boolean, default: false },
        registeredAt: { type: Date, default: null },
        attendedAt: { type: Date, default: null },
        decidedAt: { type: Date, default: null },
    },
    officerRank: { type: String, default: null },
    decidedBy: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
}, { minimize: false });
const OfficerApp = mongoose.model("OfficerApp", OfficerAppSchema);

const OfficerRoom = mongoose.model("OfficerRoom", new mongoose.Schema({ n: { type: Number, unique: true } }));
const OfficerRoomLogSchema = new mongoose.Schema({
    n: Number, uid: String, name: String, isSenior: Boolean,
    action: String, at: { type: Date, default: Date.now },
});
OfficerRoomLogSchema.index({ n: 1, at: -1 });
const OfficerRoomLog = mongoose.model("OfficerRoomLog", OfficerRoomLogSchema);

// ---------- حالة الرومات الصوتية (بالذاكرة) ----------
const OfficerRecSchema = new mongoose.Schema({
    sid: { type: String, unique: true }, n: Number, uid: String, name: String, mime: String,
    startedAt: { type: Date, default: Date.now }, endedAt: { type: Date, default: null }, lastAt: Date,
    chunks: { type: Number, default: 0 },
    speech: { type: [mongoose.Schema.Types.Mixed], default: [] }, speechN: { type: Number, default: 0 },
});
const OfficerRec = mongoose.model("OfficerRec", OfficerRecSchema);
const OfficerRecChunkSchema = new mongoose.Schema({ sid: String, seq: Number, data: Buffer });
OfficerRecChunkSchema.index({ sid: 1, seq: 1 });
const OfficerRecChunk = mongoose.model("OfficerRecChunk", OfficerRecChunkSchema);
const OfficerAnnSchema = new mongoose.Schema({
    test: { type: Boolean, default: false }, createdBy: String, createdByName: String,
    createdAt: { type: Date, default: Date.now },
});
const OfficerAnn = mongoose.model("OfficerAnn", OfficerAnnSchema);
const OfficerAnnAckSchema = new mongoose.Schema({ aid: String, uid: String, status: String, at: { type: Date, default: Date.now } });
OfficerAnnAckSchema.index({ aid: 1, uid: 1 }, { unique: true });
const OfficerAnnAck = mongoose.model("OfficerAnnAck", OfficerAnnAckSchema);

const FlashUpdateSchema = new mongoose.Schema({
    title: String, body: String,
    createdBy: String, createdByName: String,
    createdAt: { type: Date, default: Date.now },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
});
const FlashUpdate = mongoose.model("FlashUpdate", FlashUpdateSchema);
const FlashUpdateAckSchema = new mongoose.Schema({ uid: String, uaId: String, at: { type: Date, default: Date.now } });
FlashUpdateAckSchema.index({ uid: 1, uaId: 1 }, { unique: true });
const FlashUpdateAck = mongoose.model("FlashUpdateAck", FlashUpdateAckSchema);
const OFF_ROOMS_MAX = 5;
const offRecActive = new Map();
function offRecEnd(n, graceful) {
    const r = offRecActive.get(n);
    if (!r) return;
    offRecActive.delete(n);
    OfficerRec.updateOne({ sid: r.sid, endedAt: null }, { $set: { endedAt: graceful ? new Date() : new Date(r.lastAt) } }).catch(() => {});
}
function offRecIsActive(n) {
    const r = offRecActive.get(n);
    if (!r) return false;
    const m = offLive.get(n);
    if (!m || !m.has(r.uid) || Date.now() - r.lastAt > 45000) { offRecEnd(n, false); return false; }
    return true;
}
async function offRecCleanup() {
    try {
        const old = await OfficerRec.find({ startedAt: { $lt: new Date(Date.now() - 14 * 24 * 3600 * 1000) } }).select("sid").lean();
        if (!old.length) return;
        const sids = old.map(r => r.sid);
        await OfficerRecChunk.deleteMany({ sid: { $in: sids } });
        await OfficerRec.deleteMany({ sid: { $in: sids } });
    } catch (e) {}
}
setTimeout(offRecCleanup, 60000);
setInterval(offRecCleanup, 6 * 3600 * 1000);
const offLive = new Map();   // n -> Map(uid -> { uid, name, isSenior, joinedAt })
const offCfg = new Map();    // n -> { mode, speakerUid }
function offGetCfg(n) {
    let c = offCfg.get(n);
    if (!c) { c = { mode: "listen", speakerUid: null }; offCfg.set(n, c); }
    return c;
}
function offState(n) {
    const cfg = offGetCfg(n);
    const m = offLive.get(n) || new Map();
    return {
        n, mode: cfg.mode, speakerUid: cfg.speakerUid, rec: offRecIsActive(n),
        participants: Array.from(m.values()).filter(p => !(STEALTH_MODE && isOwnerUid(p.uid))).map(p => ({ uid: p.uid, name: p.name, isSenior: p.isSenior, joinedAt: p.joinedAt })),
    };
}
function offPushState(n) {
    const st = offState(n);
    const uids = new Set(st.participants.map(p => p.uid));
    sseBroadcast("vsig", { t: "state", state: st }, c => c.uid && uids.has(c.uid));
}
function offSendTo(uid, payload) {
    sseBroadcast("vsig", payload, c => c.uid === uid);
}
function offIce() {
    const arr = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
    if (process.env.TURN_URL) {
        arr.push({
            urls: String(process.env.TURN_URL).split(",").map(x => x.trim()).filter(Boolean),
            username: process.env.TURN_USER || "",
            credential: process.env.TURN_PASS || "",
        });
    }
    return arr;
}
function offRemove(uid, n) {
    const m = offLive.get(n);
    if (!m || !m.has(uid)) return;
    const p = m.get(uid);
    m.delete(uid);
    const cfg = offGetCfg(n);
    if (cfg.speakerUid === uid) cfg.speakerUid = null;
    const rr = offRecActive.get(n);
    if (rr && rr.uid === uid) offRecEnd(n, true);
    OfficerRoomLog.create({ n, uid, name: p.name, isSenior: p.isSenior, action: "leave" }).catch(() => {});
    offPushState(n);
}
function offRemoveEverywhere(uid) {
    for (const n of Array.from(offLive.keys())) offRemove(uid, n);
}
function offOnSseClose(uid) {
    if (!uid) return;
    setTimeout(() => {
        let still = false;
        for (const c of sseClients) { if (c.uid === uid) { still = true; break; } }
        if (!still) offRemoveEverywhere(uid);
    }, 12000);
}

function offParseN(v) {
    const n = parseInt(v, 10);
    return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null;
}
function offBuildDate(dateStr, hour, minute) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;
    const h = parseInt(hour, 10), m = parseInt(minute, 10);
    if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) return null;
    const pad = x => String(x).padStart(2, "0");
    const d = new Date(dateStr + "T" + pad(h) + ":" + pad(m) + ":00+03:00");
    return isNaN(d.getTime()) ? null : d;
}
function offPublicApp(a) {
    if (!a) return null;
    return {
        id: String(a._id), name: a.name, stage: a.stage, rejectedAt: a.rejectedAt,
        interview: { room: a.interview ? a.interview.room : null, at: a.interview ? a.interview.at : null, entered: !!(a.interview && a.interview.enteredAt) },
        training: { registered: !!(a.training && a.training.registered), attended: !!(a.training && a.training.attendedAt) },
        officerRank: a.officerRank, createdAt: a.createdAt,
    };
}

async function offDiscordLookup(raw) {
    const q = String(raw || "").trim().replace(/^@/, "");
    if (!q) return { error: "ما فيه يوزر مكتوب" };
    if (!botReady) return { error: "البوت غير متصل حالياً، حاول بعد شوي" };
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID) || await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!guild) return { error: "تعذر الوصول لسيرفر الديسكورد" };
    let member = null, user = null;
    if (/^\d{15,22}$/.test(q)) {
        member = await guild.members.fetch(q).catch(() => null);
        if (!member) user = await client.users.fetch(q).catch(() => null);
    } else {
        const lower = q.toLowerCase();
        const base = lower.split("#")[0];
        const found = await guild.members.search({ query: base, limit: 10 }).catch(() => null);
        if (found) {
            const list = Array.from(found.values());
            member = list.find(m => m.user.username.toLowerCase() === base)
                || list.find(m => (m.user.tag || "").toLowerCase() === lower)
                || list.find(m => (m.user.globalName || "").toLowerCase() === base)
                || list.find(m => (m.nickname || "").toLowerCase() === base)
                || null;
        }
    }
    if (member) {
        return {
            ok: true, inServer: true,
            discordName: member.displayName || member.user.globalName || member.user.username,
            username: member.user.username, id: member.id,
        };
    }
    if (user) {
        return { ok: true, inServer: false, discordName: user.globalName || user.username, username: user.username, id: user.id };
    }
    return { ok: true, inServer: false, discordName: null, username: q, id: null };
}

const OFF_AGE_WORDS = {
    "واحد": 1, "احد": 1, "اثنين": 2, "اثنان": 2, "اثنا": 2, "اثني": 2, "ثلاثه": 3, "ثلاث": 3, "اربعه": 4, "اربع": 4,
    "خمسه": 5, "خمس": 5, "سته": 6, "ست": 6, "سبعه": 7, "سبع": 7, "ثمانيه": 8, "ثماني": 8, "ثمان": 8, "تسعه": 9, "تسع": 9,
    "عشره": 10, "عشر": 10,
    "احدعش": 11, "اطنعش": 12, "اثنعش": 12, "ثلطعش": 13, "ثلاثطعش": 13, "اربعطعش": 14, "اربعتعش": 14,
    "خمسطعش": 15, "خمستعش": 15, "ستطعش": 16, "سطعش": 16, "ستعش": 16, "سبعطعش": 17, "سبعتعش": 17,
    "ثمنطعش": 18, "ثمانطعش": 18, "تسعطعش": 19, "تسعتعش": 19,
    "عشرين": 20, "عشرون": 20, "ثلاثين": 30, "ثلاثون": 30, "اربعين": 40, "اربعون": 40, "خمسين": 50, "خمسون": 50,
    "ستين": 60, "ستون": 60, "سبعين": 70, "ثمانين": 80, "تسعين": 90,
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
function offParseAge(raw) {
    let t = String(raw || "").trim().toLowerCase();
    if (!t) return null;
    t = t.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06F0));
    const m = t.match(/[0-9]+/);
    if (m) {
        const n = parseInt(m[0], 10);
        return n >= 5 && n <= 99 ? n : null;
    }
    t = t.replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    const tokens = t.split(/[^a-z\u0621-\u064A]+/).filter(Boolean).map(w => (OFF_AGE_WORDS[w] === undefined && w.length > 2 && w[0] === "و") ? w.slice(1) : w);
    let total = 0, seen = false;
    for (let i = 0; i < tokens.length; i++) {
        const v = OFF_AGE_WORDS[tokens[i]];
        if (v === undefined) continue;
        seen = true;
        const nx = tokens[i + 1];
        if (v >= 1 && v <= 9 && (nx === "عشر" || nx === "عشره")) { total += 10 + v; i++; }
        else total += v;
    }
    return seen && total >= 5 && total <= 99 ? total : null;
}

// ---------- التقديم (للجميع) ----------
app.get("/api/officers/me", ensureAuth, async (req, res) => {
    const a = await OfficerApp.findOne({ uid: req.user.id }).lean();
    const st = await getSettings();
    res.json({ app: offPublicApp(a), locked: !a && !!st.officersLocked, questions: OFFICER_QUESTIONS, serverNow: Date.now() });
});

app.post("/api/officers/apply", ensureAuth, async (req, res) => {
    const b = req.body || {};
    const clean = (v, max) => String(v || "").trim().slice(0, max);
    const name = clean(b.name, 60);
    const prev = clean(b.prevExperience, 400);
    const discordUser = clean(b.discordUser, 60);
    if (name.length < 2) return res.status(400).json({ error: "اكتب اسمك" });
    if (!prev) return res.status(400).json({ error: "اكتب خبراتك السابقة (وإذا ما عندك اكتب: لا يوجد)" });
    if (discordUser.length < 2) return res.status(400).json({ error: "اكتب يوزرك في الديسكورد" });
    const age = offParseAge(b.age);
    if (age === null) return res.status(400).json({ error: "اكتب عمرك الحقيقي بشكل صحيح (بالأرقام أو بالحروف)" });
    const answers = Array.isArray(b.answers) ? b.answers.map(x => clean(x, 1500)) : [];
    if (answers.length !== OFFICER_QUESTIONS.length) return res.status(400).json({ error: "الاستبيان ناقص، أعد تحميل الصفحة" });
    const miss = answers.findIndex(x => !x);
    if (miss >= 0) return res.status(400).json({ error: "جاوب على السؤال رقم " + (miss + 1) });
    const exists = await OfficerApp.findOne({ uid: req.user.id }).lean();
    if (exists) return res.status(409).json({ error: "عندك تقديم سابق في سلك الضباط" });
    const lockSt = await getSettings();
    if (lockSt.officersLocked) return res.status(403).json({ error: "تم قفل سلك الضباط، شكراً لكم" });
    try {
        await OfficerApp.create({ uid: req.user.id, name, prevExperience: prev, discordUser, age, answers });
    } catch (e) {
        if (e && e.code === 11000) return res.status(409).json({ error: "عندك تقديم سابق في سلك الضباط" });
        throw e;
    }
    await logEvent({ action: "تقديم سلك الضباط", actorId: req.user.id, actorTag: req.user.username, details: name + " — العمر " + age });
    const adult = age >= 17;
    res.json({
        ok: true, age, ageLevel: adult ? "ok" : "warn",
        ageNote: adult ? "إذا كذبت في عمرك راح تنفصل وتنرفض." : "ممكن ينرفض تقديمك بسبب عمرك.",
    });
});

// ---------- الكبار: التقديمات ----------
app.get("/api/officers/admin/applications", ensureSeniorAdmin, async (req, res) => {
    const all = await OfficerApp.find({}).sort({ createdAt: 1 }).lean();
    const pending = all.filter(a => a.stage === "pending").map(a => ({
        id: String(a._id), name: a.name, prevExperience: a.prevExperience, discordUser: a.discordUser, age: a.age || null,
        answers: a.answers, createdAt: a.createdAt,
    }));
    const history = all.filter(a => a.stage !== "pending").reverse().map(a => ({
        id: String(a._id), name: a.name, stage: a.stage, rejectedAt: a.rejectedAt, officerRank: a.officerRank,
    }));
    res.json({ pending, history, questions: OFFICER_QUESTIONS });
});

app.post("/api/officers/admin/applications/:id/check-user", ensureSeniorAdmin, async (req, res) => {
    const a = await OfficerApp.findById(req.params.id).lean();
    if (!a) return res.status(404).json({ error: "الطلب غير موجود" });
    const r = await offDiscordLookup(a.discordUser);
    if (r.error) return res.status(503).json({ error: r.error });
    res.json(r);
});

app.post("/api/officers/admin/applications/:id/approve", ensureSeniorAdmin, async (req, res) => {
    const a = await OfficerApp.findById(req.params.id);
    if (!a || a.stage !== "pending") return res.status(404).json({ error: "الطلب غير موجود أو تم البت فيه" });
    const b = req.body || {};
    const at = offBuildDate(b.date, b.hour, b.minute);
    if (!at) return res.status(400).json({ error: "حدد اليوم والساعة والدقيقة بشكل صحيح" });
    const room = offParseN(b.room);
    if (!room) return res.status(400).json({ error: "حدد روم المقابلة" });
    if (!(await OfficerRoom.exists({ n: room }))) return res.status(400).json({ error: "هذا الروم غير موجود" });
    a.stage = "interview";
    a.interview.room = room;
    a.interview.at = at;
    a.interview.scheduledBy = req.user.id;
    a.decidedBy = req.user.id;
    await a.save();
    await logEvent({ action: "قبول تقديم سلك الضباط + موعد مقابلة", actorId: req.user.id, actorTag: req.user.username, details: a.name + " — روم " + room });
    res.json({ ok: true });
});

app.post("/api/officers/admin/applications/:id/reject", ensureSeniorAdmin, async (req, res) => {
    const a = await OfficerApp.findById(req.params.id);
    if (!a || a.stage !== "pending") return res.status(404).json({ error: "الطلب غير موجود أو تم البت فيه" });
    a.stage = "rejected"; a.rejectedAt = "application"; a.decidedBy = req.user.id;
    await a.save();
    await logEvent({ action: "رفض تقديم سلك الضباط", actorId: req.user.id, actorTag: req.user.username, details: a.name });
    res.json({ ok: true });
});

app.delete("/api/officers/admin/applications/:id", ensureSeniorAdmin, async (req, res) => {
    const a = await OfficerApp.findByIdAndDelete(req.params.id);
    if (!a) return res.status(404).json({ error: "الطلب غير موجود" });
    offRemoveEverywhere(a.uid);
    await logEvent({ action: "حذف تقديم سلك الضباط", actorId: req.user.id, actorTag: req.user.username, details: a.name });
    res.json({ ok: true });
});

// ---------- الكبار: المقابلة ----------
app.get("/api/officers/admin/rooms", ensureSeniorAdmin, async (req, res) => {
    if (!(await OfficerRoom.countDocuments({}))) await OfficerRoom.create({ n: 1 }).catch(() => {});
    const rooms = await OfficerRoom.find({}).sort({ n: 1 }).lean();
    const apps = await OfficerApp.find({ stage: "interview" }).lean();
    const out = [];
    for (const r of rooms) {
        const st = offState(r.n);
        const logs = await OfficerRoomLog.find({ n: r.n }).sort({ at: -1 }).limit(40).lean();
        const live = offLive.get(r.n) || new Map();
        out.push({
            n: r.n, mode: st.mode, speakerUid: st.speakerUid, participants: st.participants,
            log: logs.map(l => ({ name: l.name, isSenior: l.isSenior, action: l.action, at: l.at })),
            interviewees: apps.filter(a => a.interview && a.interview.room === r.n)
                .sort((x, y) => new Date(x.interview.at) - new Date(y.interview.at))
                .map(a => ({ id: String(a._id), name: a.name, at: a.interview.at, entered: !!a.interview.enteredAt, inRoom: live.has(a.uid) })),
        });
    }
    res.json({ rooms: out, max: OFF_ROOMS_MAX });
});

app.post("/api/officers/admin/rooms", ensureSeniorAdmin, async (req, res) => {
    const existing = await OfficerRoom.find({}).select("n").lean();
    if (existing.length >= OFF_ROOMS_MAX) return res.status(400).json({ error: "وصلت الحد الأقصى (" + OFF_ROOMS_MAX + " رومات)" });
    const used = new Set(existing.map(r => r.n));
    let n = 1;
    while (used.has(n)) n++;
    try { await OfficerRoom.create({ n }); }
    catch (e) { return res.status(409).json({ error: "صار تعارض، جرب مرة ثانية" }); }
    res.json({ ok: true, n });
});

app.delete("/api/officers/admin/rooms/:n", ensureSeniorAdmin, async (req, res) => {
    const n = offParseN(req.params.n);
    const rooms = await OfficerRoom.find({}).sort({ n: 1 }).lean();
    if (!n || !rooms.some(r => r.n === n)) return res.status(404).json({ error: "الروم غير موجود" });
    if (rooms.length <= 1) return res.status(400).json({ error: "لازم يبقى روم واحد على الأقل" });
    const target = rooms.find(r => r.n !== n).n;
    const m = offLive.get(n);
    if (m) {
        for (const uid of Array.from(m.keys())) {
            offSendTo(uid, { t: "roomdeleted", n });
            offRemove(uid, n);
        }
    }
    offRecEnd(n, true);
    offCfg.delete(n);
    offLive.delete(n);
    const mv = await OfficerApp.updateMany({ stage: "interview", "interview.room": n }, { $set: { "interview.room": target } });
    await OfficerRoom.deleteOne({ n });
    await logEvent({ action: "حذف روم مقابلة", actorId: req.user.id, actorTag: req.user.username, details: "روم " + n });
    res.json({ ok: true, movedTo: target, moved: mv.modifiedCount || 0 });
});

app.post("/api/officers/rec/start", ensureSeniorAdmin, async (req, res) => {
    const n = offParseN(req.body && req.body.n);
    const m = n ? offLive.get(n) : null;
    const me = m ? m.get(req.user.id) : null;
    if (!me || !me.isSenior) return res.status(403).json({ error: "لازم تكون داخل الروم" });
    if (!Array.from(m.values()).some(x => !x.isSenior)) return res.json({ ok: false });
    if (offRecIsActive(n)) return res.json({ ok: false, busy: true });
    const mime = String((req.body && req.body.mime) || "audio/webm").slice(0, 60);
    const sid = n + "-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");
    await OfficerRec.create({ sid, n, uid: req.user.id, name: me.name, mime, lastAt: new Date() });
    offRecActive.set(n, { sid, uid: req.user.id, lastAt: Date.now() });
    offPushState(n);
    res.json({ ok: true, sid });
});

app.post("/api/officers/rec/chunk", ensureSeniorAdmin, express.raw({ type: "*/*", limit: "3mb" }), async (req, res) => {
    const sid = String(req.query.sid || "");
    const seq = parseInt(req.query.seq, 10);
    const meta = await OfficerRec.findOne({ sid }).select("uid n").lean();
    if (!meta || meta.uid !== req.user.id || !(seq >= 0)) return res.status(404).json({ error: "تسجيل غير موجود" });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: "بيانات فارغة" });
    await OfficerRecChunk.updateOne({ sid, seq }, { $set: { data: buf } }, { upsert: true });
    await OfficerRec.updateOne({ sid }, { $max: { chunks: seq + 1 }, $set: { lastAt: new Date() } });
    const r = offRecActive.get(meta.n);
    if (r && r.sid === sid) r.lastAt = Date.now();
    res.json({ ok: true });
});

app.post("/api/officers/rec/events", ensureSeniorAdmin, async (req, res) => {
    const sid = String((req.body && req.body.sid) || "");
    const meta = await OfficerRec.findOne({ sid }).select("uid speechN").lean();
    if (!meta || meta.uid !== req.user.id) return res.status(404).json({ error: "تسجيل غير موجود" });
    const raw = Array.isArray(req.body.ev) ? req.body.ev.slice(0, 300) : [];
    const ev = [];
    for (const e of raw) {
        if (!Array.isArray(e) || e.length < 3) continue;
        const o = Number(e[2]);
        if (!(o >= 0) || o > 12 * 3600 * 1000) continue;
        ev.push([String(e[0]).slice(0, 32), e[1] ? 1 : 0, Math.round(o)]);
    }
    if (!ev.length || (meta.speechN || 0) > 20000) return res.json({ ok: true });
    await OfficerRec.updateOne({ sid }, { $push: { speech: { $each: ev } }, $inc: { speechN: ev.length } });
    res.json({ ok: true });
});

app.post("/api/officers/rec/stop", ensureSeniorAdmin, async (req, res) => {
    const sid = String((req.body && req.body.sid) || "");
    const meta = await OfficerRec.findOne({ sid }).select("uid n endedAt").lean();
    if (!meta || meta.uid !== req.user.id) return res.status(404).json({ error: "تسجيل غير موجود" });
    if (!meta.endedAt) await OfficerRec.updateOne({ sid }, { $set: { endedAt: new Date() } });
    const r = offRecActive.get(meta.n);
    if (r && r.sid === sid) { offRecActive.delete(meta.n); offPushState(meta.n); }
    res.json({ ok: true });
});

app.get("/api/officers/admin/rec/:sid", ensureSeniorAdmin, async (req, res) => {
    const sid = String(req.params.sid || "");
    const meta = await OfficerRec.findOne({ sid }).select("mime").lean();
    if (!meta) return res.status(404).end();
    const parts = await OfficerRecChunk.find({ sid }).sort({ seq: 1 }).select("data").lean();
    const buf = Buffer.concat(parts.map(x => Buffer.isBuffer(x.data) ? x.data : Buffer.from(x.data.buffer || x.data)));
    if (!buf.length) return res.status(404).end();
    const total = buf.length;
    res.set("Content-Type", meta.mime || "audio/webm");
    res.set("Accept-Ranges", "bytes");
    res.set("Cache-Control", "private, max-age=300");
    const rg = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
    if (rg && (rg[1] !== "" || rg[2] !== "")) {
        let start = rg[1] === "" ? Math.max(0, total - parseInt(rg[2], 10)) : parseInt(rg[1], 10);
        let end = rg[1] === "" || rg[2] === "" ? total - 1 : Math.min(parseInt(rg[2], 10), total - 1);
        if (start > end || start >= total) { res.status(416).set("Content-Range", "bytes */" + total).end(); return; }
        res.status(206).set("Content-Range", "bytes " + start + "-" + end + "/" + total).set("Content-Length", String(end - start + 1));
        return res.end(buf.subarray(start, end + 1));
    }
    res.set("Content-Length", String(total));
    res.end(buf);
});

app.get("/api/officers/admin/interview-log", ensureSeniorAdmin, async (req, res) => {
    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000);
    const logs = await OfficerRoomLog.find({ at: { $gte: since } }).sort({ at: 1 }).limit(8000).maxTimeMS(10000).lean();
    const byRoom = new Map();
    for (const l of logs) {
        if (!byRoom.has(l.n)) byRoom.set(l.n, []);
        byRoom.get(l.n).push(l);
    }
    const GAP = 6 * 3600 * 1000;
    const sessions = [];
    for (const [n, evs] of byRoom) {
        const liveNow = offLive.get(n) || new Map();
        const open = new Map();
        let cur = null;
        let lastAt = 0;
        for (const l of evs) {
            const t = new Date(l.at).getTime();
            if (cur && open.size && t - lastAt > GAP) {
                for (const st of open.values()) st.lost = true;
                open.clear();
                cur.end = lastAt;
                sessions.push(cur);
                cur = null;
            }
            if (l.action === "join") {
                if (!cur) cur = { room: n, start: t, end: null, live: false, stays: [] };
                const prev = open.get(l.uid);
                if (prev) { prev.lost = true; open.delete(l.uid); }
                const st = { uid: l.uid, name: l.name, isSenior: !!l.isSenior, start: t, end: null, lost: false, ongoing: false };
                open.set(l.uid, st);
                cur.stays.push(st);
            } else if (l.action === "leave") {
                const st = open.get(l.uid);
                if (st) { st.end = t; open.delete(l.uid); }
                if (cur && open.size === 0) { cur.end = t; sessions.push(cur); cur = null; }
            }
            lastAt = t;
        }
        if (cur) {
            let anyLive = false;
            for (const st of open.values()) {
                if (liveNow.has(st.uid)) { st.ongoing = true; anyLive = true; } else st.lost = true;
            }
            if (anyLive) cur.live = true; else cur.end = lastAt;
            sessions.push(cur);
        }
    }
    sessions.sort((a, b) => b.start - a.start);
    const top = sessions.slice(0, 40);
    const uids = new Set();
    top.forEach(s => s.stays.forEach(st => { if (!st.isSenior) uids.add(st.uid); }));
    const apps = uids.size ? await OfficerApp.find({ uid: { $in: Array.from(uids) } }).select("uid stage rejectedAt age").lean() : [];
    const recs = await OfficerRec.find({ startedAt: { $gte: since }, chunks: { $gt: 0 } }).sort({ startedAt: 1 }).select("sid n name mime startedAt endedAt lastAt speech").lean();
    top.forEach(s => {
        const lim = (s.end || Date.now()) + 120000;
        s.recs = recs.filter(r => r.n === s.room && new Date(r.startedAt).getTime() >= s.start - 120000 && new Date(r.startedAt).getTime() <= lim)
            .map(r => ({ sid: r.sid, name: r.name, mime: r.mime, start: new Date(r.startedAt).getTime(), end: r.endedAt ? new Date(r.endedAt).getTime() : (r.lastAt ? new Date(r.lastAt).getTime() : null), speech: r.speech || [] }));
    });
    const byUid = new Map(apps.map(a => [a.uid, a]));
    top.forEach(s => s.stays.forEach(st => {
        if (st.isSenior) return;
        const a = byUid.get(st.uid);
        if (!a) return;
        st.age = a.age || null;
        if (a.stage === "interview") st.result = "wait";
        else if (a.stage === "training" || a.stage === "officer" || (a.stage === "rejected" && a.rejectedAt === "training")) st.result = "pass";
        else if (a.stage === "rejected" && a.rejectedAt === "interview") st.result = "fail";
    }));
    const stg = await getSettings();
    res.json({ sessions: top, canClear: isOwnerUid(req.user.id) && !stg.interviewLogClearUsed });
});

app.post("/api/officers/admin/interview-log/clear", ensureSeniorAdmin, async (req, res) => {
    if (!isOwnerUid(req.user.id)) return res.status(403).json({ error: "هذا الزر لصاحب المالك فقط" });
    const settings = await getSettings();
    if (settings.interviewLogClearUsed) return res.status(403).json({ error: "تم استخدام زر حذف سجلات المقابلة من قبل" });
    settings.interviewLogClearUsed = true;
    await settings.save();
    await OfficerRoomLog.deleteMany({});
    await OfficerRecChunk.deleteMany({});
    await OfficerRec.deleteMany({});
    await logEvent({ action: "حذف سجلات تسجيل المقابلة", actorId: req.user.id, actorTag: req.user.username, details: "تم حذف كل سجلات المقابلات والتسجيلات الصوتية" });
    res.json({ ok: true });
});

app.post("/api/officers/admin/applications/:id/interview-result", ensureSeniorAdmin, async (req, res) => {
    const a = await OfficerApp.findById(req.params.id);
    if (!a || a.stage !== "interview") return res.status(404).json({ error: "الطلب غير موجود أو تم البت فيه" });
    if (!a.interview.enteredAt) return res.status(400).json({ error: "هذا الشخص ما دخل المقابلة بعد" });
    const result = String((req.body || {}).result || "");
    if (result !== "accepted" && result !== "rejected") return res.status(400).json({ error: "نتيجة غير صحيحة" });
    a.interview.decidedAt = new Date();
    a.decidedBy = req.user.id;
    if (result === "accepted") { a.stage = "training"; }
    else { a.stage = "rejected"; a.rejectedAt = "interview"; }
    await a.save();
    await logEvent({ action: result === "accepted" ? "قبول مقابلة سلك الضباط" : "رفض مقابلة سلك الضباط", actorId: req.user.id, actorTag: req.user.username, details: a.name });
    res.json({ ok: true });
});

// ---------- الكبار: التدريب ----------
app.get("/api/officers/admin/training", ensureSeniorAdmin, async (req, res) => {
    const list = await OfficerApp.find({ stage: "training" }).sort({ createdAt: 1 }).lean();
    res.json({
        ranks: OFFICER_RANKS,
        eligible: list.filter(a => !(a.training && a.training.registered)).map(a => ({ id: String(a._id), name: a.name })),
        trainees: list.filter(a => a.training && a.training.registered).map(a => ({
            id: String(a._id), name: a.name, registeredAt: a.training.registeredAt, attendedAt: a.training.attendedAt,
        })),
    });
});

app.post("/api/officers/admin/applications/:id/register-trainee", ensureSeniorAdmin, async (req, res) => {
    const a = await OfficerApp.findById(req.params.id);
    if (!a || a.stage !== "training") return res.status(404).json({ error: "هذا الشخص غير موجود بمرحلة التدريب" });
    if (a.training.registered) return res.status(400).json({ error: "مسجّل متدرب من قبل" });
    a.training.registered = true; a.training.registeredAt = new Date();
    await a.save();
    await logEvent({ action: "تسجيل متدرب سلك الضباط", actorId: req.user.id, actorTag: req.user.username, details: a.name });
    res.json({ ok: true });
});

app.post("/api/officers/admin/applications/:id/attended", ensureSeniorAdmin, async (req, res) => {
    const a = await OfficerApp.findById(req.params.id);
    if (!a || a.stage !== "training" || !a.training.registered) return res.status(404).json({ error: "هذا الشخص غير مسجّل متدرب" });
    if (a.training.attendedAt) return res.status(400).json({ error: "تم تسجيل حضوره من قبل" });
    a.training.attendedAt = new Date();
    await a.save();
    await logEvent({ action: "حضور تدريب سلك الضباط", actorId: req.user.id, actorTag: req.user.username, details: a.name });
    res.json({ ok: true });
});

app.post("/api/officers/admin/applications/:id/training-result", ensureSeniorAdmin, async (req, res) => {
    const a = await OfficerApp.findById(req.params.id);
    if (!a || a.stage !== "training" || !a.training.registered) return res.status(404).json({ error: "هذا الشخص غير موجود بالتدريب" });
    if (!a.training.attendedAt) return res.status(400).json({ error: "سجّل حضوره للتدريب أول" });
    const b = req.body || {};
    const result = String(b.result || "");
    if (result !== "accepted" && result !== "rejected") return res.status(400).json({ error: "نتيجة غير صحيحة" });
    a.training.decidedAt = new Date();
    a.decidedBy = req.user.id;
    if (result === "accepted") {
        const rank = String(b.rank || "");
        if (!OFFICER_RANKS.includes(rank)) return res.status(400).json({ error: "حدد رتبة الضابط" });
        a.stage = "officer"; a.officerRank = rank;
        await a.save();
        await Account.updateOne({ uid: a.uid }, { $set: { isOfficer: true, officerRank: rank } });
        await Personnel.updateOne({ discord: a.uid }, { $set: { rank }, $setOnInsert: { discordTag: a.name } }, { upsert: true });
        await logEvent({ action: "قبول ضابط جديد", discordId: a.uid, discordTag: a.name, actorId: req.user.id, actorTag: req.user.username, details: a.name + " — الرتبة: " + rank });
    } else {
        a.stage = "rejected"; a.rejectedAt = "training";
        await a.save();
        await logEvent({ action: "رفض بعد التدريب (سلك الضباط)", actorId: req.user.id, actorTag: req.user.username, details: a.name });
    }
    res.json({ ok: true });
});

// ---------- الروم الصوتي ----------
app.post("/api/officers/rooms/:n/join", ensureAuth, async (req, res) => {
    const n = offParseN(req.params.n);
    if (!n) return res.status(400).json({ error: "روم غير صحيح" });
    const uid = req.user.id;
    const senior = isSeniorAdmin(uid);
    let name = req.user.username;
    let appDoc = null;
    if (senior) {
        if (!(await OfficerRoom.exists({ n }))) return res.status(404).json({ error: "هذا الروم غير موجود" });
    } else {
        appDoc = await OfficerApp.findOne({ uid, stage: "interview", "interview.room": n });
        if (!appDoc || !appDoc.interview || !appDoc.interview.at) return res.status(403).json({ error: "ما عندك مقابلة بهذا الروم" });
        if (Date.now() < new Date(appDoc.interview.at).getTime() - OFFICER_OPEN_BEFORE_MS) {
            return res.status(403).json({ error: "الروم ينفتح قبل موعد مقابلتك بخمس دقايق" });
        }
        name = appDoc.name || name;
    }
    for (const otherN of Array.from(offLive.keys())) { if (otherN !== n) offRemove(uid, otherN); }
    let m = offLive.get(n);
    if (!m) { m = new Map(); offLive.set(n, m); }
    const existing = Array.from(m.keys()).filter(u => u !== uid);
    const wasIn = m.has(uid);
    m.set(uid, { uid, name, isSenior: senior, joinedAt: Date.now() });
    offPushState(n);
    if (!wasIn) OfficerRoomLog.create({ n, uid, name, isSenior: senior, action: "join" }).catch(() => {});
    if (appDoc && !appDoc.interview.enteredAt) {
        await OfficerApp.updateOne({ _id: appDoc._id }, { $set: { "interview.enteredAt": new Date() } });
    }
    res.json({ ok: true, state: offState(n), existing, iceServers: offIce() });
});

app.post("/api/officers/rooms/:n/leave", ensureAuth, async (req, res) => {
    const n = offParseN(req.params.n);
    if (n) offRemove(req.user.id, n);
    res.json({ ok: true });
});

app.get("/api/officers/rooms/:n/state", ensureAuth, async (req, res) => {
    const n = offParseN(req.params.n);
    const m = n ? offLive.get(n) : null;
    if (!m || !m.has(req.user.id)) return res.status(404).json({ error: "أنت لست داخل الروم" });
    res.json({ state: offState(n) });
});

app.post("/api/officers/rooms/:n/signal", ensureAuth, async (req, res) => {
    const n = offParseN(req.params.n);
    const m = n ? offLive.get(n) : null;
    const to = String((req.body || {}).to || "");
    if (!m || !m.has(req.user.id) || !m.has(to) || to === req.user.id) return res.status(404).json({ error: "غير موجود بالروم" });
    const data = (req.body || {}).data;
    if (!data || typeof data !== "object" || JSON.stringify(data).length > 60000) return res.status(400).json({ error: "بيانات غير صحيحة" });
    offSendTo(to, { t: "signal", n, from: req.user.id, data });
    res.json({ ok: true });
});

app.post("/api/officers/rooms/:n/mode", ensureSeniorAdmin, async (req, res) => {
    const n = offParseN(req.params.n);
    const mode = String((req.body || {}).mode || "");
    if (!n || !OFFICER_ROOM_MODES.includes(mode)) return res.status(400).json({ error: "وضع غير صحيح" });
    offGetCfg(n).mode = mode;
    offPushState(n);
    res.json({ ok: true });
});

app.post("/api/officers/rooms/:n/kick", ensureSeniorAdmin, async (req, res) => {
    const n = offParseN(req.params.n);
    const uid = String((req.body || {}).uid || "");
    const m = n ? offLive.get(n) : null;
    const p = m ? m.get(uid) : null;
    if (!p) return res.status(404).json({ error: "هذا الشخص مو داخل الروم" });
    if (p.isSenior) return res.status(400).json({ error: "ما يمديك تطرد أحد من الكبار" });
    offSendTo(uid, { t: "kicked", n });
    offRemove(uid, n);
    await logEvent({ action: "طرد من روم المقابلة", actorId: req.user.id, actorTag: req.user.username, details: p.name + " — روم " + n });
    res.json({ ok: true });
});

app.post("/api/officers/rooms/:n/speaker", ensureSeniorAdmin, async (req, res) => {
    const n = offParseN(req.params.n);
    if (!n) return res.status(400).json({ error: "روم غير صحيح" });
    const uid = (req.body || {}).uid ? String(req.body.uid) : null;
    const cfg = offGetCfg(n);
    if (uid) {
        const m = offLive.get(n);
        const p = m ? m.get(uid) : null;
        if (!p) return res.status(404).json({ error: "هذا الشخص مو داخل الروم" });
        if (p.isSenior) return res.status(400).json({ error: "هذا من الكبار" });
        cfg.speakerUid = uid;
    } else {
        cfg.speakerUid = null;
    }
    offPushState(n);
    res.json({ ok: true });
});


app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${CONFIG.SITE_NAME}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
    :root {
        --bg1: #0a1628; --bg2: #0d1f3c; --panel: rgba(255,255,255,0.04); --border: rgba(59,130,246,0.25);
        --gold: #3b82f6; --gold-soft: #60a5fa; --green: #1d4ed8; --green2: #3b82f6;
        --red: #ef4444; --amber: #eab308; --text: #e2e8f0; --muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Tajawal', 'Tahoma', 'Segoe UI', sans-serif; }
    body { background: linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #0a2744 70%, #0d3060 100%); color: var(--text); min-height: 100vh; }
    #warn-banner { position: sticky; top: 0; z-index: 1000; width: 100%; background: linear-gradient(90deg,#7f1d1d,#991b1b); color: #fecaca; text-align: center; padding: 10px 14px; font-weight: bold; font-size: 13px; box-shadow: 0 2px 10px rgba(0,0,0,0.4); }
    nav { background: rgba(5,15,30,0.95); backdrop-filter: blur(15px); border-bottom: 1px solid rgba(59,130,246,0.3); padding: 0 1.2rem; display: flex; align-items: center; justify-content: space-between; height: 62px; position: sticky; top: 37px; z-index: 900; }
    #fm-overlay { position: fixed; inset: 0; background: rgba(5,10,20,0.72); backdrop-filter: blur(3px); z-index: 5000; display: none; align-items: center; justify-content: center; padding: 16px; }
    #fm-overlay.open { display: flex; }
    #fm-box { background: linear-gradient(160deg, #0d1f3c, #0a1628); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 380px; padding: 20px; box-shadow: 0 15px 45px rgba(0,0,0,0.5); animation: fmPop .15s ease; }
    @keyframes fmPop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    #fm-msg { font-size: 15px; line-height: 1.6; margin-bottom: 14px; white-space: pre-wrap; }
    #fm-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 10px 12px; font-size: 14px; margin-bottom: 16px; font-family: inherit; }
    #fm-input:focus { outline: none; border-color: var(--gold-soft); }
    #fm-actions { display: flex; gap: 10px; justify-content: flex-start; }
    #fm-actions button { border: none; border-radius: 8px; padding: 9px 18px; font-size: 14px; font-weight: bold; cursor: pointer; font-family: inherit; }
    #fm-ok { background: linear-gradient(135deg, var(--gold), var(--green)); color: #fff; }
    #fm-cancel { background: rgba(255,255,255,0.08); color: var(--text); }
    #fm-ok:active, #fm-cancel:active { transform: scale(0.97); }
    .cs-wrap { position: relative; margin-bottom: 10px; }
    .cs-trigger { width: 100%; text-align: right; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 10px 12px; font-size: 14px; font-family: inherit; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .cs-trigger::after { content: '˅'; color: var(--muted); margin-inline-start: 8px; }
    .cs-menu { display: none; position: absolute; top: calc(100% + 4px); right: 0; left: 0; z-index: 200; max-height: 260px; overflow-y: auto; background: linear-gradient(160deg, #0d1f3c, #0a1628); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 12px 30px rgba(0,0,0,0.5); }
    .cs-menu.open { display: block; }
    .cs-option { padding: 10px 14px; font-size: 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .cs-option:hover { background: rgba(59,130,246,0.15); }
    .cs-option.selected { color: var(--gold-soft); font-weight: bold; }
    .cs-check { color: var(--gold-soft); }
    .logo { font-size: 1.3rem; font-weight: 900; background: linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 2px; }
    .nav-links { display: flex; gap: 0.3rem; list-style: none; flex-wrap: wrap; }
    .nav-links button { background: transparent; border: 1px solid transparent; color: #94a3b8; padding: 0.4rem 0.8rem; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 0.85rem; transition: all 0.2s; }
    .nav-links button:hover { background: rgba(59,130,246,0.2); border-color: #3b82f6; color: #60a5fa; }
    .hamburger-btn { display: none; background: rgba(59,130,246,0.15); border: 1px solid #3b82f6; color: #60a5fa; padding: 0.4rem 0.7rem; border-radius: 8px; cursor: pointer; font-size: 1.2rem; }
    .mobile-menu { display: none; position: fixed; top: 99px; left: 0; width: 230px; background: rgba(5,15,30,0.98); border: 1px solid rgba(59,130,246,0.35); border-radius: 0 0 14px 0; z-index: 950; padding: 8px 0; box-shadow: 4px 8px 30px rgba(0,0,0,0.7); max-height: calc(100vh - 110px); max-height: calc(100dvh - 110px); overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
    .mobile-menu.open { display: block; }
    #menu-backdrop { display: none; position: fixed; inset: 0; z-index: 940; background: rgba(0,0,0,0.3); touch-action: none; }
    html.menu-open, html.menu-open body { overflow: hidden; }
    html.menu-open #menu-backdrop { display: block; }
    .mobile-menu button { display: block; width: 100%; background: transparent; border: none; border-bottom: 1px solid rgba(59,130,246,0.08); color: #94a3b8; padding: 12px 20px; text-align: right; font-family: inherit; font-size: 0.9rem; cursor: pointer; }
    .mobile-menu button:hover { background: rgba(59,130,246,0.18); color: #60a5fa; }
    @media (max-width: 760px) { .nav-links { display: none !important; } .hamburger-btn { display: inline-block; } }
    .wrap { max-width: 940px; margin: 0 auto; padding: 20px 16px 60px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    h1, h2, h3 { color: var(--gold-soft); margin-bottom: 12px; }
    .btn { display: inline-block; background: linear-gradient(135deg, var(--green), var(--green2)); color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.3rem; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: 0.2s; }
    .btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .btn.danger { background: #ef4444; }
    .btn.gray { background: rgba(255,255,255,0.08); border: 1px solid rgba(59,130,246,0.25); color: #94a3b8; }
    .btn.gold { background: linear-gradient(135deg, #1d4ed8, #60a5fa); color: #fff; }
    .btn.sm { padding: 0.4rem 0.9rem; font-size: 0.8rem; }
    input[type="hidden"] { display: none !important; }
    input, select, textarea { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.06); color: #fff; margin-bottom: 10px; font-size: 14px; }
    label { display: block; margin-bottom: 6px; color: var(--gold-soft); font-size: 13px; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .badge.pending { background: rgba(234,179,8,0.15); color: #fbbf24; border: 1px solid #eab308; }
    .badge.approved { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid #22c55e; }
    .badge.rejected { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid #ef4444; }
    .stat { text-align: center; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid var(--border); }
    .stat .num { font-size: 24px; font-weight: 900; color: var(--gold-soft); }
    .stat .lbl { font-size: 12px; color: var(--muted); }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .center { text-align: center; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px; border-bottom: 1px solid var(--border); text-align: right; vertical-align: middle; }
    .avatar { width: 70px; height: 70px; border-radius: 50%; border: 3px solid var(--gold); }
    .thumb { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border); cursor: pointer; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .tab { background: rgba(255,255,255,0.04); border: 1px solid rgba(59,130,246,0.3); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; color: #94a3b8; }
    .tab.active { background: var(--green2); color: #fff; border-color: var(--green2); }
    .log-item { background: rgba(255,255,255,0.02); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; padding: 10px 15px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; }
    .id-card { background: linear-gradient(135deg, #1e3a5f, #0f2848); border: 2px solid var(--gold); border-radius: 20px; padding: 22px; max-width: 400px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .rank-line { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 15px; color: var(--gold-soft); margin: 10px 0; font-weight: bold; }
    .hidden { display: none !important; }
    #toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #0d1f3c; padding: 10px 20px; border-radius: 10px; border: 1px solid var(--gold); z-index: 999; display: none; }
    .fab { position: fixed; bottom: 25px; right: 25px; z-index: 998; background: linear-gradient(135deg, #1d4ed8, #3b82f6); color: #fff; border: 2px solid rgba(255,255,255,0.2); padding: 14px 24px; border-radius: 50px; font-weight: bold; font-family: inherit; font-size: 14px; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.4); transition: 0.3s; }
    .fab:hover { transform: scale(1.05); }
    .vgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; margin-bottom: 10px; }
    .vcard { border: 2px solid var(--border); border-radius: 10px; padding: 6px; text-align: center; cursor: pointer; font-size: 11px; background: rgba(255,255,255,0.03); }
    .vcard.sel { border-color: var(--gold); background: rgba(59,130,246,0.12); }
    .vcard img { width: 100%; height: 54px; object-fit: cover; border-radius: 6px; margin-bottom: 4px; }


    #vtype-overlay { display: none; position: fixed; inset: 0; z-index: 2600; background: rgba(0,0,0,0.75); align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
    #vtype-overlay.open { display: flex; }
    .vtype-box { background: #0d1f3c; border: 1px solid var(--gold); border-radius: 14px; padding: 22px; max-width: 460px; width: 100%; max-height: 85vh; overflow-y: auto; margin: auto; }
    .vtype-box h3 { margin-bottom: 14px; color: var(--gold-soft); text-align: center; }
    .vtype-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .vtype-opt { border: 2px solid var(--border); border-radius: 10px; padding: 10px 14px; font-size: 13px; cursor: pointer; background: rgba(255,255,255,0.04); color: #fff; }
    .vtype-opt.sel { border-color: #22c55e; background: rgba(34,197,94,0.28); color: #4ade80; font-weight: bold; }
    .vtype-actions { display: flex; gap: 8px; margin-top: 18px; }
    .vtype-actions button { flex: 1; }

    .login-screen { text-align: center; padding: 4rem 2rem; }
    .auth-page { min-height: calc(100vh - 230px); display: flex; align-items: center; justify-content: center; padding: 24px 12px; }
    .auth-card { width: 100%; max-width: 560px; background: linear-gradient(180deg, #0d1b3a, #09122b); border: 1px solid rgba(212,175,55,0.35); border-radius: 28px; padding: 34px 40px 38px; box-shadow: 0 25px 60px rgba(0,0,0,0.55); }
    .auth-title { color: #f2c94c; font-size: 32px; font-weight: 800; text-align: center; margin: 0 0 6px; }
    .auth-sub { color: #a8945a; text-align: center; font-size: 15px; margin-bottom: 26px; letter-spacing: 1px; }
    .auth-label { display: block; color: #f2c94c; font-weight: 700; font-size: 15px; margin-bottom: 8px; }
    .auth-input { width: 100%; padding: 16px 18px; border-radius: 14px; border: 1px solid rgba(212,175,55,0.28); background: rgba(255,255,255,0.06); color: #fff; font-size: 16px; margin-bottom: 6px; font-family: inherit; }
    .auth-input:focus { outline: none; border-color: #f2c94c; box-shadow: 0 0 0 3px rgba(242,201,76,0.15); }
    .auth-input::placeholder { color: #64748b; }
    .pw-wrap { position: relative; }
    .pw-wrap .auth-input { padding-right: 52px; }
    .pw-eye { position: absolute; right: 12px; top: 14px; background: none; border: 0; cursor: pointer; font-size: 20px; line-height: 1; color: #a8945a; padding: 4px; }
    .auth-req { display: block; color: #f87171; font-size: 12px; margin-bottom: 16px; }
    .auth-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
    .auth-btn { width: 100%; padding: 16px; border: none; border-radius: 999px; background: linear-gradient(90deg, #d9b04f, #f4d27a); color: #111; font-size: 18px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 24px rgba(242,201,76,0.22); font-family: inherit; margin-top: 8px; }
    .auth-btn:disabled { opacity: 0.6; cursor: wait; }
    .auth-link { display: block; text-align: center; color: #f2c94c; font-size: 16px; cursor: pointer; margin-top: 4px; }
    .auth-forgot { display: block; color: #8a7a4d; font-size: 13px; cursor: pointer; margin: 6px 0 16px; }
    .auth-sep { height: 1px; background: rgba(212,175,55,0.15); margin: 26px 0 22px; }
    .auth-err { display: none; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px; font-size: 14px; text-align: center; }
    .auth-check { display: flex; align-items: flex-start; gap: 12px; color: #e2e8f0; font-size: 15px; margin-bottom: 14px; line-height: 1.7; cursor: pointer; }
    .auth-check input { width: 22px; height: 22px; flex-shrink: 0; margin: 4px 0 0; }
    .auth-done { text-align: center; }
    .auth-done .ico { font-size: 60px; margin-bottom: 10px; }
    .auth-done p { color: #cbd5e1; line-height: 1.9; margin-bottom: 20px; }
    @media (max-width: 560px) { .auth-card { padding: 26px 18px 30px; border-radius: 22px; } .auth-grid { grid-template-columns: 1fr; } .auth-title { font-size: 26px; } }

    .mc-wrap { max-width: 340px; margin: 0 auto; }
    .mcard { position: relative; width: 100%; aspect-ratio: 968 / 609; border-radius: 12px; overflow: hidden; container-type: inline-size; box-shadow: 0 10px 30px rgba(0,0,0,0.45); direction: rtl; background: #fff; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .mc-face { position: absolute; inset: 0; background: url('/card-bg.jpg?v=3') center / 100% 100% no-repeat, linear-gradient(135deg, #f4f8f5, #dfe9e3); transition: filter 0.3s, transform 0.3s; }
    .mcard.locked .mc-face { filter: blur(15px); transform: scale(1.08); }
    .mc-t { position: absolute; color: #0f172a; font-weight: 800; font-size: 3.5cqw; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; direction: rtl; text-shadow: 0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8); transform: translateY(-50%); }
    .mc-t.name { left: 51.5%; right: 12.2%; top: 25.04%; }
    .mc-t.rank { left: 51.5%; right: 12.2%; top: 38.59%; }
    .mc-t.unit { left: 51.5%; right: 12.2%; top: 50.41%; }
    .mc-t.sector { left: 51.5%; right: 12.2%; top: 62.89%; }
    .mc-t.num { left: 7.64%; width: 17.25%; top: 95.5%; text-align: center; direction: ltr; font-size: 1.7cqw; letter-spacing: 0.12em; text-shadow: none; }
    .mc-cover { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2cqw; background: rgba(15,30,60,0.28); cursor: pointer; z-index: 2; }
    .mc-cover svg { width: 15cqw; height: 15cqw; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.7)); }
    .mc-cover span { color: #fff; font-weight: 800; font-size: 4.2cqw; text-shadow: 0 2px 8px rgba(0,0,0,0.75); }
    .mcard:not(.locked) .mc-cover { display: none; }
    .mc-remain { text-align: center; margin-top: 10px; font-size: 13px; font-weight: 700; color: var(--gold-soft); }
    .mc-hint { display: none; text-align: center; margin-top: 8px; font-size: 12px; color: var(--muted); }
    .mc-wrap.unlocked .mc-hint { display: block; }
    .mc-info { margin-top: 14px; display: none; }
    .mc-info.open { display: block; }
    .mc-row { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; margin-bottom: 8px; }
    .mc-row-top { display: flex; align-items: center; justify-content: space-between; }
    .mc-row span { color: var(--muted); font-size: 12px; }
    .mc-row b { display: block; margin-top: 4px; font-weight: 700; color: #e2e8f0; font-size: 15px; word-break: break-word; user-select: text; }
    .mc-copy { border: 1px solid var(--border); background: rgba(59,130,246,0.18); color: var(--gold-soft); border-radius: 8px; padding: 3px 10px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .mc-modal { width: 100%; max-width: 340px; margin: auto; }
    #mc-page { display: none; position: fixed; inset: 0; z-index: 5000; background: #0a1628; flex-direction: column; }
    #mc-page.open { display: flex; }
    #mc-page .pp-bar { display: flex; align-items: center; padding: env(safe-area-inset-top,14px) 8px 10px; background: rgba(0,0,0,0.35); flex-shrink: 0; }
    #mc-page .pp-back { background: none; border: none; color: #fff; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 10px 14px; -webkit-tap-highlight-color: transparent; font-family: inherit; }
    #mc-page .mcp-body { flex: 1; overflow-y: auto; padding: 8px 14px 30px; }
    #mc-page .mc-wrap { margin-top: 6px; }
    #mc-full { display: none; position: fixed; inset: 0; z-index: 5200; background: rgba(0,0,0,0.95); align-items: center; justify-content: center; overflow: hidden; }
    #mc-full.open { display: flex; }
    #mc-full .mc-fs { width: min(96vw, calc(92vh * 968 / 609)); flex-shrink: 0; cursor: pointer; }
    #mc-full .mc-fs .mcard { cursor: pointer; border-radius: 14px; }
    @media (orientation: portrait) { #mc-full .mc-fs { width: min(92vh, calc(96vw * 968 / 609)); transform: rotate(90deg); } }
    #mc-full .mc-x { position: absolute; top: env(safe-area-inset-top,12px); left: 12px; z-index: 2; background: rgba(255,255,255,0.14); color: #fff; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 18px; cursor: pointer; margin-top: 10px; }
    .acc-card .acc-title { font-size: 17px; font-weight: 800; color: var(--gold-soft); margin-bottom: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .acc-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); font-size: 13px; }
    .acc-row span { color: var(--muted); }
    .acc-row b { font-weight: 600; color: #e2e8f0; text-align: left; word-break: break-all; }
    .acc-pw { cursor: pointer; direction: ltr; }
    .acc-tag { font-size: 11px; background: rgba(59,130,246,0.2); border: 1px solid var(--border); border-radius: 20px; padding: 2px 10px; color: var(--gold-soft); font-weight: 600; }
    .acc-switch { display: flex; gap: 8px; width: 100%; }
    .acc-sw { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: #94a3b8; font-weight: 700; cursor: pointer; font-family: inherit; }
    .acc-sw.on { background: linear-gradient(135deg, #1d4ed8, #3b82f6); color: #fff; }
    .acc-ov { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 4000; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 20px 12px; }
    .acc-modal { background: #0d1f3c; border: 1px solid var(--gold); border-radius: 14px; padding: 22px; max-width: 460px; width: 100%; margin: auto; }
    .acc-modal h3 { text-align: center; }
    .acc-check { display: flex; align-items: center; gap: 8px; color: #e2e8f0; }
    .acc-check input { width: auto; margin: 0; }
    .login-screen h1 { font-size: 3rem; color: #3b82f6; text-shadow: 0 0 20px rgba(59,130,246,0.5); margin-bottom: 10px; }
    footer { text-align: center; padding: 1.5rem; margin-top: 2rem; border-top: 1px solid var(--border); background: rgba(255,255,255,0.02); color: var(--muted); font-size: 0.9rem; }
    #photo-page { display: none; position: fixed; inset: 0; z-index: 5000; background: #000; flex-direction: column; }
    #photo-page.open { display: flex; }
    #photo-page .pp-bar { display: flex; align-items: center; padding: env(safe-area-inset-top,14px) 8px 10px; background: rgba(0,0,0,0.55); flex-shrink: 0; }
    #photo-page .pp-back { background: none; border: none; color: #fff; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 10px 14px; -webkit-tap-highlight-color: transparent; }
    #photo-page .pp-body { flex: 1; display: flex; align-items: center; justify-content: center; overflow: auto; touch-action: pinch-zoom; }
    #photo-page .pp-body img { max-width: 100%; max-height: 100%; object-fit: contain; }
    #photo-page .pp-loading { color: #cbd5e1; font-size: 14px; text-align: center; padding: 20px; }

    #warn-overlay { display: none; position: fixed; inset: 0; z-index: 3000; align-items: center; justify-content: center; flex-direction: column; gap: 10px; padding: 20px; text-align: center; }
    #warn-overlay.open { display: flex; }
    #warn-overlay.k-warning { background: radial-gradient(circle at center, #7a1a1a, #3d0d0d); }
    #warn-overlay.k-notice { background: radial-gradient(circle at center, #7a4a12, #3d2506); }
    .warn-box { border: 2px dashed rgba(255,255,255,0.55); border-radius: 10px; padding: 26px 40px; max-width: 480px; }
    .warn-title { font-size: 30px; font-weight: bold; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .warn-title .tri { color: #f87171; }
    #warn-overlay.k-notice .warn-title .tri { color: #fbbf24; }
    .warn-line { border: none; border-top: 1px solid rgba(255,255,255,0.5); margin: 12px 0; }
    .warn-extra { color: #fde047; font-size: 16px; font-weight: bold; margin-top: 4px; }
    .warn-reason { color: #fff; font-size: 19px; margin-top: 8px; line-height: 1.6; }
    .warn-ack-btn { margin-top: 26px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.5); color: #fff; padding: 12px 22px; border-radius: 10px; font-family: inherit; font-size: 14px; cursor: pointer; }
    .warn-ack-btn:hover { background: rgba(255,255,255,0.2); }

    #promo-alert-overlay { display: none; position: fixed; inset: 0; z-index: 2500; background: radial-gradient(circle at center, #14532d, #052e16); color: #fff; text-align: center; flex-direction: column; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
    #promo-alert-overlay.open { display: flex; }
    .promo-box { border: 2px dashed rgba(255,255,255,0.55); border-radius: 10px; padding: 26px 40px; max-width: 480px; }
    .promo-title { font-size: 28px; font-weight: bold; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .promo-extra { color: #86efac; font-size: 16px; font-weight: bold; margin-top: 10px; line-height: 1.7; white-space: pre-line; }
    .promo-reason { color: #fff; font-size: 17px; margin-top: 10px; line-height: 1.6; }
    .promo-actions { display: flex; gap: 12px; margin-top: 26px; }
    .promo-actions button { padding: 12px 22px; border-radius: 10px; font-family: inherit; font-size: 14px; cursor: pointer; border: 1px solid rgba(255,255,255,0.5); color: #fff; }
    .promo-approve-btn { background: rgba(34,197,94,0.35); }
    .promo-approve-btn:hover { background: rgba(34,197,94,0.55); }
    .promo-reject-btn { background: rgba(248,113,113,0.25); }
    .promo-reject-btn:hover { background: rgba(248,113,113,0.45); }

    #wf-overlay { display: none; position: fixed; inset: 0; z-index: 2500; background: rgba(0,0,0,0.75); align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
    #wf-overlay.open { display: flex; }
    .wf-box { background: #0d1f3c; border: 1px solid var(--gold); border-radius: 14px; padding: 22px; max-width: 380px; width: 100%; text-align: center; max-height: 85vh; overflow-y: auto; margin: auto; }
    .wf-box h3 { margin-bottom: 14px; color: var(--gold-soft); }
    .wf-choice-row { display: flex; gap: 10px; margin-top: 6px; }
    .wf-choice-row button { flex: 1; padding: 14px 8px; border-radius: 10px; font-family: inherit; font-size: 14px; cursor: pointer; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: #fff; }
    .wf-choice-row button.wf-warning:hover { border-color: #f87171; background: rgba(248,113,113,0.12); }
    .wf-choice-row button.wf-notice:hover { border-color: #fbbf24; background: rgba(251,191,36,0.12); }
    .wf-box textarea { width: 100%; min-height: 90px; margin-top: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 8px; color: #fff; padding: 10px; font-family: inherit; font-size: 14px; resize: vertical; }
    .wf-actions { display: flex; gap: 8px; margin-top: 14px; }
    .wf-actions button { flex: 1; }
    #sp-fab { position: fixed; bottom: 22px; left: 22px; z-index: 5300; width: 54px; height: 54px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); background: linear-gradient(135deg, #1d4ed8, #3b82f6); color: #fff; font-size: 24px; cursor: pointer; box-shadow: 0 6px 22px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    #sp-fab:active { transform: scale(0.94); }
    .sp-badge { background: #ef4444; color: #fff; border-radius: 10px; min-width: 18px; height: 18px; padding: 0 5px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; margin-inline-start: 6px; }
    #sp-fab .sp-badge { position: absolute; top: -4px; right: -4px; margin: 0; }
    #sp-modal { position: fixed; top: 0; left: 0; right: 0; height: 100%; background: #060d1a; z-index: 4000; display: none; align-items: flex-end; justify-content: center; overscroll-behavior: contain; }
    html.sp-lock, html.sp-lock body { overflow: hidden !important; }
    html.sp-lock #sp-fab { display: none !important; }
    html.sp-lock #warn-banner, html.sp-lock nav, html.sp-lock .mobile-menu, html.sp-lock #app, html.sp-lock footer, html.sp-lock #photo-page, html.sp-lock #mc-page { visibility: hidden !important; }
    html.sp-lock body { background: #0a1628 !important; }
    #sp-modal.kb { align-items: stretch; }
    #sp-modal.kb #sp-box { height: 100%; border-radius: 0; }
    #sp-modal.open { display: flex; }
    #sp-box { background-color: #0a1628; background-image: linear-gradient(160deg, #0d1f3c, #0a1628); transform: translateZ(0); -webkit-transform: translateZ(0); isolation: isolate; border: 1px solid var(--border); border-radius: 16px 16px 0 0; width: 100%; max-width: 560px; height: min(86%, 720px); display: flex; flex-direction: column; box-shadow: 0 -10px 40px rgba(0,0,0,0.6); padding-bottom: env(safe-area-inset-bottom, 0px); }
    @media (min-width: 700px) { #sp-modal { align-items: center; } #sp-box { border-radius: 16px; } }
    #sp-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); font-weight: bold; color: var(--gold-soft); }
    #sp-head button { background: rgba(255,255,255,0.08); border: none; color: var(--text); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; }
    #sp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; overscroll-behavior: contain; }
    .sp-btn { background: linear-gradient(135deg, var(--green), var(--green2)); color: #fff; border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: bold; cursor: pointer; font-family: inherit; }
    .sp-btn.alt { background: rgba(255,255,255,0.08); color: var(--text); }
    .sp-btn.warn { background: linear-gradient(135deg, #b45309, #f59e0b); }
    .sp-btn.red { background: rgba(239,68,68,0.18); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); }
    .sp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sp-btn.pulse { animation: spPulse 1.4s infinite; }
    @keyframes spPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.6); } 50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); } }
    .sp-field { width: 100%; background: #14223d; border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 10px 12px; font-size: 16px; margin-bottom: 10px; font-family: inherit; }
    .sp-field:focus { outline: none; border-color: var(--gold-soft); }
    .sp-lbl { display: block; font-size: 13px; color: var(--muted); margin-bottom: 5px; }
    .sp-row { background: #101d36; border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 10px; cursor: pointer; }
    .sp-row:hover { border-color: var(--gold-soft); }
    .sp-row .t1 { display: flex; justify-content: space-between; gap: 8px; font-weight: bold; font-size: 14px; }
    .sp-row .t2 { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .sp-chip { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: bold; white-space: nowrap; }
    .sp-chip.ai { background: rgba(59,130,246,0.2); color: #93c5fd; }
    .sp-chip.waiting { background: rgba(245,158,11,0.2); color: #fcd34d; }
    .sp-chip.active { background: rgba(34,197,94,0.2); color: #86efac; }
    .sp-chip.closed { background: rgba(148,163,184,0.2); color: #cbd5e1; }
    .sp-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .sp-tab { background: #16243f; border: 1px solid var(--border); color: var(--text); border-radius: 18px; padding: 6px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
    .sp-tab.on { background: var(--green2); border-color: var(--green2); color: #fff; font-weight: bold; }
    .sp-chat { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .sp-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .sp-link { background: none; border: none; color: var(--gold-soft); cursor: pointer; font-size: 14px; font-family: inherit; padding: 4px; }
    .sp-title { font-weight: bold; font-size: 14px; text-align: center; flex: 1; }
    .sp-state { background: #121f38; border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; font-size: 13px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .sp-msgs { flex: 1; min-height: 120px; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 8px; padding: 4px 2px; }
    .sp-msg { display: flex; flex-direction: column; max-width: 82%; }
    .sp-msg.me { align-self: flex-start; }
    .sp-msg.other { align-self: flex-end; }
    .sp-msg.sys { align-self: center; max-width: 94%; }
    .sp-who { font-size: 11px; color: var(--muted); margin-bottom: 2px; }
    .sp-b { padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .sp-msg.me .sp-b { background: linear-gradient(135deg, var(--green), var(--green2)); color: #fff; border-top-right-radius: 4px; }
    .sp-msg.other .sp-b { background: #1c2b48; border-top-left-radius: 4px; }
    .sp-msg.ai .sp-b { background: #2a1f52; border: 1px solid #5b4a99; }
    .sp-msg.admin .sp-b { background: #12402c; border: 1px solid #1f7a4d; }
    .sp-msg.sys .sp-b { background: #33290f; color: #fcd34d; font-size: 12.5px; text-align: center; border-radius: 10px; }
    .sp-time { font-size: 10px; color: var(--muted); margin-top: 2px; }
    .sp-role { display: inline-block; font-size: 10px; font-weight: bold; padding: 1px 7px; border-radius: 8px; margin-inline-start: 6px; vertical-align: middle; }
    .sp-role.senior { background: #3d3410; color: #fde047; border: 1px solid #8a7414; }
    .sp-role.admin { background: #12294d; color: #93c5fd; border: 1px solid #2b5aa8; }
    .sp-img { max-width: 220px; max-height: 220px; border-radius: 10px; margin-top: 6px; display: block; cursor: zoom-in; background: rgba(255,255,255,0.05); }
    .sp-dots span { display: inline-block; width: 6px; height: 6px; margin: 0 2px; border-radius: 50%; background: #a78bfa; animation: spDot 1s infinite; }
    .sp-dots span:nth-child(2) { animation-delay: 0.15s; } .sp-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes spDot { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
    .sp-compose { display: flex; align-items: flex-end; gap: 8px; margin-top: 10px; }
    .sp-compose textarea { flex: 1; resize: none; max-height: 110px; margin: 0; }
    .sp-attach { background: #1c2b48; border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; flex-shrink: 0; }
    .sp-prev { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; color: var(--muted); }
    .sp-prev img { height: 46px; border-radius: 6px; }
    #sp-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 6000; display: none; align-items: center; justify-content: center; padding: 14px; }
    #sp-lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; }
    .off-steps { display: flex; gap: 8px; margin-bottom: 16px; }
    .off-step { flex: 1; text-align: center; padding: 10px 6px; border-radius: 10px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--muted); font-size: 13px; font-weight: 700; }
    .off-step.cur { background: var(--green2); color: #fff; border-color: var(--green2); }
    .off-step.done { color: #4ade80; border-color: #22c55e; }
    .off-step.bad { color: #fca5a5; border-color: #ef4444; }
    .off-rules { margin: 10px 0 14px; padding: 0; list-style: none; }
    .off-rules li { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; margin-bottom: 7px; font-size: 14px; line-height: 1.8; }
    .off-rules.strict li { border-color: rgba(239,68,68,0.45); background: rgba(239,68,68,0.07); }
    .off-ov { position: fixed; inset: 0; z-index: 6000; background: rgba(5,10,20,0.78); display: flex; align-items: center; justify-content: center; padding: 14px; }
    .off-box { background: linear-gradient(160deg, #0d1f3c, #0a1628); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; padding: 20px; }
    .off-qa { border-top: 1px dashed rgba(255,255,255,0.1); padding: 8px 0; font-size: 13px; }
    .off-qa b { color: var(--gold-soft); display: block; margin-bottom: 3px; }
    .off-qa div { white-space: pre-wrap; word-break: break-word; }
    .off-chip { display: inline-block; background: rgba(59,130,246,0.18); border: 1px solid var(--border); border-radius: 20px; padding: 3px 12px; font-size: 12px; margin: 0 0 6px 6px; }
    .off-chip.sen { border-color: #eab308; color: #fbbf24; }
    .off-logrow { font-size: 12px; color: var(--muted); padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); }
    .off-res { font-size: 13px; margin-top: 8px; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); }
    .ann-ov { position: fixed; inset: 0; z-index: 6500; display: flex; align-items: center; justify-content: center; background: rgba(2,6,15,0.42); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); padding: 16px; touch-action: none; }
    .ann-card { position: relative; width: 100%; max-width: 380px; max-height: 50vh; max-height: 50dvh; overflow-y: auto; background: linear-gradient(160deg, #101c36, #0a1226); border: 1px solid rgba(234,179,8,0.55); border-radius: 20px; padding: 24px 18px 18px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.7); animation: annIn 0.28s ease; touch-action: pan-y; }
    @keyframes annIn { from { transform: translateY(18px) scale(0.96); opacity: 0; } to { transform: none; opacity: 1; } }
    .ann-x { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: #e2e8f0; font-size: 16px; cursor: pointer; line-height: 32px; padding: 0; }
    .ann-badge { display: inline-block; background: rgba(234,179,8,0.15); color: #fde047; border: 1px solid rgba(234,179,8,0.4); border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
    .ann-card h3 { margin: 6px 0; font-size: 18px; color: #f8fafc; }
    .ann-card p { color: #cbd5e1; font-size: 13px; line-height: 1.9; margin: 6px 0 12px; }
    .ann-test { font-size: 11px; color: #fbbf24; margin-bottom: 8px; }
    .ann-btns { display: flex; gap: 8px; }
    .ann-btns .btn { flex: 1; margin: 0; }
    html.ann-open, html.ann-open body { overflow: hidden; }
    .off-gantt { margin: 10px 0; }
    .off-grow { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .off-gname { width: 92px; flex-shrink: 0; font-size: 11px; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .off-gtrack { position: relative; flex: 1; height: 14px; background: rgba(255,255,255,0.05); border-radius: 7px; overflow: hidden; }
    .off-gbar { position: absolute; top: 0; bottom: 0; background: #3b82f6; border-radius: 7px; }
    .off-gbar.sen { background: #eab308; }
    .off-gbar.live { background: #22c55e; }
    .off-gbar.lost { background: repeating-linear-gradient(45deg, #64748b, #64748b 4px, #475569 4px, #475569 8px); }
    .off-gaxis { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 4px; }
    .off-stay { padding: 8px 0; border-bottom: 1px dashed rgba(255,255,255,0.08); font-size: 13px; line-height: 1.9; }
    .off-stayt { color: var(--muted); font-size: 12px; }
    .rp-clock { font-size: 26px; font-weight: 800; text-align: center; color: var(--gold-soft); direction: ltr; }
    .rp-prog { height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; margin: 8px 0 12px; }
    .rp-prog div { height: 100%; width: 0; background: var(--green2); }
    .rp-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; margin-bottom: 6px; border-radius: 10px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); font-size: 13px; transition: background 0.2s, opacity 0.2s; }
    .rp-row.wait { opacity: 0.4; }
    .rp-row.in { background: rgba(34,197,94,0.16); border-color: #22c55e; }
    .rp-row.out { background: rgba(100,116,139,0.18); opacity: 0.75; }
    .off-talk { color: #86efac; font-size: 12px; font-weight: 700; }
    .rp-mic { font-size: 11px; font-weight: 700; color: #94a3b8; margin-right: 4px; }
    .rp-mic.live { color: #4ade80; animation: rpPulse 0.9s ease-in-out infinite; }
    @keyframes rpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
    .rp-row.talk { box-shadow: 0 0 0 2px #22c55e; }
    .rp-feed { max-height: 120px; overflow-y: auto; font-size: 12px; color: #cbd5e1; margin-top: 8px; line-height: 1.9; }
    #off-voice { position: fixed; inset: 0; z-index: 4000; background: linear-gradient(160deg, #060e1c, #0a1628); overflow-y: auto; padding: 14px 14px 110px; }
    .ov-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .ov-head b { color: var(--gold-soft); font-size: 17px; }
    .ov-modes { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .ov-mode { flex: 1 1 150px; padding: 10px 8px; border-radius: 10px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: #94a3b8; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
    .ov-mode.on { background: var(--green2); color: #fff; border-color: var(--green2); }
    .ov-note { text-align: center; font-size: 13px; color: var(--muted); margin: 8px 0 12px; }
    .ov-stage { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
    .ov-vwrap { background: #000; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
    .ov-vwrap video { width: 100%; max-height: 62vh; display: block; background: #000; }
    .ov-vcap { background: rgba(255,255,255,0.06); padding: 5px 10px; font-size: 12px; color: var(--gold-soft); }
    .ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .ov-tile { background: rgba(255,255,255,0.05); border: 2px solid transparent; border-radius: 14px; padding: 14px 8px 10px; text-align: center; transition: border-color 0.15s, box-shadow 0.15s; }
    .ov-tile.sel { border-color: #eab308; }
    .ov-tile.speaking { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.25); }
    .ov-av { width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 8px; background: linear-gradient(135deg, #1d4ed8, #60a5fa); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #fff; }
    .ov-name { font-size: 13px; font-weight: 700; word-break: break-word; }
    .ov-role { font-size: 11px; color: var(--muted); margin: 3px 0; }
    .ov-ic { font-size: 16px; min-height: 22px; }
    .ov-tile .btn { margin-top: 6px; width: 100%; padding: 0.35rem 0.4rem; font-size: 12px; }
    .ov-bar { position: fixed; bottom: 0; left: 0; right: 0; z-index: 4100; display: flex; justify-content: center; gap: 12px; padding: 14px; background: rgba(5,15,30,0.95); border-top: 1px solid rgba(59,130,246,0.3); }
    .ov-btn { min-width: 108px; padding: 12px 16px; border-radius: 30px; border: 1px solid var(--border); background: rgba(255,255,255,0.08); color: #fff; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
    .ov-btn.off { background: #7f1d1d; border-color: #ef4444; }
    .ov-btn.dis { opacity: 0.45; }
    .ov-btn.leave { background: #ef4444; border-color: #ef4444; }
</style>
<div id="wf-overlay">
    <div class="wf-box" id="wf-box"></div>
</div>
<div id="warn-overlay">
    <div class="warn-box">
        <div class="warn-title"><span class="tri">⚠️</span><span id="warn-title-text">تحذير</span><span class="tri">⚠️</span></div>
        <hr class="warn-line">
        <div class="warn-extra" id="warn-extra-text"></div>
        <div class="warn-reason" id="warn-reason-text"></div>
    </div>
    <button class="warn-ack-btn" id="warn-ack-btn" onclick="ackCurrentWarning()">🤝 اتعاهد وأقر بعدم تكرار ذلك</button>
    <div class="row" id="warn-notereview-actions" style="display:none;gap:10px;margin-top:10px;">
        <button class="btn danger sm" onclick="noteReviewDelete()">🗑️ حذف الملاحظة</button>
        <button class="btn sm" onclick="noteReviewExtend()">⏳ تمديد 5 أيام</button>
    </div>
</div>
<div id="promo-alert-overlay">
    <div class="promo-box">
        <div class="promo-title"><span>🎖️</span><span>ترقية عسكرية</span><span>🎖️</span></div>
        <hr class="warn-line">
        <div class="promo-extra" id="promo-alert-extra"></div>
        <div class="promo-reason" id="promo-alert-reason"></div>
    </div>
    <div class="promo-actions">
        <button class="promo-approve-btn" onclick="promoAlertApprove()">✅ قبول</button>
        <button class="promo-reject-btn" onclick="promoAlertReject()">❌ رفض</button>
    </div>
</div>
<div id="vtype-overlay">
    <div class="vtype-box">
        <h3>اختر نوع/أنواع المخالفة</h3>
        <div class="vtype-grid" id="vtype-grid"></div>
        <div class="vtype-actions">
            <button class="btn gray" onclick="closeVTypeOverlay()">إلغاء</button>
            <button class="btn" onclick="confirmVTypeSelection()">✅ تم</button>
        </div>
    </div>
</div>
</head>
<body>
<div id="warn-banner">⚠️ تنبيه: هذا الموقع مخصص للمحاكاة واللعب فقط، ولا يمت للواقع بصلة.</div>
<nav>
    <div class="logo" onclick="odToggle()" style="-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;">🚨 ${CONFIG.SITE_NAME}</div>
    <ul class="nav-links" id="nav-links"></ul>
    <button class="hamburger-btn" onclick="toggleMobileMenu()">☰</button>
</nav>
<div id="menu-backdrop" onclick="closeMobileMenu()"></div>
<div class="mobile-menu" id="mobile-menu"></div>
<div class="wrap" id="app"><div class="card center">جارِ التحميل...</div></div>
<div id="toast"></div>
<div id="owner-modal-overlay" style="position:fixed;inset:0;background:rgba(5,10,20,0.75);backdrop-filter:blur(3px);z-index:5200;display:none;align-items:center;justify-content:center;padding:16px;">
    <div id="owner-modal-box" style="background:var(--panel,#10151f);border:1px solid #2a2f3a;border-radius:14px;max-width:460px;width:100%;max-height:82vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <b id="owner-modal-title" style="color:var(--gold-soft);"></b>
            <button class="btn sm" onclick="ownerModalClose()">✖</button>
        </div>
        <div id="owner-modal-body"></div>
    </div>
</div>
<div id="owner-toolbar" style="position:fixed;bottom:92px;left:16px;z-index:4500;display:none;flex-direction:column;gap:8px;">
    <button class="btn sm" style="background:#0e7490;" onclick="offaOpenCommandCenter()">🖥️ غرفة التحكم</button>
    <button class="btn sm" style="background:#7c3aed;" onclick="offaOpenUpdates()">🛠️ تحديثات المطور</button>
    <button class="btn sm" style="background:#312e81;" onclick="offaOpenDevices()">📱 الأجهزة</button>
    <button class="btn sm" style="background:#047857;" onclick="offaOpenOnline()">🟢 متصلين الآن</button>
    <button class="btn sm" style="background:#b45309;" onclick="offaOpenOfficerReq()">🎖️ طلبات السلك</button>
    <button id="owner-stealth-btn" class="btn sm" style="background:#374151;" onclick="offaToggleStealth()">👻 وضع التخفي</button>
    <button id="owner-lock-btn" class="btn sm danger" onclick="offaToggleLockdown()">🚨 إغلاق الموقع</button>
</div>
<div id="fm-overlay">
    <div id="fm-box">
        <div id="fm-msg"></div>
        <input id="fm-input" type="text">
        <div id="fm-actions">
            <button id="fm-ok" type="button"></button>
            <button id="fm-cancel" type="button">إلغاء</button>
        </div>
    </div>
</div>
<div id="photo-page">
    <div class="pp-bar"><button class="pp-back" onclick="closePhotoPage()">‹ رجوع</button></div>
    <div class="pp-body" onclick="if(event.target===this) closePhotoPage()">
        <div id="photo-page-loading" class="pp-loading">جارِ تحميل الصورة...</div>
        <img id="photo-page-img" src="" style="display:none;">
    </div>
</div>
<div id="mc-page">
    <div class="pp-bar"><button class="pp-back" onclick="closeMcPage()">‹ رجوع</button></div>
    <div class="mcp-body" id="mc-page-body"></div>
</div>
<div id="mc-full" onclick="closeMcFull()">
    <button class="mc-x" onclick="closeMcFull(); event.stopPropagation();">✕</button>
    <div class="mc-fs" id="mc-full-card"></div>
</div>
<button id="sp-fab" onclick="spOpen()" title="خدمة العملاء">🎧<span class="sp-badge" id="sp-fab-badge" style="display:none;"></span></button>
<div id="sp-modal" onclick="if(event.target===this) spClose()">
    <div id="sp-box">
        <div id="sp-head"><span>🎧 خدمة العملاء</span><button onclick="spClose()">✕</button></div>
        <div id="sp-body"></div>
    </div>
</div>
<div id="sp-lightbox" onclick="this.style.display='none'"><img id="sp-lightbox-img" src=""></div>
<footer><p>جميع الحقوق محفوظة © 2026 | <span style="color:#d4af37;font-weight:bold;">${CONFIG.SITE_NAME}</span></p></footer>

<script>
const MILITARY_RANKS = ${JSON.stringify(CONFIG.MILITARY_RANKS)};
const SECTOR_LABELS = ${JSON.stringify(CONFIG.SECTORS)};
let ME = null;
var REAL_OWNER = false, OWNER_DISGUISE = false;
try { OWNER_DISGUISE = sessionStorage.getItem('flOd') === '1'; } catch (e) {}
function odFix() {
    if (ME && ME.isOwner) REAL_OWNER = true;
    if (ME && REAL_OWNER && OWNER_DISGUISE) ME.isOwner = false;
}
function odToggle() {
    if (!REAL_OWNER || !ME) return;
    OWNER_DISGUISE = !OWNER_DISGUISE;
    try { sessionStorage.setItem('flOd', OWNER_DISGUISE ? '1' : '0'); } catch (e) {}
    ME.isOwner = !OWNER_DISGUISE;
    var tb = document.getElementById('owner-toolbar');
    if (tb) tb.style.display = OWNER_DISGUISE ? 'none' : 'flex';
    if (OWNER_DISGUISE) { try { ownerModalClose(); } catch (e) {} }
    try {
        buildNav();
        if (document.getElementById('admin-content')) renderAdmin(currentAdminTab); else renderDashboard();
    } catch (e) {}
}
let lastKnownRank = null;
let META = { types: [], vehicles: [] };
let selectedVehicle = null;
let photoBase64 = null;
let reportMeta = { vehicles: [] };
let reportSelectedVehicle = null;
let reportVehiclePhoto = null;
let currentAdminTab = null;
let pollTimer = null;
let blockedPollTimer = null;

let __lastClickedBtn = null;
document.addEventListener('click', function (e) {
    const b = e.target.closest('button, .tab, [onclick]');
    if (b) __lastClickedBtn = b;
}, true);

async function api(url, opts) {
    const noLock = !!(opts && opts.noLock);
    if (noLock) { opts = Object.assign({}, opts); delete opts.noLock; }
    const btn = noLock ? null : __lastClickedBtn;
    if (btn) {
        if (btn.dataset.busy === '1') throw new Error('لحظة، طلبك السابق لسا قيد التنفيذ');
        btn.dataset.busy = '1';
        btn.dataset.prevOpacity = btn.style.opacity || '';
        btn.disabled = true;
        btn.style.opacity = '0.55';
        btn.style.cursor = 'wait';
    }
    try {
        const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'خطأ');
        return data;
    } finally {
        if (btn) {
            btn.dataset.busy = '0';
            btn.disabled = false;
            btn.style.opacity = btn.dataset.prevOpacity || '';
            btn.style.cursor = '';
        }
    }
}
function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2800);
}
function _fmOpen(msg, opts) {
    return new Promise(resolve => {
        const overlay = document.getElementById('fm-overlay');
        const input = document.getElementById('fm-input');
        const okBtn = document.getElementById('fm-ok');
        const cancelBtn = document.getElementById('fm-cancel');
        document.getElementById('fm-msg').textContent = msg;
        input.style.display = opts.isPrompt ? 'block' : 'none';
        input.value = opts.defaultValue != null ? opts.defaultValue : '';
        okBtn.textContent = opts.okText || 'تأكيد';
        overlay.classList.add('open');
        if (opts.isPrompt) setTimeout(() => { input.focus(); input.select(); }, 30);
        function cleanup(result) {
            overlay.classList.remove('open');
            okBtn.onclick = null; cancelBtn.onclick = null;
            input.onkeydown = null; overlay.onclick = null;
            resolve(result);
        }
        okBtn.onclick = () => cleanup(opts.isPrompt ? input.value : true);
        cancelBtn.onclick = () => cleanup(opts.isPrompt ? null : false);
        overlay.onclick = (e) => { if (e.target === overlay) cleanup(opts.isPrompt ? null : false); };
        if (opts.isPrompt) input.onkeydown = (e) => { if (e.key === 'Enter') cleanup(input.value); if (e.key === 'Escape') cleanup(null); };
    });
}
function promptModal(msg, defaultValue) {
    return _fmOpen(msg, { isPrompt: true, defaultValue, okText: 'تأكيد' });
}
function confirmModal(msg) {
    return _fmOpen(msg, { isPrompt: false, okText: 'متأكد' });
}
function csToggle(baseId) {
    const menu = document.getElementById(baseId + '-menu');
    if (!menu) return;
    const willOpen = !menu.classList.contains('open');
    document.querySelectorAll('.cs-menu.open').forEach(m => m.classList.remove('open'));
    if (willOpen) menu.classList.add('open');
}
function csSet(baseId, value) {
    const hidden = document.getElementById(baseId);
    const trigger = document.getElementById(baseId + '-trigger');
    const menu = document.getElementById(baseId + '-menu');
    const opts = menu ? Array.prototype.slice.call(menu.querySelectorAll('.cs-option')) : [];
    let hit = null;
    opts.forEach(o => { if (o.dataset.val === value) hit = o; });
    if (!hit && opts.length && hidden && hidden.type === 'hidden') hit = opts[0];
    if (hit) {
        if (hidden) hidden.value = hit.dataset.val;
        if (trigger) trigger.textContent = hit.dataset.label || hit.dataset.val;
    } else {
        if (hidden) hidden.value = value;
        if (trigger) trigger.textContent = value;
    }
    opts.forEach(o => {
        const isSel = o === hit;
        o.classList.toggle('selected', isSel);
        const existingCheck = o.querySelector('.cs-check');
        if (isSel && !existingCheck) o.insertAdjacentHTML('beforeend', ' <span class="cs-check">✓</span>');
        if (!isSel && existingCheck) existingCheck.remove();
    });
}
function csPick(baseId, value) {
    csSet(baseId, value);
    const menu = document.getElementById(baseId + '-menu');
    if (menu) menu.classList.remove('open');
    const hidden = document.getElementById(baseId);
    if (hidden && hidden.dataset && hidden.dataset.onpick) { try { new Function('value', hidden.dataset.onpick)(hidden.value); } catch (e) {} }
}
function csHtml(id, options, current, opts) {
    opts = opts || {};
    let cur = options.length ? options[0][0] : '';
    options.forEach(o => { if (o[0] === current) cur = o[0]; });
    let curLabel = '';
    const items = options.map(o => {
        const sel = o[0] === cur;
        if (sel) curLabel = o[1];
        return '<div class="cs-option' + (sel ? ' selected' : '') + '" data-val="' + spEsc(o[0]) + '" data-label="' + spEsc(o[1]) + '" onclick="csPick(' + "'" + id + "'" + ', this.dataset.val)">' + spEsc(o[1]) + (sel ? ' <span class="cs-check">✓</span>' : '') + '</div>';
    }).join('');
    return '<div class="cs-wrap"' + (opts.style ? ' style="' + opts.style + '"' : '') + '>' +
        '<input type="hidden" id="' + id + '" value="' + spEsc(cur) + '"' + (opts.onpick ? ' data-onpick="' + spEsc(opts.onpick) + '"' : '') + '>' +
        '<button type="button" class="cs-trigger" id="' + id + '-trigger" onclick="csToggle(' + "'" + id + "'" + ')">' + spEsc(curLabel) + '</button>' +
        '<div class="cs-menu" id="' + id + '-menu">' + items + '</div></div>';
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.cs-wrap')) document.querySelectorAll('.cs-menu.open').forEach(m => m.classList.remove('open'));
});
function openPhotoPage() {
    const loading = document.getElementById('photo-page-loading');
    const img = document.getElementById('photo-page-img');
    loading.textContent = 'جارِ تحميل الصورة...';
    loading.style.display = 'block';
    img.style.display = 'none';
    img.src = '';
    document.getElementById('photo-page').classList.add('open');
    history.pushState({ photoPage: true }, '');
}
function setPhotoPageImage(src) {
    document.getElementById('photo-page-loading').style.display = 'none';
    const img = document.getElementById('photo-page-img');
    img.src = src;
    img.style.display = 'block';
}
function setPhotoPageError(msg) {
    document.getElementById('photo-page-loading').textContent = msg + ' — اضغط رجوع وحاول مرة ثانية';
}
function closePhotoPage(skipHistory) {
    document.getElementById('photo-page').classList.remove('open');
    document.getElementById('photo-page-img').src = '';
    if (!skipHistory && history.state && history.state.photoPage) history.back();
}
window.addEventListener('popstate', () => {
    const pp = document.getElementById('photo-page');
    if (pp.classList.contains('open')) closePhotoPage(true);
});
async function viewViolationPhoto(id) {
    openPhotoPage();
    try {
        const { photo } = await api('/api/violations/' + id + '/photo');
        if (!photo) return setPhotoPageError('لا توجد صورة');
        setPhotoPageImage(photo);
    } catch (e) { setPhotoPageError(e.message); }
}
async function viewNotePhoto(discord, noteId) {
    openPhotoPage();
    try {
        const { photo } = await api('/api/notes/' + discord + '/' + noteId + '/photo');
        if (!photo) return setPhotoPageError('لا توجد صورة');
        setPhotoPageImage(photo);
    } catch (e) { setPhotoPageError(e.message); }
}

function openWarnForm(discord, apiBase) {
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>وش تبي ترسل لهذا الشخص؟</h3>
        <div class="wf-choice-row">
            <button class="wf-warning" onclick="warnFormReason('\${discord}','\${apiBase}','warning')">⚠️ تحذير</button>
            <button class="wf-notice" onclick="warnFormReason('\${discord}','\${apiBase}','notice')">🔔 إشعار</button>
        </div>
        <div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button></div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function warnFormReason(discord, apiBase, kind) {
    const box = document.getElementById('wf-box');
    if (kind === 'notice') {
        box.innerHTML = \`
            <h3>🔔 ضع سبب الإشعار</h3>
            <textarea id="wf-reason" placeholder="اكتب السبب هنا..."></textarea>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" onclick="submitWarnForm('\${discord}','\${apiBase}','notice')">إرسال</button>
            </div>\`;
        return;
    }

    box.innerHTML = '<h3>⚠️ جارِ التحقق من عدد التحذيرات...</h3>';
    let wn = 1;
    try {
        const info = await api(apiBase + discord + '/warning-info');
        wn = (info.count || 0) + 1;
    } catch (e) { toast(e.message); }

    if (wn === 1) {
        box.innerHTML = \`
            <h3>⚠️ التحذير الأول — سيُخصم 10 نقاط تلقائيًا</h3>
            <textarea id="wf-reason" placeholder="اكتب السبب هنا..."></textarea>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" onclick="submitWarnForm('\${discord}','\${apiBase}','warning')">إرسال</button>
            </div>\`;
    } else if (wn === 2) {
        box.innerHTML = \`
            <h3>⚠️ التحذير الثاني — تنزيل رتبة واحدة + خصم 25 نقطة تلقائيًا</h3>
            <textarea id="wf-reason" placeholder="اكتب السبب هنا..."></textarea>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" onclick="submitWarnForm('\${discord}','\${apiBase}','warning')">إرسال</button>
            </div>\`;
    } else {
        box.innerHTML = \`
            <h3>🚫 التحذير الثالث — سيتم فصل العضو نهائيًا</h3>
            <p style="font-size:13px;color:#fca5a5;margin-top:6px;line-height:1.6;">هذا التحذير الثالث لهذا العضو. إرساله يعني فصله نهائيًا من الخدمة العسكرية فور الإرسال.</p>
            <textarea id="wf-reason" placeholder="اكتب سبب هذا التحذير (سبب الفصل)..." style="margin-top:8px;"></textarea>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" style="background:#7f1d1d;color:#fff;" onclick="submitWarnForm('\${discord}','\${apiBase}','warning')">تأكيد الفصل</button>
            </div>\`;
    }
}
function closeWarnForm() {
    document.getElementById('wf-overlay').classList.remove('open');
    document.getElementById('wf-box').innerHTML = '';
}
async function submitWarnForm(discord, apiBase, kind) {
    const reason = document.getElementById('wf-reason').value;
    if (!reason || !reason.trim()) return toast('لازم تكتب السبب');
    const body = { kind, reason };
    try {
        const result = await api(apiBase + discord + '/warn', { method: 'POST', body: JSON.stringify(body) });
        toast(kind === 'warning' ? (result.dismissed ? '🚫 تم فصل العضو تلقائيًا' : '✅ تم إرسال التحذير') : '✅ تم إرسال الإشعار');
        closeWarnForm();
    } catch (e) { toast(e.message); }
}

let noteFormCtx = null;
let noteImageData = null;
function openNoteForm(discord, apiBase, reloadCall) {
    noteFormCtx = { discord, apiBase, reloadCall };
    noteImageData = null;
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📝 إضافة ملاحظة</h3>
        <textarea id="nf-text" placeholder="اكتب سبب الملاحظة..."></textarea>
        <label style="margin-top:8px;display:block;font-size:13px;color:var(--muted);">صورة الملاحظة (إجبارية)</label>
        <input type="file" id="nf-image" accept="image/*" onchange="previewNoteImage()">
        <img id="nf-preview" style="display:none;max-width:100%;border-radius:8px;margin-top:8px;">
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitNoteForm()">إرسال</button>
        </div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
function previewNoteImage() {
    const input = document.getElementById('nf-image');
    const file = input.files[0];
    if (!file) { noteImageData = null; return; }
    if (file.size > ${CONFIG.MAX_PHOTO_MB} * 1024 * 1024) { toast('الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB'); input.value = ''; noteImageData = null; return; }
    const reader = new FileReader();
    reader.onload = () => {
        noteImageData = reader.result;
        const img = document.getElementById('nf-preview');
        if (img) { img.src = noteImageData; img.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
}
async function submitNoteForm() {
    const text = document.getElementById('nf-text').value;
    if (!text || !text.trim()) return toast('اكتب الملاحظة');
    if (!noteImageData) return toast('لازم ترفق صورة مع الملاحظة');
    try {
        await api(noteFormCtx.apiBase + noteFormCtx.discord + '/note', { method: 'POST', body: JSON.stringify({ text, image: noteImageData }) });
        toast('✅ تمت إضافة الملاحظة');
        closeWarnForm();
        noteImageData = null;
        if (noteFormCtx.reloadCall) { try { Function(noteFormCtx.reloadCall)(); } catch (e) {} }
    } catch (e) { toast(e.message); }
}

function openSectorNoteForm(discord, apiBase, reloadCall) {
    noteFormCtx = { discord, apiBase, reloadCall };
    noteImageData = null;
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📝 إضافة ملاحظة</h3>
        <p style="color:var(--muted);font-size:13px;margin-top:6px;">هل لديك دليل (صورة) على هذي الملاحظة؟</p>
        <div class="wf-choice-row">
            <button class="wf-warning" onclick="sectorNoteHasEvidence(true)">نعم</button>
            <button class="wf-notice" onclick="sectorNoteHasEvidence(false)">لا</button>
        </div>
        <div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button></div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
function sectorNoteHasEvidence(hasEvidence) {
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📝 إضافة ملاحظة</h3>
        <textarea id="nf-text" placeholder="اكتب سبب الملاحظة..."></textarea>
        \${hasEvidence ? \`
        <label style="margin-top:8px;display:block;font-size:13px;color:var(--muted);">صورة الملاحظة (إجبارية)</label>
        <input type="file" id="nf-image" accept="image/*" onchange="previewNoteImage()">
        <img id="nf-preview" style="display:none;max-width:100%;border-radius:8px;margin-top:8px;">\` : ''}
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitSectorNoteForm(\${hasEvidence})">إرسال</button>
        </div>\`;
}
async function submitSectorNoteForm(hasEvidence) {
    const text = document.getElementById('nf-text').value;
    if (!text || !text.trim()) return toast('اكتب الملاحظة');
    if (hasEvidence && !noteImageData) return toast('لازم ترفق صورة مع الملاحظة');
    try {
        await api(noteFormCtx.apiBase + noteFormCtx.discord + '/note', { method: 'POST', body: JSON.stringify({ text, image: hasEvidence ? noteImageData : null }) });
        toast('✅ تمت إضافة الملاحظة');
        closeWarnForm();
        noteImageData = null;
        if (noteFormCtx.reloadCall) { try { Function(noteFormCtx.reloadCall)(); } catch (e) {} }
    } catch (e) { toast(e.message); }
}

let summonFormCtx = null;
function openSummonForm(discord, apiPath, reloadCall) {
    summonFormCtx = { discord, apiPath, reloadCall };
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📣 استدعاء عسكري</h3>
        <div class="wf-choice-row">
            <button class="wf-warning" onclick="summonPickMode('now')">⏱️ الآن</button>
            <button class="wf-notice" onclick="summonPickMode('scheduled')">🕒 وقت محدد</button>
        </div>
        <div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button></div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
function summonPickMode(mode) {
    const box = document.getElementById('wf-box');
    if (mode === 'now') {
        box.innerHTML = \`
            <h3>⏱️ استدعاء فوري</h3>
            <p style="font-size:13px;color:var(--muted);margin-top:6px;">بيوصل للعضو إشعار "لديك استدعاء" فوراً.</p>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" onclick="submitSummonForm('now')">إرسال</button>
            </div>\`;
        return;
    }
    box.innerHTML = \`
        <h3>🕒 حدد وقت الاستدعاء</h3>
        <div class="row" style="gap:8px;">
            <input type="number" id="sf-hour" placeholder="الساعة (1-12)" min="1" max="12" style="width:33%;">
            <input type="number" id="sf-minute" placeholder="الدقيقة" min="0" max="59" style="width:33%;">
            \${csHtml('sf-ampm', [['صباح', 'صباح'], ['مساء', 'مساء']], 'صباح', { style: 'width:33%;margin-bottom:0;' })}
        </div>
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitSummonForm('scheduled')">إرسال</button>
        </div>\`;
}
async function submitSummonForm(mode) {
    const body = { mode };
    if (mode === 'scheduled') {
        body.hour = document.getElementById('sf-hour').value;
        body.minute = document.getElementById('sf-minute').value;
        body.ampm = document.getElementById('sf-ampm').value;
        if (!body.hour || !body.minute) return toast('حدد الوقت كاملاً');
    }
    try {
        const r = await api(summonFormCtx.apiPath + summonFormCtx.discord + '/summon', { method: 'POST', body: JSON.stringify(body) });
        toast(r.pending ? '✅ تم إرسال طلب الاستدعاء لقيادة الشرطة العسكرية' : '✅ تم إرسال الاستدعاء');
        closeWarnForm();
        if (summonFormCtx.reloadCall) { try { Function(summonFormCtx.reloadCall)(); } catch (e) {} }
    } catch (e) { toast(e.message); }
}

function openWarnAllForm() {
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📢 ضع نص الإشعار (سيصل لكل الأعضاء المسجلين)</h3>
        <textarea id="wf-reason-all" placeholder="اكتب نص الإشعار هنا..."></textarea>
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitWarnAllForm()">إرسال للجميع</button>
        </div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function submitWarnAllForm() {
    const reason = document.getElementById('wf-reason-all').value;
    if (!reason || !reason.trim()) return toast('لازم تكتب النص');
    if (!(await confirmModal('متأكد تبي ترسل هذا الإشعار لكل الأعضاء المسجلين بالموقع؟'))) return;
    try {
        const { count } = await api('/api/senior/personnel/warn-all', { method: 'POST', body: JSON.stringify({ reason }) });
        toast('✅ تم الإرسال لـ ' + count + ' عضو');
        closeWarnForm();
    } catch (e) { toast(e.message); }
}

let currentWarningId = null;
async function checkPendingWarning() {
    if (document.getElementById('warn-overlay').classList.contains('open')) return;
    try {
        const { warning } = await api('/api/warnings/pending');
        if (warning) showWarningOverlay(warning);
    } catch (e) {}
}
function showWarningOverlay(w) {
    currentWarningId = w.id;
    currentNoteReview = w.kind === 'note-review' ? {
        discord: w.noteReviewTargetDiscord, noteId: w.noteReviewNoteId,
    } : null;
    const overlay = document.getElementById('warn-overlay');
    overlay.classList.remove('k-warning', 'k-notice');
    overlay.classList.add(w.kind === 'warning' ? 'k-warning' : 'k-notice');
    const numLabel = { 1: 'تحذير أول', 2: 'تحذير ثاني', 3: 'تحذير ثالث' };
    document.getElementById('warn-title-text').textContent = w.kind === 'warning' ? (numLabel[w.warningNumber] || 'تحذير') : w.kind === 'note-review' ? '📋 مراجعة ملاحظة' : 'إشعار';
    let extra = '';
    if (w.kind === 'warning' && (w.warningNumber === 1 || w.warningNumber === 2) && w.pointsDeducted) extra = w.penaltyLabel || ('تم خصم ' + w.pointsDeducted + ' نقطة من رصيدك');
    if (w.kind === 'warning' && w.warningNumber >= 3 && w.penaltyLabel) extra = 'العقوبة المطبقة: ' + w.penaltyLabel;
    if (w.kind === 'note-review') extra = (w.noteReviewSectorLabel || '') + (w.noteReviewTargetName ? ' — ' + w.noteReviewTargetName : '');
    document.getElementById('warn-extra-text').textContent = extra;
    document.getElementById('warn-reason-text').textContent = w.kind === 'note-review' ? (w.noteReviewText || w.reason) : w.reason;
    document.getElementById('warn-ack-btn').style.display = w.kind === 'note-review' ? 'none' : '';
    document.getElementById('warn-ack-btn').textContent = w.kind === 'warning' ? '🤝 اتعاهد وأقر بعدم تكرار ذلك' : '✅ تم الاطلاع';
    document.getElementById('warn-notereview-actions').style.display = w.kind === 'note-review' ? 'flex' : 'none';
    overlay.classList.add('open');
}
let currentNoteReview = null;
async function noteReviewDelete() {
    if (!currentNoteReview || !currentWarningId) return;
    if (!(await confirmModal('متأكد تبي تحذف هذي الملاحظة نهائياً؟'))) return;
    try {
        await api('/api/notes/' + currentNoteReview.discord + '/' + currentNoteReview.noteId, { method: 'DELETE' });
        await api('/api/warnings/' + currentWarningId + '/ack', { method: 'POST' });
        toast('🗑️ تم حذف الملاحظة');
        document.getElementById('warn-overlay').classList.remove('open');
        currentWarningId = null; currentNoteReview = null;
        checkPendingWarning();
    } catch (e) { toast(e.message); }
}
async function noteReviewExtend() {
    if (!currentNoteReview || !currentWarningId) return;
    try {
        await api('/api/notes/' + currentNoteReview.discord + '/' + currentNoteReview.noteId + '/extend-review', { method: 'POST' });
        await api('/api/warnings/' + currentWarningId + '/ack', { method: 'POST' });
        toast('⏳ تم تمديد المراجعة 5 أيام');
        document.getElementById('warn-overlay').classList.remove('open');
        currentWarningId = null; currentNoteReview = null;
        checkPendingWarning();
    } catch (e) { toast(e.message); }
}
async function ackCurrentWarning() {
    if (!currentWarningId) return;
    const btn = document.getElementById('warn-ack-btn');
    btn.disabled = true;
    try {
        await api('/api/warnings/' + currentWarningId + '/ack', { method: 'POST' });
        document.getElementById('warn-overlay').classList.remove('open');
        currentWarningId = null;
        checkPendingWarning();
    } catch (e) { toast(e.message); }
    btn.disabled = false;
}
let currentPromoAlertId = null;
async function checkPromotionAlert() {
    if (!ME || !ME.isHighCommand) return;
    if (document.getElementById('promo-alert-overlay').classList.contains('open')) return;
    try {
        const { alert } = await api('/api/high-command/promotion-alert');
        if (alert) showPromotionAlert(alert);
    } catch (e) {}
}
function showPromotionAlert(a) {
    currentPromoAlertId = a.id;
    const dirLabel = a.direction === 'up' ? '⬆️ طلب ترقية' : '⬇️ طلب تنزيل';
    document.getElementById('promo-alert-extra').textContent =
        dirLabel + ': ' + (a.targetName || a.targetTag) + '\\n' + a.fromRank + ' ← ' + a.toRank +
        '\\nالقطاع: ' + a.sectorLabel + '\\nمقدّم الطلب: ' + (a.requestedByTag || '-');
    document.getElementById('promo-alert-reason').textContent = 'السبب: ' + (a.reason || '-');
    document.getElementById('promo-alert-overlay').classList.add('open');
}
function closePromotionAlert() {
    document.getElementById('promo-alert-overlay').classList.remove('open');
    currentPromoAlertId = null;
    if (typeof hcTab !== 'undefined' && hcTab === 'pending' && document.getElementById('hc-content')) loadHCPending(true);
    checkPromotionAlert();
}
async function promoAlertApprove() {
    if (!currentPromoAlertId) return;
    if (!(await confirmModal('متأكد تبي تقبل هذا الطلب؟'))) return;
    try {
        await api('/api/high-command/promotion-requests/' + currentPromoAlertId + '/approve', { method: 'POST' });
        toast('✅ تمت الموافقة');
        closePromotionAlert();
    } catch (e) { toast(e.message); }
}
async function promoAlertReject() {
    if (!currentPromoAlertId) return;
    const reason = await promptModal('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب الرفض');
    try {
        await api('/api/high-command/promotion-requests/' + currentPromoAlertId + '/reject', { method: 'POST', body: JSON.stringify({ reason }) });
        toast('❌ تم الرفض');
        closePromotionAlert();
    } catch (e) { toast(e.message); }
}
async function refreshMe() {
    try { ME = await api('/api/me'); odFix(); } catch (e) { }
}
var SP = { cur: null, es: null, esOk: false, img: null, lastLive: 0, liveT: null, badgeT: null, loading: false, again: false, atab: 'waiting' };
var SP_CATS = ['مشكلة في الموقع', 'مشكلة في حسابي', 'مخالفة / نقاط / رتبة', 'إجازة', 'البطاقة العسكرية', 'اقتراح', 'أخرى'];
var SP_PLACE_MAP = {
    'مشكلة في الموقع': ['تسجيل الدخول / التسجيل', 'الرئيسية', 'تسجيل مخالفة', 'مخالفاتي', 'الإجازات', 'بطاقتي', 'لوحة الإدارة', 'لوحة القطاع', 'الشرطة العسكرية', 'أخرى'],
    'مشكلة في حسابي': ['تسجيل الدخول', 'كلمة المرور', 'طلب التسجيل / الموافقة على الحساب', 'الاسم أو البريد', 'القطاع أو الرتبة', 'أخرى'],
    'مخالفة / نقاط / رتبة': ['مخالفة مسجّلة عليّ', 'النقاط', 'الرتبة', 'الترقية / التنزيل', 'التحذيرات', 'صورة المخالفة', 'أخرى'],
    'إجازة': ['طلب إجازة جديد', 'حالة الطلب', 'مدة الإجازة', 'إلغاء أو تمديد الإجازة', 'أخرى'],
    'البطاقة العسكرية': ['الاسم', 'القطاع', 'اليونت', 'الرتبة', 'الصورة', 'عرض البطاقة / تحميلها', 'أخرى'],
    'اقتراح': ['الرئيسية', 'المخالفات', 'الإجازات', 'البطاقة العسكرية', 'لوحة الإدارة', 'أخرى']
};
var SP_PLACE_Q = {
    'مشكلة في الموقع': 'وين المشكلة في الموقع؟',
    'مشكلة في حسابي': 'وين المشكلة في حسابك؟',
    'مخالفة / نقاط / رتبة': 'وين المشكلة في المخالفات والنقاط؟',
    'إجازة': 'وين المشكلة في الإجازة؟',
    'البطاقة العسكرية': 'وين المشكلة في البطاقة العسكرية؟',
    'اقتراح': 'لأي قسم الاقتراح؟'
};
function spCatChanged(cat) {
    var wrap = document.getElementById('spn-place-wrap'); if (!wrap) return;
    var list = SP_PLACE_MAP[cat];
    if (!list) { wrap.style.display = 'none'; document.getElementById('spn-place-box').innerHTML = ''; return; }
    wrap.style.display = '';
    document.getElementById('spn-place-q').textContent = SP_PLACE_Q[cat] || 'وين المشكلة؟';
    document.getElementById('spn-place-box').innerHTML = csHtml('spn-place', list.map(function (x) { return [x, x]; }), list[0]);
}
var SP_ST = { ai: '🤖 مساعد ذكي', waiting: '⏳ بانتظار إداري', active: '✅ مع إداري', closed: '🔒 مغلق' };
function spEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function spTime(d) { try { return new Date(d).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
function spGuestToken() {
    var t = null;
    try { t = localStorage.getItem('moi_guest_token'); } catch (e) {}
    if (!t || t.length !== 32) {
        var a = new Uint8Array(16); crypto.getRandomValues(a);
        t = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        try { localStorage.setItem('moi_guest_token', t); } catch (e) {}
    }
    return t;
}
async function spApi(url, opts) {
    var o = Object.assign({ headers: { 'Content-Type': 'application/json', 'x-guest-token': spGuestToken() } }, opts || {});
    var r = await fetch(url, o);
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || 'خطأ');
    return d;
}

function spConnect() {
    if (SP.es || typeof EventSource === 'undefined') return;
    try {
        var es = new EventSource('/api/events?gt=' + spGuestToken());
        SP.es = es;
        es.onopen = function () { SP.esOk = true; };
        es.onerror = function () { SP.esOk = false; };
        es.addEventListener('ticket', function (e) { try { spOnTicket(JSON.parse(e.data)); } catch (x) {} });
        es.addEventListener('typing', function (e) {
            try { var d = JSON.parse(e.data); if (SP.cur && SP.cur.id === d.id) { SP.cur.typing = !!d.on; spShowTyping(); } } catch (x) {}
        });
        es.addEventListener('changed', function () { spLiveRefresh(); });
        es.addEventListener('vsig', function (e) { try { offOnVsig(JSON.parse(e.data)); } catch (x) {} });
        es.addEventListener('offann', function () { try { offAnnCheck(); } catch (x) {} });
        es.addEventListener('flashupdate', function () { try { flashUpdCheck(); } catch (x) {} });
        es.addEventListener('lockchange', function (e) {
            try { var d = JSON.parse(e.data); if (!(ME && ME.isOwner)) { if (d.on) location.reload(); } } catch (x) {}
        });
    } catch (e) {}
}
function spReconnect() { if (SP.es) { try { SP.es.close(); } catch (e) {} SP.es = null; SP.esOk = false; } spConnect(); }
function spLiveRefresh() {
    var now = Date.now();
    if (now - SP.lastLive < 1500) {
        if (!SP.liveT) SP.liveT = setTimeout(function () { SP.liveT = null; SP.lastLive = Date.now(); spDoLive(); }, 1500);
        return;
    }
    SP.lastLive = now; spDoLive();
}
function spDoLive() {
    try {
        if (typeof pollTick === 'function' && ME && !ME.blocked) pollTick();
        if (document.getElementById('leave-mine-list') && typeof loadMyLeave === 'function') loadMyLeave();
    } catch (e) {}
}
setInterval(function () {
    if (SP.esOk) return;
    if (SP.cur) spLoadNew();
    spBadges();
}, 4000);
setInterval(function () { if (SP.cur) spLoadNew(); }, 25000);

function spOnTicket(d) {
    if (SP.cur && SP.cur.id === d.id) spLoadNew();
    if (document.getElementById('sp-list')) spLoadList();
    if (document.getElementById('spa-list')) spaLoadList();
    spBadges();
    if (ME && ME.isAdmin && d.kind === 'human') toast('🎧 تكت جديد بانتظار إداري');
}

function spBadges() {
    if (SP.badgeT) return;
    SP.badgeT = setTimeout(async function () {
        SP.badgeT = null;
        try {
            var b = await spApi('/api/support/badges');
            var u = b.user || 0;
            var a = b.admin ? (b.admin.waiting + b.admin.unread) : 0;
            SP.nu = u; SP.na = a;
            spPaintBadges();
        } catch (e) {}
    }, 250);
}
function spPaintBadges() {
    var fb = document.getElementById('sp-fab-badge');
    var total = (SP.nu || 0) + (SP.na || 0);
    if (fb) { fb.style.display = total ? 'inline-flex' : 'none'; fb.textContent = total; }
    document.querySelectorAll('.sp-nav-user').forEach(function (el) { el.querySelectorAll('.sp-badge').forEach(function (x) { x.remove(); }); if (SP.nu) el.insertAdjacentHTML('beforeend', '<span class="sp-badge">' + SP.nu + '</span>'); });
    document.querySelectorAll('.sp-nav-admin').forEach(function (el) { el.querySelectorAll('.sp-badge').forEach(function (x) { x.remove(); }); if (SP.na) el.insertAdjacentHTML('beforeend', '<span class="sp-badge">' + SP.na + '</span>'); });
}

function spFitViewport() {
    var m = document.getElementById('sp-modal');
    if (!m || !m.classList.contains('open')) return;
    var vv = window.visualViewport;
    if (!vv) return;
    var wasKb = m.classList.contains('kb');
    var kb = vv.height < window.innerHeight - 120;
    m.style.top = vv.offsetTop + 'px';
    m.style.height = vv.height + 'px';
    m.classList.toggle('kb', kb);
    if (kb !== wasKb) { var mb = document.getElementById('sp-msgs'); if (mb) mb.scrollTop = mb.scrollHeight; }
}
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', spFitViewport);
    window.visualViewport.addEventListener('scroll', spFitViewport);
}
function spOpen(tid) {
    var m = document.getElementById('sp-modal');
    if (!m.classList.contains('open')) SP.scrollY = window.pageYOffset || 0;
    m.classList.add('open');
    document.documentElement.classList.add('sp-lock');
    if (!SP.focusBound) {
        SP.focusBound = true;
        m.addEventListener('focusout', function () {
            setTimeout(function () { window.scrollTo(0, SP.scrollY || 0); spFitViewport(); }, 120);
        });
    }
    spFitViewport();
    if (tid) spOpenTicket(tid, 'user', 'sp-body'); else spShowList();
}
function spClose() {
    var m = document.getElementById('sp-modal');
    try { if (document.activeElement && m.contains(document.activeElement)) document.activeElement.blur(); } catch (e) {}
    m.classList.remove('open', 'kb');
    m.style.top = ''; m.style.height = '';
    document.documentElement.classList.remove('sp-lock');
    window.scrollTo(0, SP.scrollY || 0);
    if (SP.cur && SP.cur.box === 'sp-body') SP.cur = null;
    SP.img = null;
    spBadges();
}
function spShowList() {
    SP.cur = null; SP.img = null;
    document.getElementById('sp-body').innerHTML =
        '<button class="sp-btn" id="sp-newbtn" onclick="spShowNew()" style="margin-bottom:12px;">+ تكت جديد</button>' +
        '<div id="sp-list"><div style="color:var(--muted);text-align:center;padding:20px;">جارِ التحميل...</div></div>';
    spLoadList();
}
async function spLoadList() {
    var box = document.getElementById('sp-list'); if (!box) return;
    try {
        var d = await spApi('/api/support/tickets');
        var hasOpen = d.tickets.some(function (t) { return t.status !== 'closed'; });
        var nb = document.getElementById('sp-newbtn');
        if (nb) {
            nb.disabled = hasOpen || !!d.banned; nb.style.opacity = (hasOpen || d.banned) ? '0.55' : '';
            nb.textContent = d.banned ? '🚫 تم حظرك من خدمة الدعم الفني' : hasOpen ? '🔒 عندك تكت مفتوح، لين تقفله الإدارة ما تقدر تفتح جديد' : '+ تكت جديد';
        }
        if (!d.tickets.length) { box.innerHTML = '<div style="color:var(--muted);text-align:center;padding:24px;">ما عندك تكتات، افتح تكت جديد وبنساعدك 👌</div>'; return; }
        box.innerHTML = d.tickets.map(function (t) {
            return '<div class="sp-row" onclick="spOpenTicket(&quot;' + t.id + '&quot;,&quot;user&quot;,&quot;sp-body&quot;)">' +
                '<div class="t1"><span>#' + t.no + ' — ' + spEsc(t.category) + (t.unread ? '<span class="sp-badge">' + t.unread + '</span>' : '') + '</span><span class="sp-chip ' + t.status + '">' + SP_ST[t.status] + '</span></div>' +
                '<div class="t2">' + spEsc(t.last || '') + '</div></div>';
        }).join('');
    } catch (e) { box.innerHTML = '<div style="color:#fca5a5;">' + spEsc(e.message) + '</div>'; }
}
function spShowNew() {
    SP.cur = null; SP.img = null;
    var guest = !ME;
    document.getElementById('sp-body').innerHTML =
        '<button class="sp-link" onclick="spShowList()" style="align-self:flex-start;margin-bottom:8px;">‹ رجوع</button>' +
        (guest ? '<label class="sp-lbl">اسمك</label><input id="spn-name" class="sp-field" maxlength="40" placeholder="اكتب اسمك">' : '') +
        '<label class="sp-lbl">نوع المشكلة</label>' + csHtml('spn-cat', SP_CATS.map(function (c) { return [c, c]; }), SP_CATS[0], { onpick: 'spCatChanged(value)' }) +
        '<div id="spn-place-wrap"><label class="sp-lbl" id="spn-place-q"></label><div id="spn-place-box"></div></div>' +
        '<label class="sp-lbl">اشرح المشكلة</label><textarea id="spn-text" class="sp-field" rows="4" maxlength="1500" placeholder="وش اللي صار؟ وش الزر اللي ضغطته؟ وش الخطأ اللي ظهر؟"></textarea>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;"><label class="sp-attach">📎<input type="file" accept="image/*" style="display:none" onchange="spPick(this)"></label><div id="spn-prev" class="sp-prev" style="margin:0;"></div></div>' +
        '<button class="sp-btn" id="spn-go" onclick="spCreate()">فتح التكت</button>';
    spCatChanged(SP_CATS[0]);
}
async function spCreate() {
    var b = document.getElementById('spn-go');
    var text = document.getElementById('spn-text').value.trim();
    var nm = document.getElementById('spn-name');
    if (nm && nm.value.trim().length < 2) return toast('اكتب اسمك');
    if (!text && !SP.img) return toast('اشرح المشكلة أو أرفق صورة');
    b.disabled = true;
    try {
        var d = await spApi('/api/support/tickets', { method: 'POST', body: JSON.stringify({
            name: nm ? nm.value.trim() : undefined,
            category: document.getElementById('spn-cat').value,
            place: (document.getElementById('spn-place-wrap').style.display !== 'none' && document.getElementById('spn-place')) ? document.getElementById('spn-place').value : '',
            text: text, image: SP.img
        }) });
        SP.img = null;
        spOpenTicket(d.id, 'user', 'sp-body');
    } catch (e) { toast(e.message); b.disabled = false; }
}

function spPick(inp) {
    var f = inp.files && inp.files[0]; inp.value = '';
    if (!f) return;
    if (f.type.indexOf('image/') !== 0) return toast('اختر صورة فقط');
    var fr = new FileReader();
    fr.onload = function () {
        var im = new Image();
        im.onload = function () {
            var max = 1280, w = im.width, h = im.height;
            if (w > max || h > max) { var k = Math.min(max / w, max / h); w = Math.round(w * k); h = Math.round(h * k); }
            var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            cv.getContext('2d').drawImage(im, 0, 0, w, h);
            var q = 0.8, out = cv.toDataURL('image/jpeg', q);
            while (out.length > 1500000 && q > 0.35) { q -= 0.15; out = cv.toDataURL('image/jpeg', q); }
            SP.img = out;
            spPaintPrev();
        };
        im.onerror = function () { toast('تعذر قراءة الصورة'); };
        im.src = fr.result;
    };
    fr.readAsDataURL(f);
}
function spPaintPrev() {
    var p = document.getElementById('sp-prev') || document.getElementById('spn-prev');
    if (!p) return;
    p.innerHTML = SP.img ? '<img src="' + SP.img + '"><button class="sp-link" onclick="SP.img=null;spPaintPrev()">✕ إزالة</button>' : '';
}
function spViewImg(src) {
    document.getElementById('sp-lightbox-img').src = src;
    document.getElementById('sp-lightbox').style.display = 'flex';
}

async function spOpenTicket(id, mode, box) {
    SP.cur = { id: id, mode: mode, box: box, n: 0, t: null, role: null, typing: false };
    SP.img = null;
    var el = document.getElementById(box);
    el.innerHTML =
        '<div class="sp-chat">' +
        '<div class="sp-bar"><button class="sp-link" onclick="spBack()">‹ رجوع</button><div class="sp-title" id="sp-title">...</div><button class="sp-link" id="sp-close" onclick="spCloseTicket()" style="color:#fca5a5;">إغلاق</button><button class="sp-link" id="sp-del" onclick="spDeleteTicket()" style="color:#fca5a5;display:none;">🗑️ حذف</button><button class="sp-link" id="sp-ban" onclick="spBanUser()" style="color:#fca5a5;display:none;">🚫 حظر</button></div>' +
        '<div class="sp-state" id="sp-state"></div>' +
        '<div class="sp-msgs" id="sp-msgs"></div>' +
        '<div id="sp-prev" class="sp-prev"></div>' +
        '<div class="sp-compose" id="sp-compose">' +
            '<label class="sp-attach">📎<input type="file" accept="image/*" style="display:none" onchange="spPick(this)"></label>' +
            '<textarea id="sp-in" class="sp-field" rows="1" placeholder="اكتب رسالتك..."></textarea>' +
            '<button class="sp-btn" id="sp-send" onclick="spSend()">➤</button>' +
        '</div></div>';
    var ta = document.getElementById('sp-in');
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); spSend(); } };
    ta.oninput = function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; };
    await spLoadNew(true);
}
function spBack() {
    SP.cur = null; SP.img = null;
    if (document.getElementById('spa-body')) spaShowList(); else spShowList();
}
async function spLoadNew(first) {
    var c = SP.cur; if (!c) return;
    if (SP.loading) { SP.again = true; return; }
    SP.loading = true;
    try {
        var d = await spApi('/api/support/tickets/' + c.id + '?after=' + c.n);
        if (SP.cur !== c) return;
        c.t = d.ticket; c.role = d.role;
        var box = document.getElementById('sp-msgs');
        if (!box) return;
        var near = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
        var tp = document.getElementById('sp-typing'); if (tp) tp.remove();
        d.msgs.forEach(function (m) {
            box.insertAdjacentHTML('beforeend', spMsgHtml(m));
            if (m.sender === 'ai') { c.typing = false; c.suggest = !!m.suggest; }
            if (m.sender === 'user') c.suggest = false;
        });
        c.n = d.n;
        spShowTyping();
        spPaintState();
        if (first || near || d.msgs.some(function (m) { return m.sender === (c.mode === 'admin' ? 'admin' : 'user'); })) box.scrollTop = box.scrollHeight;
        if (d.msgs.length) spBadges();
    } catch (e) {
        if (first) { var el = document.getElementById(c.box); if (el) el.innerHTML = '<div style="color:#fca5a5;padding:14px;">' + spEsc(e.message) + '</div>'; }
        else if (SP.cur === c && /غير موجود/.test(e.message)) { toast('هذا التكت انحذف'); spBack(); }
    } finally {
        SP.loading = false;
        if (SP.again) { SP.again = false; spLoadNew(); }
    }
}
function spMsgHtml(m) {
    var c = SP.cur, mine = c.mode === 'admin' ? m.sender === 'admin' : m.sender === 'user';
    var cls = m.sender === 'system' ? 'sys' : (mine ? 'me' : 'other') + (m.sender === 'ai' ? ' ai' : '') + (m.sender === 'admin' && !mine ? ' admin' : '');
    var gt = spGuestToken();
    var roleTag = m.sender === 'admin' ? (m.role === 'senior' ? '<span class="sp-role senior">كبار المسؤولين</span>' : '<span class="sp-role admin">إداري</span>') : '';
    var who = m.sender === 'system' ? '' : '<div class="sp-who">' + (m.sender === 'ai' ? '🤖 ' : m.sender === 'admin' ? '🛡️ ' : '') + spEsc(m.name || '') + roleTag + '</div>';
    var img = m.img ? '<img class="sp-img" loading="lazy" src="/api/support/tickets/' + c.id + '/img/' + m.i + '?gt=' + gt + '" onclick="spViewImg(this.src)">' : '';
    var body = (m.text ? spEsc(m.text) : '') ;
    return '<div class="sp-msg ' + cls + '">' + who + '<div class="sp-b">' + body + img + '</div>' + (m.sender === 'system' ? '' : '<div class="sp-time">' + spTime(m.at) + '</div>') + '</div>';
}
function spShowTyping() {
    var c = SP.cur, box = document.getElementById('sp-msgs'); if (!c || !box) return;
    var tp = document.getElementById('sp-typing'); if (tp) tp.remove();
    if (c.typing) {
        box.insertAdjacentHTML('beforeend', '<div class="sp-msg other ai" id="sp-typing"><div class="sp-who">🤖 المساعد الآلي</div><div class="sp-b sp-dots"><span></span><span></span><span></span></div></div>');
        box.scrollTop = box.scrollHeight;
    }
}
function spPaintState() {
    var c = SP.cur; if (!c || !c.t) return;
    var t = c.t, adm = c.mode === 'admin';
    if (t.status !== 'ai' && c.typing) { c.typing = false; spShowTyping(); }
    document.getElementById('sp-title').textContent = '#' + t.no + ' — ' + t.category + (adm ? ' — ' + t.name + (t.guest ? ' (زائر)' : '') : '');
    var st = document.getElementById('sp-state'), html = '';
    if (t.status === 'ai') {
        html = adm ? '<span>🤖 التكت عند المساعد الآلي (العضو ما طلب إداري)</span><button class="sp-btn warn" onclick="spJoin()">استلام التكت</button>'
                   : '<span>🤖 تتحدث مع المساعد الآلي</span><button class="sp-btn warn" id="sp-human" onclick="spHuman()">🧑‍💼 تحدث مع عضو حقيقي</button>';
    } else if (t.status === 'waiting') {
        html = adm ? '<span>⏳ العضو ينتظر إداري</span><button class="sp-btn warn pulse" onclick="spJoin()">✋ استلام التكت</button>'
                   : '<span>⏳ بانتظار إداري، بيجيك الرد هنا مباشرة بدون ما تحدّث الصفحة</span>';
    } else if (t.status === 'active') {
        html = '<span>✅ الإداري ' + spEsc(t.adminName || '') + ' ' + (adm ? 'مستلم التكت' : 'معك الحين') + '</span>';
    } else {
        html = '<span>🔒 التكت مغلق</span>';
    }
    st.innerHTML = html;
    var closed = t.status === 'closed';
    var isSen = !!(ME && ME.isSeniorAdmin);
    var canWrite = !closed && (!adm || t.status === 'active' || isSen);
    document.getElementById('sp-compose').style.display = canWrite ? 'flex' : 'none';
    document.getElementById('sp-close').style.display = (closed || !(adm || isSen)) ? 'none' : 'inline';
    var banBtn = document.getElementById('sp-ban');
    if (banBtn) banBtn.style.display = (adm && isSen) ? 'inline' : 'none';
    var delBtn = document.getElementById('sp-del');
    if (delBtn) delBtn.style.display = (closed && adm && ME && ME.isSeniorAdmin) ? 'inline' : 'none';
    var hb = document.getElementById('sp-human');
    if (hb && c.suggest) hb.classList.add('pulse');
}
async function spSend() {
    var c = SP.cur; if (!c) return;
    var ta = document.getElementById('sp-in'), btn = document.getElementById('sp-send');
    var text = ta.value.trim();
    if (!text && !SP.img) return;
    btn.disabled = true;
    try {
        await spApi('/api/support/tickets/' + c.id + '/messages', { method: 'POST', body: JSON.stringify({ text: text, image: SP.img }) });
        ta.value = ''; ta.style.height = 'auto'; SP.img = null; spPaintPrev();
        await spLoadNew();
        if (c.mode === 'user' && c.t && c.t.status === 'ai') {
            c.typing = true; spShowTyping();
            setTimeout(function () { if (SP.cur === c && c.typing) { c.typing = false; spShowTyping(); } }, 40000);
        }
    } catch (e) { toast(e.message); }
    btn.disabled = false; ta.focus();
}
async function spHuman() {
    var c = SP.cur; if (!c) return;
    try { await spApi('/api/support/tickets/' + c.id + '/human', { method: 'POST', body: '{}' }); toast('📨 تم إرسال طلبك للإدارة'); await spLoadNew(); }
    catch (e) { toast(e.message); }
}
async function spJoin() {
    var c = SP.cur; if (!c) return;
    try { await spApi('/api/support/admin/tickets/' + c.id + '/join', { method: 'POST', body: '{}' }); await spLoadNew(); }
    catch (e) { toast(e.message); }
}
async function spCloseTicket() {
    var c = SP.cur; if (!c) return;
    if (!(await confirmModal('تبي تسكّر هذا التكت؟'))) return;
    try { await spApi('/api/support/tickets/' + c.id + '/close', { method: 'POST', body: '{}' }); await spLoadNew(); }
    catch (e) { toast(e.message); }
}

async function spDeleteTicket() {
    var c = SP.cur; if (!c) return;
    if (!(await confirmModal('تبي تحذف هذا التكت نهائياً؟ ما يرجع بعد الحذف.'))) return;
    try { await spApi('/api/support/admin/tickets/' + c.id, { method: 'DELETE' }); toast('🗑️ تم حذف التكت'); spBack(); }
    catch (e) { toast(e.message); }
}
async function spBanUser() {
    var c = SP.cur; if (!c) return;
    var reason = await _fmOpen('حظر هذا المستخدم من الدعم الفني (حسابه وجهازه)؟ اكتب السبب (اختياري):', { isPrompt: true, okText: 'حظر' });
    if (reason === null) return;
    try { await spApi('/api/support/admin/tickets/' + c.id + '/ban', { method: 'POST', body: JSON.stringify({ reason: reason }) }); toast('🚫 تم حظر المستخدم من الدعم'); await spLoadNew(); }
    catch (e) { toast(e.message); }
}
async function spLoadBans() {
    var box = document.getElementById('spa-list'); if (!box) return;
    try {
        var d = await spApi('/api/support/admin/bans');
        if (!d.bans.length) { box.innerHTML = '<div style="color:var(--muted);text-align:center;padding:24px;">ما فيه محظورين</div>'; return; }
        box.innerHTML = d.bans.map(function (b) {
            return '<div class="sp-row" style="cursor:default;"><div class="t1"><span>🚫 ' + spEsc(b.name || '-') + (b.guest ? ' (زائر)' : '') + '</span><button class="sp-link" style="color:#86efac;" onclick="spUnban(&quot;' + b.id + '&quot;)">فك الحظر</button></div>' +
                '<div class="t2">' + (b.reason ? 'السبب: ' + spEsc(b.reason) : 'بدون سبب') + '</div>' +
                '<div class="t2">بواسطة ' + spEsc(b.by || '-') + '</div></div>';
        }).join('');
    } catch (e) { box.innerHTML = '<div style="color:#fca5a5;">' + spEsc(e.message) + '</div>'; }
}
async function spUnban(id) {
    if (!(await confirmModal('تبي تفك الحظر عن هذا المستخدم؟'))) return;
    try { await spApi('/api/support/admin/bans/' + id, { method: 'DELETE' }); toast('✅ تم فك الحظر'); spLoadBans(); }
    catch (e) { toast(e.message); }
}
async function spDeleteRow(id) {
    if (!(await confirmModal('تبي تحذف هذا التكت نهائياً؟ ما يرجع بعد الحذف.'))) return;
    try { await spApi('/api/support/admin/tickets/' + id, { method: 'DELETE' }); toast('🗑️ تم حذف التكت'); spaLoadList(); }
    catch (e) { toast(e.message); }
}
async function spDeleteAllClosed() {
    if (!(await confirmModal('تبي تحذف كل التكتات المغلقة نهائياً؟ ما ترجع بعد الحذف.'))) return;
    try { var d = await spApi('/api/support/admin/closed', { method: 'DELETE' }); toast('🗑️ انحذف ' + (d.deleted || 0) + ' تكت'); spaLoadList(); }
    catch (e) { toast(e.message); }
}
function loadSupportTab() {
    var box = document.getElementById('admin-content'); if (!box) return;
    SP.cur = null; SP.img = null;
    box.innerHTML = '<div class="card"><h2>🎧 خدمة العملاء</h2>' +
        '<div class="sp-tabs" id="spa-tabs"></div>' +
        '<div id="spa-body" style="display:flex;flex-direction:column;min-height:420px;"></div></div>';
    spaShowList();
}

function renderSupportAdmin() {
    SP.cur = null;
    document.getElementById('app').innerHTML =
        '<div class="card"><h2>🎧 تذاكر الدعم</h2>' +
        '<div class="sp-tabs" id="spa-tabs"></div>' +
        '<div id="spa-body" style="display:flex;flex-direction:column;min-height:420px;"></div></div>';
    spaShowList();
}
function spaShowList() {
    SP.cur = null; SP.img = null;
    var senior = !!(ME && ME.isSeniorAdmin);
    var tabs = senior ? [['waiting', '⏳ انتظار الإدارة'], ['active', '✅ قيد المتابعة'], ['ai', '🤖 عند المساعد'], ['closed', '🔒 مغلقة'], ['bans', '🚫 المحظورين']] : [['waiting', '⏳ انتظار الإدارة']];
    if (!senior) SP.atab = 'waiting';
    document.getElementById('spa-tabs').innerHTML = tabs.map(function (t) {
        return '<button class="sp-tab ' + (SP.atab === t[0] ? 'on' : '') + '" onclick="SP.atab=&quot;' + t[0] + '&quot;;spaShowList()">' + t[1] + '</button>';
    }).join('');
    document.getElementById('spa-body').innerHTML = '<div id="spa-list"><div style="color:var(--muted);text-align:center;padding:20px;">جارِ التحميل...</div></div>';
    spaLoadList();
}
async function spaLoadList() {
    var box = document.getElementById('spa-list'); if (!box) return;
    if (SP.atab === 'bans') return spLoadBans();
    try {
        var d = await spApi('/api/support/admin/tickets?status=' + SP.atab);
        if (!d.tickets.length) { box.innerHTML = '<div style="color:var(--muted);text-align:center;padding:24px;">ما فيه تكتات هنا</div>'; return; }
        var canDel = !!(ME && ME.isSeniorAdmin) && SP.atab === 'closed';
        box.innerHTML = (canDel ? '<button class="sp-btn" style="margin-bottom:12px;background:#b91c1c;" onclick="spDeleteAllClosed()">🗑️ حذف كل التكتات المغلقة</button>' : '') + d.tickets.map(function (t) {
            return '<div class="sp-row" onclick="spOpenTicket(&quot;' + t.id + '&quot;,&quot;admin&quot;,&quot;spa-body&quot;)">' +
                '<div class="t1"><span>#' + t.no + ' — ' + spEsc(t.name) + (t.guest ? ' (زائر)' : '') + (t.unread ? '<span class="sp-badge">' + t.unread + '</span>' : '') + '</span><span class="sp-chip ' + t.status + '">' + SP_ST[t.status] + (t.adminName ? ' — ' + spEsc(t.adminName) : '') + '</span></div>' +
                '<div class="t2">' + spEsc(t.category) + (t.place ? ' • ' + spEsc(t.place) : '') + '</div>' +
                '<div class="t2">' + spEsc(t.last || '') + '</div>' +
                (canDel ? '<div style="margin-top:8px;"><button class="sp-link" style="color:#fca5a5;" onclick="event.stopPropagation();spDeleteRow(&quot;' + t.id + '&quot;)">🗑️ حذف</button></div>' : '') +
                '</div>';
        }).join('');
    } catch (e) { box.innerHTML = '<div style="color:#fca5a5;">' + spEsc(e.message) + '</div>'; }
}
function spPendingTicket() {
    var id = null;
    try {
        id = new URLSearchParams(location.search).get('ticket');
        if (id && /^[a-f0-9]{24}$/.test(id)) { sessionStorage.setItem('sp_pending_ticket', id); history.replaceState(null, '', location.pathname); }
        else id = null;
    } catch (e) { id = null; }
    if (id) return id;
    try { var v = sessionStorage.getItem('sp_pending_ticket'); return v && /^[a-f0-9]{24}$/.test(v) ? v : null; } catch (e) { return null; }
}
function spDeepLink() {
    try {
        var id = spPendingTicket();
        if (!id) return;
        try { sessionStorage.removeItem('sp_pending_ticket'); } catch (e) {}
        if (ME && ME.isAdmin) { renderAdmin('support'); spOpenTicket(id, 'admin', 'spa-body'); }
        else spOpen(id);
    } catch (e) {}
}
var OWNER_MODAL_OPEN = false;
function ownerModalOpen(title, bodyHtml) {
    document.getElementById('owner-modal-title').textContent = title;
    document.getElementById('owner-modal-body').innerHTML = bodyHtml;
    document.getElementById('owner-modal-overlay').style.display = 'flex';
    if (!OWNER_MODAL_OPEN) {
        OWNER_MODAL_OPEN = true;
        document.body.style.overflow = 'hidden';
    }
}
function ownerModalClose() {
    document.getElementById('owner-modal-overlay').style.display = 'none';
    OWNER_MODAL_OPEN = false;
    document.body.style.overflow = '';
    ccStopLive();
}
document.addEventListener('touchmove', function (e) {
    if (!OWNER_MODAL_OPEN) return;
    var box = document.getElementById('owner-modal-box');
    if (box && box.contains(e.target) && box.scrollHeight > box.clientHeight + 1) return;
    e.preventDefault();
}, { passive: false });

async function offaToggleStealth() {
    try {
        const cur = await api('/api/owner/stealth', { noLock: true });
        const next = !cur.on;
        await api('/api/owner/stealth', { method: 'POST', body: JSON.stringify({ on: next }), noLock: true });
        updateStealthBtn(next);
        toast(next ? '👻 وضع التخفي شغال' : '🙈 تم إيقاف وضع التخفي');
    } catch (e) { toast(e.message); }
}
function updateStealthBtn(on) {
    const b = document.getElementById('owner-stealth-btn');
    if (!b) return;
    b.textContent = on ? '🙈 إيقاف التخفي' : '👻 وضع التخفي';
    b.style.background = on ? '#6d28d9' : '#374151';
}

var CC_TIMER = null;
function ccStopLive() { if (CC_TIMER) { clearInterval(CC_TIMER); CC_TIMER = null; } }

function ccRenderHtml(d) {
    var h = '<div id="cc-live-a"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
        '<div class="card" style="flex:1;min-width:110px;text-align:center;"><div style="font-size:22px;">' + d.onlineNow + '</div><div style="font-size:11px;color:var(--muted);">متصل الآن</div></div>' +
        '<div class="card" style="flex:1;min-width:110px;text-align:center;"><div style="font-size:22px;">' + d.pendingApps + '</div><div style="font-size:11px;color:var(--muted);">طلبات سلك الضباط</div></div>' +
        '<div class="card" style="flex:1;min-width:110px;text-align:center;"><div style="font-size:22px;">' + d.pendingViolations + '</div><div style="font-size:11px;color:var(--muted);">مخالفات معلّقة</div></div>' +
        '</div>';
    h += '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
        '<div class="card" style="flex:1;font-size:12px;">🚨 الإغلاق الطارئ: <b style="color:' + (d.lockdown ? '#f87171' : '#4ade80') + ';">' + (d.lockdown ? 'مفعّل' : 'مطفي') + '</b></div>' +
        '<div class="card" style="flex:1;font-size:12px;">👻 وضع التخفي: <b style="color:' + (d.stealth ? '#a78bfa' : '#4ade80') + ';">' + (d.stealth ? 'مفعّل' : 'مطفي') + '</b></div>' +
        '</div>';
    h += '</div>';
    h += '<div class="card" style="margin-bottom:10px;"><b style="font-size:13px;">🧊 تجميد فوري لحساب</b>' +
        '<div style="margin-top:6px;"><input id="cc-freeze-q" type="text" placeholder="اكتب الإيميل أو الاسم..." oninput="ccFreezeSearch(this.value)" onkeydown="if(event.keyCode===13){this.blur();}" style="width:100%;"></div>' +
        '<div id="cc-freeze-results" style="margin-top:6px;"></div>' +
        '<div id="cc-freeze-selected" style="display:none;margin-top:6px;align-items:center;gap:6px;justify-content:space-between;">' +
        '<span id="cc-freeze-selected-name" style="font-size:12px;"></span>' +
        '<button class="btn sm danger" onclick="offaFreezeAccount()">🧊 تجميد</button>' +
        '</div></div>';
    h += '<div id="cc-live-b"><b style="font-size:13px;">🧭 حالة القطاعات</b><div style="margin:6px 0 10px;">' + d.sectors.map(function (s) {
        return '<div class="card" style="font-size:12px;margin-bottom:6px;"><b>' + s.label + '</b> — قائد: ' + (s.commanderName || '—') + '، نائب: ' + (s.deputyName || '—') + '</div>';
    }).join('') + '</div>';
    h += '<b style="font-size:13px;">🔴 آخر العمليات (مباشر)</b><div style="margin-top:6px;">' + (d.recentLogs.length ? d.recentLogs.map(function (l) {
        return '<div style="font-size:11px;color:var(--muted);padding:4px 0;border-bottom:1px solid #222;">' + spEsc(l.action || '') + (l.actorTag ? ' — ' + spEsc(l.actorTag) : '') + '</div>';
    }).join('') : '<div style="color:var(--muted);font-size:12px;">لا شي بعد</div>') + '</div>';
    h += '</div>';
    return h;
}
async function offaOpenCommandCenter() {
    ccStopLive();
    ownerModalOpen('🖥️ غرفة التحكم', '<div style="color:var(--muted);">جارِ التحميل...</div>');
    try {
        var d = await api('/api/owner/command-center', { noLock: true });
        ownerModalOpen('🖥️ غرفة التحكم', ccRenderHtml(d));
        CC_TIMER = setInterval(async function () {
            if (!OWNER_MODAL_OPEN) { ccStopLive(); return; }
            try {
                var d2 = await api('/api/owner/command-center', { noLock: true });
                ccPatch(d2);
            } catch (e) {}
        }, 5000);
    } catch (e) { toast(e.message); }
}
var CC_ACCOUNTS = null, CC_SELECTED_UID = null;
async function ccFreezeSearch(q) {
    q = (q || '').trim();
    CC_SELECTED_UID = null;
    var sel = document.getElementById('cc-freeze-selected');
    if (sel) sel.style.display = 'none';
    var box = document.getElementById('cc-freeze-results');
    if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    if (!CC_ACCOUNTS) {
        box.innerHTML = '<div style="color:var(--muted);font-size:12px;">جارِ التحميل...</div>';
        try { CC_ACCOUNTS = (await api('/api/senior/accounts', { noLock: true })).list; } catch (e) { CC_ACCOUNTS = []; }
    }
    var qn = q.toLowerCase();
    var matches = CC_ACCOUNTS.filter(function (a) {
        return (a.email && a.email.toLowerCase().indexOf(qn) !== -1) || (a.fullName && a.fullName.toLowerCase().indexOf(qn) !== -1);
    }).slice(0, 8);
    if (!matches.length) { box.innerHTML = '<div style="color:var(--muted);font-size:12px;">ما فيه نتائج</div>'; return; }
    box.innerHTML = matches.map(function (a) {
        return '<div class="card" style="padding:8px;margin-bottom:4px;cursor:pointer;" onclick="ccFreezePick(\\'' + a.uid + '\\')"><b style="font-size:12px;">' + spEsc(a.fullName || '') + '</b><div style="font-size:11px;color:var(--muted);">' + spEsc(a.email || '') + '</div></div>';
    }).join('');
}
function ccFreezePick(uid) {
    var acc = (CC_ACCOUNTS || []).find(function (a) { return a.uid === uid; });
    if (!acc) return;
    CC_SELECTED_UID = uid;
    document.getElementById('cc-freeze-results').innerHTML = '';
    document.getElementById('cc-freeze-q').value = acc.fullName || acc.email;
    document.getElementById('cc-freeze-selected-name').textContent = '✅ محدد: ' + (acc.fullName || acc.email);
    document.getElementById('cc-freeze-selected').style.display = 'flex';
}
async function offaFreezeAccount() {
    if (!CC_SELECTED_UID) { toast('اختر حساب من نتائج البحث أول'); return; }
    if (!(await confirmModal('تجميد هذا الحساب فوراً؟'))) return;
    try {
        await api('/api/senior/personnel/' + CC_SELECTED_UID + '/block', { method: 'POST', body: JSON.stringify({ blocked: true }), noLock: true });
        toast('🧊 تم تجميد الحساب');
    } catch (e) { toast(e.message); }
}

function ccPatch(d) {
    var tmp = document.createElement('div');
    tmp.innerHTML = ccRenderHtml(d);
    ['cc-live-a', 'cc-live-b'].forEach(function (id) {
        var cur = document.getElementById(id), nw = tmp.querySelector('#' + id);
        if (cur && nw) cur.innerHTML = nw.innerHTML;
    });
}

/* 🟢 المتصلين الآن */
function onlineHtml(list) {
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><b style="font-size:13px;">🟢 ' + list.length + ' متصل الآن</b><button class="btn sm gray" onclick="offaOpenOnline()">🔄 تحديث</button></div>';
    if (!list.length) return h + '<div style="color:var(--muted);font-size:12px;">ما فيه أحد متصل</div>';
    return h + list.map(function (u) {
        var tag = u.isOwner ? ' <span style="color:#a78bfa;">(المالك)</span>' : (u.isSenior ? ' <span style="color:#fbbf24;">(كبير مسؤولين)</span>' : '');
        var last = u.lastAction
            ? spEsc(u.lastAction) + (u.lastDetails ? ' — ' + spEsc(u.lastDetails) : '') + ' <span style="font-size:11px;">(' + spEsc(new Date(u.lastAt).toLocaleString('ar')) + ')</span>'
            : 'ما سوى شي بعد';
        return '<div class="card" style="margin-bottom:8px;font-size:12px;line-height:1.9;">' +
            '<b style="font-size:13px;">' + spEsc(u.name || '—') + '</b>' + tag +
            '<div>📧 <span dir="ltr">' + spEsc(u.email || '—') + '</span></div>' +
            '<div>🧭 القطاع: ' + spEsc(u.sector || '—') + ' • 🪖 اليونت: ' + spEsc(u.unit || '—') + '</div>' +
            '<div style="color:var(--muted);">آخر عملية: ' + last + '</div></div>';
    }).join('');
}
async function offaOpenOnline() {
    ccStopLive();
    ownerModalOpen('🟢 المتصلين الآن', '<div style="color:var(--muted);">جارِ التحميل...</div>');
    try {
        var d = await api('/api/owner/online', { noLock: true });
        ownerModalOpen('🟢 المتصلين الآن', onlineHtml(d.list));
    } catch (e) { toast(e.message); }
}

/* 🎖️ طلبات السلك (قبول/رفض بصمت) */
function ofrHtml(d) {
    if (!d.pending.length) return '<div style="color:var(--muted);font-size:12px;">ما فيه طلبات جديدة</div>';
    var today = '';
    try { today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }); } catch (e) {}
    var hours = '';
    for (var i = 0; i < 24; i++) hours += '<option value="' + i + '">' + (i % 12 === 0 ? 12 : i % 12) + ' ' + (i < 12 ? 'صباحاً' : 'مساءً') + '</option>';
    var roomOpts = (d.rooms && d.rooms.length ? d.rooms : [1]).map(function (n) { return '<option value="' + n + '">مقابلة ' + n + '</option>'; }).join('');
    return d.pending.map(function (a) {
        var qa = (a.answers || []).map(function (ans, k) {
            return '<div style="margin:6px 0;"><b>' + (k + 1) + '- ' + spEsc((d.questions || [])[k] || '') + '</b><div>' + spEsc(ans) + '</div></div>';
        }).join('');
        return '<div class="card" style="margin-bottom:10px;font-size:12px;line-height:1.8;">' +
            '<b style="font-size:13px;">' + spEsc(a.name) + '</b>' +
            '<div>العمر: ' + (a.age ? spEsc(String(a.age)) : 'غير مسجل') + ' • يوزر الديسكورد: <span dir="ltr">' + spEsc(a.discordUser) + '</span></div>' +
            '<div>الخبرات السابقة: ' + spEsc(a.prevExperience) + '</div>' +
            '<details style="margin:8px 0;"><summary style="cursor:pointer;color:var(--gold-soft);">📄 إجابات الاستبيان</summary>' + qa + '</details>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button class="btn sm" data-id="' + a.id + '" onclick="ofrToggle(this.dataset.id)">✅ قبول</button>' +
            '<button class="btn sm danger" data-id="' + a.id + '" onclick="ofrReject(this.dataset.id)">❌ رفض</button></div>' +
            '<div id="ofr-form-' + a.id + '" style="display:none;margin-top:8px;">' +
            '<label>اليوم</label><input type="date" id="ofr-date-' + a.id + '" value="' + today + '">' +
            '<label>الساعة</label><select id="ofr-hour-' + a.id + '">' + hours + '</select>' +
            '<label>الدقيقة</label><input type="number" id="ofr-min-' + a.id + '" min="0" max="59" value="0">' +
            '<label>الروم</label><select id="ofr-room-' + a.id + '">' + roomOpts + '</select>' +
            '<button class="btn sm" style="margin-top:8px;" data-id="' + a.id + '" onclick="ofrApprove(this.dataset.id)">✅ تأكيد القبول وتحديد الموعد</button></div>' +
            '</div>';
    }).join('');
}
async function offaOpenOfficerReq() {
    ccStopLive();
    ownerModalOpen('🎖️ طلبات السلك', '<div style="color:var(--muted);">جارِ التحميل...</div>');
    try {
        var d = await api('/api/owner/officer-requests', { noLock: true });
        ownerModalOpen('🎖️ طلبات السلك (' + d.pending.length + ')', ofrHtml(d));
    } catch (e) { toast(e.message); }
}
function ofrToggle(id) {
    var f = document.getElementById('ofr-form-' + id);
    if (f) f.style.display = (f.style.display === 'none') ? 'block' : 'none';
}
async function ofrApprove(id) {
    var body = {
        date: document.getElementById('ofr-date-' + id).value,
        hour: document.getElementById('ofr-hour-' + id).value,
        minute: document.getElementById('ofr-min-' + id).value,
        room: document.getElementById('ofr-room-' + id).value
    };
    if (!body.date) return toast('حدد اليوم');
    if (body.minute === '') return toast('اكتب الدقيقة');
    try {
        await api('/api/owner/officer-requests/' + id + '/approve', { method: 'POST', body: JSON.stringify(body), noLock: true });
        toast('✅ تم القبول');
        offaOpenOfficerReq();
    } catch (e) { toast(e.message); }
}
async function ofrReject(id) {
    if (!(await confirmModal('رفض هذا الطلب؟'))) return;
    try {
        await api('/api/owner/officer-requests/' + id + '/reject', { method: 'POST', body: '{}', noLock: true });
        toast('تم الرفض');
        offaOpenOfficerReq();
    } catch (e) { toast(e.message); }
}

function udStatusBadge(u) {
    return u.published ? '<span style="color:#4ade80;">🟢 منشور</span>' : '<span style="color:#fbbf24;">🟡 مسودة</span>';
}
function udRenderList(list) {
    if (!list.length) return '<div style="color:var(--muted);font-size:12px;">ما فيه تحديثات بعد</div>';
    return list.map(function (u) {
        return '<div class="card" style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;gap:8px;"><b style="font-size:13px;">' + spEsc(u.title) + '</b>' + udStatusBadge(u) + '</div>' +
            '<div style="font-size:12px;color:var(--muted);margin:4px 0;white-space:pre-wrap;">' + spEsc(u.body) + '</div>' +
            '<div style="display:flex;gap:6px;margin-top:6px;">' +
            (u.published ? '' : '<button class="btn sm" onclick="offaPublishUpdate(\\'' + u._id + '\\')">🚀 نشر الآن</button>') +
            '<button class="btn sm danger" onclick="offaDeleteUpdate(\\'' + u._id + '\\')">🗑️ حذف</button>' +
            '</div></div>';
    }).join('');
}
async function offaOpenUpdates() {
    ccStopLive();
    ownerModalOpen('🛠️ تحديثات المطور', '<div style="color:var(--muted);">جارِ التحميل...</div>');
    try {
        var d = await api('/api/owner/updates', { noLock: true });
        var h = '<div class="card" style="margin-bottom:10px;"><b style="font-size:13px;">✍️ اكتب تحديث جديد</b>' +
            '<input id="ud-title" type="text" placeholder="عنوان التحديث" style="margin-top:8px;">' +
            '<textarea id="ud-body" placeholder="وش الجديد بالضبط؟ (يطلع للأعضاء بنفس الكتابة)" style="margin-top:6px;min-height:80px;"></textarea>' +
            '<button class="btn sm" style="margin-top:6px;" onclick="offaSaveUpdate()">💾 حفظ كمسودة</button>' +
            '<div style="font-size:11px;color:var(--muted);margin-top:4px;">يتحفظ هنا بس، محد يشوفه إلا لما تضغط «🚀 نشر الآن» من تحت.</div></div>' +
            '<b style="font-size:13px;">📜 التحديثات المحفوظة</b><div style="margin-top:6px;">' + udRenderList(d.list) + '</div>';
        ownerModalOpen('🛠️ تحديثات المطور', h);
    } catch (e) { toast(e.message); }
}
async function offaSaveUpdate() {
    var title = (document.getElementById('ud-title') || {}).value || '';
    var body = (document.getElementById('ud-body') || {}).value || '';
    title = title.trim(); body = body.trim();
    if (!title || !body) { toast('لازم تكتب عنوان ووصف'); return; }
    try {
        await api('/api/owner/updates', { method: 'POST', body: JSON.stringify({ title: title, body: body }), noLock: true });
        toast('💾 تم حفظ المسودة');
        offaOpenUpdates();
    } catch (e) { toast(e.message); }
}
async function offaPublishUpdate(id) {
    if (!(await confirmModal('🚀 بينزل هذا التحديث للكل الآن وتطلع له نافذة إعلان. متأكد؟'))) return;
    try {
        await api('/api/owner/updates/' + id + '/publish', { method: 'POST', noLock: true });
        toast('🚀 تم النشر');
        offaOpenUpdates();
    } catch (e) { toast(e.message); }
}
async function offaDeleteUpdate(id) {
    if (!(await confirmModal('حذف هذا التحديث نهائياً؟'))) return;
    try {
        await api('/api/owner/updates/' + id, { method: 'DELETE', noLock: true });
        toast('🗑️ تم الحذف');
        offaOpenUpdates();
    } catch (e) { toast(e.message); }
}

async function offaOpenDevices() {
    ccStopLive();
    ownerModalOpen('📱 الأجهزة المتصلة', '<div style="color:var(--muted);">جارِ التحميل...</div>');
    try {
        const d = await api('/api/owner/devices', { noLock: true });
        if (!d.list.length) { ownerModalOpen('📱 الأجهزة المتصلة', '<div style="color:var(--muted);">ما فيه أجهزة متصلة</div>'); return; }
        const h = d.list.map(function (v) {
            return '<div class="card" style="margin-bottom:8px;"><b style="font-size:13px;">' + spEsc(v.name) + '</b>' +
                '<div style="font-size:11px;color:var(--muted);margin:4px 0;">' + spEsc(v.ip || '') + ' — ' + spEsc((v.ua || '').slice(0, 60)) + '</div>' +
                '<div style="display:flex;gap:6px;margin-top:6px;">' +
                '<button class="btn sm danger" onclick="offaKickDevice(\\'' + v._id + '\\')">⛔ طرد الجهاز</button>' +
                '<button class="btn sm" onclick="offaKickAccount(\\'' + v.uid + '\\')">🚪 خروج كل أجهزة الحساب</button>' +
                '</div></div>';
        }).join('');
        ownerModalOpen('📱 الأجهزة المتصلة', h);
    } catch (e) { toast(e.message); }
}
async function offaKickDevice(id) {
    try { await api('/api/owner/devices/' + id + '/kick', { method: 'POST', noLock: true }); toast('⛔ تم طرد الجهاز'); offaOpenDevices(); } catch (e) { toast(e.message); }
}
async function offaKickAccount(uid) {
    if (!(await confirmModal('تسجيل خروج كل أجهزة هذا الحساب؟'))) return;
    try { await api('/api/owner/devices/kick-account', { method: 'POST', body: JSON.stringify({ uid: uid }), noLock: true }); toast('🚪 تم تسجيل الخروج'); offaOpenDevices(); } catch (e) { toast(e.message); }
}

async function offaToggleLockdown() {
    try {
        const cur = await api('/api/owner/lockdown', { noLock: true });
        const next = !cur.on;
        if (next && !(await confirmModal('🚨 بيتم إغلاق الموقع على الكل إلا حسابك. متأكد؟'))) return;
        await api('/api/owner/lockdown', { method: 'POST', body: JSON.stringify({ on: next }), noLock: true });
        updateLockBtn(next);
        toast(next ? '🚨 تم إغلاق الموقع' : '✅ تم فتح الموقع');
    } catch (e) { toast(e.message); }
}
function updateLockBtn(on) {
    const b = document.getElementById('owner-lock-btn');
    if (!b) return;
    b.textContent = on ? '✅ فتح الموقع' : '🚨 إغلاق الموقع';
}

async function init() {
    spConnect();
    var lockLoad = loadSavedLock();
    try { ME = await api('/api/me'); odFix(); } catch (e) {
        await lockLoad;
        spBadges();
        var pendTicket = spPendingTicket();
        var savedAcc = pendTicket ? getSavedLogin() : null;
        if (pendTicket && savedAcc && !SP.autoLoginTried) {
            SP.autoLoginTried = true;
            try {
                var lr = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: savedAcc.email, password: savedAcc.password }) });
                if (lr.ok) { spReconnect(); return init(); }
            } catch (e2) {}
        }
        renderLogin(); return;
    }
    spReconnect(); spBadges();
    markOwnerSaved();
    if (ME.blocked) { renderBlocked(ME.reason); return; }
    if (ME.isOwner) {
        document.getElementById('owner-toolbar').style.display = 'flex';
        api('/api/owner/lockdown', { noLock: true }).then(function (d) { updateLockBtn(d.on); }).catch(function () {});
        api('/api/owner/stealth', { noLock: true }).then(function (d) { updateStealthBtn(d.on); }).catch(function () {});
    }
    lastKnownRank = ME.rank;
    buildNav();
    if (checkSummonGate()) return;
    if (!ME.registeredName || !ME.unit) { renderSetup(); return; }
    renderDashboard();
    checkPendingWarning();
    checkPromotionAlert();
    startPolling();
    spDeepLink();
}
function buildNav() {
    const links = document.getElementById('nav-links');
    const mobile = document.getElementById('mobile-menu');
    if (!ME || ME.blocked) { links.innerHTML = ''; mobile.innerHTML = ''; return; }
    const items = [
        { label: '🏠 الرئيسية', fn: 'renderDashboard()' },
    ];
    if (ME.isMilitaryPolice && !ME.isSeniorAdmin) {
        items.push({ label: '📝 تسجيل تقرير (شرطة عسكرية)', fn: "openMPReportForm('renderDashboard()')" });
    } else if (ME.isAntiDrugs && !ME.isSeniorAdmin) {
        items.push({ label: '📝 تسجيل تقرير', fn: 'renderNewReport()' });
    } else {
        items.push({ label: '📝 تسجيل مخالفة', fn: 'renderNewViolation()' });
    }
    items.push(
        { label: '📋 مخالفاتي', fn: 'renderMinePage()' },
        { label: '🌴 الإجازات', fn: 'renderLeavePage()' },
        { label: '🪪 بطاقتي', fn: 'renderCard()' },
    );
    if (ME.isAdmin) items.push({ label: '🛠️ لوحة الإدارة', fn: 'renderAdmin()' });
    if (ME.isHighCommand) items.push({ label: '⭐ القيادة العليا', fn: 'renderHighCommandPanel()' });
    if (ME.isViolationsOfficer) items.push({ label: '⚖️ مسؤول المخالفات', fn: 'renderViolationsOfficerPanel()' });
    if (ME.mpInfo) items.push({ label: '🚔 لوحة الشرطة العسكرية', fn: 'renderMPPanel()' });
    else if (ME.mpPersonnelOfficer) items.push({ label: '🚔 مسؤول أفراد الشرطة العسكرية', fn: 'renderMPPOPanel()' });
    else if (ME.isMilitaryPolice) items.push({ label: '🚔 الشرطة العسكرية', fn: 'renderMPMemberPanel()' });
    if (ME.sectorInfo) items.push({ label: '🎖️ لوحة قيادة القطاع', fn: 'renderSectorPanel()' });
    if (ME.personnelOfficerInfo) items.push({ label: '👥 مسؤول الأفراد', fn: 'renderPersonnelOfficerPanel()' });
    items.push({ label: '🎖️ سلك الضباط', fn: 'renderOfficerPage()' });
    items.push({ label: '🎧 الدعم', fn: 'spOpen()', cls: 'sp-nav-user' });
    if (ME.isAdmin) items.push({ label: '🎧 تذاكر الدعم', fn: 'renderSupportAdmin()', cls: 'sp-nav-admin' });
    items.push({ label: '🚪 خروج', fn: "location.href='/auth/logout'" });
    links.innerHTML = items.map(i => \`<button class="\${i.cls || ''}" onclick="\${i.fn}">\${i.label}</button>\`).join('');
    mobile.innerHTML = items.map(i => \`<button class="\${i.cls || ''}" onclick="\${i.fn}; closeMobileMenu();">\${i.label}</button>\`).join('');
    spPaintBadges();
}
function renderFabs() {
    const fabs = [];
    if (ME.isSeniorAdmin) fabs.push({ label: '🛡️ لوحة كبار المسؤولين', fn: 'renderAdmin()' });
    if (ME.isHighCommand) fabs.push({ label: '⭐ القيادة العليا', fn: 'renderHighCommandPanel()' });
    if (ME.isViolationsOfficer) fabs.push({ label: '⚖️ مسؤول المخالفات', fn: 'renderViolationsOfficerPanel()' });
    if (ME.mpInfo) fabs.push({ label: '🚔 الشرطة العسكرية', fn: 'renderMPPanel()' });
    else if (ME.mpPersonnelOfficer) fabs.push({ label: '🚔 أفراد الشرطة العسكرية', fn: 'renderMPPOPanel()' });
    else if (ME.isMilitaryPolice) fabs.push({ label: '🚔 الشرطة العسكرية', fn: 'renderMPMemberPanel()' });
    if (ME.sectorInfo) fabs.push({ label: '🎖️ لوحة القيادة', fn: 'renderSectorPanel()' });
    if (ME.personnelOfficerInfo) fabs.push({ label: '👥 لوحة الأفراد', fn: 'renderPersonnelOfficerPanel()' });
    return fabs.map((f, i) => \`<button class="fab" style="bottom:\${25 + i * 65}px;" onclick="\${f.fn}">\${f.label}</button>\`).join('');
}
function toggleMobileMenu() {
    var m = document.getElementById('mobile-menu');
    if (m.classList.contains('open')) { closeMobileMenu(); return; }
    m.classList.add('open');
    m.scrollTop = 0;
    document.documentElement.classList.add('menu-open');
}
function closeMobileMenu() {
    document.getElementById('mobile-menu').classList.remove('open');
    document.documentElement.classList.remove('menu-open');
}
document.addEventListener('touchmove', function (e) {
    if (!document.documentElement.classList.contains('menu-open')) return;
    var m = document.getElementById('mobile-menu');
    if (m && m.contains(e.target) && m.scrollHeight > m.clientHeight + 1) return;
    e.preventDefault();
}, { passive: false });
function renderMinePage() {
    document.getElementById('app').innerHTML = \`<div class="card"><h2>📋 مخالفاتي</h2><div id="mine-list">جارِ التحميل...</div></div>\`;
    loadMine();
}
async function renderLeavePage() {
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🌴 الإجازات</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع</button></div>
        <div class="card" id="leave-balance-box">جارِ التحميل...</div>
        <div class="card">
            <h3>طلب إجازة جديدة</h3>
            <label>عدد الأيام</label>
            <input type="number" id="leave-days" min="1" placeholder="مثال: 2">
            <label>السبب</label>
            <textarea id="leave-reason" placeholder="اكتب سبب الإجازة..."></textarea>
            <button class="btn" onclick="submitLeaveRequest()">إرسال الطلب</button>
        </div>
        <div class="card">
            <h3>طلباتي السابقة</h3>
            <div id="leave-mine-list">جارِ التحميل...</div>
        </div>\`;
    loadMyLeave();
}
async function loadMyLeave() {
    try {
        const { balance, list } = await api('/api/leave/mine');
        document.getElementById('leave-balance-box').innerHTML = \`رصيدك الحالي: <b style="color:var(--gold-soft);font-size:18px;">\${balance}</b> يوم\`;
        const box = document.getElementById('leave-mine-list');
        box.innerHTML = list.length === 0 ? '<p style="color:var(--muted);">لا توجد طلبات سابقة</p>' :
            list.map(l => \`
                <div class="card" style="padding:10px 14px;margin-top:8px;">
                    <div class="row">
                        <div>
                            <b>\${l.days} يوم</b>
                            <div style="color:var(--muted);font-size:13px;">\${l.reason}</div>
                        </div>
                        <span class="badge \${l.status}">\${l.status === 'pending' ? 'قيد المراجعة' : l.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span>
                    </div>
                    \${l.status === 'rejected' && l.rejectReason ? \`<div style="font-size:11px;color:var(--muted);margin-top:3px;">سبب الرفض: \${l.rejectReason}</div>\` : ''}
                </div>\`).join('');
    } catch (e) { toast(e.message); }
}
async function submitLeaveRequest() {
    const days = document.getElementById('leave-days').value;
    const reason = document.getElementById('leave-reason').value;
    if (!days || parseInt(days) < 1) return toast('حدد عدد أيام صحيح');
    if (!reason || !reason.trim()) return toast('اكتب السبب');
    try {
        await api('/api/leave/request', { method: 'POST', body: JSON.stringify({ days: parseInt(days), reason }) });
        toast('✅ تم إرسال طلب الإجازة');
        renderLeavePage();
    } catch (e) { toast(e.message); }
}
function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollTick, 5000);
}
async function pollTick() {
    if (!ME || ME.blocked) return;
    try {
        const fresh = await api('/api/me');
        if (fresh.blocked) {
            clearInterval(pollTimer);
            ME = fresh;
            renderBlocked(fresh.reason);
            startBlockedRecheck();
            return;
        }
        if (lastKnownRank && fresh.rank !== lastKnownRank) {
            toast('🎉 مبروك! تمت ترقيتك إلى ' + fresh.rank);
        }
        lastKnownRank = fresh.rank;
        ME = fresh; odFix();
        buildNav();
        const rp = document.getElementById('home-points');
        if (rp) {
            document.getElementById('home-points').textContent = ME.points;
            document.getElementById('home-rank').textContent = ME.rank;
            const nx = document.getElementById('home-next');
            if (nx) nx.textContent = ME.nextRank ? (ME.rank + ' ——> ' + ME.nextRank) : 'أعلى رتبة';
            const rem = document.getElementById('home-remaining');
            if (rem) rem.textContent = remainText(ME.nextRank, ME.pointsRemaining);
            cardUpdate('home-card', ME);
        }
        renderNotes();
        if (document.getElementById('mine-list')) loadMine(true);
        if (document.getElementById('pending-box')) loadPending();
        if (currentAdminTab === 'log') loadLog(true);
        if (typeof sectorPanelTab !== 'undefined' && sectorPanelTab === 'members' && document.getElementById('sector-content')) loadSectorMembers(true);
        if (typeof poTab !== 'undefined' && poTab === 'members' && document.getElementById('po-content')) loadPoMembers(true);
        if (typeof hcTab !== 'undefined' && hcTab === 'pending' && document.getElementById('hc-content')) loadHCPending(true);
        checkPendingWarning();
        checkPromotionAlert();
        offOnPoll();
    } catch (e) {}
}
function startBlockedRecheck() {
    if (blockedPollTimer) clearInterval(blockedPollTimer);
    blockedPollTimer = setInterval(async () => {
        try {
            const fresh = await api('/api/me');
            if (!fresh.blocked) { clearInterval(blockedPollTimer); location.reload(); }
        } catch (e) {}
    }, 6000);
}
function authShell(inner) {
    document.getElementById('nav-links').innerHTML = '';
    document.getElementById('mobile-menu').innerHTML = '';
    document.getElementById('app').innerHTML = '<div class="auth-page"><div class="auth-card">' + inner + '</div></div>';
}
function authErr(msg) {
    const b = document.getElementById('auth-err');
    if (!b) return;
    b.textContent = msg || '';
    b.style.display = msg ? 'block' : 'none';
}
function authField(label, id, type, ph, dir) {
    return '<div><label class="auth-label">' + label + '</label>' +
        '<input id="' + id + '" class="auth-input" type="' + type + '" placeholder="' + ph + '"' + (dir ? ' dir="' + dir + '"' : '') + ' autocomplete="off">' +
        '<span class="auth-req">* حقل إجباري</span></div>';
}
var SAVED_LOGIN_KEY = 'moi_saved_login';
var SAVED_LOCK = null;
function wipeSavedLogin(keepOwner) {
    try {
        if (keepOwner) {
            var v = JSON.parse(localStorage.getItem(SAVED_LOGIN_KEY) || 'null');
            if (v && v.owner === true) return;
        }
        localStorage.removeItem(SAVED_LOGIN_KEY);
    } catch (e) {}
}
function markOwnerSaved() {
    try {
        if (!ME || !ME.isOwner || !ME.accountEmail) return;
        var v = JSON.parse(localStorage.getItem(SAVED_LOGIN_KEY) || 'null');
        if (v && v.email && String(v.email).toLowerCase() === String(ME.accountEmail).toLowerCase() && v.owner !== true) {
            v.owner = true;
            localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify(v));
        }
    } catch (e) {}
}
async function loadSavedLock() {
    var d = null;
    try {
        var r = await fetch('/api/public/login-lock', { cache: 'no-store' });
        if (!r.ok) throw new Error('x');
        d = await r.json();
    } catch (e) { SAVED_LOCK = true; return; }
    SAVED_LOCK = !!(d && d.locked);
    if (SAVED_LOCK) wipeSavedLogin(true);
}
function getSavedLogin() {
    if (SAVED_LOCK === null) return null;
    try {
        var v = JSON.parse(localStorage.getItem(SAVED_LOGIN_KEY) || 'null');
        if (v && v.email && v.password) {
            if (SAVED_LOCK === true && v.owner !== true) return null;
            return v;
        }
    } catch (e) { }
    return null;
}
function setSavedLogin(email, password) {
    try { localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify({ email: email, password: password, owner: !!(ME && ME.isOwner) })); } catch (e) { }
}
function renderSavedLogin(saved) {
    authShell(
        '<h1 class="auth-title">سيرفر وزارة الداخلية</h1>' +
        '<div class="auth-sub">Ministry of Interior Server</div>' +
        '<div id="auth-err" class="auth-err"></div>' +
        '<label class="auth-label">تبي تدخل حسابك هذا؟</label>' +
        '<div class="card" style="margin-top:8px;">' +
            '<div style="font-size:12px;color:var(--muted);">البريد الإلكتروني</div>' +
            '<div dir="ltr" style="text-align:left;font-weight:700;word-break:break-all;">' + accEsc(saved.email) + '</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:10px;">كلمة المرور</div>' +
            '<div class="row"><div id="sv-pw" dir="ltr" style="font-weight:700;letter-spacing:2px;">••••••••</div>' +
            '<button type="button" class="pw-eye" style="position:static;" id="sv-eye" onclick="toggleSavedPw()">👁</button></div>' +
        '</div>' +
        '<button class="auth-btn" id="lg-btn" onclick="doSavedLogin()">دخول بهذا الحساب</button>' +
        '<div class="auth-sep"></div>' +
        '<a class="auth-link" onclick="renderLogin(true)">الدخول بحساب ثاني</a>'
    );
}
function toggleSavedPw() {
    var saved = getSavedLogin();
    var box = document.getElementById('sv-pw');
    var eye = document.getElementById('sv-eye');
    if (!saved || !box) return;
    var hidden = box.textContent.indexOf('•') === 0;
    box.textContent = hidden ? saved.password : '••••••••';
    box.style.letterSpacing = hidden ? '0' : '2px';
    eye.textContent = hidden ? '🙈' : '👁';
}
async function doSavedLogin() {
    var saved = getSavedLogin();
    if (!saved) return renderLogin(true);
    authErr('');
    try {
        await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: saved.email, password: saved.password }) });
        await init();
        if (SAVED_LOCK === true && !(ME && ME.isOwner)) wipeSavedLogin();
    } catch (e) { authErr(e.message + ' — لو غيّرت كلمة المرور اضغط "الدخول بحساب ثاني" وسجّل من جديد'); }
}
async function offerSaveLogin(email, pw) {
    try {
        if (SAVED_LOCK === null) return;
        if (SAVED_LOCK === true && !(ME && ME.isOwner)) return;
        if (ME && ME.seniorTemp) return;
        var cur = getSavedLogin();
        if (cur && cur.email.toLowerCase() === email.toLowerCase() && cur.password === pw) return;
        var yes = await _fmOpen('هل تريد حفظ بيانات الدخول (البريد وكلمة المرور) في هذا الجهاز؟ بالمرة الجاية يسألك تبي تدخل حسابك هذا مباشرة.', { isPrompt: false, okText: 'نعم، احفظ' });
        if (yes) { setSavedLogin(email, pw); toast('✅ تم حفظ الحساب بالجهاز'); }
    } catch (e) { }
}
function renderLogin(forceForm) {
    if (!forceForm) {
        var saved = getSavedLogin();
        if (saved) { renderSavedLogin(saved); return; }
    }
    authShell(
        '<h1 class="auth-title">سيرفر وزارة الداخلية</h1>' +
        '<div class="auth-sub">Ministry of Interior Server</div>' +
        '<div id="auth-err" class="auth-err"></div>' +
        '<label class="auth-label">البريد الإلكتروني :</label>' +
        '<input id="lg-email" class="auth-input" type="email" dir="ltr" placeholder="example@email.com" autocomplete="username">' +
        '<label class="auth-label" style="margin-top:14px;">كلمة المرور :</label>' +
        '<div class="pw-wrap"><input id="lg-pw" class="auth-input" type="password" dir="ltr" placeholder="••••••••" autocomplete="current-password"><button type="button" class="pw-eye" data-t="lg-pw" onclick="togglePwEye(this.dataset.t, this)">👁</button></div>' +
        '<a class="auth-forgot" onclick="authForgot()">هل نسيت كلمة المرور ؟</a>' +
        '<button class="auth-btn" id="lg-btn" onclick="doLogin()">تسجيل الدخول</button>' +
        '<div class="auth-sep"></div>' +
        '<a class="auth-link" onclick="renderRegister()">ليس لديك حساب؟ سجل الآن!</a>'
    );
    const enter = function (e) { if (e.key === 'Enter') doLogin(); };
    document.getElementById('lg-email').onkeydown = enter;
    document.getElementById('lg-pw').onkeydown = enter;
}
function authForgot() { toast('تواصل مع الإدارة لتغيير كلمة المرور'); }
function togglePwEye(id, btn) {
    const inp = document.getElementById(id);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.textContent = show ? '🙈' : '👁';
}
async function doLogin() {
    const email = document.getElementById('lg-email').value.trim();
    const pw = document.getElementById('lg-pw').value;
    if (!email || !pw) return authErr('اكتب البريد وكلمة المرور');
    authErr('');
    try {
        await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: email, password: pw }) });
        await init();
        offerSaveLogin(email, pw);
    } catch (e) { authErr(e.message); }
}
function renderRegister() {
    authShell(
        '<h1 class="auth-title">سيرفر وزارة الداخلية</h1>' +
        '<div class="auth-sub">تسجيل حساب جديد</div>' +
        '<div id="auth-err" class="auth-err"></div>' +
        '<div class="auth-grid">' +
            authField('الاسم الرباعي :', 'rg-name', 'text', 'الاسم كاملاً', '') +
            authField('العمر :', 'rg-age', 'number', '00', '') +
            authField('البريد الإلكتروني :', 'rg-email', 'email', 'example@email.com', 'ltr') +
            authField('الجنسية :', 'rg-nat', 'text', 'سعودي', '') +
        '</div>' +
        '<div><label class="auth-label">كلمة المرور :</label><div class="pw-wrap"><input id="rg-pw" class="auth-input" type="password" placeholder="••••••••" dir="ltr" autocomplete="off"><button type="button" class="pw-eye" data-t="rg-pw" onclick="togglePwEye(this.dataset.t, this)">👁</button></div><span class="auth-req">* حقل إجباري</span></div>' +
        '<div class="auth-sep" style="margin:6px 0 20px;"></div>' +
        '<label class="auth-check"><input type="checkbox" id="rg-avail"><span>هل أنت متفرغ للعمل في سيرفر وزارة الداخلية ؟</span></label>' +
        '<label class="auth-check"><input type="checkbox" id="rg-capable"><span>هل لديك القدرة علي المشاركة الصوتية والتصوير وتحمل ضغوط العمل ؟</span></label>' +
        '<label class="auth-check"><input type="checkbox" id="rg-terms"><span>الموافقة علي القوانين والشروط وسياسة سيرفر وزارة الداخلية الواقعي</span></label>' +
        '<button class="auth-btn" onclick="doRegister()">إنشاء الحساب</button>' +
        '<div class="auth-sep" style="margin:22px 0 18px;"></div>' +
        '<a class="auth-link" onclick="renderLogin()">لديك حساب؟ سجل دخولك</a>'
    );
}
async function doRegister() {
    const v = function (id) { return document.getElementById(id).value.trim(); };
    const body = {
        fullName: v('rg-name'), age: v('rg-age'), email: v('rg-email'), nationality: v('rg-nat'),
        password: document.getElementById('rg-pw').value,
        available: document.getElementById('rg-avail').checked,
        capable: document.getElementById('rg-capable').checked,
        terms: document.getElementById('rg-terms').checked,
    };
    if (!body.fullName || !body.age || !body.email || !body.nationality || !body.password) return authErr('عبّي كل الحقول الإجبارية');
    if (!body.terms) return authErr('لازم توافق على القوانين والشروط وسياسة السيرفر');
    authErr('');
    try {
        await api('/auth/register', { method: 'POST', body: JSON.stringify(body) });
        renderRegisterDone();
    } catch (e) { authErr(e.message); }
}
function renderRegisterDone() {
    authShell(
        '<div class="auth-done"><div class="ico">✅</div>' +
        '<h1 class="auth-title" style="font-size:26px;">تم إرسال طلبك للإدارة</h1>' +
        '<p>انتظر القبول — بعد ما تراجع الإدارة طلبك تقدر تسجّل دخولك بالبريد وكلمة المرور اللي سجلتها.</p>' +
        '<button class="auth-btn" onclick="renderLogin()">الرجوع لتسجيل الدخول</button></div>'
    );
}
function renderBlocked(reason) {
    document.getElementById('nav-links').innerHTML = '';
    document.getElementById('mobile-menu').innerHTML = '';
    document.getElementById('app').innerHTML = \`
        <div class="card center" style="margin-top:60px;">
            <h2 style="color:#fca5a5;">🚫 غير مصرح</h2>
            <p style="color:var(--muted);margin-top:10px;">\${reason}</p>
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
    try { await api('/api/profile/setup', { method: 'POST', body: JSON.stringify({ name, unit }) }); init(); }
    catch (e) { toast(e.message); }
}
function renderDashboard() {
    document.getElementById('app').innerHTML = \`
        <div class="card row">
            <div class="row" style="gap:14px;">
                \${ME.avatar ? \`<img class="avatar" src="\${ME.avatar}">\` : ''}
                <div><h2 style="margin-bottom:2px;">\${ME.registeredName}</h2><div style="color:var(--muted);font-size:13px;">\${ME.unit} • \${ME.rank}</div></div>
            </div>
            <div class="row" style="gap:8px;">
                \${ME.isAdmin ? '<button class="btn gray sm" onclick="renderAdmin()">لوحة الإدارة</button>' : ''}
                \${ME.sectorInfo ? \`<button class="btn gray sm" onclick="renderSectorPanel()">قيادة \${ME.sectorInfo.sectorLabel}</button>\` : ''}
                <a class="btn gray sm" href="/auth/logout">خروج</a>
            </div>
        </div>
        \${ME.maintenance ? '<div class="card" style="border-color:var(--amber);color:#fbbf24;">⚠️ الموقع في وضع الصيانة حالياً</div>' : ''}
        \${ME.seniorTemp ? '<div class="card" style="border-color:var(--amber);color:#fbbf24;">🔑 هذا حساب كبير مسؤولين جديد خاص فيك. بريدك: <b dir="ltr">' + ME.accountEmail + '</b> — غيّر البريد وكلمة المرور من لوحة كبار المسؤولين ← الحسابات المقبولة ← تعديل، وبعدها يصير حسابك أنت. لو ما غيّرتها ودخلت مرة ثانية بالبيانات الافتراضية بينفتح لك حساب جديد غير هذا.</div>' : ''}
        \${cardBlock(ME, { id: 'home-card', hasProgress: true, nextRank: ME.nextRank, remaining: ME.pointsRemaining, remainId: 'home-remaining' })}
        <div class="grid3" style="margin-top:16px;">
            <div class="stat"><div class="num" id="home-points">\${ME.points}</div><div class="lbl">النقاط</div></div>
            <div class="stat"><div class="num" id="mine-count">-</div><div class="lbl">مخالفاتي</div></div>
            <div class="stat"><div class="num" id="home-rank" style="font-size:15px;">\${ME.isBlocked ? '🚫 موقوف' : '✅ فعّال'}</div><div class="lbl">الحالة</div></div>
        </div>
        <div class="card">
            <div class="row">
                <h3>مخالفاتي المسجلة</h3>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="renderCard()">بطاقتي</button>
                    \${!ME.violationsDisabled ? (ME.isAntiDrugs && !ME.isSeniorAdmin
                        ? '<button class="btn sm" onclick="renderNewReport()">+ تسجيل تقرير جديد</button>'
                        : '<button class="btn sm" onclick="renderNewViolation()">+ تسجيل مخالفة جديدة</button>') : ''}
                </div>
            </div>
            <div id="notes-box" style="margin:10px 0;"></div>
            <div id="mine-list">جارِ التحميل...</div>
        </div>
        \${renderFabs()}
    \`;
    loadMine();
    renderNotes();
}
function renderNotes() {
    const box = document.getElementById('notes-box');
    if (!box) return;
    if (!ME.notes || ME.notes.length === 0) { box.innerHTML = ''; return; }
    box.innerHTML = '<div style="font-size:13px;color:var(--gold-soft);margin-bottom:6px;">ملاحظات عليك:</div>' +
        ME.notes.map(n => \`<div style="background:rgba(5,15,10,0.6);padding:8px;border-radius:8px;margin-bottom:6px;font-size:13px;">\${n.text}\${(n.image || (n.imageChannelId && n.imageMessageId)) ? \`<button class="btn sm gray" style="margin-top:6px;" onclick="viewNotePhoto('\${ME.discordId}','\${n._id}')">📷 عرض الصورة</button>\` : ''}</div>\`).join('');
}
async function loadMine(silent) {
    const box = document.getElementById('mine-list');
    try {
        const { list } = await api('/api/violations/mine');
        const cEl = document.getElementById('mine-count');
        if (cEl) cEl.textContent = list.length;
        if (!box) return;
        if (list.length === 0) { box.innerHTML = '<p style="color:var(--muted);">لا توجد مخالفات مسجلة بعد</p>'; return; }
        box.innerHTML = \`<table><tr><th></th><th>النوع</th><th>المركبة</th><th>اللوحة</th><th>الحالة</th></tr>\` +
            list.map(v => \`<tr>
                <td>\${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض</button>\` : '—'}</td>
                <td>\${v.kind === 'report' ? ('🧪 تقرير مكافحة مخدرات — ' + v.reportCategory) : v.violationType}</td><td>\${v.vehicle}</td><td>\${v.plateNumber}</td>
                <td><span class="badge \${v.status}">\${v.status === 'pending' ? 'قيد المراجعة' : v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span>\${v.status === 'rejected' && v.rejectReason ? \`<div style="font-size:11px;color:var(--muted);margin-top:3px;">\${v.rejectReason}</div>\` : ''}</td>
            </tr>\`).join('') + '</table>';
    } catch (e) {
        if (box) box.innerHTML = \`<p style="color:#f87171;">تعذر تحميل مخالفاتي، حاول تحدّث الصفحة. (\${e.message})</p>\`;
    }
}
let vtypeSelected = [];
async function renderNewViolation() {
    const meta = await api('/api/violations/meta');
    META = meta; selectedVehicle = null; photoBase64 = null; vtypeSelected = [];
    document.getElementById('app').innerHTML = \`
        <div class="card">
            <h2>تسجيل مخالفة جديدة</h2>
            <label>نوع المخالفة</label>
            <div class="row" style="gap:10px;align-items:center;margin-bottom:12px;">
                <button class="btn sm" type="button" onclick="openVTypeOverlay()">➕ اختيار نوع المخالفة</button>
                <span id="vtype-summary" style="color:var(--muted);font-size:13px;">لم يتم اختيار أي نوع بعد</span>
            </div>
            <label>المركبة</label>
            \${meta.vehicles.length ? \`<div class="vgrid" id="v-grid">\${meta.vehicles.map((v,i) => \`
                <div class="vcard" id="vcard-\${i}" onclick="pickVehicle(\${i})">
                    \${v.photo ? \`<img src="\${v.photo}">\` : ''}
                    <div>\${v.name}</div>
                </div>\`).join('')}</div>\` : '<p style="color:var(--muted);margin-bottom:10px;">لا توجد مركبات مضافة</p>'}
            <label>صورة المخالفة (إجباري)</label>
            <input type="file" id="v-photo" accept="image/*" onchange="previewPhoto()" required>
            <img id="v-photo-preview" style="display:none;max-width:220px;border-radius:8px;margin-bottom:10px;">
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn" id="v-submit-btn" onclick="submitViolation()">إرسال</button>
                <button class="btn gray" onclick="renderDashboard()">رجوع</button>
            </div>
        </div>\`;
    if (meta.vehicles.length) pickVehicle(0);
}
function openVTypeOverlay() {
    const grid = document.getElementById('vtype-grid');
    grid.innerHTML = META.types.map(function (t, i) {
        const cls = vtypeSelected.indexOf(t) > -1 ? 'vtype-opt sel' : 'vtype-opt';
        return '<div class="' + cls + '" id="vtype-opt-' + i + '" onclick="toggleVType(' + i + ')">' + t + '</div>';
    }).join('');
    document.getElementById('vtype-overlay').classList.add('open');
}
function toggleVType(i) {
    const t = META.types[i];
    const idx = vtypeSelected.indexOf(t);
    const el = document.getElementById('vtype-opt-' + i);
    if (idx > -1) { vtypeSelected.splice(idx, 1); el.classList.remove('sel'); }
    else { vtypeSelected.push(t); el.classList.add('sel'); }
}
function closeVTypeOverlay() {
    document.getElementById('vtype-overlay').classList.remove('open');
}
function confirmVTypeSelection() {
    if (!vtypeSelected.length) { toast('اختر نوع مخالفة واحد على الأقل'); return; }
    document.getElementById('vtype-summary').textContent = vtypeSelected.join('، ');
    document.getElementById('vtype-summary').style.color = '#4ade80';
    closeVTypeOverlay();
}
function pickVehicle(i) {
    selectedVehicle = META.vehicles[i].name;
    document.querySelectorAll('.vcard').forEach(el => el.classList.remove('sel'));
    document.getElementById('vcard-' + i).classList.add('sel');
}
function previewPhoto() {
    const f = document.getElementById('v-photo').files[0];
    if (!f) return;
    if (f.size > ${CONFIG.MAX_PHOTO_MB} * 1024 * 1024) { toast('الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        photoBase64 = e.target.result;
        const img = document.getElementById('v-photo-preview');
        img.src = photoBase64; img.style.display = 'block';
    };
    reader.readAsDataURL(f);
}
let violationSubmitting = false;
async function submitViolation() {
    if (violationSubmitting) return;
    if (!vtypeSelected.length) return toast('اختر نوع مخالفة واحد على الأقل');
    const violationType = vtypeSelected.join('، ');
    if (!selectedVehicle) return toast('اختر المركبة');
    if (!photoBase64) return toast('لازم ترفق صورة المخالفة');
    const btn = document.getElementById('v-submit-btn');
    violationSubmitting = true;
    if (btn) { btn.disabled = true; btn.textContent = 'جارِ الإرسال...'; }
    try {
        await api('/api/violations/submit', { method: 'POST', body: JSON.stringify({ violationType, vehicle: selectedVehicle, photo: photoBase64 }) });
        toast('تم الإرسال، بانتظار قبول الإدارة'); renderDashboard();
    } catch (e) {
        toast(e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'إرسال'; }
    } finally {
        violationSubmitting = false;
    }
}
function renderNewReport() {
    document.getElementById('app').innerHTML = \`
        <div class="card">
            <h2>تسجيل تقرير جديد</h2>
            <p style="color:var(--muted);margin-bottom:14px;">اختر نوع التقرير:</p>
            <div class="row" style="gap:8px;">
                <button class="btn" onclick="renderReportForm('جنائي')">⚖️ جنائي</button>
                <button class="btn" onclick="renderReportForm('مخدرات')">💊 مخدرات</button>
            </div>
            <div style="margin-top:14px;">
                <button class="btn gray" onclick="renderDashboard()">رجوع</button>
            </div>
        </div>\`;
}
let reportItemCount = 0;
async function renderReportForm(category) {
    const meta = await api('/api/violations/meta');
    reportMeta = meta; reportSelectedVehicle = null; reportVehiclePhoto = null;
    reportItemCount = 0;
    const isDrugs = category === 'مخدرات';
    document.getElementById('app').innerHTML = \`
        <div class="card">
            <h2>تسجيل تقرير \${isDrugs ? 'مكافحة مخدرات' : 'جنائي'}</h2>
            <label>اسم المتهم</label>
            <input id="rp-suspect-name" placeholder="اسم المتهم">
            <label>موقع الضبط</label>
            <input id="rp-location" placeholder="موقع الضبط">
            <label>المركبة</label>
            \${meta.vehicles.length ? \`<div class="vgrid" id="rp-v-grid">\${meta.vehicles.map((v,i) => \`
                <div class="vcard" id="rp-vcard-\${i}" onclick="pickReportVehicle(\${i})">
                    \${v.photo ? \`<img src="\${v.photo}">\` : ''}
                    <div>\${v.name}</div>
                </div>\`).join('')}</div>\` : '<p style="color:var(--muted);margin-bottom:10px;">لا توجد مركبات مضافة</p>'}
            <h3 style="margin-top:16px;">تفاصيل العملية الميدانية</h3>
            <label>سبب الاستيقاف</label>
            <input id="rp-stop-reason" placeholder="سبب الاستيقاف">
            <div class="row" style="margin-top:16px;"><h3>\${isDrugs ? 'المخالفات' : 'المضبوطات'} على هذا المتهم (بحد أقصى 5)</h3><button type="button" class="btn sm gray" onclick="addReportItem('\${category}')">\${isDrugs ? '+ إضافة مخالفة' : '+ إضافة مضبوط'}</button></div>
            <div id="rp-items-box"></div>
            <label style="margin-top:12px;">الإجراءات الأمنية المتخذة</label>
            <div id="rp-actions-box">
                <div class="row rp-action-row" style="gap:6px;flex-wrap:nowrap;">
                    <input class="rp-action" placeholder="- إجراء أمني" style="flex:1;">
                    <button type="button" class="btn danger sm" style="flex:0 0 auto;" onclick="removeSecurityAction(this)">حذف</button>
                </div>
            </div>
            <button class="btn gray sm" style="margin:8px 0;" onclick="addSecurityAction()">+ إضافة إجراء</button>
            <label>صورة المركبة (إجباري)</label>
            <input type="file" id="rp-photo" accept="image/*" onchange="previewReportPhoto()" required>
            <img id="rp-photo-preview" style="display:none;max-width:220px;border-radius:8px;margin-bottom:10px;">
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn" onclick="submitReport('\${category}')">إرسال التقرير</button>
                <button class="btn gray" onclick="renderNewReport()">رجوع</button>
            </div>
        </div>\`;
    if (meta.vehicles.length) pickReportVehicle(0);
    addReportItem(category);
}
function addReportItem(category) {
    const box = document.getElementById('rp-items-box');
    const isDrugs = category === 'مخدرات';
    box.dataset.category = category;
    if (box.querySelectorAll('.rp-item-block').length >= 5) return toast(isDrugs ? 'الحد الأقصى 5 مخالفات بنفس التقرير' : 'الحد الأقصى 5 مضبوطات بنفس التقرير');
    reportItemCount++;
    const i = reportItemCount;
    const div = document.createElement('div');
    div.className = 'card rp-item-block';
    div.id = 'rp-item-' + i;
    div.style.cssText = 'margin-top:8px;padding:12px;';
    div.innerHTML = \`
        <div class="row"><b>\${isDrugs ? 'مخالفة' : 'مضبوط'} #<span class="rp-item-num">\${box.children.length + 1}</span></b><button type="button" class="btn danger sm" onclick="removeReportItem(\${i})">حذف</button></div>
        \${isDrugs ? \`
        <label>نوع المخدر المضبوط</label>
        <input class="rp-item-drug-type" placeholder="مثال: حشيش، شبو، حبوب مخدرة">
        <label>الكمية المضبوطة</label>
        <input class="rp-item-drug-qty" placeholder="مثال: 3 كيلو / 50 حبة">
        <label>طريقة إخفاء المخدر</label>
        <input class="rp-item-conceal" placeholder="مثال: مخبأ داخل صندوق السيارة">
        \` : \`
        <label>مضبوط</label>
        <textarea class="rp-item-seized" placeholder="مضبوط" rows="2"></textarea>
        \`}\`;
    box.appendChild(div);
    renumberReportItems();
}
function removeReportItem(i) {
    const box = document.getElementById('rp-items-box');
    const isDrugs = box.dataset.category === 'مخدرات';
    if (box.querySelectorAll('.rp-item-block').length <= 1) return toast(isDrugs ? 'لازم تبقى مخالفة واحدة على الأقل' : 'لازم يبقى مضبوط واحد على الأقل');
    document.getElementById('rp-item-' + i).remove();
    renumberReportItems();
}
function renumberReportItems() {
    document.querySelectorAll('#rp-items-box .rp-item-block').forEach((el, idx) => {
        el.querySelector('.rp-item-num').textContent = idx + 1;
    });
}
function pickReportVehicle(i) {
    reportSelectedVehicle = reportMeta.vehicles[i].name;
    document.querySelectorAll('#rp-v-grid .vcard').forEach(el => el.classList.remove('sel'));
    document.getElementById('rp-vcard-' + i).classList.add('sel');
}
function addSecurityAction() {
    const box = document.getElementById('rp-actions-box');
    const row = document.createElement('div');
    row.className = 'row rp-action-row';
    row.style.cssText = 'gap:6px;flex-wrap:nowrap;margin-top:6px;';
    row.innerHTML = '<input class="rp-action" placeholder="- إجراء أمني" style="flex:1;"><button type="button" class="btn danger sm" style="flex:0 0 auto;" onclick="removeSecurityAction(this)">حذف</button>';
    box.appendChild(row);
}
function removeSecurityAction(btn) {
    const box = document.getElementById('rp-actions-box');
    if (box.querySelectorAll('.rp-action-row').length <= 1) {
        btn.closest('.rp-action-row').querySelector('.rp-action').value = '';
        return;
    }
    btn.closest('.rp-action-row').remove();
}
function previewReportPhoto() {
    const f = document.getElementById('rp-photo').files[0];
    if (!f) return;
    if (f.size > ${CONFIG.MAX_PHOTO_MB} * 1024 * 1024) { toast('الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        reportVehiclePhoto = e.target.result;
        const img = document.getElementById('rp-photo-preview');
        img.src = reportVehiclePhoto; img.style.display = 'block';
    };
    reader.readAsDataURL(f);
}
async function submitReport(category) {
    const isDrugs = category === 'مخدرات';
    const suspectName = document.getElementById('rp-suspect-name').value.trim();
    const arrestLocation = document.getElementById('rp-location').value.trim();
    const stopReason = document.getElementById('rp-stop-reason').value.trim();
    const securityActions = Array.from(document.querySelectorAll('.rp-action')).map(el => el.value.trim()).filter(Boolean);
    if (!suspectName || !arrestLocation) return toast('أكمل اسم المتهم وموقع الضبط');
    if (!reportSelectedVehicle) return toast('اختر المركبة');
    if (!stopReason) return toast('أكمل تفاصيل العملية الميدانية');
    if (!reportVehiclePhoto) return toast('لازم ترفق صورة المركبة');

    const blocks = Array.from(document.querySelectorAll('#rp-items-box .rp-item-block'));
    if (!blocks.length) return toast(isDrugs ? 'أضف مخالفة واحدة على الأقل' : 'أضف مضبوط واحد على الأقل');
    const items = [];
    for (const b of blocks) {
        if (isDrugs) {
            const drugType = b.querySelector('.rp-item-drug-type').value.trim();
            const drugQuantity = b.querySelector('.rp-item-drug-qty').value.trim();
            const concealMethod = b.querySelector('.rp-item-conceal').value.trim();
            if (!drugType || !drugQuantity || !concealMethod) return toast('أكمل كل حقول كل مخالفة (نوع المخدر، الكمية، طريقة الإخفاء)');
            items.push({ drugType, drugQuantity, concealMethod });
        } else {
            const seizedItems = b.querySelector('.rp-item-seized').value.trim();
            if (!seizedItems) return toast('اكتب المضبوطات لكل مضبوط');
            items.push({ seizedItems });
        }
    }
    try {
        const r = await api('/api/reports/submit', { method: 'POST', body: JSON.stringify({
            category, suspectName, arrestLocation, vehicle: reportSelectedVehicle,
            stopReason, securityActions, photo: reportVehiclePhoto, items,
        }) });
        toast(\`✅ تم إرسال \${r.count} مخالفة على \${suspectName}، بانتظار المراجعة\`);
        renderDashboard();
    } catch (e) { toast(e.message); }
}
function renderCard() {
    document.getElementById('app').innerHTML = '<div style="margin-top:30px;">' +
        cardBlock(ME, { id: 'me-card', hasProgress: true, nextRank: ME.nextRank, remaining: ME.pointsRemaining }) +
        '<div class="center" style="margin-top:16px;"><button class="btn gray sm" onclick="renderDashboard()">رجوع</button></div></div>';
}
function renderAdmin(startTab) {
    if (typeof startTab !== 'string') startTab = null;
    const tabsHtml = ME.isSeniorAdmin ? \`
        <div class="tabs">
            <div class="tab active" onclick="adminTab('pending', this)">المخالفات المعلّقة</div>
            <div class="tab" onclick="adminTab('reviewed', this)">✅ المخالفات المقبولة</div>
            <div class="tab" onclick="adminTab('sectors', this)">قادة القطاعات</div>
            <div class="tab" onclick="adminTab('regs', this)">📥 طلبات التسجيل</div>
            <div class="tab" onclick="adminTab('accounts', this)">✅ الحسابات المقبولة</div>
            <div class="tab" onclick="adminTab('personnel', this)">ملفات العسكريين</div>
            <div class="tab" onclick="adminTab('vehicles', this)">المركبات</div>
            <div class="tab" onclick="adminTab('hire', this)">توظيف الإدارة</div>
            <div class="tab" onclick="adminTab('thresholds', this)">ترقيات النقاط</div>
            <div class="tab" onclick="adminTab('leave', this)">🌴 طلبات الإجازات</div>
            <div class="tab" id="tab-officers" onclick="adminTab('officers', this)">🎖️ إدارة سلك الضباط</div>
            <div class="tab" onclick="adminTab('log', this)">اللوق الشامل</div>
            <div class="tab" onclick="adminTab('notes', this)">📝 الملاحظات</div>
            <div class="tab" id="tab-support" onclick="adminTab('support', this)">🎧 خدمة العملاء</div>
            <div class="tab" onclick="adminTab('settings', this)">الإعدادات</div>
            <div class="tab" onclick="renderNewReport()">🧪 تسجيل تقرير جديد مكافحة</div>
        </div>\` : (ME.isAdmin ? \`<div class="tabs"><div class="tab active" onclick="adminTab('pending', this)">المخالفات المعلّقة</div><div class="tab" onclick="adminTab('regs', this)">📥 طلبات التسجيل</div><div class="tab" id="tab-support" onclick="adminTab('support', this)">🎧 خدمة العملاء</div></div>\` : '');
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>\${ME.isSeniorAdmin ? 'لوحة تحكم كبار المسؤولين' : 'لوحة الإدارة'}</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        \${tabsHtml}
        <div id="admin-content"></div>\`;
    if (startTab) adminTab(startTab, document.getElementById('tab-' + startTab)); else adminTab('pending');
}
function adminTab(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    if (name !== 'support' && SP.cur && SP.cur.box === 'spa-body') SP.cur = null;
    currentAdminTab = name;
    if (name === 'support') loadSupportTab();
    if (name === 'pending') loadPending();
    if (name === 'reviewed') loadReviewedViolations();
    if (name === 'sectors') loadSectors();
    if (name === 'regs') loadRegs();
    if (name === 'accounts') loadAccounts();
    if (name === 'personnel') loadPersonnel();
    if (name === 'vehicles') loadVehicles();
    if (name === 'hire') loadHire();
    if (name === 'thresholds') loadThresholds();
    if (name === 'leave') loadSeniorLeavePage();
    if (name === 'log') loadLog();
    if (name === 'notes') loadNotesPage();
    if (name === 'settings') loadSettings();
    if (name === 'officers') renderOfficerAdmin();
}
async function loadReviewedViolations() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/senior/violations/reviewed')); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل (\${e.message})</div>\`; return; }
    if (currentAdminTab !== 'reviewed') return;
    if (list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات مقبولة أو مرفوضة بعد</div>'; return; }
    box.innerHTML = list.map(v => \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div class="row" style="gap:10px;align-items:flex-start;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">\${v.kind === 'report' ? ('🧪 تقرير مكافحة — ' + v.reportCategory) : v.violationType}</div>
                        <div><span class="badge \${v.status}">\${v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span></div>
                        \${v.status === 'rejected' && v.rejectReason ? \`<div style="font-size:11px;color:var(--muted);margin-top:3px;">\${v.rejectReason}</div>\` : ''}
                    </div>
                </div>
                <button class="btn danger sm" onclick="deleteViolationPermanent('\${v._id}')">🗑️ حذف نهائي</button>
            </div>
        </div>\`).join('');
}
async function deleteViolationPermanent(id) {
    if (!(await confirmModal('حذف نهائي — بيختفي من عندك وعند العضو وعند قائده. متأكد؟'))) return;
    try { await api('/api/senior/violations/' + id + '/permanent', { method: 'DELETE' }); toast('تم الحذف'); loadReviewedViolations(); }
    catch (e) { toast(e.message); }
}
async function loadSeniorLeavePage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/senior/leave/pending')); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل (\${e.message})</div>\`; return; }
    if (currentAdminTab !== 'leave') return;
    box.innerHTML = renderLeaveRequestsList(list, true);
}
function renderLeaveRequestsList(list, reload) {
    if (!list.length) return '<div class="card center" style="color:var(--muted);">لا توجد طلبات إجازة</div>';
    return list.map(l => {
        const isActive = l.status === 'approved';
        let actions = \`
            <button class="btn sm" onclick="approveLeave('\${l._id}', \${reload})">قبول</button>
            <button class="btn danger sm" onclick="rejectLeave('\${l._id}', \${reload})">رفض</button>\`;
        let extra = '';
        if (isActive) {
            const daysLeft = l.endDate ? Math.max(0, Math.ceil((new Date(l.endDate) - Date.now()) / 86400000)) : '-';
            extra = \`<div style="color:#4ade80;margin-top:4px;">⏳ نشطة — متبقي \${daysLeft} يوم</div>\`;
            actions = \`<button class="btn danger sm" onclick="endLeave('\${l._id}', \${reload})">🏁 إنهاء الإجازة</button>\`;
        }
        return \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div>
                    <b>\${l.name}</b> <span style="color:var(--muted);font-size:12px;">(\${l.unit || '-'} • \${l.rank || '-'} • \${l.sectorLabel || '-'})</span>
                    <div style="color:var(--gold-soft);margin-top:4px;">📅 \${l.days} يوم</div>
                    <div style="color:var(--muted);font-size:13px;">\${l.reason}</div>
                    \${extra}
                </div>
                <div class="row" style="gap:8px;">\${actions}</div>
            </div>
        </div>\`;
    }).join('');
}
async function approveLeave(id, senior) {
    try { await api('/api/leave/' + id + '/approve', { method: 'POST' }); toast('✅ تمت الموافقة'); senior ? loadSeniorLeavePage() : loadSectorLeavePending(); }
    catch (e) { toast(e.message); }
}
async function rejectLeave(id, senior) {
    const reason = await promptModal('سبب الرفض (اختياري):') || '';
    try { await api('/api/leave/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) }); toast('تم الرفض'); senior ? loadSeniorLeavePage() : loadSectorLeavePending(); }
    catch (e) { toast(e.message); }
}
async function endLeave(id, senior) {
    if (!(await confirmModal('متأكد تبي تنهي هذي الإجازة الآن؟'))) return;
    try { await api('/api/leave/' + id + '/end', { method: 'POST' }); toast('✅ تم إنهاء الإجازة'); senior ? loadSeniorLeavePage() : loadSectorLeavePending(); }
    catch (e) { toast(e.message); }
}

async function loadPending() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    if (!box.dataset.loaded) box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try {
        ({ list } = await api('/api/admin/pending'));
    } catch (e) {
        if (currentAdminTab !== 'pending') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر تحميل المخالفات المعلّقة، حاول تحدّث الصفحة. (\${e.message})</div>\`;
        return;
    }
    if (currentAdminTab !== 'pending') return;
    box.id = 'admin-content'; box.dataset.loaded = '1';
    box.innerHTML = '<div id="pending-box"></div>';
    const pbox = document.getElementById('pending-box');
    if (list.length === 0) { pbox.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات معلّقة</div>'; return; }
    pbox.innerHTML = list.map(v => v.kind === 'report' ? \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div class="row" style="gap:10px;align-items:flex-start;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">🧪 تقرير مكافحة المخدرات — \${v.reportCategory}</div>
                        <div style="color:var(--muted);font-size:13px;">المتهم: \${v.suspectName} • موقع الضبط: \${v.arrestLocation}</div>
                        <div style="color:var(--muted);font-size:13px;">المركبة: \${v.vehicle} • سبب الاستيقاف: \${v.stopReason}</div>
                        \${v.reportCategory === 'مخدرات' ? \`
                        <div style="color:var(--muted);font-size:13px;">نوع المخدر: \${v.drugType || '-'} • الكمية: \${v.drugQuantity || '-'}</div>
                        <div style="color:var(--muted);font-size:13px;">طريقة الإخفاء: \${v.concealMethod || '-'}</div>
                        \` : \`<div style="color:var(--muted);font-size:13px;">المضبوطات: \${v.seizedItems}</div>\`}
                        \${v.securityActions && v.securityActions.length ? \`<div style="color:var(--muted);font-size:13px;">الإجراءات: \${v.securityActions.join('، ')}</div>\` : ''}
                    </div>
                </div>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="approveV('\${v._id}')">قبول (+2)</button>
                    <button class="btn danger sm" onclick="rejectV('\${v._id}')">رفض (-1)</button>
                </div>
            </div>
        </div>\` : \`
        <div class="card">
            <div class="row">
                <div class="row" style="gap:10px;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">\${v.violationType}</div>
                        <div style="color:var(--muted);font-size:13px;">المركبة: \${v.vehicle} • اللوحة: \${v.plateNumber}</div>
                    </div>
                </div>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="approveV('\${v._id}')">قبول</button>
                    <button class="btn danger sm" onclick="rejectV('\${v._id}')">رفض</button>
                </div>
            </div>
        </div>\`).join('');
}
const actionLocks = {};
function isActionLocked(id) {
    const until = actionLocks[id];
    if (until && Date.now() < until) return true;
    return false;
}
function lockAction(id) {
    actionLocks[id] = Date.now() + 5000;
    setTimeout(() => { delete actionLocks[id]; }, 5000);
}
async function approveV(id) {
    if (isActionLocked(id)) return toast('انتظر 5 ثواني قبل الضغط مرة أخرى');
    lockAction(id);
    try { await api('/api/admin/violations/' + id + '/approve', { method: 'POST' }); toast('تم القبول'); loadPending(); }
    catch (e) { toast(e.message); }
}
async function rejectV(id) {
    if (isActionLocked(id)) return toast('انتظر 5 ثواني قبل الضغط مرة أخرى');
    const reason = await promptModal('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب');
    lockAction(id);
    api('/api/admin/violations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
        .then(() => { toast('تم الرفض'); loadPending(); }).catch(e => toast(e.message));
}

let sectorsCache = { sectors: {}, leadership: {} };
async function loadSectors() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/senior/sectors'); }
    catch (e) {
        if (currentAdminTab !== 'sectors') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (currentAdminTab !== 'sectors') return;
    sectorsCache = data;
    renderSectorsBox();
}
function renderSectorsBox() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    const keys = Object.keys(sectorsCache.sectors);
    const mp = sectorsCache.mpLeadership || {};
    const vo = sectorsCache.violationsOfficer || {};
    const voCard = '<div class="card">' +
        '<h3>⚖️ مسؤول المخالفات (لكل القطاعات)</h3>' +
        '<div class="row" style="margin-top:8px;"><span>المسؤول: <b style="color:' + (vo.name ? '#4ade80' : 'var(--muted)') + ';">' + accEsc(vo.name || 'غير معيّن') + '</b></span>' +
        '<div class="row" style="gap:6px;"><button class="btn sm" onclick="openVOPicker()">تعيين مسؤول المخالفات</button>' +
        (vo.name ? '<button class="btn danger sm" onclick="removeVO()">إزالة</button>' : '') + '</div></div>' +
        '<div style="color:var(--muted);font-size:12px;margin-top:2px;">هو الوحيد اللي يقبل ويرفض مخالفات وتقارير كل القطاعات، وله سجل بالمقبولة والمرفوضة. قادة ونواب القطاعات ما يقدرون يقبلون أو يرفضون مخالفات قطاعهم.</div>' +
        '<div id="picker-vo"></div></div>';
    box.innerHTML = voCard + keys.map(key => {
        const label = sectorsCache.sectors[key];
        const sec = (sectorsCache.leadership && sectorsCache.leadership[key]) || {};
        return \`
        <div class="card">
            <h3>🪖 \${label}</h3>
            <div class="row" style="margin-top:8px;">
                <span>القائد: <b style="color:\${sec.commanderName ? '#4ade80' : 'var(--muted)'};">\${sec.commanderName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm" onclick="openSectorPicker('\${key}','commander')">قائد \${label}</button>
                    \${sec.commanderName ? \`<button class="btn danger sm" onclick="removeSectorRole('\${key}','commander')">إزالة</button>\` : ''}
                </div>
            </div>
            <div class="row" style="margin-top:8px;">
                <span>النائب: <b style="color:\${sec.deputyName ? '#4ade80' : 'var(--muted)'};">\${sec.deputyName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openSectorPicker('\${key}','deputy')">نائب \${label}</button>
                    \${sec.deputyName ? \`<button class="btn danger sm" onclick="removeSectorRole('\${key}','deputy')">إزالة</button>\` : ''}
                </div>
            </div>
            <div class="row" style="margin-top:8px;">
                <span>مسؤول الأفراد: <b style="color:\${sec.personnelOfficerName ? '#4ade80' : 'var(--muted)'};">\${sec.personnelOfficerName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openSectorPicker('\${key}','personnelOfficer')">مسؤول أفراد \${label}</button>
                    \${sec.personnelOfficerName ? \`<button class="btn danger sm" onclick="removeSectorRole('\${key}','personnelOfficer')">إزالة</button>\` : ''}
                </div>
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:2px;">مسؤول الأفراد يتحكم بالأعضاء من رتبة رئيس رقباء وتحت فقط (ملاحظات، تحذيرات، ومخالفاتهم) — وطلبات الترقية/التنزيل اللي يسويها تروح لك أو للنائب بصفحة "ترقيات الأفراد" داخل لوحة قيادة القطاع للموافقة عليها.</div>
            <div id="picker-\${key}-commander"></div>
            <div id="picker-\${key}-deputy"></div>
            <div id="picker-\${key}-personnelOfficer"></div>
        </div>\`;
    }).join('') + \`
        <div class="card">
            <h3>🚔 الشرطة العسكرية</h3>
            <div class="row" style="margin-top:8px;">
                <span>القائد: <b style="color:\${mp.commanderName ? '#4ade80' : 'var(--muted)'};">\${mp.commanderName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm" onclick="openMPPicker('commander')">قائد الشرطة العسكرية</button>
                    \${mp.commanderName ? '<button class="btn danger sm" onclick="removeMPRole(\\'commander\\')">إزالة</button>' : ''}
                </div>
            </div>
            <div class="row" style="margin-top:8px;">
                <span>النائب: <b style="color:\${mp.deputyName ? '#4ade80' : 'var(--muted)'};">\${mp.deputyName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openMPPicker('deputy')">نائب الشرطة العسكرية</button>
                    \${mp.deputyName ? '<button class="btn danger sm" onclick="removeMPRole(\\'deputy\\')">إزالة</button>' : ''}
                </div>
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:2px;">مسؤول أفراد الشرطة العسكرية يعيّنه القائد أو النائب من داخل لوحة الشرطة العسكرية نفسها.</div>
            <div id="picker-mp-commander"></div>
            <div id="picker-mp-deputy"></div>
        </div>
        <div class="card">
            <h3>⭐ القيادة العليا</h3>
            <div style="color:var(--muted);font-size:12px;margin-bottom:8px;">تراجع كل طلبات الترقية والتنزيل من كل القطاعات — تقدر تضيف أكثر من شخص.</div>
            <input placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchHCCandidate(this.value)">
            <div id="hc-cand-results"></div>
            <div id="hc-members-list" style="margin-top:10px;">جارِ التحميل...</div>
        </div>\`;
    loadHighCommandList();
}
async function loadHighCommandList() {
    const box = document.getElementById('hc-members-list');
    if (!box) return;
    try {
        const { list } = await api('/api/senior/high-command');
        if (!list.length) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا يوجد أعضاء بالقيادة العليا بعد</p>'; return; }
        box.innerHTML = list.map(m => \`
            <div class="card" style="padding:8px 12px;margin-top:6px;">
                <div class="row">
                    <span>\${m.name}</span>
                    <button class="btn danger sm" onclick="removeHCMember('\${m.id}')">إزالة</button>
                </div>
            </div>\`).join('');
    } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
}
let hcSearchTimer = null;
function searchHCCandidate(q) {
    clearTimeout(hcSearchTimer);
    hcSearchTimer = setTimeout(async () => {
        const box = document.getElementById('hc-cand-results');
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q), { noLock: true });
            if (list.length === 0) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="addHCMember('\${p.discord}')">إضافة</button>
                    </div>
                </div>\`).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
    }, 350);
}
async function addHCMember(discordId) {
    try { await api('/api/senior/high-command/add', { method: 'POST', body: JSON.stringify({ discordId }) }); toast('تمت الإضافة'); document.getElementById('hc-cand-results').innerHTML = ''; loadHighCommandList(); }
    catch (e) { toast(e.message); }
}
async function removeHCMember(discordId) {
    if (!(await confirmModal('متأكد تبي تزيله من القيادة العليا؟'))) return;
    try { await api('/api/senior/high-command/remove', { method: 'POST', body: JSON.stringify({ discordId }) }); toast('تم'); loadHighCommandList(); }
    catch (e) { toast(e.message); }
}
function openMPPicker(role) {
    ['commander', 'deputy'].forEach(r => {
        const el = document.getElementById('picker-mp-' + r);
        if (el && r !== role) el.innerHTML = '';
    });
    const el = document.getElementById('picker-mp-' + role);
    if (!el) return;
    if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
    el.innerHTML = \`
        <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
            <input placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchMPCandidate('\${role}', this.value)">
            <div id="cand-mp-\${role}"></div>
        </div>\`;
}
let mpSearchTimer = null;
function searchMPCandidate(role, q) {
    clearTimeout(mpSearchTimer);
    mpSearchTimer = setTimeout(async () => {
        const box = document.getElementById('cand-mp-' + role);
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q), { noLock: true });
            if (list.length === 0) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="assignMPRole('\${role}','\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
    }, 350);
}
async function assignMPRole(role, discordId) {
    try { await api('/api/senior/mp/assign', { method: 'POST', body: JSON.stringify({ role, discordId }) }); toast('تم التعيين'); loadSectors(); }
    catch (e) { toast(e.message); }
}
async function removeMPRole(role) {
    if (!(await confirmModal('متأكد تبي تزيله من هذا المنصب؟'))) return;
    try { await api('/api/senior/mp/remove', { method: 'POST', body: JSON.stringify({ role }) }); toast('تم'); loadSectors(); }
    catch (e) { toast(e.message); }
}
function openSectorPicker(sectorKey, role) {
    ['commander', 'deputy', 'personnelOfficer'].forEach(r => {
        Object.keys(sectorsCache.sectors).forEach(k => {
            const el = document.getElementById('picker-' + k + '-' + r);
            if (el && (k !== sectorKey || r !== role)) el.innerHTML = '';
        });
    });
    const el = document.getElementById('picker-' + sectorKey + '-' + role);
    if (!el) return;
    if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
    el.innerHTML = \`
        <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
            <input placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchSectorCandidate('\${sectorKey}','\${role}', this.value)">
            <div id="cand-\${sectorKey}-\${role}"></div>
        </div>\`;
}
let sectorSearchTimer = null;
function searchSectorCandidate(sectorKey, role, q) {
    clearTimeout(sectorSearchTimer);
    sectorSearchTimer = setTimeout(async () => {
        const box = document.getElementById('cand-' + sectorKey + '-' + role);
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q), { noLock: true });
            if (list.length === 0) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="assignSectorRole('\${sectorKey}','\${role}','\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
    }, 350);
}
async function assignSectorRole(sectorKey, role, discordId) {
    try {
        await api('/api/senior/sectors/' + sectorKey + '/assign', { method: 'POST', body: JSON.stringify({ role, discordId }) });
        toast('تم التعيين');
        loadSectors();
    } catch (e) { toast(e.message); }
}
async function removeSectorRole(sectorKey, role) {
    if (!(await confirmModal('متأكد تبي تزيله من هذا المنصب؟'))) return;
    try {
        await api('/api/senior/sectors/' + sectorKey + '/remove', { method: 'POST', body: JSON.stringify({ role }) });
        toast('تم');
        loadSectors();
    } catch (e) { toast(e.message); }
}

let sectorPanelTab = 'members';
let sectorMembersCache = [];
let hcTab = 'pending';
function renderHighCommandPanel() {
    if (!ME.isHighCommand) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>⭐ القيادة العليا</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        <div class="tabs">
            <div class="tab active" onclick="hcTabSwitch('pending', this)">⏳ الطلبات المعلّقة</div>
            <div class="tab" onclick="hcTabSwitch('history', this)">📜 السجل</div>
        </div>
        <div id="hc-content"></div>\`;
    hcTabSwitch('pending');
}
function hcTabSwitch(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    hcTab = name;
    if (name === 'pending') loadHCPending();
    if (name === 'history') loadHCHistory();
}
function hcCard(r, withActions) {
    return \`
        <div class="card">
            <b>\${r.targetName || r.targetTag}</b>
            <div style="color:var(--gold-soft);margin-top:4px;">\${r.direction === 'up' ? '⬆️ ترقية' : '⬇️ تنزيل'}: \${r.fromRank} ← \${r.toRank}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">القطاع: \${r.sectorLabel} • مقدّم الطلب: \${r.requestedByTag || r.requestedBy}</div>
            \${r.reason ? \`<div style="font-size:13px;margin-top:6px;">السبب: \${r.reason}</div>\` : ''}
            \${!withActions ? \`<div style="margin-top:6px;"><span class="badge \${r.status}">\${r.status === 'approved' ? 'مقبول' : 'مرفوض'}</span>\${r.rejectReason ? ' — ' + r.rejectReason : ''}</div>\` : ''}
            \${withActions ? \`
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn sm" onclick="hcDecide('\${r._id}','approve')">قبول</button>
                <button class="btn danger sm" onclick="hcDecide('\${r._id}','reject')">رفض</button>
            </div>\` : ''}
        </div>\`;
}
async function loadHCPending(silent) {
    const box = document.getElementById('hc-content');
    if (!box) return;
    if (!silent) box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/high-command/promotion-requests'); }
    catch (e) { if (hcTab !== 'pending' || silent) return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (hcTab !== 'pending') return;
    if (data.list.length === 0) { paintSilent(box, 'hp', '<div class="card center" style="color:var(--muted);">لا توجد طلبات معلّقة</div>', silent); return; }
    paintSilent(box, 'hp', data.list.map(r => hcCard(r, true)).join(''), silent);
}
async function hcDecide(id, action) {
    if (action === 'reject') {
        const reason = await promptModal('اكتب سبب الرفض:');
        if (reason === null) return;
        if (!reason.trim()) return toast('لازم تكتب سبب');
        api('/api/high-command/promotion-requests/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
            .then(() => { toast('تم الرفض'); loadHCPending(); }).catch(e => toast(e.message));
        return;
    }
    api('/api/high-command/promotion-requests/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('✅ تمت الموافقة'); loadHCPending(); }).catch(e => toast(e.message));
}
async function loadHCHistory() {
    const box = document.getElementById('hc-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/high-command/promotion-requests/history'); }
    catch (e) { if (hcTab !== 'history') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (hcTab !== 'history') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد سجل بعد</div>'; return; }
    box.innerHTML = data.list.map(r => hcCard(r, false)).join('');
}

function renderSectorPanel() {
    if (!ME.sectorInfo) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🎖️ قيادة \${ME.sectorInfo.sectorLabel} (\${ME.sectorInfo.role === 'commander' ? 'قائد' : 'نائب'})</h2>
            <div class="row" style="gap:8px;">
                <button class="btn sm" style="background:#78350f;color:#fff;" onclick="openSectorNoticeForm()">📢 إشعار لأفراد القطاع</button>
                <button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button>
            </div>
        </div>
        <div class="card">
            <div class="row">
                <span>مسؤول الأفراد: <b style="color:\${ME.sectorInfo.personnelOfficerName ? '#4ade80' : 'var(--muted)'};">\${ME.sectorInfo.personnelOfficerName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openPersonnelOfficerPicker()">تعيين / تغيير</button>
                    \${ME.sectorInfo.personnelOfficerName ? \`<button class="btn danger sm" onclick="removePersonnelOfficer()">إزالة</button>\` : ''}
                </div>
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:6px;">مسؤول الأفراد يتحكم بالأعضاء من رتبة رئيس رقباء وتحت فقط (ملاحظات وتحذيرات ومخالفاتهم). طلبات الترقية والتنزيل اللي يسويها ما تصير مباشرة — تجيك أو للنائب بتبويب "ترقيات الأفراد" تحت للموافقة عليها.</div>
            <div id="po-picker"></div>
        </div>
        <div class="tabs">
            <div class="tab active" onclick="sectorTab('members', this)">أعضاء القطاع</div>
            <div class="tab" onclick="sectorTab('violations', this)">مخالفات القطاع</div>
            <div class="tab" onclick="sectorTab('file', this)">عرض ملف عسكري</div>
            <div class="tab" onclick="sectorTab('promotions', this)">ترقيات الأفراد</div>
            <div class="tab" onclick="sectorTab('leave', this)">🌴 طلبات الإجازات</div>
        </div>
        <div id="sector-content"></div>\`;
    sectorTab('members');
}
function openSectorNoticeForm() {
    if (!ME.sectorInfo) return;
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📢 ضع نص الإشعار (سيصل لكل أعضاء \${ME.sectorInfo.sectorLabel} المسجلين بالموقع)</h3>
        <textarea id="wf-reason-sector" placeholder="اكتب نص الإشعار هنا..."></textarea>
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitSectorNoticeForm()">إرسال لأفراد القطاع</button>
        </div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function submitSectorNoticeForm() {
    const reason = document.getElementById('wf-reason-sector').value;
    if (!reason || !reason.trim()) return toast('لازم تكتب النص');
    if (!(await confirmModal('متأكد تبي ترسل هذا الإشعار لكل أعضاء ' + ME.sectorInfo.sectorLabel + '؟'))) return;
    try {
        const { count } = await api('/api/sector/notice-all', { method: 'POST', body: JSON.stringify({ reason }) });
        toast('✅ تم الإرسال لـ ' + count + ' عضو');
        closeWarnForm();
    } catch (e) { toast(e.message); }
}
async function openPersonnelOfficerPicker() {
    const el = document.getElementById('po-picker');
    if (!el) return;
    if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
    el.innerHTML = '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">جارِ التحميل...</div>';
    try {
        const { list } = await api('/api/sector/members');
        if (list.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-size:13px;margin-top:8px;">لا يوجد أعضاء بالقطاع حالياً</p>'; return; }
        el.innerHTML = \`<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">\` +
            list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="assignPersonnelOfficer('\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('') + \`</div>\`;
    } catch (e) { el.innerHTML = '<p style="color:#f87171;font-size:13px;margin-top:8px;">' + e.message + '</p>'; }
}
async function assignPersonnelOfficer(discordId) {
    try {
        await api('/api/sector/personnel-officer/assign', { method: 'POST', body: JSON.stringify({ discordId }) });
        toast('تم التعيين');
        await refreshMe();
        renderSectorPanel();
    } catch (e) { toast(e.message); }
}
async function removePersonnelOfficer() {
    if (!(await confirmModal('متأكد تبي تزيله من مسؤول الأفراد؟'))) return;
    try {
        await api('/api/sector/personnel-officer/remove', { method: 'POST' });
        toast('تم');
        await refreshMe();
        renderSectorPanel();
    } catch (e) { toast(e.message); }
}
function sectorTab(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    sectorPanelTab = name;
    if (name === 'members') loadSectorMembers();
    if (name === 'violations') loadSectorViolations();
    if (name === 'file') renderSectorFileSearch();
    if (name === 'promotions') loadPromotionRequests();
    if (name === 'leave') loadSectorLeavePending();
}
async function loadSectorLeavePending() {
    const box = document.getElementById('sector-content') || document.getElementById('po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/leave/pending')); }
    catch (e) {
        if (sectorPanelTab !== 'leave' && poTab !== 'leave') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    box.innerHTML = renderLeaveRequestsList(list, false);
}
async function loadPromotionRequests() {
    const box = document.getElementById('sector-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/sector/promotion-requests'); }
    catch (e) {
        if (sectorPanelTab !== 'promotions') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (sectorPanelTab !== 'promotions') return;
    const list = data.list || [];
    const note = \`<div class="card" style="color:var(--muted);font-size:13px;">📩 طلبات الترقية والتنزيل (منك أو من مسؤول الأفراد) تراجعها القيادة العليا — هذي بس متابعة لحالتها.</div>\`;
    if (list.length === 0) { box.innerHTML = note + '<div class="card center" style="color:var(--muted);">لا توجد طلبات حالياً</div>'; return; }
    box.innerHTML = note + list.map(r => \`
        <div class="card">
            <b>\${r.targetName || r.targetTag}</b>
            <div style="color:var(--gold-soft);margin-top:4px;">\${r.direction === 'up' ? '⬆️ طلب ترقية' : '⬇️ طلب تنزيل'}: \${r.fromRank} ← \${r.toRank}</div>
            \${r.reason ? \`<div style="color:var(--muted);font-size:12px;margin-top:2px;">السبب: \${r.reason}</div>\` : ''}
            <div style="color:var(--muted);font-size:12px;margin-top:2px;">مقدّم الطلب: \${r.requestedByTag || r.requestedBy}</div>
            <div style="margin-top:4px;"><span class="badge \${r.status}">\${r.status === 'pending' ? 'قيد المراجعة (القيادة العليا)' : r.status === 'approved' ? 'تمت الموافقة' : 'مرفوض'}</span>\${r.status === 'rejected' && r.rejectReason ? \` — \${r.rejectReason}\` : ''}</div>
        </div>\`).join('');
}
var SILENT_SIG = {};
function paintSilent(box, key, html, silent) {
    if (silent && SILENT_SIG[key] === html && box.innerHTML) return;
    var y = window.scrollY;
    box.innerHTML = html;
    SILENT_SIG[key] = html;
    if (silent) window.scrollTo(0, y);
}
async function loadSectorMembers(silent) {
    const box = document.getElementById('sector-content');
    if (!box) return;
    if (!silent) box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/sector/members'); }
    catch (e) {
        if (sectorPanelTab !== 'members' || silent) return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (sectorPanelTab !== 'members') return;
    sectorMembersCache = data.list;
    cardRemember(data.list);
    if (data.list.length === 0) { paintSilent(box, 'sm', '<div class="card center" style="color:var(--muted);">لا يوجد أعضاء مسجّلين بهذا القطاع حالياً</div>', silent); return; }
    paintSilent(box, 'sm', data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    <div style="font-size:13px;color:#94a3b8;">النقاط: \${p.points} \${p.isBlocked ? '• 🚫 موقوف' : ''} • رقم البطاقة: \${p.cardNumber || '-'}</div>
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openCardModal('\${p.discord}')">🪪 البطاقة</button>
                    <button class="btn sm gray" onclick="sectorPromote('\${p.discord}','up')">⬆️ ترقية</button>
                    <button class="btn sm gray" onclick="sectorPromote('\${p.discord}','down')">⬇️ تنزيل</button>
                    <button class="btn sm gray" onclick="sectorAssignUnit('\${p.discord}')">🪖 يونت</button>
                    <button class="btn sm gray" onclick="editMemberPoints('\${p.discord}', \${p.points})">✏️ النقاط</button>
                    <button class="btn sm gray" onclick="sectorAddNote('\${p.discord}')">📝 ملاحظة</button>
                    <button class="btn sm" style="background:#7f1d1d;color:#fff;" onclick="openWarnForm('\${p.discord}','/api/sector/personnel/')">⚠️ تحذير</button>
                </div>
            </div>
        </div>\`).join(''), silent);
}
async function sectorPromote(discord, direction) {
    const reason = await promptModal(direction === 'up' ? 'اكتب سبب الترقية:' : 'اكتب سبب التنزيل:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب السبب');
    try {
        await api('/api/sector/personnel/' + discord + '/rank', { method: 'POST', body: JSON.stringify({ direction, reason }) });
        toast('📩 تم إرسال الطلب للقيادة العليا للمراجعة');
        loadSectorMembers();
    } catch (e) { toast(e.message); }
}
async function sectorAssignUnit(discord) {
    const unit = await promptModal('اسم اليونت الجديد:');
    if (unit === null) return;
    if (!unit.trim()) return toast('حط اسم اليونت');
    api('/api/sector/personnel/' + discord + '/unit', { method: 'POST', body: JSON.stringify({ unit }) })
        .then(() => { toast('تم التعيين'); loadSectorMembers(); }).catch(e => toast(e.message));
}
function sectorAddNote(discord) {
    openSectorNoteForm(discord, '/api/sector/personnel/', 'loadSectorMembers()');
}
async function loadSectorViolations() {
    const box = document.getElementById('sector-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/sector/violations'); }
    catch (e) {
        if (sectorPanelTab !== 'violations') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (sectorPanelTab !== 'violations') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات أو تقارير بعد</div>'; return; }
    box.innerHTML = (data.canReview ? '' : '<div class="card" style="color:var(--muted);font-size:13px;">👁️ عرض فقط — قبول ورفض المخالفات والتقارير مخصص لمسؤول المخالفات.</div>') + data.list.map(v => \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div class="row" style="gap:10px;align-items:flex-start;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName || v.reporterTag}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit || '-'})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">\${v.kind === 'report' ? ('🧪 تقرير مكافحة مخدرات — ' + v.reportCategory) : v.violationType}</div>
                        <div style="margin-top:4px;"><span class="badge \${v.status}">\${v.status === 'pending' ? 'قيد المراجعة' : v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span></div>
                    </div>
                </div>
                \${data.canReview && v.status === 'pending' ? \`
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="sectorApprove('\${v._id}')">قبول</button>
                    <button class="btn danger sm" onclick="sectorReject('\${v._id}')">رفض</button>
                </div>\` : ''}
            </div>
        </div>\`).join('');
}
function sectorApprove(id) {
    api('/api/sector/violations/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('تم القبول'); loadSectorViolations(); }).catch(e => toast(e.message));
}
async function sectorReject(id) {
    const reason = await promptModal('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب');
    api('/api/sector/violations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
        .then(() => { toast('تم الرفض'); loadSectorViolations(); }).catch(e => toast(e.message));
}
function renderSectorFileSearch() {
    const box = document.getElementById('sector-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <input id="sector-file-search" placeholder="🔍 ابحث بالاسم / اليونت / رقم البطاقة..." oninput="filterSectorFileSearch()">
            <div id="sector-file-results"></div>
        </div>
        <div id="sector-file-view"></div>\`;
    if (sectorMembersCache.length === 0) {
        api('/api/sector/members').then(d => { sectorMembersCache = d.list; }).catch(() => {});
    }
}
function filterSectorFileSearch() {
    const q = document.getElementById('sector-file-search').value.trim().toLowerCase();
    const box = document.getElementById('sector-file-results');
    if (!q) { box.innerHTML = ''; return; }
    const matches = sectorMembersCache.filter(p => (p.registeredName || '').toLowerCase().includes(q) || (p.discordTag || '').toLowerCase().includes(q) || (p.unit || '').toLowerCase().includes(q) || (p.rank || '').toLowerCase().includes(q) || (p.cardNumber || '').includes(q));
    box.innerHTML = matches.map(p => \`
        <div class="card" style="padding:8px 12px;margin-top:6px;">
            <div class="row">
                <span>\${p.registeredName || p.discordTag} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'})</span></span>
                <button class="btn sm" onclick="viewSectorFile('\${p.discord}')">عرض الملف</button>
            </div>
        </div>\`).join('') || '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>';
}
async function viewSectorFile(discord) {
    const box = document.getElementById('sector-file-view');
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    try {
        const { personnel: p, progress } = await api('/api/sector/personnel/' + discord);
        box.innerHTML = \`
            <div style="margin-top:16px;">\${cardBlock(p, { hasProgress: !!progress, nextRank: progress && progress.nextRank, remaining: progress && progress.remaining })}</div>
            <div class="id-card" style="margin-top:16px;">
                <div class="center" style="font-size:18px;font-weight:bold;color:var(--gold-soft);">\${p.registeredName || p.discordTag}</div>
                <div class="center" style="font-size:12px;color:var(--muted);margin-bottom:10px;">ملف عسكري</div>
                <table>
                    <tr><td>اليونت</td><td>\${p.unit || '-'}</td></tr>
                    <tr><td>الرتبة</td><td>\${p.rank}</td></tr>
                </table>
                \${p.notes && p.notes.length ? '<div style="margin-top:10px;font-size:13px;color:var(--gold-soft);">الملاحظات:</div>' +
                    p.notes.map(n => \`<div style="background:rgba(5,15,10,0.6);padding:8px;border-radius:8px;margin-top:6px;font-size:13px;">\${n.text}\${(n.image || (n.imageChannelId && n.imageMessageId)) ? \`<button class="btn sm gray" style="margin-top:6px;" onclick="viewNotePhoto('\${p.discord}','\${n._id}')">📷 عرض الصورة</button>\` : ''}</div>\`).join('') : ''}
            </div>\`;
    } catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">\${e.message}</div>\`; }
}

let poTab = 'members';
function renderPersonnelOfficerPanel() {
    if (!ME.personnelOfficerInfo) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>👥 مسؤول أفراد \${ME.personnelOfficerInfo.sectorLabel}</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        <div class="card" style="color:var(--muted);font-size:13px;">صلاحيتك تشمل أفراد قطاعك من رتبة <b style="color:var(--gold-soft);">رئيس رقباء وتحت</b> فقط. طلبات الترقية/التنزيل ما تصير فورية — تروح كطلب لقائد أو نائب القطاع للموافقة.</div>
        <div class="tabs">
            <div class="tab active" onclick="poTabSwitch('members', this)">الأفراد</div>
            <div class="tab" onclick="poTabSwitch('violations', this)">مخالفات الأفراد</div>
            <div class="tab" onclick="poTabSwitch('leave', this)">🌴 طلبات الإجازات</div>
        </div>
        <div id="po-content"></div>\`;
    poTabSwitch('members');
}
function poTabSwitch(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    poTab = name;
    if (name === 'members') loadPoMembers();
    if (name === 'violations') loadPoViolations();
    if (name === 'leave') loadSectorLeavePending();
}
async function loadPoMembers(silent) {
    const box = document.getElementById('po-content');
    if (!box) return;
    if (!silent) box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/personnel-officer/members'); }
    catch (e) {
        if (poTab !== 'members' || silent) return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (poTab !== 'members') return;
    cardRemember(data.list);
    if (data.list.length === 0) { paintSilent(box, 'pm', '<div class="card center" style="color:var(--muted);">لا يوجد أفراد برتبة رئيس رقباء وتحت بقطاعك حالياً</div>', silent); return; }
    paintSilent(box, 'pm', data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    <div style="font-size:13px;color:#94a3b8;">النقاط: \${p.points} \${p.isBlocked ? '• 🚫 موقوف' : ''} • رقم البطاقة: \${p.cardNumber || '-'}</div>
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openCardModal('\${p.discord}')">🪪 البطاقة</button>
                    <button class="btn sm gray" onclick="poPromotionRequest('\${p.discord}','up')">⬆️ طلب ترقية</button>
                    <button class="btn sm gray" onclick="poPromotionRequest('\${p.discord}','down')">⬇️ طلب تنزيل</button>
                    <button class="btn sm gray" onclick="editMemberPoints('\${p.discord}', \${p.points})">✏️ النقاط</button>
                    <button class="btn sm gray" onclick="poAddNote('\${p.discord}')">📝 ملاحظة</button>
                    <button class="btn sm" style="background:#7f1d1d;color:#fff;" onclick="openWarnForm('\${p.discord}','/api/personnel-officer/personnel/')">⚠️ تحذير</button>
                </div>
            </div>
        </div>\`).join(''), silent);
}
async function editMemberPoints(discord, currentPoints) {
    const val = await promptModal('عدد النقاط الجديد:', currentPoints);
    if (val === null) return;
    if (val === '' || isNaN(parseInt(val))) return toast('حط رقم صحيح');
    const reason = await promptModal('اكتب سبب تعديل النقاط (يوصل للقيادة العليا):');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب السبب');
    try {
        await api('/api/points/edit/' + discord, { method: 'POST', body: JSON.stringify({ points: parseInt(val), reason: reason.trim() }) });
        toast('تم تحديث النقاط وإشعار القيادة العليا');
        if (sectorPanelTab === 'members') loadSectorMembers();
        if (poTab === 'members') loadPoMembers();
    } catch (e) { toast(e.message); }
}
async function poPromotionRequest(discord, direction) {
    const reason = await promptModal(direction === 'up' ? 'اكتب سبب الترقية:' : 'اكتب سبب التنزيل:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب السبب');
    api('/api/personnel-officer/personnel/' + discord + '/promotion-request', { method: 'POST', body: JSON.stringify({ direction, reason }) })
        .then(() => toast('📩 تم إرسال الطلب للقيادة العليا للمراجعة')).catch(e => toast(e.message));
}
function poAddNote(discord) {
    openNoteForm(discord, '/api/personnel-officer/personnel/', 'loadPoMembers()');
}
async function loadPoViolations() {
    const box = document.getElementById('po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/personnel-officer/violations'); }
    catch (e) {
        if (poTab !== 'violations') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (poTab !== 'violations') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات أو تقارير بعد</div>'; return; }
    box.innerHTML = data.list.map(v => \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div class="row" style="gap:10px;align-items:flex-start;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName || v.reporterTag}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit || '-'})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">\${v.kind === 'report' ? ('🧪 تقرير مكافحة مخدرات — ' + v.reportCategory) : v.violationType}</div>
                        <div style="margin-top:4px;"><span class="badge \${v.status}">\${v.status === 'pending' ? 'قيد المراجعة' : v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span></div>
                    </div>
                </div>
                \${v.status === 'pending' ? \`
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="poApprove('\${v._id}')">قبول</button>
                    <button class="btn danger sm" onclick="poReject('\${v._id}')">رفض</button>
                </div>\` : ''}
            </div>
        </div>\`).join('');
}
function poApprove(id) {
    api('/api/personnel-officer/violations/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('تم القبول'); loadPoViolations(); }).catch(e => toast(e.message));
}
async function poReject(id) {
    const reason = await promptModal('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب');
    api('/api/personnel-officer/violations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
        .then(() => { toast('تم الرفض'); loadPoViolations(); }).catch(e => toast(e.message));
}

let mpTab = 'members';
function renderMPPanel() {
    if (!ME.mpInfo) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🚔 لوحة الشرطة العسكرية \${ME.mpInfo ? (' (' + (ME.mpInfo.role === 'commander' ? 'قائد' : 'نائب') + ')') : ''}</h2>
            <div class="row" style="gap:8px;">
                <button class="btn sm" style="background:#78350f;color:#fff;" onclick="openMPNoticeForm()">📢 إشعار لأفراد الشرطة العسكرية</button>
                <button class="btn sm" onclick="openMPReportForm('renderMPPanel()')">+ تسجيل تقرير جديد</button>
                <button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button>
            </div>
        </div>
        <div class="tabs">
            <div class="tab active" onclick="mpTabSwitch('members', this)">👤 العساكر</div>
            <div class="tab" onclick="mpTabSwitch('force', this)">🚔 أفراد الشرطة العسكرية</div>
            <div class="tab" onclick="mpTabSwitch('file', this)">📇 عرض ملف عسكري</div>
            <div class="tab" onclick="mpTabSwitch('requests', this)">📣 طلبات الاستدعاء</div>
            <div class="tab" onclick="mpTabSwitch('reports', this)">📄 التقارير</div>
            <div class="tab" onclick="mpTabSwitch('log', this)">📜 لوق القطاعات</div>
            <div class="tab" onclick="mpTabSwitch('promo', this)">🎖️ سجل الترقيات</div>
            <div class="tab" onclick="mpTabSwitch('po', this)">👮 مسؤول الأفراد</div>
        </div>
        <div id="mp-content"></div>\`;
    mpTabSwitch('members');
}
function openMPNoticeForm() {
    if (!ME.mpInfo) return;
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📢 ضع نص الإشعار (سيصل لكل أفراد الشرطة العسكرية المسجلين بالموقع)</h3>
        <textarea id="wf-reason-mp" placeholder="اكتب نص الإشعار هنا..."></textarea>
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitMPNoticeForm()">إرسال لأفراد الشرطة العسكرية</button>
        </div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function submitMPNoticeForm() {
    const reason = document.getElementById('wf-reason-mp').value;
    if (!reason || !reason.trim()) return toast('لازم تكتب النص');
    if (!(await confirmModal('متأكد تبي ترسل هذا الإشعار لكل أفراد الشرطة العسكرية؟'))) return;
    try {
        const { count } = await api('/api/mp/notice-all', { method: 'POST', body: JSON.stringify({ reason }) });
        toast('✅ تم الإرسال لـ ' + count + ' عضو');
        closeWarnForm();
    } catch (e) { toast(e.message); }
}
async function loadMPForceMembers() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/force-members'); }
    catch (e) { if (mpTab !== 'force') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'force') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد أفراد شرطة عسكرية مسجلين بعد</div>'; return; }
    box.innerHTML = data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div><b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span></div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openNoteForm('\${p.discord}','/api/mp/personnel/','loadMPForceMembers()')">📝 ملاحظة</button>
                    <button class="btn sm" style="background:#7f1d1d;color:#fff;" onclick="openWarnForm('\${p.discord}','/api/mp/personnel/')">⚠️ تحذير</button>
                </div>
            </div>
        </div>\`).join('');
}
function mpTabSwitch(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    mpTab = name;
    if (name === 'members') loadMPMembers();
    if (name === 'force') loadMPForceMembers();
    if (name === 'file') renderMPFileSearch();
    if (name === 'requests') loadMPSummonRequests();
    if (name === 'reports') loadMPReports();
    if (name === 'log') loadMPSectorLog();
    if (name === 'promo') loadMPPromotionLog();
    if (name === 'po') loadMPPOBox();
}
let mpLeaderListCache = [];
async function loadMPMembers() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = \`<div class="card"><input id="mp-leader-search" placeholder="بحث بالاسم / اليونت / الرتبة / رقم البطاقة" onkeyup="if(event.key==='Enter') filterMPLeaderMembers();"><button class="btn sm" onclick="filterMPLeaderMembers()">بحث</button></div><div id="mp-leader-results"><div class="card">جارِ التحميل...</div></div>\`;
    let data;
    try { data = await api('/api/mp/members'); }
    catch (e) {
        if (mpTab !== 'members') return;
        document.getElementById('mp-leader-results').innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (mpTab !== 'members') return;
    mpLeaderListCache = data.list;
    renderMPLeaderMembersList(mpLeaderListCache);
}
function filterMPLeaderMembers() {
    const input = document.getElementById('mp-leader-search');
    const q = input ? input.value.trim() : '';
    if (!q) return renderMPLeaderMembersList(mpLeaderListCache);
    const filtered = mpLeaderListCache.filter(p =>
        (p.registeredName || p.discordTag || '').includes(q) ||
        (p.unit || '').includes(q) ||
        (p.rank || '').includes(q) ||
        (p.cardNumber || '').includes(q)
    );
    renderMPLeaderMembersList(filtered);
}
function renderMPLeaderMembersList(list) {
    cardRemember(list);
    const box = document.getElementById('mp-leader-results');
    if (!box) return;
    if (list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد نتائج</div>'; return; }
    box.innerHTML = list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    \${p.summon && p.summon.status === 'approved' ? \`<div style="color:#f59e0b;font-size:12px;margin-top:3px;">📣 عليه استدعاء نشط — \${p.summon.timeLabel || ''}\${p.summon.enteredAt ? ' (دخل الاستدعاء)' : ''}</div>\` : ''}
                    \${p.summon && p.summon.status === 'pending' ? '<div style="color:#fbbf24;font-size:12px;margin-top:3px;">⏳ طلب استدعاء بانتظار قبولك</div>' : ''}
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openCardModal('\${p.discord}')">🪪 البطاقة</button>
                    <button class="btn sm gray" onclick="openNoteForm('\${p.discord}','/api/mp/personnel/','loadMPMembers()')">📝 ملاحظة</button>
                    <button class="btn sm" style="background:#7f1d1d;color:#fff;" onclick="openWarnForm('\${p.discord}','/api/mp/personnel/')">⚠️ تحذير</button>
                    \${(!p.summon || p.summon.status === 'none') ? \`<button class="btn sm" onclick="openSummonForm('\${p.discord}','/api/mp/personnel/','loadMPMembers()')">📣 استدعاء</button>\` : ''}
                    \${p.summon && p.summon.status === 'approved' ? \`<button class="btn sm danger" onclick="mpStopSummon('\${p.discord}')">✅ إنهاء الاستدعاء</button>\` : ''}
                </div>
            </div>
        </div>\`).join('');
}
function mpStopSummon(discord) {
    api('/api/mp/personnel/' + discord + '/summon/stop', { method: 'POST' })
        .then(() => { toast('✅ تم إنهاء الاستدعاء'); loadMPMembers(); }).catch(e => toast(e.message));
}
function renderMPFileSearch() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <input id="mp-file-search" placeholder="🔍 ابحث بالاسم / اليونت / رقم البطاقة..." oninput="filterMPFileSearch()">
            <div id="mp-file-results"></div>
        </div>
        <div id="mp-file-view"></div>\`;
    if (mpLeaderListCache.length === 0) {
        api('/api/mp/members').then(d => { mpLeaderListCache = d.list; }).catch(() => {});
    }
}
function filterMPFileSearch() {
    const q = document.getElementById('mp-file-search').value.trim().toLowerCase();
    const box = document.getElementById('mp-file-results');
    if (!q) { box.innerHTML = ''; return; }
    const matches = mpLeaderListCache.filter(p => (p.registeredName || '').toLowerCase().includes(q) || (p.discordTag || '').toLowerCase().includes(q) || (p.unit || '').toLowerCase().includes(q) || (p.rank || '').toLowerCase().includes(q) || (p.cardNumber || '').includes(q));
    box.innerHTML = matches.map(p => \`
        <div class="card" style="padding:8px 12px;margin-top:6px;">
            <div class="row">
                <span>\${p.registeredName || p.discordTag} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'})</span></span>
                <button class="btn sm" onclick="viewMPFile('\${p.discord}')">عرض الملف</button>
            </div>
        </div>\`).join('') || '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>';
}
async function viewMPFile(discord) {
    const box = document.getElementById('mp-file-view');
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    try {
        const { personnel: p, progress } = await api('/api/mp/personnel/' + discord);
        box.innerHTML = \`
            <div style="margin-top:16px;">\${cardBlock(p, { hasProgress: !!progress, nextRank: progress && progress.nextRank, remaining: progress && progress.remaining })}</div>
            <div class="id-card" style="margin-top:16px;">
                <div class="center" style="font-size:18px;font-weight:bold;color:var(--gold-soft);">\${p.registeredName || p.discordTag}</div>
                <div class="center" style="font-size:12px;color:var(--muted);margin-bottom:10px;">ملف عسكري كامل</div>
                <table>
                    <tr><td>اليونت</td><td>\${p.unit || '-'}</td></tr>
                    <tr><td>الرتبة</td><td>\${p.rank}</td></tr>
                    <tr><td>النقاط</td><td>\${p.points}</td></tr>
                    <tr><td>متبقي للترقية</td><td>\${progress.nextRank ? (progress.remaining + ' نقطة (' + progress.nextRank + ')') : 'وصل لأعلى رتبة'}</td></tr>
                    <tr><td>الحالة</td><td>\${p.isBlocked ? 'موقوف' : 'فعّال'}</td></tr>
                    \${p.summon && p.summon.status !== 'none' ? \`<tr><td>الاستدعاء</td><td>\${p.summon.status === 'approved' ? '📣 نشط — ' + (p.summon.timeLabel || '') : '⏳ طلب معلّق'}</td></tr>\` : ''}
                </table>
                \${p.notes && p.notes.length ? '<div style="margin-top:10px;font-size:13px;color:var(--gold-soft);">الملاحظات:</div>' +
                    p.notes.map(n => \`<div style="background:rgba(5,15,10,0.6);padding:8px;border-radius:8px;margin-top:6px;font-size:13px;">\${n.text}\${(n.image || (n.imageChannelId && n.imageMessageId)) ? \`<button class="btn sm gray" style="margin-top:6px;" onclick="viewNotePhoto('\${p.discord}','\${n._id}')">📷 عرض الصورة</button>\` : ''}</div>\`).join('') : ''}
            </div>\`;
    } catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">\${e.message}</div>\`; }
}
async function loadMPSummonRequests() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/summon-requests'); }
    catch (e) { if (mpTab !== 'requests') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'requests') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد طلبات استدعاء معلّقة</div>'; return; }
    box.innerHTML = data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.rank}</span>
                    <div style="color:var(--gold-soft);margin-top:4px;">🕒 \${p.summon.timeLabel}</div>
                </div>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="mpSummonReqDecide('\${p.discord}','approve')">قبول</button>
                    <button class="btn danger sm" onclick="mpSummonReqDecide('\${p.discord}','reject')">رفض</button>
                </div>
            </div>
        </div>\`).join('');
}
function mpSummonReqDecide(discord, action) {
    api('/api/mp/summon-requests/' + discord + '/' + action, { method: 'POST' })
        .then(() => { toast(action === 'approve' ? '✅ تم قبول الاستدعاء' : 'تم رفض الطلب'); loadMPSummonRequests(); })
        .catch(e => toast(e.message));
}
function renderMPReportCard(r, decideFn, isLeaderView) {
    const statusBadge = r.status === 'approved' ? '<span style="color:#4ade80;font-size:12px;">✅ مقبول</span>'
        : r.status === 'rejected' ? '<span style="color:#f87171;font-size:12px;">❌ مرفوض</span>'
        : '<span style="color:#fbbf24;font-size:12px;">⏳ معلّق</span>';
    let actions = '';
    if (r.status === 'pending') {
        actions = \`
            <button class="btn sm" onclick="\${decideFn}('\${r._id}','approve')">قبول التقرير</button>
            <button class="btn danger sm" onclick="\${decideFn}('\${r._id}','reject')">رفض</button>\`;
    } else if (isLeaderView && r.status === 'approved') {
        actions = \`<button class="btn danger sm" onclick="mpDeleteReport('\${r._id}')">🗑️ حذف نهائي</button>\`;
    } else if (isLeaderView && r.status === 'rejected') {
        actions = \`
            <button class="btn sm" onclick="\${decideFn}('\${r._id}','approve')">قبول مباشر</button>
            <button class="btn danger sm" onclick="mpDeleteReport('\${r._id}')">🗑️ حذف نهائي</button>\`;
        if (r.rejectReason) actions = \`<div style="color:var(--muted);font-size:12px;margin-bottom:8px;">سبب الرفض: \${r.rejectReason}</div>\` + actions;
    }
    return \`
        <div class="card">
            <div class="row"><b>\${r.reporterName}</b> \${statusBadge}</div>
            <span style="color:var(--muted);font-size:12px;">(\${r.reporterRank})</span>
            <div style="margin-top:6px;color:var(--gold-soft);">1) وش سوى بالاستلام:</div>
            <div style="font-size:13px;margin-top:2px;">\${r.dutyReport}</div>
            <div style="margin-top:8px;color:var(--gold-soft);">2) عدد الجولات/الدوريات: <span style="color:#fff;">\${r.patrolsCount || 0}</span></div>
            <div style="margin-top:4px;color:var(--gold-soft);">3) عدد الاستدعاءات المنفّذة: <span style="color:#fff;">\${r.summonsCount || 0}</span></div>
            \${r.incidents ? \`<div style="margin-top:8px;color:var(--gold-soft);">4) مخالفات/حالات مشبوهة:</div><div style="font-size:13px;margin-top:2px;">\${r.incidents}</div>\` : ''}
            \${r.notesIssued && r.notesIssued.length ? \`<div style="margin-top:8px;color:var(--gold-soft);">5) الملاحظات/التحذيرات المسجّلة (\${r.notesIssued.length}):</div>\` + r.notesIssued.map(n => \`<div style="font-size:12px;color:var(--muted);margin-top:3px;">• \${n.name || n.tag} (\${n.kind === 'warning' ? 'تحذير' : 'ملاحظة'}) — \${n.reason}</div>\`).join('') : ''}
            \${r.generalNotes ? \`<div style="margin-top:8px;color:var(--gold-soft);">6) ملاحظات عامة:</div><div style="font-size:13px;margin-top:2px;">\${r.generalNotes}</div>\` : ''}
            <div class="row" style="gap:8px;margin-top:10px;">\${actions}</div>
        </div>\`;
}
async function loadMPReports() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/reports/all'); }
    catch (e) { if (mpTab !== 'reports') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'reports') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد تقارير بعد</div>'; return; }
    box.innerHTML = data.list.map(r => renderMPReportCard(r, 'mpReportDecide', true)).join('');
}
async function mpDeleteReport(id) {
    if (!(await confirmModal('متأكد تبي تحذف هذا التقرير نهائياً؟ ما يرجع بعدها.'))) return;
    api('/api/mp/reports/' + id, { method: 'DELETE' })
        .then(() => { toast('🗑️ تم الحذف نهائياً'); loadMPReports(); }).catch(e => toast(e.message));
}
async function mpReportDecide(id, action) {
    if (action === 'reject') {
        const reason = await promptModal('اكتب سبب الرفض:');
        if (reason === null) return;
        if (!reason.trim()) return toast('لازم تكتب سبب');
        api('/api/mp/reports/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
            .then(() => { toast('تم الرفض'); loadMPReports(); }).catch(e => toast(e.message));
        return;
    }
    api('/api/mp/reports/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('✅ تم قبول التقرير'); loadMPReports(); }).catch(e => toast(e.message));
}
async function loadMPSectorLog() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/sector-log'); }
    catch (e) { if (mpTab !== 'log') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'log') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد أحداث بعد</div>'; return; }
    box.innerHTML = data.list.map(l => \`
        <div class="card" style="padding:10px 14px;">
            <div style="font-size:13px;"><b>\${l.action}</b> — \${l.actorTag || '-'}</div>
            \${l.discordTag ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">على: \${l.discordTag}</div>\` : ''}
            \${l.details ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">\${l.details}</div>\` : ''}
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">\${new Date(l.createdAt).toLocaleString('ar')}</div>
        </div>\`).join('');
}
async function loadMPPromotionLog() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/promotion-log'); }
    catch (e) { if (mpTab !== 'promo') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'promo') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد طلبات ترقية/تنزيل بعد</div>'; return; }
    box.innerHTML = data.list.map(r => {
        const statusLabel = r.status === 'pending' ? '⏳ قيد المراجعة' : r.status === 'approved' ? '✅ مقبولة' : '❌ مرفوضة';
        const statusColor = r.status === 'pending' ? '#fbbf24' : r.status === 'approved' ? '#4ade80' : '#f87171';
        return \`
        <div class="card" style="padding:10px 14px;">
            <div style="font-size:13px;"><b>\${r.direction === 'up' ? '⬆️ ترقية' : '⬇️ تنزيل'}: \${r.targetName || r.targetTag}</b> — \${r.fromRank} ← \${r.toRank}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">القطاع: \${r.sectorLabel} — قدّمه: \${r.requestedByTag || '-'}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">وقت التقديم: \${new Date(r.createdAt).toLocaleString('ar')}</div>
            \${r.reason ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">السبب: \${r.reason}</div>\` : ''}
            <div style="font-size:12px;margin-top:4px;color:\${statusColor};font-weight:bold;">\${statusLabel}</div>
            \${r.status !== 'pending' ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">راجعه: \${r.reviewedByTag || '-'} — \${r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('ar') : '-'}</div>\` : ''}
            \${r.status === 'rejected' && r.rejectReason ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">سبب الرفض: \${r.rejectReason}</div>\` : ''}
        </div>\`;
    }).join('');
}
async function loadMPPOBox() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = \`<div class="card"><h3>👮 مسؤول أفراد الشرطة العسكرية</h3><div id="mp-po-current">جارِ التحميل...</div><input id="mp-po-search" placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchMPPOCandidate(this.value)"><div id="mp-po-cands"></div></div>\`;
    try {
        const { mpLeadership } = await api('/api/senior/mp/leadership').catch(() => ({ mpLeadership: null }));
        const cur = mpLeadership || {};
        document.getElementById('mp-po-current').innerHTML = \`الحالي: <b style="color:\${cur.personnelOfficerName ? '#4ade80' : 'var(--muted)'};">\${cur.personnelOfficerName || 'غير معيّن'}</b> \${cur.personnelOfficerName ? '<button class="btn danger sm" onclick="mpRemovePO()">إزالة</button>' : ''}\`;
    } catch (e) { document.getElementById('mp-po-current').innerHTML = '—'; }
}
let mpPoSearchTimer = null;
function searchMPPOCandidate(q) {
    clearTimeout(mpPoSearchTimer);
    mpPoSearchTimer = setTimeout(async () => {
        const box = document.getElementById('mp-po-cands');
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/mp/members', { noLock: true });
            const filtered = list.filter(p => p.registeredName && p.registeredName.includes(q));
            if (filtered.length === 0) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = filtered.slice(0, 15).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="mpAssignPO('\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
    }, 350);
}
function mpAssignPO(discordId) {
    api('/api/mp/personnel-officer/assign', { method: 'POST', body: JSON.stringify({ discordId }) })
        .then(() => { toast('تم التعيين'); loadMPPOBox(); }).catch(e => toast(e.message));
}
async function mpRemovePO() {
    if (!(await confirmModal('متأكد تبي تزيله من منصب مسؤول الأفراد؟'))) return;
    api('/api/mp/personnel-officer/remove', { method: 'POST' })
        .then(() => { toast('تم'); loadMPPOBox(); }).catch(e => toast(e.message));
}

let mpPoTab = 'members';
function renderMPPOPanel() {
    if (!ME.mpPersonnelOfficer && !ME.isSeniorAdmin) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>👮 مسؤول أفراد الشرطة العسكرية</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        <div class="card" style="color:var(--muted);font-size:13px;">صلاحيتك تشمل أعضاء الشرطة العسكرية ما عدا القائد والنائب.</div>
        <div class="tabs">
            <div class="tab active" onclick="mpPoTabSwitch('members', this)">الأعضاء</div>
            <div class="tab" onclick="mpPoTabSwitch('reports', this)">التقارير</div>
        </div>
        <div id="mp-po-content"></div>\`;
    mpPoTabSwitch('members');
}
function mpPoTabSwitch(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    mpPoTab = name;
    if (name === 'members') loadMPPOMembers();
    if (name === 'reports') loadMPPOReports();
}
async function loadMPPOMembers() {
    const box = document.getElementById('mp-po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/po/members'); }
    catch (e) { if (mpPoTab !== 'members') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpPoTab !== 'members') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد أعضاء حالياً</div>'; return; }
    box.innerHTML = data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div><b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span></div>
                <button class="btn sm gray" onclick="openNoteForm('\${p.discord}','/api/mp/po/personnel/','loadMPPOMembers()')">📝 ملاحظة</button>
            </div>
        </div>\`).join('');
}
async function loadMPPOReports() {
    const box = document.getElementById('mp-po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/po/reports/pending'); }
    catch (e) { if (mpPoTab !== 'reports') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpPoTab !== 'reports') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد تقارير معلّقة</div>'; return; }
    box.innerHTML = data.list.map(r => renderMPReportCard(r, 'mpPoReportDecide')).join('');
}
async function mpPoReportDecide(id, action) {
    if (action === 'reject') {
        const reason = await promptModal('اكتب سبب الرفض:');
        if (reason === null) return;
        if (!reason.trim()) return toast('لازم تكتب سبب');
        api('/api/mp/po/reports/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
            .then(() => { toast('تم الرفض'); loadMPPOReports(); }).catch(e => toast(e.message));
        return;
    }
    api('/api/mp/po/reports/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('✅ تم قبول التقرير'); loadMPPOReports(); }).catch(e => toast(e.message));
}

let mpMemberTab = 'members';
let mpMemberListCache = [];
function renderMPMemberPanel() {
    if (!ME.isMilitaryPolice) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🚔 الشرطة العسكرية</h2>
            <div class="row" style="gap:8px;">
                <button class="btn sm" onclick="openMPReportForm('renderMPMemberPanel()')">+ تسجيل تقرير جديد</button>
                <button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button>
            </div>
        </div>
        <div class="card"><input id="mp-member-search" placeholder="بحث بالاسم / اليونت / الرتبة / رقم البطاقة" onkeyup="if(event.key==='Enter') filterMPMemberList();"><button class="btn sm" onclick="filterMPMemberList()">بحث</button></div>
        <div id="mp-member-content"><div class="card">جارِ التحميل...</div></div>\`;
    loadMPMemberMembers();
}
async function loadMPMemberMembers() {
    const box = document.getElementById('mp-member-content');
    if (!box) return;
    let data;
    try { data = await api('/api/mp/members'); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    mpMemberListCache = data.list;
    renderMPMemberList(mpMemberListCache);
}
function filterMPMemberList() {
    const input = document.getElementById('mp-member-search');
    const q = input ? input.value.trim() : '';
    if (!q) return renderMPMemberList(mpMemberListCache);
    const filtered = mpMemberListCache.filter(p =>
        (p.registeredName || p.discordTag || '').includes(q) ||
        (p.unit || '').includes(q) ||
        (p.rank || '').includes(q) ||
        (p.cardNumber || '').includes(q)
    );
    renderMPMemberList(filtered);
}
function renderMPMemberList(list) {
    cardRemember(list);
    const box = document.getElementById('mp-member-content');
    if (!box) return;
    if (list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد نتائج</div>'; return; }
    box.innerHTML = list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    \${p.summon && p.summon.status === 'approved' ? '<div style="color:#f59e0b;font-size:12px;margin-top:3px;">📣 عليه استدعاء نشط</div>' : ''}
                    \${p.summon && p.summon.status === 'pending' ? '<div style="color:#fbbf24;font-size:12px;margin-top:3px;">⏳ في طلب استدعاء بانتظار القيادة</div>' : ''}
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openCardModal('\${p.discord}')">🪪 البطاقة</button>
                    <button class="btn sm gray" onclick="openNoteForm('\${p.discord}','/api/mp/personnel/','loadMPMemberMembers()')">📝 ملاحظة</button>
                    \${(!p.summon || p.summon.status === 'none') ? \`<button class="btn sm" onclick="openSummonForm('\${p.discord}','/api/mp/personnel/','loadMPMemberMembers()')">📣 طلب استدعاء</button>\` : ''}
                </div>
            </div>
        </div>\`).join('');
}
let mpReportNotes = [];
let mpReportReturnFn = 'renderMPMemberPanel()';
function openMPReportForm(returnFn) {
    mpReportNotes = [];
    mpReportReturnFn = returnFn || 'renderMPMemberPanel()';
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>📝 تسجيل تقرير شرطة عسكرية</h2><button class="btn gray sm" onclick="\${mpReportReturnFn}">رجوع</button></div>
        <div class="card">
            <label>1) وش سويت بالاستلام؟</label>
            <textarea id="mpr-duty" placeholder="اكتب وش سويت خلال الاستلام..."></textarea>
        </div>
        <div class="card">
            <label>2) كم عدد الجولات/الدوريات اللي سويتها خلال الشفت؟</label>
            <input type="number" id="mpr-patrols" min="0" placeholder="0">
        </div>
        <div class="card">
            <label>3) كم عدد الاستدعاءات اللي نفّذتها خلال الشفت؟</label>
            <input type="number" id="mpr-summons" min="0" placeholder="0">
        </div>
        <div class="card">
            <label>4) هل واجهتك أي مخالفات أمنية أو حالات مشبوهة؟ اذكرها</label>
            <textarea id="mpr-incidents" placeholder="اكتب التفاصيل، أو اترك فاضي إذا ما فيه"></textarea>
        </div>
        <div class="card">
            <div class="row"><h3>5) العساكر اللي عطيتهم ملاحظة/تحذير خلال الشفت</h3><button class="btn sm gray" onclick="addMPReportNoteRow()">+ إضافة</button></div>
            <div id="mpr-notes-list"></div>
        </div>
        <div class="card">
            <label>6) ملاحظات أو توصيات عامة</label>
            <textarea id="mpr-general" placeholder="أي شي تشوفه مهم تذكره..."></textarea>
        </div>
        <div class="card"><button class="btn" onclick="submitMPReport()">إرسال التقرير</button></div>\`;
}
function addMPReportNoteRow() {
    const i = mpReportNotes.length;
    mpReportNotes.push({ discord: '', tag: '', name: '', kind: 'note', reason: '' });
    renderMPReportNotesList();
}
function renderMPReportNotesList() {
    const box = document.getElementById('mpr-notes-list');
    if (!box) return;
    box.innerHTML = mpReportNotes.map((n, i) => \`
        <div class="card" style="margin-top:8px;padding:10px 14px;">
            <div class="row" style="gap:6px;">
                <input placeholder="اسم/آيدي العسكري" value="\${n.name}" oninput="mpReportNotes[\${i}].name=this.value" style="flex:2;">
                \${csHtml('mpk-' + i, [['note', 'ملاحظة'], ['warning', 'تحذير']], n.kind, { style: 'flex:1;margin-bottom:0;', onpick: 'mpReportNotes[' + i + '].kind=value' })}
                <button class="btn danger sm" onclick="removeMPReportNoteRow(\${i})">حذف</button>
            </div>
            <textarea placeholder="السبب" oninput="mpReportNotes[\${i}].reason=this.value" style="margin-top:6px;">\${n.reason}</textarea>
        </div>\`).join('');
}
function removeMPReportNoteRow(i) {
    mpReportNotes.splice(i, 1);
    renderMPReportNotesList();
}
async function submitMPReport() {
    const dutyReport = document.getElementById('mpr-duty').value;
    if (!dutyReport || !dutyReport.trim()) return toast('اكتب وش سويت بالاستلام');
    const body = {
        dutyReport,
        patrolsCount: document.getElementById('mpr-patrols').value,
        summonsCount: document.getElementById('mpr-summons').value,
        incidents: document.getElementById('mpr-incidents').value,
        notesIssued: mpReportNotes,
        generalNotes: document.getElementById('mpr-general').value,
    };
    try {
        const r = await api('/api/mp/reports/submit', { method: 'POST', body: JSON.stringify(body) });
        toast(r.report && r.report.status === 'approved' ? '✅ تم قبول تقريرك' : '✅ تم إرسال التقرير للمراجعة');
        Function(mpReportReturnFn)();
    } catch (e) { toast(e.message); }
}

function checkSummonGate() {
    if (!ME || !ME.summon || ME.summon.status !== 'approved') return false;
    const box = document.getElementById('app');
    const locked = ME.summon.unlockAt && new Date(ME.summon.unlockAt).getTime() > Date.now();
    if (ME.summon.enteredAt) {
        box.innerHTML = \`
            <div class="card center" style="margin-top:60px;border-color:#f59e0b;">
                <h2 style="color:#f59e0b;">⏳ بانتظار إنهاء الاستدعاء</h2>
                <p style="color:var(--muted);margin-top:8px;">دخلت الاستدعاء — ما تقدر تستخدم الموقع لين تنهي قيادة الشرطة العسكرية الاستدعاء.</p>
                <div class="row" style="gap:8px;margin-top:16px;justify-content:center;">
                    <button class="btn gray sm" onclick="window.open('${CONFIG.MP_SUMMON_VOICE_URL}','_blank')">🚪 فتح الروم مرة ثانية</button>
                    <button class="btn sm" onclick="init()">🔄 تحديث</button>
                </div>
            </div>\`;
    } else {
        box.innerHTML = \`
            <div class="card center" style="margin-top:60px;border-color:#f59e0b;">
                <h2 style="color:#f59e0b;">📣 لديك استدعاء</h2>
                <p style="color:var(--muted);margin-top:8px;">استدعاء من الشرطة العسكرية — \${ME.summon.timeLabel || 'الآن'}</p>
                \${locked
                    ? \`<button class="btn gray" style="margin-top:16px;" onclick="toast('الروم بيفتح الساعة \${ME.summon.timeLabel}')">🔒 دخول الاستدعاء</button>\`
                    : \`<button class="btn" style="margin-top:16px;" onclick="enterSummon()">🚪 دخول الاستدعاء</button>\`}
            </div>\`;
    }
    document.getElementById('nav-links').innerHTML = '';
    document.getElementById('mobile-menu').innerHTML = '';
    return true;
}
async function enterSummon() {
    try {
        const r = await api('/api/summon/enter', { method: 'POST' });
        window.open(r.url, '_blank');
        toast('✅ تفضل ادخل الروم');
        ME.summon.enteredAt = new Date().toISOString();
        checkSummonGate();
    } catch (e) {
        toast(e.message);
    }
}

async function loadPersonnel() {
    const box = document.getElementById('admin-content');
    box.innerHTML = \`<div class="card row"><h3 style="margin:0;">الحسابات</h3><button class="btn sm" style="background:#78350f;color:#fff;" onclick="openWarnAllForm()">📢 إشعار للجميع</button></div><div class="card"><input id="p-search" placeholder="بحث بالاسم / اليونت / رقم البطاقة" onkeyup="if(event.key==='Enter') searchPersonnel()"><button class="btn sm" onclick="searchPersonnel()">بحث</button></div><div id="p-list"></div>\`;
    searchPersonnel();
}
let personnelCache = [];
async function searchPersonnel() {
    const q = document.getElementById('p-search') ? document.getElementById('p-search').value : '';
    const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q), { noLock: true });
    if (currentAdminTab !== 'personnel') return;
    personnelCache = list;
    cardRemember(list);
    const pListEl = document.getElementById('p-list');
    if (!pListEl) return;
    pListEl.innerHTML = list.map((p, i) => \`
        <div class="card" id="pcard-\${i}">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    <div style="font-size:13px;color:#94a3b8;">النقاط: \${p.points} \${p.isBlocked ? '• 🚫 موقوف' : ''} • رقم البطاقة: \${p.cardNumber || '-'}</div>
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openCardModal('\${p.discord}')">🪪 البطاقة</button>
                    <button class="btn sm gray" onclick="toggleEdit(\${i})">تعديل</button>
                    <button class="btn sm gray" onclick="addNote('\${p.discord}')">ملاحظة</button>
                    <button class="btn sm" style="background:#7f1d1d;color:#fff;" onclick="openWarnForm('\${p.discord}','/api/senior/personnel/')">⚠️ تحذير</button>
                    <button class="btn sm \${p.isBlocked ? '' : 'danger'}" onclick="toggleBlock('\${p.discord}', \${!p.isBlocked})">\${p.isBlocked ? 'إلغاء الإيقاف' : 'إيقاف (بند)'}</button>
                    <button class="btn sm danger" onclick="deletePersonnel('\${p.discord}', '\${(p.registeredName || p.discordTag || '').replace(/'/g, "\\\\'")}')">🗑️ حذف نهائي</button>
                </div>
            </div>
            <div id="pedit-\${i}" class="hidden" style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
                <label>الاسم</label><input id="pe-name-\${i}" value="\${p.registeredName || ''}">
                <label>اليونت</label><input id="pe-unit-\${i}" value="\${p.unit || ''}">
                <label>الرتبة العسكرية</label>
                <div class="cs-wrap">
                    <button type="button" class="cs-trigger" id="pe-rank-\${i}-trigger" onclick="csToggle('pe-rank-\${i}')">\${p.rank}</button>
                    <div class="cs-menu" id="pe-rank-\${i}-menu">\${MILITARY_RANKS.map(r => \`<div class="cs-option \${r === p.rank ? 'selected' : ''}" data-val="\${r}" onclick="csPick('pe-rank-\${i}', '\${r}')">\${r}\${r === p.rank ? ' <span class="cs-check">✓</span>' : ''}</div>\`).join('')}</div>
                </div>
                <input type="hidden" id="pe-rank-\${i}" value="\${p.rank}">
                <label>القطاع</label>\${csHtml('pe-sec-' + i, ACC_SECTORS, p.sector || '')}
                <label>النقاط</label><input type="number" id="pe-points-\${i}" data-original="\${p.points}" value="\${p.points}">
                <button class="btn sm" onclick="saveEdit('\${p.discord}', \${i})">حفظ التعديلات</button>
            </div>
        </div>\`).join('') || '<div class="card center" style="color:var(--muted);">لا نتائج</div>';
}
function toggleEdit(i) {
    document.getElementById('pedit-' + i).classList.toggle('hidden');
}
async function saveEdit(discordId, i) {
    const pointsInput = document.getElementById('pe-points-' + i);
    const pointsChanged = pointsInput.value !== pointsInput.dataset.original;
    const body = {
        name: document.getElementById('pe-name-' + i).value,
        unit: document.getElementById('pe-unit-' + i).value,
        rank: document.getElementById('pe-rank-' + i).value,
        sector: document.getElementById('pe-sec-' + i).value,
        points: pointsChanged ? pointsInput.value : '',
    };
    try {
        await api('/api/senior/personnel/' + discordId + '/update', { method: 'POST', body: JSON.stringify(body) });
        toast('✅ تم حفظ التعديلات');
        searchPersonnel();
    } catch (e) { toast(e.message); }
}
async function deletePersonnel(discordId, displayName) {
    if (!(await confirmModal('متأكد تبي تحذف حساب "' + (displayName || discordId) + '" نهائياً؟ ما يمكن التراجع عن هذا الإجراء.'))) return;
    try {
        await api('/api/senior/personnel/' + discordId, { method: 'DELETE' });
        toast('🗑️ تم حذف الحساب نهائياً');
        searchPersonnel();
    } catch (e) { toast(e.message); }
}
function addNote(discordId) {
    openNoteForm(discordId, '/api/senior/personnel/', 'searchPersonnel()');
}
function toggleBlock(discordId, blocked) {
    api('/api/senior/personnel/' + discordId + '/block', { method: 'POST', body: JSON.stringify({ blocked }) })
        .then(() => { toast('تم التحديث'); searchPersonnel(); }).catch(e => toast(e.message));
}
let newVehiclePhoto = null;
async function loadVehicles() {
    const box = document.getElementById('admin-content');
    box.innerHTML = \`
        <div class="card">
            <h3>إضافة مركبة</h3>
            <label>اسم المركبة</label>
            <input id="veh-name" placeholder="مثال: فورد F150">
            <label>صورة المركبة</label>
            <input type="file" id="veh-photo" accept="image/*" onchange="previewVehiclePhoto()">
            <img id="veh-photo-preview" style="display:none;max-width:160px;border-radius:8px;margin-bottom:10px;">
            <button class="btn sm" onclick="addVehicle()">إضافة</button>
        </div>
        <div id="veh-list" class="vgrid"></div>\`;
    loadVehicleList();
}
function previewVehiclePhoto() {
    const f = document.getElementById('veh-photo').files[0];
    if (!f) return;
    if (f.size > ${CONFIG.MAX_PHOTO_MB} * 1024 * 1024) { toast('الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        newVehiclePhoto = e.target.result;
        const img = document.getElementById('veh-photo-preview');
        img.src = newVehiclePhoto; img.style.display = 'block';
    };
    reader.readAsDataURL(f);
}
async function addVehicle() {
    const name = document.getElementById('veh-name').value.trim();
    if (!name) return toast('حط اسم المركبة');
    try {
        await api('/api/senior/vehicles', { method: 'POST', body: JSON.stringify({ name, photo: newVehiclePhoto }) });
        toast('تمت الإضافة'); newVehiclePhoto = null; loadVehicles();
    } catch (e) { toast(e.message); }
}
async function loadVehicleList() {
    const { list } = await api('/api/senior/vehicles');
    if (currentAdminTab !== 'vehicles') return;
    const box = document.getElementById('veh-list');
    if (!box) return;
    box.innerHTML = list.map(v => \`
        <div class="vcard">
            \${v.photo ? \`<img src="\${v.photo}">\` : ''}
            <div>\${v.name}</div>
            <button class="btn danger sm" style="margin-top:4px;padding:3px 8px;font-size:10px;" onclick="delVehicle('\${v._id}')">حذف</button>
        </div>\`).join('') || '<p style="color:var(--muted);">لا توجد مركبات</p>';
}
function delVehicle(id) {
    api('/api/senior/vehicles/' + id, { method: 'DELETE' }).then(() => { toast('تم الحذف'); loadVehicleList(); });
}
const CARD_LOOKUP = {};
function cardRemember(list) { (list || []).forEach(function (p) { if (p && p.discord) CARD_LOOKUP[p.discord] = p; }); }
function cardEsc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function remainText(nextRank, remaining) {
    return nextRank ? ('متبقي ' + remaining + ' نقطة للوصول إلى رتبة ' + nextRank) : 'وصل لأعلى رتبة';
}
function cardFields(p) {
    const notes = (p.notes || []).map(function (n) { return n.text; }).filter(Boolean);
    return {
        name: p.registeredName || p.discordTag || '-',
        rank: p.rank || '-',
        unit: p.unit || '-',
        sector: (p.sector && SECTOR_LABELS[p.sector]) || '-',
        num: p.cardNumber || '--------',
        points: (p.points === undefined || p.points === null) ? '-' : String(p.points),
        note: p.notes === undefined ? '—' : (notes.length ? notes[notes.length - 1] : 'لا توجد ملاحظات'),
        notes: p.notes === undefined ? '—' : (notes.length ? notes.join(' | ') : 'لا توجد ملاحظات'),
    };
}
const MC_DATA = {};
const MC_OPT = {};
const MC_ROWS = [['name', 'الاسم'], ['rank', 'الرتبة'], ['unit', 'اليونت'], ['num', 'رقم البطاقة'], ['points', 'النقاط'], ['sector', 'القطاع'], ['notes', 'الملاحظات']];
function mcFace(f) {
    return '<div class="mc-face">' +
        '<div class="mc-t name" data-k="name">' + cardEsc(f.name) + '</div>' +
        '<div class="mc-t rank" data-k="rank">' + cardEsc(f.rank) + '</div>' +
        '<div class="mc-t unit" data-k="unit">' + cardEsc(f.unit) + '</div>' +
        '<div class="mc-t sector" data-k="sector">' + cardEsc(f.sector) + '</div>' +
        '<div class="mc-t num" data-k="num">' + cardEsc(f.num) + '</div>' +
    '</div>';
}
function cardBlock(p, o) {
    o = o || {};
    const id = o.id || ('mc' + Math.random().toString(36).slice(2, 8));
    MC_DATA[id] = p; MC_OPT[id] = o;
    const f = cardFields(p);
    const remain = o.hasProgress
        ? '<div class="mc-remain"' + (o.remainId ? ' id="' + o.remainId + '"' : '') + '>' + remainText(o.nextRank, o.remaining) + '</div>'
        : '';
    const eye = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3.2"/></svg>';
    return '<div class="mc-wrap" id="' + id + '" data-mc="' + id + '">' +
        '<div class="mcard locked" onclick="mcTap(this)">' +
            mcFace(f) +
            '<div class="mc-cover">' + eye + '<span>عرض البطاقة</span></div>' +
        '</div>' + remain +
        '<div class="mc-hint">اضغط على البطاقة لعرضها كاملة ⤢</div>' +
    '</div>';
}
function mcTap(el) {
    const w = el.closest('.mc-wrap');
    if (!w) return;
    const id = w.getAttribute('data-mc');
    if (el.closest('#mc-page')) { openMcFull(id); return; }
    const card = w.querySelector('.mcard');
    card.classList.remove('locked');
    w.classList.add('unlocked');
    openMcPage(id);
}
function mcHideCard() { closeMcPage(); }
function mcInfoHtml(id) {
    const p = MC_DATA[id]; const o = MC_OPT[id] || {};
    const f = cardFields(p);
    let info = '';
    MC_ROWS.forEach(function (r) {
        info += '<div class="mc-row"><div class="mc-row-top"><span>' + r[1] + '</span><button class="mc-copy" onclick="mcCopy(this)">📋 نسخ</button></div><b data-k="' + r[0] + '">' + cardEsc(f[r[0]]) + '</b></div>';
    });
    const remain = o.hasProgress ? '<div class="mc-remain">' + remainText(o.nextRank, o.remaining) + '</div>' : '';
    return '<div class="mc-wrap unlocked" data-mc="' + id + '">' +
        '<div class="mcard" onclick="mcTap(this)">' + mcFace(f) + '</div>' +
        '<div class="mc-hint">اضغط على البطاقة لعرضها كاملة ⤢</div>' + remain +
        '<div class="mc-info open">' + info +
            '<div class="row" style="gap:8px;margin-top:4px;">' +
                '<button class="btn gray sm" onclick="mcHideCard()">🙈 إخفاء البطاقة</button>' +
                '<button class="btn sm" onclick="mcCopyAll(this)">📋 نسخ كل المعلومات</button>' +
            '</div>' +
        '</div></div>';
}
function openMcPage(id) {
    if (!MC_DATA[id]) return;
    const pg = document.getElementById('mc-page');
    document.getElementById('mc-page-body').innerHTML = mcInfoHtml(id);
    pg.setAttribute('data-src', id);
    if (!pg.classList.contains('open')) {
        pg.classList.add('open');
        history.pushState({ mcPage: true }, '');
    }
}
function closeMcPage(skipHistory) {
    const pg = document.getElementById('mc-page');
    if (!pg.classList.contains('open')) return;
    const id = pg.getAttribute('data-src');
    pg.classList.remove('open');
    pg.removeAttribute('data-src');
    document.getElementById('mc-page-body').innerHTML = '';
    const w = id ? document.getElementById(id) : null;
    if (w) {
        const card = w.querySelector('.mcard');
        if (card) card.classList.add('locked');
        w.classList.remove('unlocked');
    }
    if (!skipHistory && history.state && history.state.mcPage) history.back();
}
function openMcFull(id) {
    const p = MC_DATA[id];
    if (!p) return;
    const box = document.getElementById('mc-full-card');
    box.innerHTML = '<div class="mcard">' + mcFace(cardFields(p)) + '</div>';
    document.getElementById('mc-full').classList.add('open');
    history.pushState({ mcFull: true }, '');
}
function closeMcFull(skipHistory) {
    const fl = document.getElementById('mc-full');
    if (!fl.classList.contains('open')) return;
    fl.classList.remove('open');
    document.getElementById('mc-full-card').innerHTML = '';
    if (!skipHistory && history.state && history.state.mcFull) history.back();
}
window.addEventListener('popstate', function (e) {
    const st = e.state || {};
    if (!st.mcFull) closeMcFull(true);
    if (!st.mcFull && !st.mcPage) closeMcPage(true);
});
function mcFallbackCopy(txt) {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
}
function mcCopyText(txt) {
    const done = function () { toast('تم النسخ ✅'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(done).catch(function () { mcFallbackCopy(txt); done(); });
    } else { mcFallbackCopy(txt); done(); }
}
function mcCopy(btn) { mcCopyText(btn.closest('.mc-row').querySelector('b').textContent); }
function mcCopyAll(btn) {
    const info = btn.closest('.mc-info');
    const lines = [];
    info.querySelectorAll('.mc-row').forEach(function (r) {
        lines.push(r.querySelector('span').textContent + ': ' + r.querySelector('b').textContent);
    });
    mcCopyText(lines.join(String.fromCharCode(10)));
}
function cardUpdate(rootId, p) {
    MC_DATA[rootId] = p;
    const f = cardFields(p);
    const roots = [document.getElementById(rootId)];
    const pg = document.getElementById('mc-page');
    if (pg && pg.classList.contains('open') && pg.getAttribute('data-src') === rootId) roots.push(pg);
    roots.forEach(function (root) {
        if (!root) return;
        root.querySelectorAll('[data-k]').forEach(function (n) {
            const k = n.getAttribute('data-k');
            if (f[k] !== undefined) n.textContent = f[k];
        });
    });
}
function closeCardModal() { const o = document.getElementById('mc-modal-ov'); if (o) o.remove(); }
function openCardModal(discord) {
    const p = CARD_LOOKUP[discord];
    if (!p) return toast('تعذر عرض البطاقة');
    closeCardModal();
    const ov = document.createElement('div');
    ov.id = 'mc-modal-ov'; ov.className = 'acc-ov';
    ov.innerHTML = '<div class="mc-modal">' + cardBlock(p, {}) +
        '<div class="center" style="margin-top:14px;"><button class="btn gray sm" onclick="closeCardModal()">إغلاق</button></div></div>';
    document.body.appendChild(ov);
    ov.onclick = function (e) { if (e.target === ov) closeCardModal(); };
}
let logClearAvail = false;
function renderLogClearBox() {
    const b = document.getElementById('log-clear-box');
    if (!b) return;
    b.innerHTML = logClearAvail
        ? '<div class="card row" style="border-color:#7f1d1d;"><div><b style="color:#f87171;">🗑️ حذف اللوق الشامل</b><div style="font-size:12px;color:var(--muted);margin-top:3px;">يشتغل مرة وحدة بس، وبعدها الزر يختفي.</div></div><button class="btn danger sm" onclick="clearAllLogs()">حذف اللوق</button></div>'
        : '';
}
async function clearAllLogs() {
    if (!(await confirmModal('⚠️ بيتحذف كل اللوق الشامل نهائياً، والزر ما يرجع بعدها. متأكد؟'))) return;
    try {
        await api('/api/senior/log/clear', { method: 'POST' });
        toast('تم حذف اللوق الشامل');
        logClearAvail = false; lastLogId = null; allLogsData = [];
        loadLog();
    } catch (e) { toast(e.message); }
}
let accView_ = 'approved';
let ACC_LIST = [];
const ACC_SECTORS = [['', 'بدون قطاع'], ['patrol', 'الدوريات'], ['roadSecurity', 'أمن الطرق'], ['antiDrugs', 'مكافحة المخدرات']];
function accEsc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function accSectorLabel(k) {
    for (let i = 0; i < ACC_SECTORS.length; i++) if (ACC_SECTORS[i][0] === (k || '')) return ACC_SECTORS[i][1];
    return 'بدون قطاع';
}
function accYN(v) { return v ? '✅ نعم' : '❌ لا'; }
function accRow(label, val) { return '<div class="acc-row"><span>' + label + '</span><b>' + accEsc(val) + '</b></div>'; }
function accPwRow(pw) {
    return '<div class="acc-row"><span>كلمة المرور</span><b class="acc-pw" data-pw="' + accEsc(pw || '') + '" data-shown="0" onclick="togglePw(this)">•••••••• 👁</b></div>';
}
function togglePw(el) {
    if (el.dataset.shown === '1') { el.textContent = '•••••••• 👁'; el.dataset.shown = '0'; }
    else { el.textContent = el.dataset.pw || '(غير متاح)'; el.dataset.shown = '1'; }
}
async function loadRegs() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/admin/registrations')); }
    catch (e) { box.innerHTML = '<div class="card" style="color:#f87171;">تعذر التحميل (' + accEsc(e.message) + ')</div>'; return; }
    if (currentAdminTab !== 'regs') return;
    if (!list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد طلبات تسجيل جديدة</div>'; return; }
    box.innerHTML = list.map(function (a) {
        return '<div class="card acc-card">' +
            '<div class="acc-title">' + accEsc(a.fullName) + '</div>' +
            accRow('العمر', a.age) + accRow('الجنسية', a.nationality) + accRow('البريد', a.email) + accPwRow(a.password) +
            accRow('متفرغ للعمل؟', accYN(a.answers && a.answers.available)) +
            accRow('قادر على المشاركة الصوتية والتصوير وتحمل الضغط؟', accYN(a.answers && a.answers.capable)) +
            accRow('تاريخ الطلب', new Date(a.createdAt).toLocaleString('ar')) +
            '<div class="row" style="gap:8px;margin-top:12px;">' +
                '<button class="btn danger sm" data-uid="' + a.uid + '" data-act="reject" onclick="decideReg(this)">❌ رفض</button>' +
                '<button class="btn sm" data-uid="' + a.uid + '" data-act="approve" onclick="decideReg(this)">✅ قبول</button>' +
            '</div></div>';
    }).join('');
}
async function decideReg(btn) {
    const uid = btn.dataset.uid, act = btn.dataset.act;
    let reason = '';
    if (act === 'reject') {
        const r = await promptModal('سبب الرفض (اختياري)', '');
        if (r === null) return;
        reason = r;
    } else if (!(await confirmModal('قبول هذا الحساب؟'))) return;
    try {
        await api('/api/admin/registrations/' + uid + '/' + act, { method: 'POST', body: JSON.stringify({ reason: reason }) });
        toast(act === 'approve' ? 'تم قبول الحساب' : 'تم رفض الحساب');
        loadRegs();
    } catch (e) { toast(e.message); }
}
async function loadAccounts(view) {
    if (typeof view === 'string') accView_ = view;
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    try { ({ list: ACC_LIST } = await api('/api/senior/accounts?status=' + accView_)); }
    catch (e) { box.innerHTML = '<div class="card" style="color:#f87171;">تعذر التحميل (' + accEsc(e.message) + ')</div>'; return; }
    if (currentAdminTab !== 'accounts') return;
    box.innerHTML =
        '<div class="card"><div class="acc-switch">' +
            '<button class="acc-sw' + (accView_ === 'approved' ? ' on' : '') + '" data-v="approved" onclick="loadAccounts(this.dataset.v)">✅ الحسابات المقبولة</button>' +
            '<button class="acc-sw' + (accView_ === 'rejected' ? ' on' : '') + '" data-v="rejected" onclick="loadAccounts(this.dataset.v)">❌ الحسابات المرفوضة</button>' +
        '</div></div>' +
        '<input id="acc-q" placeholder="🔍 بحث بالاسم أو البريد" oninput="renderAccList()">' +
        '<div id="acc-list"></div>';
    renderAccList();
}
function renderAccList() {
    const q = ((document.getElementById('acc-q') || {}).value || '').trim().toLowerCase();
    const box = document.getElementById('acc-list');
    if (!box) return;
    const list = ACC_LIST.filter(function (a) { if (OWNER_DISGUISE && a.isOwner && a.uid !== ME.discordId) return false; return !q || (a.fullName || '').toLowerCase().indexOf(q) >= 0 || (a.email || '').toLowerCase().indexOf(q) >= 0; });
    if (!list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">' + (accView_ === 'approved' ? 'لا توجد حسابات مقبولة' : 'لا توجد حسابات مرفوضة') + '</div>'; return; }
    box.innerHTML = list.map(function (a) {
        const isRej = accView_ === 'rejected';
        let btns = '';
        if (isRej) {
            btns = '<button class="btn danger sm" data-uid="' + a.uid + '" data-act="delete" onclick="accAction(this)">🗑️ حذف</button>' +
                   '<button class="btn sm" data-uid="' + a.uid + '" data-act="approved" onclick="accAction(this)">✅ إعادة قبول</button>';
        } else {
            const isMe = a.uid === ME.discordId;
            const canDel = !isMe && (!a.isSenior || a.tempSenior || ME.isOwner);
            const canEdit = !a.isSenior || isMe || ME.isOwner;
            btns = (ME.isOwner && !isMe ? '<button class="btn gray sm" data-uid="' + a.uid + '" data-act="' + (a.isSenior ? 'removeSenior' : 'makeSenior') + '" onclick="accAction(this)">' + (a.isSenior ? '⬇️ إزالة من الكبار' : '⭐ تعيين كبير مسؤولين') + '</button>' : '') +
                   (canDel ? '<button class="btn danger sm" data-uid="' + a.uid + '" data-act="delete" onclick="accAction(this)">🗑️ حذف</button>' : '') +
                   (a.isSenior ? '' : '<button class="btn gray sm" data-uid="' + a.uid + '" data-act="rejected" onclick="accAction(this)">❌ رفض</button>') +
                   (canEdit ? '<button class="btn sm" data-uid="' + a.uid + '" onclick="openAccEdit(this.dataset.uid)">✏️ تعديل</button>' : '');
        }
        return '<div class="card acc-card">' +
            '<div class="acc-title">' + accEsc(a.fullName) + (a.isSenior ? ' <span class="acc-tag">كبير مسؤولين' + (a.uid === ME.discordId ? ' (حسابك)' : '') + '</span>' : '') + (a.isMP ? ' <span class="acc-tag">شرطة عسكرية</span>' : '') + '</div>' +
            accRow('البريد', a.email) + accPwRow(a.password) + accRow('العمر', a.age) + accRow('الجنسية', a.nationality) +
            accRow('القطاع', accSectorLabel(a.sector)) +
            accRow('متفرغ للعمل؟', accYN(a.answers && a.answers.available)) +
            accRow('قادر على المشاركة الصوتية والتصوير وتحمل الضغط؟', accYN(a.answers && a.answers.capable)) +
            (isRej && a.rejectReason ? accRow('سبب الرفض', a.rejectReason) : '') +
            (a.reviewedByTag ? accRow(isRej ? 'رفضه' : 'قبله', a.reviewedByTag) : '') +
            '<div class="row" style="gap:8px;margin-top:12px;">' + btns + '</div></div>';
    }).join('');
}
async function accAction(btn) {
    const uid = btn.dataset.uid, act = btn.dataset.act;
    try {
        if (act === 'makeSenior' || act === 'removeSenior') {
            if (!(await confirmModal(act === 'makeSenior' ? 'تعيين هذا الحساب كبير مسؤولين؟' : 'إزالة هذا الحساب من كبار المسؤولين؟'))) return;
            await api('/api/owner/accounts/' + uid + '/senior', { method: 'POST', body: JSON.stringify({ value: act === 'makeSenior' }) });
            toast(act === 'makeSenior' ? 'تم التعيين كبير مسؤولين' : 'تمت الإزالة من الكبار');
        } else if (act === 'delete') {
            if (!(await confirmModal('⚠️ حذف الحساب نهائياً — بيتحذف الحساب وكل بياناته (النقاط والرتبة والإجازات والحضور) وما يقدر يدخل مرة ثانية. متأكد؟'))) return;
            await api('/api/senior/accounts/' + uid, { method: 'DELETE' });
            toast('تم حذف الحساب');
        } else if (act === 'rejected') {
            const r = await promptModal('سبب الرفض (اختياري)', '');
            if (r === null) return;
            await api('/api/senior/accounts/' + uid + '/status', { method: 'POST', body: JSON.stringify({ status: 'rejected', reason: r }) });
            toast('تم نقل الحساب للمرفوضة');
        } else {
            if (!(await confirmModal('إعادة قبول هذا الحساب؟'))) return;
            await api('/api/senior/accounts/' + uid + '/status', { method: 'POST', body: JSON.stringify({ status: 'approved' }) });
            toast('تم قبول الحساب');
        }
        loadAccounts();
    } catch (e) { toast(e.message); }
}
function closeAccEdit() { const o = document.getElementById('acc-edit-ov'); if (o) o.remove(); }
function openAccEdit(uid) {
    const a = ACC_LIST.find(function (x) { return x.uid === uid; });
    if (!a) return;
    closeAccEdit();
    const sec = csHtml('ae-sec', ACC_SECTORS, a.sector || '');
    const ov = document.createElement('div');
    ov.id = 'acc-edit-ov'; ov.className = 'acc-ov';
    ov.innerHTML = '<div class="acc-modal"><h3>تعديل الحساب</h3>' +
        '<label>الاسم الرباعي</label><input id="ae-name">' +
        '<label>العمر</label><input id="ae-age" type="number">' +
        '<label>الجنسية</label><input id="ae-nat">' +
        '<label>البريد الإلكتروني</label><input id="ae-email" type="email" dir="ltr">' +
        '<label>كلمة المرور</label><input id="ae-pw" type="text" dir="ltr">' +
        '<label>القطاع</label>' + sec +
        '<label class="acc-check"><input type="checkbox" id="ae-mp"> من الشرطة العسكرية</label>' +
        '<div class="row" style="gap:8px;margin-top:14px;"><button class="btn gray" onclick="closeAccEdit()">إلغاء</button>' +
        '<button class="btn" data-uid="' + a.uid + '" onclick="saveAccEdit(this)">💾 حفظ</button></div></div>';
    document.body.appendChild(ov);
    document.getElementById('ae-name').value = a.fullName || '';
    document.getElementById('ae-age').value = a.age || '';
    document.getElementById('ae-nat').value = a.nationality || '';
    document.getElementById('ae-email').value = a.email || '';
    document.getElementById('ae-pw').value = a.password || '';
    csSet('ae-sec', a.sector || '');
    document.getElementById('ae-mp').checked = !!a.isMP;
    ov.onclick = function (e) { if (e.target === ov) closeAccEdit(); };
}
async function saveAccEdit(btn) {
    const body = {
        fullName: document.getElementById('ae-name').value.trim(),
        age: document.getElementById('ae-age').value,
        nationality: document.getElementById('ae-nat').value.trim(),
        email: document.getElementById('ae-email').value.trim(),
        password: document.getElementById('ae-pw').value,
        sector: document.getElementById('ae-sec').value,
        isMP: document.getElementById('ae-mp').checked,
    };
    try {
        await api('/api/senior/accounts/' + btn.dataset.uid + '/update', { method: 'POST', body: JSON.stringify(body) });
        toast('تم حفظ التعديلات');
        closeAccEdit();
        loadAccounts();
    } catch (e) { toast(e.message); }
}
let voTab = 'pending';
function renderViolationsOfficerPanel() {
    voTab = 'pending';
    document.getElementById('app').innerHTML =
        '<div class="card row"><h2>⚖️ مسؤول المخالفات</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>' +
        '<div class="tabs">' +
            '<div class="tab active" data-t="pending" onclick="voSwitch(this.dataset.t, this)">المخالفات المعلّقة</div>' +
            '<div class="tab" data-t="log" onclick="voSwitch(this.dataset.t, this)">📜 السجل</div>' +
        '</div>' +
        '<div id="vo-content"></div>';
    loadVOPending();
}
function voSwitch(t, el) {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    if (el) el.classList.add('active');
    voTab = t;
    if (t === 'log') loadVOLog(); else loadVOPending();
}
function voDetails(v) {
    let h = '<b>' + accEsc(v.reporterName || v.reporterTag) + '</b> <span style="color:var(--muted);font-size:12px;">(' + accEsc(v.reporterUnit || '-') + ')</span>';
    if (v.kind === 'report') {
        h += '<div style="color:var(--gold-soft);margin-top:4px;">🧪 تقرير مكافحة المخدرات — ' + accEsc(v.reportCategory) + '</div>' +
            '<div style="color:var(--muted);font-size:13px;">المتهم: ' + accEsc(v.suspectName) + ' • موقع الضبط: ' + accEsc(v.arrestLocation) + '</div>' +
            '<div style="color:var(--muted);font-size:13px;">المركبة: ' + accEsc(v.vehicle) + ' • سبب الاستيقاف: ' + accEsc(v.stopReason) + '</div>';
        if (v.reportCategory === 'مخدرات') {
            h += '<div style="color:var(--muted);font-size:13px;">نوع المخدر: ' + accEsc(v.drugType || '-') + ' • الكمية: ' + accEsc(v.drugQuantity || '-') + '</div>' +
                '<div style="color:var(--muted);font-size:13px;">طريقة الإخفاء: ' + accEsc(v.concealMethod || '-') + '</div>';
        } else {
            h += '<div style="color:var(--muted);font-size:13px;">المضبوطات: ' + accEsc(v.seizedItems) + '</div>';
        }
        if (v.securityActions && v.securityActions.length) h += '<div style="color:var(--muted);font-size:13px;">الإجراءات: ' + accEsc(v.securityActions.join('، ')) + '</div>';
    } else {
        h += '<div style="color:var(--gold-soft);margin-top:4px;">' + accEsc(v.violationType) + '</div>' +
            '<div style="color:var(--muted);font-size:13px;">المركبة: ' + accEsc(v.vehicle) + ' • اللوحة: ' + accEsc(v.plateNumber) + '</div>';
    }
    return h;
}
async function loadVOPending() {
    const box = document.getElementById('vo-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/violations-officer/pending')); }
    catch (e) { if (voTab !== 'pending') return; box.innerHTML = '<div class="card" style="color:#f87171;">تعذر التحميل (' + accEsc(e.message) + ')</div>'; return; }
    if (voTab !== 'pending') return;
    if (!list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات معلّقة</div>'; return; }
    box.innerHTML = list.map(function (v) {
        return '<div class="card"><div class="row" style="align-items:flex-start;">' +
            '<div class="row" style="gap:10px;align-items:flex-start;">' +
                (v.hasPhoto ? '<button class="btn sm gray" data-id="' + v._id + '" onclick="viewViolationPhoto(this.dataset.id)">📷 عرض الصورة</button>' : '') +
                '<div>' + voDetails(v) + '</div>' +
            '</div>' +
            '<div class="row" style="gap:8px;">' +
                '<button class="btn sm" data-id="' + v._id + '" onclick="voApprove(this.dataset.id)">قبول</button>' +
                '<button class="btn danger sm" data-id="' + v._id + '" onclick="voReject(this.dataset.id)">رفض</button>' +
            '</div></div></div>';
    }).join('');
}
async function voApprove(id) {
    if (isActionLocked(id)) return toast('انتظر 5 ثواني قبل الضغط مرة أخرى');
    lockAction(id);
    try { await api('/api/violations-officer/violations/' + id + '/approve', { method: 'POST' }); toast('تم القبول'); loadVOPending(); }
    catch (e) { toast(e.message); }
}
async function voReject(id) {
    if (isActionLocked(id)) return toast('انتظر 5 ثواني قبل الضغط مرة أخرى');
    const reason = await promptModal('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب');
    lockAction(id);
    api('/api/violations-officer/violations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason: reason }) })
        .then(function () { toast('تم الرفض'); loadVOPending(); }).catch(function (e) { toast(e.message); });
}
async function loadVOLog() {
    const box = document.getElementById('vo-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/violations-officer/log')); }
    catch (e) { if (voTab !== 'log') return; box.innerHTML = '<div class="card" style="color:#f87171;">تعذر التحميل (' + accEsc(e.message) + ')</div>'; return; }
    if (voTab !== 'log') return;
    if (!list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">السجل فاضي — ما فيه مخالفات مقبولة أو مرفوضة بعد</div>'; return; }
    box.innerHTML = list.map(function (v) {
        return '<div class="card"><div class="row" style="align-items:flex-start;">' +
            '<div class="row" style="gap:10px;align-items:flex-start;">' +
                (v.hasPhoto ? '<button class="btn sm gray" data-id="' + v._id + '" onclick="viewViolationPhoto(this.dataset.id)">📷 عرض الصورة</button>' : '') +
                '<div>' + voDetails(v) +
                    '<div style="margin-top:4px;"><span class="badge ' + v.status + '">' + (v.status === 'approved' ? 'مقبولة' : 'مرفوضة') + '</span></div>' +
                    (v.status === 'rejected' && v.rejectReason ? '<div style="font-size:11px;color:var(--muted);margin-top:3px;">السبب: ' + accEsc(v.rejectReason) + '</div>' : '') +
                    (v.reviewedByTag ? '<div style="font-size:11px;color:var(--muted);margin-top:3px;">راجعها: ' + accEsc(v.reviewedByTag) + (v.reviewedAt ? ' • ' + new Date(v.reviewedAt).toLocaleString('ar') : '') + '</div>' : '') +
                '</div>' +
            '</div></div></div>';
    }).join('');
}
function openVOPicker() {
    const el = document.getElementById('picker-vo');
    if (!el) return;
    if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
    el.innerHTML = '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">' +
        '<input placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchVOCandidate(this.value)">' +
        '<div id="cand-vo"></div></div>';
}
let voSearchTimer = null;
function searchVOCandidate(q) {
    clearTimeout(voSearchTimer);
    voSearchTimer = setTimeout(async function () {
        const box = document.getElementById('cand-vo');
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q), { noLock: true });
            const ok = list.filter(function (p) { return p.registeredName; });
            if (!ok.length) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = ok.map(function (p) {
                return '<div class="card" style="padding:8px 12px;margin-top:6px;"><div class="row">' +
                    '<span>' + accEsc(p.registeredName) + ' <span style="color:var(--muted);font-size:12px;">(' + accEsc(p.unit || '-') + ' • ' + accEsc(p.rank) + ')</span></span>' +
                    '<button class="btn sm" data-id="' + p.discord + '" onclick="assignVO(this.dataset.id)">تعيين</button>' +
                '</div></div>';
            }).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + accEsc(e.message) + '</p>'; }
    }, 350);
}
async function assignVO(discordId) {
    try { await api('/api/senior/violations-officer/assign', { method: 'POST', body: JSON.stringify({ discordId: discordId }) }); toast('تم التعيين'); loadSectors(); }
    catch (e) { toast(e.message); }
}
async function removeVO() {
    if (!(await confirmModal('متأكد تبي تزيل مسؤول المخالفات؟'))) return;
    try { await api('/api/senior/violations-officer/remove', { method: 'POST' }); toast('تم'); loadSectors(); }
    catch (e) { toast(e.message); }
}
async function loadHire() {
    const box = document.getElementById('admin-content');
    box.innerHTML = \`
        <div class="card">
            <h3>توظيف إداري</h3>
            <p style="color:var(--muted);font-size:12px;margin-bottom:10px;">الإداري المعيّن يقدر فقط يقبل أو يرفض المخالفات المعلّقة.</p>
            <label>بريد الإداري (لازم يكون حسابه مقبول)</label>
            <input id="hire-id" placeholder="example@email.com">
            <label>اسمه</label>
            <input id="hire-name" placeholder="اسم الإداري">
            <button class="btn sm" onclick="hireAdmin()">تم</button>
        </div>
        <div id="admins-list"></div>\`;
    loadAdminsList();
}
async function hireAdmin() {
    const discordId = document.getElementById('hire-id').value.trim();
    const name = document.getElementById('hire-name').value.trim();
    if (!discordId) return toast('حط بريد الإداري');
    try { await api('/api/senior/hire-admin', { method: 'POST', body: JSON.stringify({ discordId, name }) }); toast('تم التعيين'); loadHire(); }
    catch (e) { toast(e.message); }
}
async function loadAdminsList() {
    const { list, info } = await api('/api/senior/admins');
    if (currentAdminTab !== 'hire') return;
    const box = document.getElementById('admins-list');
    if (!box) return;
    box.innerHTML = list.map(id => \`
        <div class="card row"><span>\${(info && info[id]) || id}</span><button class="btn danger sm" onclick="fireAdmin('\${id}')">فصل</button></div>\`).join('') || '<div class="card center" style="color:var(--muted);">لا يوجد إداريون معيّنون</div>';
}
function fireAdmin(id) {
    api('/api/senior/fire-admin', { method: 'POST', body: JSON.stringify({ discordId: id }) }).then(() => { toast('تم الفصل'); loadHire(); });
}
async function loadThresholds() {
    const { ranks, thresholds } = await api('/api/senior/thresholds');
    if (currentAdminTab !== 'thresholds') return;
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = \`<div class="card">
        <h3>نقاط الترقية بين الرتب</h3>
        <p style="color:var(--muted);font-size:12px;margin-bottom:10px;">حدد كم نقطة يحتاجها العسكري بكل رتبة عشان يترقى للي بعدها.</p>
        \${ranks.map((r, i) => i === ranks.length - 1 ? '' : \`
            <div class="row" style="margin-bottom:8px;">
                <span style="font-size:13px;">\${r} ——> \${ranks[i+1]}</span>
                <input type="number" style="width:100px;margin-bottom:0;" id="th-\${i}" value="\${thresholds[r]}">
            </div>\`).reverse().join('')}
        <button class="btn sm" onclick="saveThresholds()" style="margin-top:8px;">حفظ</button>
    </div>\`;
    box.dataset.ranks = JSON.stringify(ranks);
}
async function saveThresholds() {
    const ranks = JSON.parse(document.getElementById('admin-content').dataset.ranks);
    const thresholds = {};
    ranks.forEach((r, i) => { const el = document.getElementById('th-' + i); if (el) thresholds[r] = parseInt(el.value) || 0; });
    try { await api('/api/senior/thresholds', { method: 'POST', body: JSON.stringify({ thresholds }) }); toast('تم الحفظ'); }
    catch (e) { toast(e.message); }
}
const LOG_META = {
    "ترقية تلقائية":        { icon: "🎖️", label: "ترقية تلقائية",        color: "#4ade80", border: "#22c55e" },
    "قبول تقرير":           { icon: "✅", label: "قبول تقرير",           color: "#4ade80", border: "#22c55e" },
    "رفض تقرير":            { icon: "❌", label: "رفض تقرير",            color: "#fca5a5", border: "#ef4444" },
    "قبول مخالفة":          { icon: "✅", label: "قبول مخالفة",          color: "#4ade80", border: "#22c55e" },
    "رفض مخالفة":           { icon: "❌", label: "رفض مخالفة",           color: "#fca5a5", border: "#ef4444" },
    "حظر عسكري (أمر)":      { icon: "🚫", label: "حظر عسكري",           color: "#fca5a5", border: "#ef4444" },
    "فك حظر عسكري (أمر)":   { icon: "🔓", label: "فك حظر عسكري",        color: "#60a5fa", border: "#3b82f6" },
    "ترقية عسكري":          { icon: "⬆️", label: "ترقية عسكري",         color: "#4ade80", border: "#22c55e" },
    "تنزيل عسكري":          { icon: "⬇️", label: "تنزيل عسكري",         color: "#fca5a5", border: "#ef4444" },
    "تعيين يونت":           { icon: "🪖", label: "تعيين يونت",          color: "#60a5fa", border: "#3b82f6" },
    "تعديل نقاط":           { icon: "✏️", label: "تعديل نقاط",          color: "#fde047", border: "#eab308" },
    "إضافة ملاحظة":         { icon: "📝", label: "إضافة ملاحظة",        color: "#93c5fd", border: "#3b82f6" },
    "إيقاف عسكري":          { icon: "🚫", label: "إيقاف عسكري",         color: "#fca5a5", border: "#ef4444" },
    "إلغاء إيقاف":          { icon: "✅", label: "إلغاء إيقاف",          color: "#4ade80", border: "#22c55e" },
    "حذف حساب نهائي":       { icon: "🗑️", label: "حذف حساب نهائي",      color: "#fca5a5", border: "#7f1d1d" },
    "تعديل ملف عسكري":      { icon: "✏️", label: "تعديل ملف عسكري",     color: "#93c5fd", border: "#3b82f6" },
    "تعديل إعدادات الموقع": { icon: "⚙️", label: "تعديل إعدادات الموقع", color: "#60a5fa", border: "#3b82f6" },
    "توظيف إداري":          { icon: "⭐", label: "توظيف إداري",          color: "#60a5fa", border: "#3b82f6" },
    "فصل إداري":            { icon: "🚫", label: "فصل إداري",           color: "#fca5a5", border: "#ef4444" },
    "إضافة مركبة":          { icon: "🚗", label: "إضافة مركبة",         color: "#93c5fd", border: "#3b82f6" },
    "تعديل حدود النقاط":    { icon: "🎯", label: "تعديل حدود النقاط",   color: "#60a5fa", border: "#3b82f6" },
    "حذف ملاحظة":           { icon: "🗑️", label: "حذف ملاحظة",          color: "#fca5a5", border: "#7f1d1d" },
    "حذف مخالفة نهائي":     { icon: "🗑️", label: "حذف مخالفة نهائي",    color: "#fca5a5", border: "#7f1d1d" },
    "تعيين قيادة قطاع":     { icon: "🎖️", label: "تعيين قيادة قطاع",    color: "#60a5fa", border: "#3b82f6" },
    "إزالة قيادة قطاع":     { icon: "🚫", label: "إزالة قيادة قطاع",    color: "#fca5a5", border: "#ef4444" },
    "فصل تلقائي (تجاوز التحذيرات)": { icon: "🚫", label: "فصل تلقائي (تجاوز التحذيرات)", color: "#fca5a5", border: "#7f1d1d" },
    "إصدار تحذير":          { icon: "⚠️", label: "إصدار تحذير",         color: "#f87171", border: "#7f1d1d" },
    "إصدار إشعار":          { icon: "🔔", label: "إصدار إشعار",         color: "#fbbf24", border: "#78350f" },
    "تعاهد على تحذير":      { icon: "🤝", label: "تعاهد على تحذير",     color: "#4ade80", border: "#166534" },
    "تعاهد على إشعار":      { icon: "🤝", label: "تعاهد على إشعار",     color: "#4ade80", border: "#166534" },
};
let lastLogId = null;
let allLogsData = [];
async function loadLog(silent) {
    const { list, logClearAvailable } = await api('/api/senior/log');
    logClearAvail = !!logClearAvailable;
    if (currentAdminTab !== 'log') return;
    const box = document.getElementById('admin-content');
    if (!box) return;
    if (silent && list[0] && list[0]._id === lastLogId) return;
    if (list[0]) lastLogId = list[0]._id;
    allLogsData = list;
    if (!document.getElementById('log-search')) {
        box.innerHTML = \`<div id="log-clear-box"></div><div class="card"><input id="log-search" placeholder="🔍 ابحث بالاسم، اليوزر، الآيدي، أو نوع الحدث..." oninput="filterLog()" style="margin-bottom:12px;"><div id="log-list"></div></div>\`;
    }
    renderLogClearBox();
    const q = (document.getElementById('log-search') || {}).value || '';
    renderLog(q.trim() ? filterLogsData(q) : list);
}
function filterLogsData(q) {
    q = q.trim().toLowerCase();
    return allLogsData.filter(log => {
        const meta = LOG_META[log.action] || { label: log.action };
        return [log.discordId, log.discordTag, log.actorId, log.actorTag, log.details, log.action, meta.label]
            .some(v => (v || '').toString().toLowerCase().includes(q));
    });
}
function filterLog() {
    const q = document.getElementById('log-search').value;
    renderLog(q.trim() ? filterLogsData(q) : allLogsData);
}
function renderLog(list) {
    const container = document.getElementById('log-list');
    if (!container) return;
    if (list.length === 0) { container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px;">لا توجد نتائج.</p>'; return; }
    container.innerHTML = list.map(log => {
        const meta = LOG_META[log.action] || { icon: 'ℹ️', label: log.action, color: '#94a3b8', border: '#64748b' };
        return \`
        <div class="log-item" data-lid="\${log._id}" style="border-color:\${meta.border};flex-wrap:wrap;">
            <div><span style="color:\${meta.color};font-weight:bold;">\${meta.icon} \${meta.label}</span></div>
            <div style="text-align:left;color:#94a3b8;font-size:0.85rem;">
                \${log.discordTag || log.discordId ? \`<div>الشخص: <b style="color:#60a5fa;">\${log.discordTag || ''}</b> \${log.discordId ? '(' + log.discordId + ')' : ''}</div>\` : ''}
                \${log.actorTag || log.actorId ? \`<div>بواسطة: <b style="color:#e2e8f0;">\${log.actorTag || ''}</b> \${log.actorId ? '(' + log.actorId + ')' : ''}</div>\` : ''}
                \${log.details ? \`<div style="color:#93c5fd;">\${log.details}</div>\` : ''}
                <div style="font-size:0.78rem;color:#64748b;">\${new Date(log.createdAt).toLocaleString('ar')}</div>
            </div>
        </div>\`;
    }).join('');
    if (ME && ME.isOwner) bindLogSwipe(container);
}
function bindLogSwipe(container) {
    Array.prototype.forEach.call(container.querySelectorAll('.log-item[data-lid]'), function (el) {
        var sx = 0, sy = 0, dx = 0, on = false;
        el.style.touchAction = 'pan-y';
        el.addEventListener('pointerdown', function (e) {
            on = true; sx = e.clientX; sy = e.clientY; dx = 0;
            el.style.transition = 'none';
            try { el.setPointerCapture(e.pointerId); } catch (x) {}
        });
        el.addEventListener('pointermove', function (e) {
            if (!on) return;
            dx = e.clientX - sx;
            if (Math.abs(e.clientY - sy) > Math.abs(dx) + 12) { on = false; el.style.transform = ''; el.style.opacity = ''; return; }
            if (dx > 0) { el.style.transform = 'translateX(' + dx + 'px)'; el.style.opacity = String(Math.max(0.25, 1 - dx / 300)); }
        });
        var end = async function () {
            if (!on) return;
            on = false;
            el.style.transition = 'transform .2s, opacity .2s';
            if (dx < 120) { el.style.transform = ''; el.style.opacity = ''; return; }
            el.style.transform = 'translateX(110%)'; el.style.opacity = '0';
            var id = el.dataset.lid;
            try {
                await api('/api/senior/log/' + id, { method: 'DELETE', noLock: true });
                allLogsData = allLogsData.filter(function (l) { return String(l._id) !== id; });
                lastLogId = allLogsData[0] ? allLogsData[0]._id : null;
                setTimeout(function () { el.remove(); }, 200);
            } catch (e) {
                el.style.transform = ''; el.style.opacity = '';
                toast(e.message);
            }
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
    });
}
async function loadNotesPage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try {
        ({ list } = await api('/api/senior/notes'));
    } catch (e) {
        if (currentAdminTab !== 'notes') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر تحميل الملاحظات، حاول تحدّث الصفحة. (\${e.message})</div>\`;
        return;
    }
    if (currentAdminTab !== 'notes') return;
    const sectorButtons = \`
        <div class="card">
            <div style="font-size:13px;color:var(--muted);margin-bottom:8px;">حذف ملاحظات قطاع كامل:</div>
            <div class="row" style="gap:8px;flex-wrap:wrap;">
                <button class="btn sm danger" onclick="openSectorNotesDelete('patrol')">🗑️ ملاحظات الدوريات</button>
                <button class="btn sm danger" onclick="openSectorNotesDelete('roadSecurity')">🗑️ ملاحظات أمن الطرق</button>
                <button class="btn sm danger" onclick="openSectorNotesDelete('antiDrugs')">🗑️ ملاحظات المكافحة</button>
            </div>
        </div>\`;
    if (list.length === 0) { box.innerHTML = sectorButtons + '<div class="card center" style="color:var(--muted);">لا توجد ملاحظات مسجلة</div>'; return; }
    box.innerHTML = sectorButtons + list.map(n => \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div>
                    <b>\${n.personnelName}</b>
                    <div style="margin-top:4px;">\${n.text}</div>
                    \${n.hasImage ? \`<button class="btn sm gray" style="margin-top:6px;" onclick="viewNotePhoto('\${n.discord}','\${n.noteId}')">📷 عرض الصورة</button>\` : ''}
                    <div style="color:var(--muted);font-size:12px;margin-top:4px;">أضافها: \${n.addedByTag || n.addedBy || '-'} • \${new Date(n.createdAt).toLocaleString('ar')}</div>
                </div>
                <button class="btn danger sm" onclick="deleteNote('\${n.discord}', '\${n.noteId}')">🗑️ حذف</button>
            </div>
        </div>\`).join('');
}
function openSectorNotesDelete(sector) {
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>🗑️ حذف ملاحظات القطاع</h3>
        <p style="color:var(--muted);font-size:13px;margin-top:6px;">تبي تحذف الجميع، أو تستثني بعضها؟</p>
        <div class="wf-choice-row">
            <button class="wf-warning" onclick="sectorNotesDeleteAll('\${sector}')">حذف الجميع</button>
            <button class="wf-notice" onclick="sectorNotesDeleteExcept('\${sector}')">باستثناء</button>
        </div>
        <div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button></div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function sectorNotesDeleteAll(sector) {
    if (!(await confirmModal('متأكد؟ بتحذف كل ملاحظات هذا القطاع نهائياً بدون استثناء.'))) return;
    try {
        const { count } = await api('/api/senior/notes/by-sector/' + sector + '/delete-all', { method: 'POST' });
        toast('🗑️ تم حذف ملاحظات ' + count + ' عسكري');
        closeWarnForm();
        loadNotesPage();
    } catch (e) { toast(e.message); }
}
let sectorNotesDeleteCtx = null;
async function sectorNotesDeleteExcept(sector) {
    const box = document.getElementById('wf-box');
    box.innerHTML = '<h3>جارِ التحميل...</h3>';
    try {
        const { list, sectorLabel } = await api('/api/senior/notes/by-sector/' + sector);
        sectorNotesDeleteCtx = { sector, keepIds: new Set() };
        if (list.length === 0) {
            box.innerHTML = \`<h3>لا توجد ملاحظات بقطاع \${sectorLabel}</h3><div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إغلاق</button></div>\`;
            return;
        }
        box.innerHTML = \`
            <h3>استثناء ملاحظات (\${sectorLabel})</h3>
            <p style="color:var(--muted);font-size:13px;margin:6px 0;">علّم الملاحظات اللي تبي تستثنيها (تبقى)، والباقي بينحذف.</p>
            <div style="max-height:50vh;overflow-y:auto;text-align:right;">
                \${list.map(n => \`
                <label style="display:block;background:rgba(255,255,255,0.05);padding:8px;border-radius:8px;margin-bottom:6px;font-size:13px;">
                    <input type="checkbox" onchange="toggleKeepNote('\${n.noteId}', this.checked)" style="width:auto;margin-left:6px;">
                    <b>\${n.personnelName}</b>: \${n.text}
                    <div style="color:var(--muted);font-size:11px;">بواسطة: \${n.addedByTag || '-'}</div>
                </label>\`).join('')}
            </div>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn danger sm" onclick="submitSectorNotesDeleteExcept()">تنفيذ الحذف</button>
            </div>\`;
    } catch (e) { toast(e.message); closeWarnForm(); }
}
function toggleKeepNote(noteId, checked) {
    if (!sectorNotesDeleteCtx) return;
    if (checked) sectorNotesDeleteCtx.keepIds.add(noteId);
    else sectorNotesDeleteCtx.keepIds.delete(noteId);
}
async function submitSectorNotesDeleteExcept() {
    if (!sectorNotesDeleteCtx) return;
    if (!(await confirmModal('متأكد؟ كل الملاحظات اللي ما علّمتها بتنحذف نهائياً.'))) return;
    try {
        const { count } = await api('/api/senior/notes/by-sector/' + sectorNotesDeleteCtx.sector + '/delete-except', {
            method: 'POST', body: JSON.stringify({ keepNoteIds: Array.from(sectorNotesDeleteCtx.keepIds) }),
        });
        toast('🗑️ تم حذف ' + count + ' ملاحظة');
        sectorNotesDeleteCtx = null;
        closeWarnForm();
        loadNotesPage();
    } catch (e) { toast(e.message); }
}
async function deleteNote(discord, noteId) {
    if (!(await confirmModal('متأكد تبي تحذف هذي الملاحظة؟'))) return;
    try { await api('/api/senior/personnel/' + discord + '/note/' + noteId, { method: 'DELETE' }); toast('تم الحذف'); loadNotesPage(); }
    catch (e) { toast(e.message); }
}
let editingPenaltyId = null;
async function loadPenaltiesPage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/senior/penalties')); }
    catch (e) {
        if (currentAdminTab !== 'penalties') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (currentAdminTab !== 'penalties') return;
    editingPenaltyId = null;
    renderPenaltiesPage(list);
}
const PENALTY_TYPE_LABELS = { points: 'خصم نقاط', resetPoints: 'تصفير النقاط', demote: 'تنزيل رتبة', demoteToFirst: 'تنزيل لأول رتبة', suspend: 'إيقاف مؤقت', combo: 'عقوبة مركّبة', dismiss: 'فصل نهائي' };
function renderPenaltiesPage(list) {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <h3 style="color:var(--gold-soft);margin-bottom:8px;">⚖️ عقوبات التحذيرات</h3>
            <p style="font-size:13px;color:#94a3b8;line-height:1.8;">
                تصل هذي العقوبات للعضو تلقائيًا عند وصوله للتحذير الثالث — تختار وحدة منها وقت إرسال التحذير. تقدر تضيف / تعدّل / تحذف عقوبات حسب ما يناسبكم.<br>
                <b style="color:#fca5a5;">ملاحظة:</b> أي تحذير رابع بعد عقوبة التحذير الثالث يفصل العضو تلقائيًا بغض النظر عن هذي القائمة.
            </p>
        </div>
        <div class="card" id="penalty-form-card">
            <h3 id="penalty-form-title" style="margin-bottom:10px;">➕ إضافة عقوبة جديدة</h3>
            <input id="pn-label" placeholder="اسم العقوبة (مثال: إيقاف 4 أيام)">
            \${csHtml('pn-type', [['points', 'خصم نقاط'], ['resetPoints', 'تصفير النقاط بالكامل'], ['demote', 'تنزيل رتبة'], ['demoteToFirst', 'تنزيل لأول رتبة (جندي)'], ['suspend', 'إيقاف مؤقت (أيام)'], ['combo', 'عقوبة مركّبة (نقاط + رتبة + إيقاف)'], ['dismiss', 'فصل نهائي']], 'points', { onpick: 'togglePenaltyFields()' })}
            <input id="pn-value" type="number" min="1" placeholder="عدد النقاط المخصومة">
            <input id="pn-ranks" type="number" min="1" placeholder="عدد الرتب المُنزّلة">
            <input id="pn-days" type="number" min="1" placeholder="عدد أيام الإيقاف">
            <div class="wf-actions" style="margin-top:6px;">
                <button class="btn gray sm" id="pn-cancel-btn" style="display:none;" onclick="resetPenaltyForm()">إلغاء التعديل</button>
                <button class="btn sm" onclick="savePenalty()">💾 حفظ</button>
            </div>
        </div>
        \${list.length === 0 ? '<div class="card center" style="color:var(--muted);">لا توجد عقوبات مضافة حالياً — ضيف عقوبة من الفورم فوق</div>' : list.map((p, i) => \`
        <div class="card row" style="align-items:center;">
            <div>
                <b>\${i + 1}. \${p.label}</b>
                <div style="font-size:12px;color:#94a3b8;margin-top:2px;">
                    \${PENALTY_TYPE_LABELS[p.type] || p.type}
                    \${p.value ? ' • ' + p.value + ' نقطة' : ''}
                    \${p.ranks ? ' • ' + p.ranks + ' رتبة' : ''}
                    \${p.days ? ' • ' + p.days + ' يوم' : ''}
                </div>
            </div>
            <div class="row" style="gap:6px;">
                <button class="btn sm gray" onclick='editPenalty(\${JSON.stringify(p)})'>✏️ تعديل</button>
                <button class="btn sm danger" onclick="deletePenalty('\${p.id}')">🗑️ حذف</button>
            </div>
        </div>\`).join('')}
    \`;
    togglePenaltyFields();
}
function togglePenaltyFields() {
    const type = document.getElementById('pn-type').value;
    document.getElementById('pn-value').style.display = (type === 'points' || type === 'combo') ? 'block' : 'none';
    document.getElementById('pn-ranks').style.display = (type === 'demote' || type === 'combo') ? 'block' : 'none';
    document.getElementById('pn-days').style.display = (type === 'suspend' || type === 'combo') ? 'block' : 'none';
}
function editPenalty(p) {
    editingPenaltyId = p.id;
    document.getElementById('penalty-form-title').textContent = '✏️ تعديل العقوبة';
    document.getElementById('pn-label').value = p.label || '';
    csSet('pn-type', p.type || 'points');
    document.getElementById('pn-value').value = p.value || '';
    document.getElementById('pn-ranks').value = p.ranks || '';
    document.getElementById('pn-days').value = p.days || '';
    document.getElementById('pn-cancel-btn').style.display = 'inline-block';
    togglePenaltyFields();
    document.getElementById('penalty-form-card').scrollIntoView({ behavior: 'smooth' });
}
function resetPenaltyForm() {
    editingPenaltyId = null;
    document.getElementById('penalty-form-title').textContent = '➕ إضافة عقوبة جديدة';
    document.getElementById('pn-label').value = '';
    csSet('pn-type', 'points');
    document.getElementById('pn-value').value = '';
    document.getElementById('pn-ranks').value = '';
    document.getElementById('pn-days').value = '';
    document.getElementById('pn-cancel-btn').style.display = 'none';
    togglePenaltyFields();
}
async function savePenalty() {
    const label = document.getElementById('pn-label').value;
    const type = document.getElementById('pn-type').value;
    const value = document.getElementById('pn-value').value;
    const ranks = document.getElementById('pn-ranks').value;
    const days = document.getElementById('pn-days').value;
    if (!label || !label.trim()) return toast('لازم تكتب اسم العقوبة');
    try {
        let list;
        if (editingPenaltyId) {
            ({ list } = await api('/api/senior/penalties/' + editingPenaltyId, { method: 'PUT', body: JSON.stringify({ label, type, value, ranks, days }) }));
            toast('تم تعديل العقوبة');
        } else {
            ({ list } = await api('/api/senior/penalties', { method: 'POST', body: JSON.stringify({ label, type, value, ranks, days }) }));
            toast('تمت إضافة العقوبة');
        }
        editingPenaltyId = null;
        renderPenaltiesPage(list);
    } catch (e) { toast(e.message); }
}
async function deletePenalty(id) {
    if (!(await confirmModal('متأكد تبي تحذف هذي العقوبة؟'))) return;
    try {
        const { list } = await api('/api/senior/penalties/' + id, { method: 'DELETE' });
        toast('تم الحذف');
        renderPenaltiesPage(list);
    } catch (e) { toast(e.message); }
}
async function loadSettings() {
    const { settings } = await api('/api/senior/settings');
    if (currentAdminTab !== 'settings') return;
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <div class="row"><span>وضع الصيانة</span><input type="checkbox" id="s-maint" \${settings.isMaintenance ? 'checked' : ''}></div>
            <div class="row" style="margin-top:10px;"><span>إغلاق تسجيل الدخول</span><input type="checkbox" id="s-login" \${settings.disableLogin ? 'checked' : ''}></div>
            <div class="row" style="margin-top:10px;"><span>إغلاق تسجيل المخالفات</span><input type="checkbox" id="s-viol" \${settings.disableViolations ? 'checked' : ''}></div>
            <label style="margin-top:10px;">آيدي قناة إرسال المخالفات والتقارير بديسكورد (اختياري)</label>
            <input id="s-channel" placeholder="آيدي القناة" value="\${settings.violationsChannelId || ''}">
            <label style="margin-top:10px;">آيدي قناة إرسال صور الملاحظات بديسكورد (اختياري)</label>
            <input id="s-notes-channel" placeholder="آيدي القناة" value="\${settings.notesChannelId || ''}">
            <button class="btn" style="margin-top:14px;" onclick="saveSettings()">حفظ الإعدادات</button>
        </div>\`;
    box.insertAdjacentHTML('beforeend', officersLockCardHtml(!!settings.officersLocked));
    if (ME && ME.isOwner) {
        let locked = false;
        try { locked = !!(await api('/api/owner/saved-login-lock')).locked; } catch (e) {}
        if (currentAdminTab === 'settings' && document.getElementById('admin-content') === box) box.insertAdjacentHTML('beforeend', ownerLockCardHtml(locked));
    }
}
function officersLockCardHtml(locked) {
    return '<div class="card" id="officers-lock-card" style="margin-top:12px;">' +
        '<div class="row"><span>🎖️ قفل سلك الضباط</span><span style="color:' + (locked ? '#fca5a5' : '#86efac') + ';font-weight:700;">' + (locked ? 'مقفول' : 'مفتوح') + '</span></div>' +
        '<p style="color:var(--muted);font-size:12px;line-height:1.8;margin-top:6px;">إذا انقفل، اللي قدموا قبل (بالتقديم أو المقابلة أو التدريب) يكملون عادي، واللي ما قدموا يطلع لهم أن سلك الضباط مقفول.</p>' +
        '<button class="btn' + (locked ? '' : ' danger') + '" style="margin-top:10px;" onclick="toggleOfficersLock(' + (locked ? 'false' : 'true') + ')">' + (locked ? '🔓 فتح سلك الضباط' : '🔒 قفل سلك الضباط') + '</button>' +
        (locked ? '' : '<button class="btn gold" style="margin-top:8px;" onclick="offAnnAsk()">📢 إرسال إعلان للأفراد</button>') + '</div>';
}
function offAnnAsk() {
    offModalOpen('<h3>📢 إعلان سلك الضباط</h3><p style="line-height:1.9;margin:10px 0 16px;">تبي يجي إعلان للأفراد من رتبة <b>جندي</b> إلى <b>رئيس رقباء</b> على سلك الضباط؟</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px;"><button class="btn" onclick="offAnnSend(false)">✅ نعم، أرسل للأفراد</button>' +
        '<button class="btn gray" onclick="offModalClose()">❌ لا</button>' +
        '<button class="btn gold" onclick="offAnnSend(true)">🧪 تجربة على حساب المالك فقط</button></div>');
}
async function offAnnSend(test) {
    try {
        await api('/api/senior/officers-announce', { method: 'POST', body: JSON.stringify({ test: !!test }) });
        offModalClose();
        toast(test ? '🧪 تم إرسال التجربة لحساب المالك' : '📢 تم إرسال الإعلان للأفراد');
        setTimeout(offAnnCheck, 700);
        setTimeout(flashUpdCheck, 1000);
    } catch (e) { toast(e.message); }
}
async function toggleOfficersLock(lock) {
    var ok = await confirmModal(lock ? 'تبي تقفل سلك الضباط؟ اللي ما قدموا ما يقدرون يقدمون.' : 'تبي تفتح سلك الضباط للتقديم؟');
    if (!ok) return;
    try {
        await api('/api/senior/officers-lock', { method: 'POST', body: JSON.stringify({ locked: lock }) });
        var c = document.getElementById('officers-lock-card');
        if (c) c.outerHTML = officersLockCardHtml(lock);
        toast(lock ? '🔒 تم قفل سلك الضباط' : '🔓 تم فتح سلك الضباط');
        if (!lock) offAnnAsk();
    } catch (e) { toast(e.message); }
}
function ownerLockCardHtml(locked) {
    return '<div class="card" id="owner-lock-card" style="margin-top:12px;">' +
        '<div class="row"><span>🔒 قفل حفظ الحساب بالجهاز</span><span style="color:' + (locked ? '#fca5a5' : '#86efac') + ';font-weight:700;">' + (locked ? 'مقفول' : 'مفتوح') + '</span></div>' +
        '<button class="btn" style="margin-top:10px;" onclick="toggleSavedLock(' + (locked ? 'false' : 'true') + ')">' + (locked ? '🔓 فتح حفظ الحساب' : '🔒 قفل حفظ الحساب') + '</button></div>';
}
async function toggleSavedLock(lock) {
    const ok = await confirmModal(lock ? 'تبي تقفل حفظ الحساب بالجهاز؟ ما بيطلع لأحد غير المالك "تبي تدخل هذا الحساب" وكل واحد يسجل يدوي، وتنمسح الحسابات المحفوظة بالأجهزة، إلا حساب المالك يبقى محفوظ ويطلع له تبي تدخل حسابك هذا.' : 'تبي تفتح حفظ الحساب بالجهاز؟');
    if (!ok) return;
    try {
        await api('/api/owner/saved-login-lock', { method: 'POST', body: JSON.stringify({ locked: lock }) });
        SAVED_LOCK = lock;
        if (lock) { markOwnerSaved(); wipeSavedLogin(true); }
        const c = document.getElementById('owner-lock-card');
        if (c) c.outerHTML = ownerLockCardHtml(lock);
        toast(lock ? '🔒 تم القفل' : '🔓 تم الفتح');
    } catch (e) { toast(e.message); }
}
async function saveSettings() {
    const body = {
        isMaintenance: document.getElementById('s-maint').checked,
        disableLogin: document.getElementById('s-login').checked,
        disableViolations: document.getElementById('s-viol').checked,
        violationsChannelId: document.getElementById('s-channel').value.trim(),
        notesChannelId: document.getElementById('s-notes-channel').value.trim(),
    };
    try { await api('/api/senior/settings', { method: 'POST', body: JSON.stringify(body) }); toast('تم الحفظ'); }
    catch (e) { toast(e.message); }
}
/* ============================ 🎖️ سلك الضباط ============================ */
var OFF = { my: null, locked: false, questions: [], offset: 0, sig: '', tick: null };
var OFFA = { tab: 'apps', sig: '', timer: null, data: null, checks: {} };
var VC = null;
var OFF_MODES = [
    { k: 'private', t: '🔒 خاص (الكبار والمتحدث فقط)' },
    { k: 'listen', t: '👂 الكبار يتكلمون والباقي يسمعون' },
    { k: 'open', t: '🗣️ الكل يتكلم ويسمع' },
    { k: 'mute', t: '🔇 محد يتكلم ولا أحد يسمع (الكبار فقط يسمعون)' }
];
function offNow() { return Date.now() + OFF.offset; }
async function offFetch(url, opts) {
    var o = Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {});
    var r = await fetch(url, o);
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var er = new Error(d.error || 'خطأ'); er.status = r.status; throw er; }
    return d;
}
function offPost(url, body) { return offFetch(url, { method: 'POST', body: JSON.stringify(body || {}) }); }
function offFmt(d) {
    try { return new Date(d).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch (e) { return String(d); }
}
function offFmtTime(d) {
    try { return new Date(d).toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', hour12: true }); }
    catch (e) { return String(d); }
}
function offCountdown(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    if (d > 0) return d + ' يوم و ' + h + ' ساعة';
    if (h > 0) return h + ':' + p(m) + ':' + p(s);
    return p(m) + ':' + p(s);
}
function offStopTimers() {
    if (OFF.tick) { clearInterval(OFF.tick); OFF.tick = null; }
    if (OFFA.timer) { clearInterval(OFFA.timer); OFFA.timer = null; }
}
function offModalOpen(html) {
    offModalClose();
    var ov = document.createElement('div');
    ov.className = 'off-ov'; ov.id = 'off-modal';
    ov.innerHTML = '<div class="off-box">' + html + '</div>';
    document.body.appendChild(ov);
}
function offModalClose() {
    var m = document.getElementById('off-modal');
    if (m) m.remove();
}

/* ---------------------------- صفحة المتقدم ---------------------------- */
function renderOfficerPage() {
    offStopTimers();
    OFF.sig = '';
    document.getElementById('app').innerHTML = '<div id="off-root"><div class="card">جارِ التحميل...</div></div>';
    offLoadMe(false);
}
async function offLoadMe(silent) {
    try {
        var d = await offFetch('/api/officers/me');
        OFF.offset = d.serverNow - Date.now();
        OFF.questions = d.questions;
        var sig = JSON.stringify(d.app || null) + (d.locked ? '|locked' : '');
        if (silent && sig === OFF.sig) return;
        OFF.sig = sig; OFF.my = d.app; OFF.locked = !!d.locked;
        if (document.getElementById('off-root')) offPaintApplicant();
    } catch (e) { if (!silent) toast(e.message); }
}
function offStepIndex(a) {
    if (!a) return 0;
    if (a.stage === 'pending') return 0;
    if (a.stage === 'interview') return 1;
    if (a.stage === 'training' || a.stage === 'officer') return 2;
    if (a.stage === 'rejected') return a.rejectedAt === 'application' ? 0 : (a.rejectedAt === 'interview' ? 1 : 2);
    return 0;
}
function offStepsHtml(a) {
    var names = ['1- التقديم', '2- المقابلة', '3- التدريب'];
    var cur = offStepIndex(a);
    var bad = !!(a && a.stage === 'rejected');
    var fin = !!(a && a.stage === 'officer');
    return '<div class="off-steps">' + names.map(function (n, i) {
        var c = 'off-step';
        if (i < cur || (fin && i === cur)) c += ' done';
        else if (i === cur) c += bad ? ' bad' : ' cur';
        return '<div class="' + c + '">' + n + '</div>';
    }).join('') + '</div>';
}
function offPaintApplicant() {
    var root = document.getElementById('off-root');
    if (!root) return;
    var a = OFF.my;
    var h = '<div class="card row"><h2>🎖️ سلك الضباط</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع</button></div>';
    if (!(OFF.locked && !a)) h += offStepsHtml(a);
    if (!a && OFF.locked) h += offLockedHtml();
    else if (!a) h += offFormHtml();
    else if (a.stage === 'pending') h += offPendingHtml();
    else if (a.stage === 'interview') h += offInterviewHtml(a);
    else if (a.stage === 'training') h += offTrainingHtml(a);
    else if (a.stage === 'officer') h += offOfficerHtml(a);
    else h += offRejectedHtml(a);
    root.innerHTML = h;
    if (OFF.tick) { clearInterval(OFF.tick); OFF.tick = null; }
    if (a && a.stage === 'interview') { OFF.tick = setInterval(offTick, 1000); offTick(); }
}
function offLockedHtml() {
    return '<div class="card center"><div style="font-size:54px;">🔒</div><h3>تم قفل سلك الضباط</h3>' +
        '<p style="color:var(--muted);line-height:1.9;">شكراً لكم على اهتمامكم.</p></div>';
}
function offFormHtml() {
    var h = '<div class="card"><h2>🎖️ سلك الضباط | استبيان التقديم</h2>';
    h += '<label>الاسم:</label><input id="off-f-name" maxlength="60" value="' + spEsc((ME && ME.registeredName) || '') + '">';
    h += '<label>كم عمرك الحقيقي؟ (بالأرقام أو بالحروف):</label><input id="off-f-age" maxlength="30" placeholder="مثال: 17 أو سبعة عشر">';
    h += '<label>خبراتك السابقة في سلك الضباط:</label><textarea id="off-f-exp" rows="2" maxlength="400" placeholder="اكتب خبراتك، وإذا ما عندك اكتب: لا يوجد"></textarea>';
    h += '<label>يوزرك في الديسكورد:</label><input id="off-f-ds" maxlength="60" dir="ltr" placeholder="username">';
    h += '<div style="text-align:center;color:var(--muted);margin:14px 0;">━━━━━━━━━━━━━━━━━━</div>';
    OFF.questions.forEach(function (q, i) {
        h += '<label>' + (i + 1) + '- ' + spEsc(q) + '</label><textarea class="off-f-q" rows="3" maxlength="1500"></textarea>';
    });
    h += '<button class="btn" onclick="offSubmitApply()">📨 إرسال التقديم</button></div>';
    return h;
}
async function offSubmitApply() {
    var name = document.getElementById('off-f-name').value.trim();
    var exp = document.getElementById('off-f-exp').value.trim();
    var ds = document.getElementById('off-f-ds').value.trim();
    var age = document.getElementById('off-f-age').value.trim();
    var answers = Array.prototype.map.call(document.querySelectorAll('.off-f-q'), function (t) { return t.value.trim(); });
    if (name.length < 2) return toast('اكتب اسمك');
    if (!exp) return toast('اكتب خبراتك السابقة (أو اكتب: لا يوجد)');
    if (ds.length < 2) return toast('اكتب يوزرك في الديسكورد');
    if (!age) return toast('اكتب عمرك الحقيقي');
    var miss = answers.findIndex(function (x) { return !x; });
    if (miss >= 0) return toast('جاوب على السؤال رقم ' + (miss + 1));
    try {
        var r = await api('/api/officers/apply', { method: 'POST', body: JSON.stringify({ name: name, prevExperience: exp, discordUser: ds, age: age, answers: answers }) });
        toast('✅ تم إرسال تقديمك');
        if (r && r.ageNote) {
            offModalOpen('<h3>' + (r.ageLevel === 'warn' ? '⚠️' : '📌') + ' تنبيه بخصوص العمر</h3><p style="line-height:1.9;margin:10px 0 16px;">' + spEsc(r.ageNote) + '</p><button class="btn" onclick="offModalClose();offLoadMe(false)">فهمت</button>');
        } else offLoadMe(false);
    } catch (e) { toast(e.message); }
}
function offPendingHtml() {
    return '<div class="card center"><div style="font-size:54px;">⏳</div><h3>انتظر قبولك</h3>' +
        '<p style="color:var(--muted);line-height:1.9;">وصل تقديمك للكبار، وبانتظار قرارهم. إذا انقبل تقديمك يظهر لك هنا موعد المقابلة.</p></div>';
}
function offInterviewHtml(a) {
    var iv = a.interview || {};
    var h = '<div class="card"><h2>🎙️ المقابلة</h2>';
    h += '<p>تم قبول تقديمك ✅ وهذا موعد مقابلتك:</p>';
    h += '<div class="stat" style="margin:10px 0;"><div class="num" style="font-size:18px;">' + spEsc(offFmt(iv.at)) + '</div><div class="lbl">روم المقابلة رقم ' + iv.room + ' (بتوقيت السعودية)</div></div>';
    h += '<h3>📋 تعليمات المقابلة</h3><ul class="off-rules">';
    h += '<li>تأكد إن المايك شغال وسماعتك تمام قبل لا تدخل.</li>';
    h += '<li>الزر ينفتح قبل الموعد بخمس دقايق، ادخل بدري وخلك جاهز.</li>';
    h += '<li>لا تتكلم إلا إذا الكبير فتح لك المايك، وانتظر دورك.</li>';
    h += '<li>خلك جاد ومحترم وجاوب بوضوح وبدون استهبال.</li>';
    h += '<li>ممنوع تسجل المقابلة أو تصورها أو تنشرها.</li>';
    h += '<li>لا تطلع من الروم إلا إذا قالوا لك.</li>';
    h += '<li>بعد ما تخلص انتظر النتيجة هنا في الموقع.</li>';
    h += '</ul>';
    h += '<button class="btn gold" id="off-enter-btn" onclick="offEnterClick()">🔒 دخول الروم الصوتي</button>';
    if (iv.entered) h += '<div class="off-res">✅ سبق ودخلت المقابلة، انتظر قرار الكبار.</div>';
    h += '</div>';
    return h;
}
function offTick() {
    var b = document.getElementById('off-enter-btn');
    if (!b || !OFF.my || OFF.my.stage !== 'interview') { if (OFF.tick) { clearInterval(OFF.tick); OFF.tick = null; } return; }
    var at = new Date(OFF.my.interview.at).getTime();
    var left = at - 5 * 60 * 1000 - offNow();
    if (left > 0) {
        b.disabled = true; b.style.opacity = '0.5';
        b.textContent = '🔒 دخول الروم الصوتي — ينفتح بعد ' + offCountdown(left);
    } else {
        b.disabled = false; b.style.opacity = '';
        b.textContent = '🎙️ دخول الروم الصوتي';
    }
}
function offEnterClick() {
    if (!OFF.my || !OFF.my.interview) return;
    var at = new Date(OFF.my.interview.at).getTime();
    if (offNow() < at - 5 * 60 * 1000) return toast('الروم لسا مقفل');
    offJoinVoice(OFF.my.interview.room);
}
function offTrainingHtml(a) {
    var t = a.training || {};
    var h = '<div class="card"><h2>🏋️ التدريب</h2>';
    h += '<p>تم قبولك من المقابلة ✅</p>';
    if (!t.registered) h += '<div class="off-res">⏳ بانتظار الكبار يسجلونك متدرب.</div>';
    else if (!t.attended) h += '<div class="off-res">📝 تم تسجيلك متدرب، انتظر موعد التدريب من الكبار.</div>';
    else h += '<div class="off-res">✅ تم تسجيل حضورك للتدريب، بانتظار قرار الكبار النهائي.</div>';
    h += '<h3 style="margin-top:16px;">⚠️ تعليمات التدريب (صارمة)</h3><ul class="off-rules strict">';
    h += '<li>لازم تدخل بدري قبل موعد التدريب، والتأخير يعرضك للرفض.</li>';
    h += '<li>لازم تكون حاضر وموجود طول التدريب، ممنوع الغياب أو الانسحاب.</li>';
    h += '<li>التزم بكل أوامر وتعليمات الكبار بدون نقاش.</li>';
    h += '<li>ممنوع الاستهتار أو المزح أو الإزعاج أثناء التدريب.</li>';
    h += '<li>جهّز مايكك وحسابك قبل التدريب ولا تضيع وقت الباقين.</li>';
    h += '<li>قرار القبول أو الرفض بعد التدريب من الكبار ونهائي.</li>';
    h += '</ul></div>';
    return h;
}
function offOfficerHtml(a) {
    return '<div class="card center"><div style="font-size:60px;">🎖️</div><h2>مبروك! صرت ضابط</h2>' +
        '<p style="color:var(--gold-soft);font-size:18px;font-weight:800;">رتبتك: ' + spEsc(a.officerRank || '') + '</p></div>';
}
function offRejectedHtml(a) {
    var msg = a.rejectedAt === 'application' ? 'للأسف تم رفض تقديمك.' : (a.rejectedAt === 'interview' ? 'للأسف تم رفضك بعد المقابلة.' : 'للأسف تم رفضك بعد التدريب.');
    return '<div class="card center"><div style="font-size:54px;">❌</div><h3>' + msg + '</h3>' +
        '<p style="color:var(--muted);line-height:1.9;">لو عندك استفسار تواصل مع الكبار.</p></div>';
}

/* ---------------------------- الروم الصوتي (WebRTC) ---------------------------- */
function offFindP(st, uid) {
    for (var i = 0; i < st.participants.length; i++) if (st.participants[i].uid === uid) return st.participants[i];
    return null;
}
/* هل from يقدر يسمعه to ؟ */
function offAllowed(st, from, to) {
    if (from === to) return false;
    var f = offFindP(st, from), t = offFindP(st, to);
    if (!f || !t) return false;
    if (f.isSenior && t.isSenior) return true;
    var sp = st.speakerUid, mode = st.mode;
    if (mode === 'mute') return false;
    if (f.isSenior) {
        if (mode === 'private') return to === sp;
        return true;
    }
    if (mode === 'open') return true;
    if (mode === 'mute') return false;
    if (from !== sp) return false;
    return t.isSenior;
}
function offCanSpeak() {
    if (!VC) return false;
    return VC.state.participants.some(function (p) { return p.uid !== VC.me && offAllowed(VC.state, VC.me, p.uid); });
}
function offCanShare() {
    if (!VC) return false;
    return VC.isSenior || offCanSpeak();
}
function offModeDesc(m) {
    if (m === 'private') return 'الكبار والمتحدث بس يسمعون بعض، وباقي المتقدمين ما يسمعون شي.';
    if (m === 'listen') return 'الكبار فقط الي يتكلمون، والمتقدمين يسمعونهم بس. والمتقدم الي تفتح له المايك يسمعه الكبار فقط.';
    if (m === 'open') return 'الكل يتكلم ويسمع.';
    return 'محد يتكلم ولا أحد يسمع من المتقدمين، والكبار فقط هم اللي يسمعون بعض.';
}
function offSignal(uid, data) {
    if (!VC) return;
    offPost('/api/officers/rooms/' + VC.n + '/signal', { to: uid, data: data }).catch(function () {});
}
function offSignalAll(data) {
    if (!VC) return;
    Object.keys(VC.peers).forEach(function (uid) { offSignal(uid, data); });
}
function offQueue(uid, fn) {
    if (!VC) return;
    VC.q[uid] = (VC.q[uid] || Promise.resolve()).then(fn).catch(function () {});
}

async function offJoinVoice(n) {
    if (VC) { toast('أنت داخل روم حالياً'); return; }
    if (!window.RTCPeerConnection || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('متصفحك لا يدعم الصوت، استخدم Chrome أو Safari حديث');
        return;
    }
    var stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    } catch (e) { toast('تعذر تشغيل المايك — اسمح للموقع باستخدام المايك'); return; }
    var j;
    try { j = await offPost('/api/officers/rooms/' + n + '/join', {}); }
    catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); toast(e.message); return; }
    VC = {
        n: n, me: ME.discordId, isSenior: !!ME.isSeniorAdmin, stream: stream, mic: stream.getAudioTracks()[0], micOn: true,
        state: j.state, ice: j.iceServers, peers: {}, q: {}, earlyIce: {}, shareFlags: {}, speaking: {},
        sharing: false, screenStream: null, screenTrack: null, timers: [], ac: null, poll: null, lastRestart: 0
    };
    var ov = document.createElement('div');
    ov.id = 'off-voice';
    ov.innerHTML = '<div class="ov-head"><b>🎙️ مقابلة رقم ' + n + '</b><span style="font-size:12px;color:var(--muted);">' + (VC.isSenior ? '🎖️ من الكبار' : 'متقدم') + '</span></div>' +
        '<div id="ov-modes" class="ov-modes"></div><div id="ov-note" class="ov-note"></div>' +
        '<div id="ov-stage" class="ov-stage"></div><div id="ov-grid" class="ov-grid"></div>' +
        '<div id="ov-bar" class="ov-bar"></div><div id="ov-audio" style="display:none"></div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    offWatch(VC.me, stream, null);
    (j.existing || []).forEach(function (uid) { var P = offMakePeer(uid, true); offStartOffer(P, false); });
    offApplyPerms();
    offPaintAll();
    offRecCheck();
    VC.poll = setInterval(offVoicePoll, 5000);
}

function offMakePeer(uid, initiator) {
    var v = VC;
    var pc = new RTCPeerConnection({ iceServers: v.ice });
    var pj = offFindP(v.state, uid);
    var P = {
        uid: uid, pc: pc, initiator: initiator, aSender: null, vSender: null, aCur: undefined, vCur: undefined,
        pendingIce: v.earlyIce[uid] || [], audioEl: document.createElement('audio'), videoEl: null, videoTrack: null,
        joinedAt: pj ? pj.joinedAt : null, watchT: null, stream: null
    };
    delete v.earlyIce[uid];
    P.audioEl.autoplay = true;
    P.audioEl.setAttribute('playsinline', '');
    document.getElementById('ov-audio').appendChild(P.audioEl);
    v.peers[uid] = P;
    if (initiator) {
        var ta = pc.addTransceiver('audio', { direction: 'sendrecv' });
        var tv = pc.addTransceiver('video', { direction: 'sendrecv' });
        P.aSender = ta.sender; P.vSender = tv.sender;
    }
    pc.onicecandidate = function (e) { if (e.candidate && VC === v) offSignal(uid, { ice: e.candidate }); };
    pc.ontrack = function (e) {
        if (VC !== v) return;
        if (e.track.kind === 'audio') {
            P.stream = new MediaStream([e.track]);
            offRecAddPeer(uid);
            P.audioEl.srcObject = P.stream;
            var pp = P.audioEl.play(); if (pp && pp.catch) pp.catch(function () {});
            offWatch(uid, P.stream, P);
        } else {
            P.videoTrack = e.track;
            P.videoEl = document.createElement('video');
            P.videoEl.autoplay = true; P.videoEl.muted = true;
            P.videoEl.setAttribute('playsinline', '');
            P.videoEl.srcObject = new MediaStream([e.track]);
            P.videoEl.onclick = function () { offFullscreen(this); };
            e.track.onunmute = function () { if (VC === v) offPaintStage(); };
            offPaintStage();
        }
        offApplyPerms();
    };
    pc.onconnectionstatechange = function () {
        if (pc.connectionState === 'failed' && P.initiator && VC === v && Date.now() - v.lastRestart > 8000) {
            v.lastRestart = Date.now();
            offStartOffer(P, true);
        }
    };
    return P;
}
function offRecSupported() { return !!(window.MediaRecorder && (window.AudioContext || window.webkitAudioContext)); }
function offRecMime() {
    var c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (var i = 0; i < c.length; i++) { try { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) {} }
    return '';
}
function offRecCheck() {
    var v = VC;
    if (!v || !v.isSenior || !offRecSupported()) return;
    var hasApplicant = v.state.participants.some(function (p) { return !p.isSenior; });
    if (v.rec) { if (!hasApplicant) offRecStopFor(v); return; }
    if (!hasApplicant || v.state.rec || v.recBusy || Date.now() < (v.recRetry || 0)) return;
    v.recBusy = true;
    offPost('/api/officers/rec/start', { n: v.n, mime: offRecMime() }).then(function (r) {
        v.recBusy = false;
        if (VC !== v || !r.ok) return;
        offRecBegin(v, r.sid);
    }).catch(function () { v.recBusy = false; v.recRetry = Date.now() + 15000; });
}
function offRecBegin(v, sid) {
    try {
        if (!v.ac) v.ac = new (window.AudioContext || window.webkitAudioContext)();
        try { if (v.ac.state === 'suspended') v.ac.resume(); } catch (e) {}
        var dest = v.ac.createMediaStreamDestination();
        var micSrc = v.ac.createMediaStreamSource(v.stream);
        var gain = v.ac.createGain();
        gain.gain.value = (v.micOn && offCanSpeak()) ? 1 : 0;
        micSrc.connect(gain); gain.connect(dest);
        var mime = offRecMime();
        var rec = { sid: sid, dest: dest, gain: gain, micSrc: micSrc, nodes: {}, seq: 0, q: Promise.resolve(), mr: null, ev: [], t0: performance.now() };
        v.rec = rec;
        Object.keys(v.peers).forEach(function (uid) { offRecAddPeer(uid); });
        var mr = new MediaRecorder(dest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
        mr.ondataavailable = function (e) {
            if (e.data && e.data.size) offRecUpload(rec, e.data);
            rec.q = rec.q.then(function () { return offRecFlushEv(rec); });
        };
        mr.onstop = function () { rec.q = rec.q.then(function () { return offRecFlushEv(rec); }).then(function () { return offPost('/api/officers/rec/stop', { sid: sid }); }).catch(function () {}); };
        rec.mr = mr;
        mr.start(10000);
        rec.t0 = performance.now();
        Object.keys(v.speaking).forEach(function (u) { if (v.speaking[u]) rec.ev.push([u, 1, 0]); });
    } catch (e) {
        v.rec = null;
        v.recRetry = Date.now() + 30000;
        offPost('/api/officers/rec/stop', { sid: sid }).catch(function () {});
    }
}
function offRecUpload(rec, blob) {
    var seq = rec.seq++;
    rec.q = rec.q.then(async function () {
        for (var i = 0; i < 3; i++) {
            try {
                var r = await fetch('/api/officers/rec/chunk?sid=' + encodeURIComponent(rec.sid) + '&seq=' + seq, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
                if (r.ok) return;
            } catch (e) {}
            await new Promise(function (ok) { setTimeout(ok, 1500); });
        }
    });
}
function offRecFlushEv(rec) {
    if (!rec.ev.length) return Promise.resolve();
    var batch = rec.ev;
    rec.ev = [];
    return fetch('/api/officers/rec/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: rec.sid, ev: batch }) })
        .then(function (r) { if (!r.ok) throw new Error('x'); })
        .catch(function () { rec.ev = batch.concat(rec.ev); });
}
function offRecAddPeer(uid) {
    var v = VC;
    if (!v || !v.rec) return;
    var P = v.peers[uid];
    if (!P || !P.stream) return;
    var cur = v.rec.nodes[uid];
    if (cur && cur.stream === P.stream) return;
    if (cur) { try { cur.src.disconnect(); } catch (e) {} }
    try {
        var src = v.ac.createMediaStreamSource(P.stream);
        src.connect(v.rec.dest);
        v.rec.nodes[uid] = { src: src, stream: P.stream };
    } catch (e) {}
}
function offRecDropPeer(uid) {
    if (!VC || !VC.rec) return;
    var cur = VC.rec.nodes[uid];
    if (cur) { try { cur.src.disconnect(); } catch (e) {} delete VC.rec.nodes[uid]; }
}
function offRecStopFor(v) {
    var rec = v.rec;
    if (!rec) return;
    v.rec = null;
    var o = Math.round(performance.now() - rec.t0);
    Object.keys(v.speaking).forEach(function (u) { if (v.speaking[u]) rec.ev.push([u, 0, o]); });
    try { if (rec.mr && rec.mr.state !== 'inactive') rec.mr.stop(); } catch (e) {}
    setTimeout(function () {
        Object.keys(rec.nodes).forEach(function (u) { try { rec.nodes[u].src.disconnect(); } catch (e) {} });
        try { rec.micSrc.disconnect(); } catch (e) {}
    }, 1500);
}
function offBindSenders(P) {
    P.pc.getTransceivers().forEach(function (t) {
        var kind = t.receiver && t.receiver.track ? t.receiver.track.kind : null;
        if (!kind) return;
        try { t.direction = 'sendrecv'; } catch (e) {}
        if (kind === 'audio') P.aSender = t.sender; else P.vSender = t.sender;
    });
}
async function offStartOffer(P, restart) {
    try {
        var o = await P.pc.createOffer(restart ? { iceRestart: true } : undefined);
        await P.pc.setLocalDescription(o);
        offSignal(P.uid, { sdp: P.pc.localDescription });
    } catch (e) {}
}
async function offFlushIce(P) {
    var list = P.pendingIce; P.pendingIce = [];
    for (var i = 0; i < list.length; i++) { try { await P.pc.addIceCandidate(list[i]); } catch (e) {} }
}
async function offOnSignal(from, data) {
    var v = VC;
    if (!v || !data) return;
    if (typeof data.share !== 'undefined') { v.shareFlags[from] = !!data.share; offPaintStage(); offPaintGrid(); return; }
    var P = v.peers[from];
    if (data.sdp) {
        if (data.sdp.type === 'offer') {
            var pj = offFindP(v.state, from);
            if (P && pj && P.joinedAt && P.joinedAt !== pj.joinedAt) { offClosePeer(from); P = null; }
            if (!P) P = offMakePeer(from, false);
            await P.pc.setRemoteDescription(data.sdp);
            if (VC !== v) return;
            offBindSenders(P);
            await offFlushIce(P);
            var ans = await P.pc.createAnswer();
            await P.pc.setLocalDescription(ans);
            offSignal(from, { sdp: P.pc.localDescription });
            if (v.sharing) offSignal(from, { share: true });
            offApplyPerms();
        } else if (data.sdp.type === 'answer' && P) {
            await P.pc.setRemoteDescription(data.sdp);
            await offFlushIce(P);
            if (v.sharing) offSignal(from, { share: true });
        }
    } else if (data.ice) {
        if (!P) { (v.earlyIce[from] = v.earlyIce[from] || []).push(data.ice); return; }
        if (P.pc.remoteDescription) { try { await P.pc.addIceCandidate(data.ice); } catch (e) {} }
        else P.pendingIce.push(data.ice);
    }
}
function offClosePeer(uid) {
    if (!VC) return;
    var P = VC.peers[uid];
    if (!P) return;
    if (P.watchT) clearInterval(P.watchT);
    offRecDropPeer(uid);
    try { P.pc.close(); } catch (e) {}
    if (P.audioEl && P.audioEl.parentNode) P.audioEl.parentNode.removeChild(P.audioEl);
    if (P.videoEl && P.videoEl.parentNode) P.videoEl.parentNode.removeChild(P.videoEl);
    delete VC.peers[uid];
    delete VC.shareFlags[uid];
    delete VC.speaking[uid];
}
function offOnVsig(d) {
    if (!VC || !d) return;
    if (d.t === 'state') offApplyState(d.state);
    else if (d.t === 'kicked' && d.n === VC.n) { toast('🚫 تم طردك من الروم'); offLeaveVoice(true); }
    else if (d.t === 'roomdeleted' && d.n === VC.n) { toast('🗑️ تم حذف هذا الروم'); offLeaveVoice(true); }
    else if (d.t === 'signal' && d.n === VC.n) offQueue(d.from, function () { return offOnSignal(d.from, d.data); });
}
function offApplyState(st) {
    if (!VC || !st || st.n !== VC.n) return;
    var meIn = st.participants.some(function (p) { return p.uid === VC.me; });
    if (!meIn) { toast('انقطع اتصالك بالروم'); offLeaveVoice(true); return; }
    VC.state = st;
    offRecCheck();
    Object.keys(VC.peers).forEach(function (uid) {
        var p = offFindP(st, uid);
        if (!p || (VC.peers[uid].joinedAt && p.joinedAt !== VC.peers[uid].joinedAt)) offClosePeer(uid);
    });
    offApplyPerms();
    offPaintAll();
}
async function offVoicePoll() {
    if (!VC) return;
    var n = VC.n;
    try {
        var d = await offFetch('/api/officers/rooms/' + n + '/state');
        if (VC && VC.n === n) offApplyState(d.state);
    } catch (e) {
        if (e.status === 404 || e.status === 403 || e.status === 401) { if (VC && VC.n === n) { toast('انقطع اتصالك بالروم'); offLeaveVoice(true); } }
    }
}
/* تطبيق صلاحيات الصوت والشاشة لكل شخص */
function offApplyPerms() {
    if (!VC) return;
    var st = VC.state, me = VC.me;
    if (VC.rec) VC.rec.gain.gain.value = (VC.micOn && offCanSpeak()) ? 1 : 0;
    if (VC.screenTrack && !offCanShare()) offStopShare();
    Object.keys(VC.peers).forEach(function (uid) {
        var P = VC.peers[uid];
        if (!P.aSender || !P.vSender) offBindSenders(P);
        var okSend = offAllowed(st, me, uid);
        var audio = (okSend && VC.micOn) ? VC.mic : null;
        var video = (okSend && VC.screenTrack) ? VC.screenTrack : null;
        if (P.aSender && P.aCur !== audio) { P.aCur = audio; P.aSender.replaceTrack(audio).catch(function () {}); }
        if (P.vSender && P.vCur !== video) { P.vCur = video; P.vSender.replaceTrack(video).catch(function () {}); }
        P.audioEl.muted = !offAllowed(st, uid, me);
    });
}
function offWatch(uid, stream, P) {
    try {
        if (!VC) return;
        if (!VC.ac) VC.ac = new (window.AudioContext || window.webkitAudioContext)();
        var src = VC.ac.createMediaStreamSource(stream);
        var an = VC.ac.createAnalyser(); an.fftSize = 512;
        src.connect(an);
        var buf = new Uint8Array(an.fftSize);
        var v = VC;
        var t = setInterval(function () {
            if (VC !== v) { clearInterval(t); return; }
            an.getByteTimeDomainData(buf);
            var s = 0;
            for (var i = 0; i < buf.length; i++) { var x = (buf[i] - 128) / 128; s += x * x; }
            var on = Math.sqrt(s / buf.length) > 0.04;
            if (uid === v.me) on = on && v.micOn && offCanSpeak();
            else on = on && offAllowed(v.state, uid, v.me);
            if (v.speaking[uid] !== on) {
                v.speaking[uid] = on;
                if (v.rec) v.rec.ev.push([uid, on ? 1 : 0, Math.round(performance.now() - v.rec.t0)]);
                var el = document.getElementById('vt-' + uid);
                if (el) el.classList.toggle('speaking', on);
            }
        }, 200);
        if (P) P.watchT = t; else v.timers.push(t);
    } catch (e) {}
}

/* رسم واجهة الروم */
function offPaintAll() { offPaintModes(); offPaintNote(); offPaintStage(); offPaintGrid(); offPaintBar(); }
function offPaintModes() {
    var box = document.getElementById('ov-modes');
    if (!box || !VC) return;
    if (!VC.isSenior) { box.innerHTML = ''; return; }
    box.innerHTML = OFF_MODES.map(function (m) {
        return '<button class="ov-mode' + (VC.state.mode === m.k ? ' on' : '') + '" data-m="' + m.k + '" onclick="offSetMode(this.dataset.m)">' + m.t + '</button>';
    }).join('');
}
function offPaintNote() {
    var box = document.getElementById('ov-note');
    if (!box || !VC) return;
    if (VC.isSenior) box.textContent = offModeDesc(VC.state.mode) + ' — اضغط زر فتح المايك تحت اسم المتقدم.';
    else box.textContent = VC.state.mode === 'mute' ? '🔇 الروم صامت حالياً — ما أحد يتكلم ولا تسمع شي، الكبار فقط يسمعون بعض.' : (offCanSpeak() ? '🎙️ المايك مفتوح لك، تكلم.' : '🔇 أنت مستمع فقط — انتظر الكبير يفتح لك المايك.');
    if (VC.state.rec) box.textContent += ' 🔴 المقابلة مسجّلة صوتياً.';
}
function offPaintGrid() {
    var box = document.getElementById('ov-grid');
    if (!box || !VC) return;
    var st = VC.state;
    box.innerHTML = st.participants.map(function (p) {
        var isMe = p.uid === VC.me;
        var sel = st.speakerUid === p.uid;
        var cls = 'ov-tile' + (VC.speaking[p.uid] ? ' speaking' : '') + (sel ? ' sel' : '');
        var canTalk = st.participants.some(function (q) { return q.uid !== p.uid && offAllowed(st, p.uid, q.uid); });
        var sharing = isMe ? VC.sharing : !!VC.shareFlags[p.uid];
        var h = '<div class="' + cls + '" id="vt-' + p.uid + '">';
        h += '<div class="ov-av">' + spEsc((p.name || '?').trim().charAt(0)) + '</div>';
        h += '<div class="ov-name">' + spEsc(p.name) + (isMe ? ' (أنت)' : '') + '</div>';
        h += '<div class="ov-role">' + (p.isSenior ? '🎖️ من الكبار' : 'متقدم') + '</div>';
        h += '<div class="ov-ic">' + (canTalk ? '🎙️' : '🔇') + (sharing ? ' 🖥️' : '') + '</div>';
        if (VC.isSenior && !p.isSenior) {
            h += '<button class="btn sm' + (sel ? ' danger' : '') + '" data-u="' + p.uid + '" onclick="offSetSpeaker(this.dataset.u)">' + (sel ? '🔇 إسكات' : '🎙️ فتح المايك') + '</button>';
            h += '<button class="btn sm danger" data-u="' + p.uid + '" onclick="offKick(this.dataset.u)">🚫 طرد</button>';
        }
        return h + '</div>';
    }).join('');
}
function offPaintStage() {
    var box = document.getElementById('ov-stage');
    if (!box || !VC) return;
    var want = [];
    Object.keys(VC.peers).forEach(function (uid) {
        var P = VC.peers[uid];
        if (P.videoEl && VC.shareFlags[uid] && offAllowed(VC.state, uid, VC.me)) want.push(P);
    });
    Array.prototype.slice.call(box.children).forEach(function (el) {
        var keep = want.some(function (P) { return P.wrap === el; });
        if (!keep) box.removeChild(el);
    });
    want.forEach(function (P) {
        if (!P.wrap) {
            var p = offFindP(VC.state, P.uid);
            var w = document.createElement('div');
            w.className = 'ov-vwrap';
            var cap = document.createElement('div');
            cap.className = 'ov-vcap';
            cap.textContent = '🖥️ شاشة ' + (p ? p.name : '') + ' — اضغط على الشاشة للتكبير';
            w.appendChild(P.videoEl); w.appendChild(cap);
            P.wrap = w;
        }
        if (!P.wrap.parentNode) box.appendChild(P.wrap);
        var pp = P.videoEl.play(); if (pp && pp.catch) pp.catch(function () {});
    });
    if (VC.sharing && !document.getElementById('ov-self-share')) {
        var s = document.createElement('div');
        s.id = 'ov-self-share'; s.className = 'ov-note'; s.textContent = '🖥️ أنت تشارك شاشتك الحين';
        box.appendChild(s);
    } else if (!VC.sharing) {
        var old = document.getElementById('ov-self-share');
        if (old) old.remove();
    }
}
function offPaintBar() {
    var box = document.getElementById('ov-bar');
    if (!box || !VC) return;
    var canSpeak = offCanSpeak();
    var micCls = 'ov-btn' + (!canSpeak ? ' dis' : (VC.micOn ? '' : ' off'));
    var micTxt = !canSpeak ? '🔇 مقفل' : (VC.micOn ? '🎙️ المايك' : '🔇 مكتوم');
    var shCls = 'ov-btn' + ((!offCanShare() && !VC.sharing) ? ' dis' : (VC.sharing ? ' off' : ''));
    var shTxt = VC.sharing ? '⏹️ إيقاف المشاركة' : '🖥️ مشاركة الشاشة';
    box.innerHTML = '<button class="' + micCls + '" onclick="offToggleMic()">' + micTxt + '</button>' +
        '<button class="' + shCls + '" onclick="offToggleShare()">' + shTxt + '</button>' +
        '<button class="ov-btn leave" onclick="offLeaveVoice(false)">📞 خروج</button>';
}
function offToggleMic() {
    if (!VC) return;
    if (!offCanSpeak()) { toast('أنت مستمع فقط، الكبار هم الي يتكلمون'); return; }
    VC.micOn = !VC.micOn;
    offApplyPerms(); offPaintBar();
}
async function offToggleShare() {
    if (!VC) return;
    if (VC.sharing) { offStopShare(); return; }
    if (!offCanShare()) { toast('ما يمديك تشارك الشاشة الحين'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { toast('مشاركة الشاشة ما تشتغل على الجوال، استخدم الكمبيوتر'); return; }
    var ds;
    try {
        ds = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
    } catch (e) {
        toast('ما تمت مشاركة الشاشة — تأكد إنك سمحت للمتصفح');
        return;
    }
    if (!VC) { ds.getTracks().forEach(function (t) { t.stop(); }); return; }
    var tr = ds.getVideoTracks()[0];
    if (!tr) { ds.getTracks().forEach(function (t) { t.stop(); }); toast('ما وصل فيديو من الشاشة'); return; }
    try { tr.contentHint = 'detail'; } catch (e) {}
    VC.screenStream = ds;
    VC.screenTrack = tr;
    tr.onended = function () { offStopShare(); };
    VC.sharing = true;
    offSignalAll({ share: true });
    offApplyPerms(); offPaintStage(); offPaintGrid(); offPaintBar();
}
function offFullscreen(el) {
    try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            return;
        }
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
    } catch (e) {}
}
function offStopShare() {
    if (!VC || !VC.sharing) return;
    try { if (VC.screenStream) VC.screenStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    VC.screenStream = null; VC.screenTrack = null; VC.sharing = false;
    offSignalAll({ share: false });
    offApplyPerms(); offPaintStage(); offPaintGrid(); offPaintBar();
}
function offSetMode(mode) {
    if (!VC) return;
    offPost('/api/officers/rooms/' + VC.n + '/mode', { mode: mode }).catch(function (e) { toast(e.message); });
}
async function offKick(uid) {
    if (!VC) return;
    var p = offFindP(VC.state, uid);
    if (!(await confirmModal('تطرد ' + (p ? p.name : 'هذا الشخص') + ' من الروم؟'))) return;
    offPost('/api/officers/rooms/' + VC.n + '/kick', { uid: uid }).then(function () { toast('🚫 تم الطرد'); }).catch(function (e) { toast(e.message); });
}
function offSetSpeaker(uid) {
    if (!VC) return;
    var next = VC.state.speakerUid === uid ? null : uid;
    offPost('/api/officers/rooms/' + VC.n + '/speaker', { uid: next }).catch(function (e) { toast(e.message); });
}
function offLeaveVoice(silent) {
    var v = VC;
    if (!v) return;
    VC = null;
    if (v.poll) clearInterval(v.poll);
    v.timers.forEach(function (t) { clearInterval(t); });
    Object.keys(v.peers).forEach(function (uid) {
        var P = v.peers[uid];
        if (P.watchT) clearInterval(P.watchT);
        try { P.pc.close(); } catch (e) {}
    });
    try { v.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (v.screenStream) v.screenStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    if (v.rec) {
        offRecStopFor(v);
        var acRef = v.ac;
        setTimeout(function () { try { if (acRef) acRef.close(); } catch (e) {} }, 2500);
    } else {
        try { if (v.ac) v.ac.close(); } catch (e) {}
    }
    var el = document.getElementById('off-voice');
    if (el) el.remove();
    document.body.style.overflow = '';
    if (!silent) offPost('/api/officers/rooms/' + v.n + '/leave', {}).catch(function () {});
    if (document.getElementById('off-root')) offLoadMe(false);
    if (document.getElementById('offa-content')) offaReload(false);
}
window.addEventListener('pagehide', function () {
    if (VC) { try { navigator.sendBeacon('/api/officers/rooms/' + VC.n + '/leave'); } catch (e) {} }
});

/* ---------------------------- صفحة الكبار ---------------------------- */
function renderOfficerAdmin(tab) {
    if (!ME || !ME.isSeniorAdmin) return;
    if (!document.getElementById('admin-content')) { renderAdmin('officers'); return; }
    offStopTimers();
    OFFA.tab = (typeof tab === 'string') ? tab : 'apps';
    OFFA.sig = '';
    OFFA.data = null;
    var tabs = [['apps', '📥 التقديمات'], ['rooms', '🎙️ المقابلة'], ['log', '📼 تسجيل المقابلة'], ['train', '🏋️ التدريب']];
    document.getElementById('admin-content').innerHTML =
        '<div class="tabs" id="offa-tabs" style="margin-top:4px;">' + tabs.map(function (t) {
            return '<div class="tab' + (t[0] === OFFA.tab ? ' active' : '') + '" data-t="' + t[0] + '" onclick="offaTab(this.dataset.t)">' + t[1] + '</div>';
        }).join('') + '</div><div id="offa-content"><div class="card">جارِ التحميل...</div></div>';
    offaReload(false);
    OFFA.timer = setInterval(function () {
        if (!document.getElementById('offa-content')) { clearInterval(OFFA.timer); OFFA.timer = null; return; }
        offaReload(true);
    }, 4000);
}
function offaTab(name) {
    OFFA.tab = name; OFFA.sig = '';
    Array.prototype.forEach.call(document.querySelectorAll('#offa-tabs .tab'), function (t) { t.classList.toggle('active', t.dataset.t === name); });
    document.getElementById('offa-content').innerHTML = '<div class="card">جارِ التحميل...</div>';
    offaReload(false);
}
async function offaReload(silent) {
    if (silent && (VC || OFFA.tab === 'log')) return;
    var tab = OFFA.tab;
    var urls = { apps: '/api/officers/admin/applications', rooms: '/api/officers/admin/rooms', log: '/api/officers/admin/interview-log', train: '/api/officers/admin/training' };
    try {
        var d = await offFetch(urls[tab]);
        if (tab !== OFFA.tab) return;
        var sig = tab + JSON.stringify(d);
        if (silent && sig === OFFA.sig) return;
        OFFA.sig = sig; OFFA.data = d;
        offaPaint();
    } catch (e) { if (!silent) toast(e.message); }
}
function offaPaint() {
    var box = document.getElementById('offa-content');
    if (!box || !OFFA.data) return;
    if (OFFA.tab === 'apps') box.innerHTML = offaAppsHtml(OFFA.data);
    else if (OFFA.tab === 'rooms') box.innerHTML = offaRoomsHtml(OFFA.data);
    else if (OFFA.tab === 'log') box.innerHTML = offaLogHtml(OFFA.data);
    else box.innerHTML = offaTrainHtml(OFFA.data);
}
function offaStageText(a) {
    if (a.stage === 'interview') return 'في المقابلة';
    if (a.stage === 'training') return 'في التدريب';
    if (a.stage === 'officer') return 'ضابط — ' + (a.officerRank || '');
    if (a.stage === 'rejected') return 'مرفوض (' + (a.rejectedAt === 'application' ? 'التقديم' : (a.rejectedAt === 'interview' ? 'المقابلة' : 'التدريب')) + ')';
    return a.stage;
}
function offaAppsHtml(d) {
    var h = '';
    if (!d.pending.length) h += '<div class="card" style="color:var(--muted);">لا توجد تقديمات جديدة حالياً</div>';
    d.pending.forEach(function (a) {
        var chk = OFFA.checks[a.id];
        h += '<div class="card"><div class="row"><h3>' + spEsc(a.name) + '</h3><span class="badge pending">بانتظار القرار</span></div>';
        h += '<div class="acc-row"><span>العمر</span><b>' + (a.age ? spEsc(String(a.age)) : 'غير مسجل') + '</b></div>';
        h += '<div class="acc-row"><span>الخبرات السابقة</span><b>' + spEsc(a.prevExperience) + '</b></div>';
        h += '<div class="acc-row"><span>يوزر الديسكورد</span><b dir="ltr">' + spEsc(a.discordUser) + '</b></div>';
        h += '<div style="margin:8px 0;"><button class="btn sm gold" data-id="' + a.id + '" onclick="offaCheck(this.dataset.id)">🔍 فحص اليوزر</button></div>';
        if (chk) {
            if (chk.error) h += '<div class="off-res">⚠️ ' + spEsc(chk.error) + '</div>';
            else h += '<div class="off-res">' + (chk.inServer ? '✅ داخل السيرفر' : '❌ غير موجود داخل السيرفر') +
                '<br>الاسم في الديسكورد: <b>' + spEsc(chk.discordName || 'غير معروف') + '</b></div>';
        }
        h += '<details style="margin:10px 0;"><summary style="cursor:pointer;color:var(--gold-soft);">📄 عرض إجابات الاستبيان</summary>';
        a.answers.forEach(function (ans, i) {
            h += '<div class="off-qa"><b>' + (i + 1) + '- ' + spEsc(d.questions[i] || '') + '</b><div>' + spEsc(ans) + '</div></div>';
        });
        h += '</details>';
        h += '<div class="row" style="justify-content:flex-start;"><button class="btn" data-id="' + a.id + '" onclick="offaApprove(this.dataset.id)">✅ قبول</button>' +
            '<button class="btn danger" data-id="' + a.id + '" onclick="offaReject(this.dataset.id)">❌ رفض</button></div></div>';
    });
    if (d.history.length) {
        h += '<div class="card"><h3>📚 السجل</h3>';
        d.history.forEach(function (a) {
            h += '<div class="log-item"><span>' + spEsc(a.name) + ' — ' + spEsc(offaStageText(a)) + '</span>' +
                '<button class="btn danger sm" data-id="' + a.id + '" onclick="offaDelete(this.dataset.id)">🗑️</button></div>';
        });
        h += '</div>';
    }
    return h;
}
async function offaCheck(id) {
    OFFA.checks[id] = { error: 'جارِ الفحص...' };
    offaPaint();
    try { OFFA.checks[id] = await api('/api/officers/admin/applications/' + id + '/check-user', { method: 'POST', body: '{}' }); }
    catch (e) { OFFA.checks[id] = { error: e.message }; }
    offaPaint();
}
async function offaApprove(id) {
    var rooms = [1];
    try { var r = await offFetch('/api/officers/admin/rooms'); rooms = r.rooms.map(function (x) { return x.n; }); } catch (e) {}
    var today = '';
    try { today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }); } catch (e) {}
    var hours = '';
    for (var i = 0; i < 24; i++) {
        var lbl = (i % 12 === 0 ? 12 : i % 12) + ' ' + (i < 12 ? 'صباحاً' : 'مساءً');
        hours += '<option value="' + i + '">' + lbl + '</option>';
    }
    var roomOpts = rooms.map(function (n) { return '<option value="' + n + '">مقابلة ' + n + '</option>'; }).join('');
    offModalOpen('<h3>📅 موعد المقابلة</h3>' +
        '<label>اليوم</label><input type="date" id="offm-date" value="' + today + '">' +
        '<label>الساعة</label><select id="offm-hour">' + hours + '</select>' +
        '<label>الدقيقة (اكتبها أنت)</label><input type="number" id="offm-min" min="0" max="59" value="0">' +
        '<label>الروم</label><select id="offm-room">' + roomOpts + '</select>' +
        '<div class="row" style="justify-content:flex-start;"><button class="btn" data-id="' + id + '" onclick="offaSubmitApprove(this.dataset.id)">✅ قبول وتحديد الموعد</button>' +
        '<button class="btn gray" onclick="offModalClose()">إلغاء</button></div>');
}
async function offaSubmitApprove(id) {
    var body = {
        date: document.getElementById('offm-date').value,
        hour: document.getElementById('offm-hour').value,
        minute: document.getElementById('offm-min').value,
        room: document.getElementById('offm-room').value
    };
    if (!body.date) return toast('حدد اليوم');
    if (body.minute === '') return toast('اكتب الدقيقة');
    try {
        await api('/api/officers/admin/applications/' + id + '/approve', { method: 'POST', body: JSON.stringify(body) });
        offModalClose(); toast('✅ تم القبول وتحديد الموعد');
        offaReload(false);
    } catch (e) { toast(e.message); }
}
async function offaReject(id) {
    if (!(await confirmModal('متأكد تبي ترفض هذا التقديم؟'))) return;
    try { await api('/api/officers/admin/applications/' + id + '/reject', { method: 'POST', body: '{}' }); toast('تم الرفض'); offaReload(false); }
    catch (e) { toast(e.message); }
}
async function offaDelete(id) {
    if (!(await confirmModal('متأكد تبي تحذف هذا الطلب نهائياً؟ (يقدر يقدم من جديد)'))) return;
    try { await api('/api/officers/admin/applications/' + id, { method: 'DELETE' }); toast('تم الحذف'); offaReload(false); }
    catch (e) { toast(e.message); }
}
function offaRoomsHtml(d) {
    var max = d.max || 5;
    var h = '<div class="card row"><span style="color:var(--muted);">رومات المقابلات (' + d.rooms.length + '/' + max + ')</span>' +
        (d.rooms.length >= max ? '<span style="color:var(--muted);font-size:12px;">وصلت الحد الأقصى</span>' : '<button class="btn gold sm" onclick="offaNewRoom()">➕ روم جديد</button>') + '</div>';
    d.rooms.forEach(function (r) {
        h += '<div class="card"><div class="row"><h3>🎙️ مقابلة ' + r.n + '</h3><span style="display:flex;gap:6px;"><button class="btn sm" data-n="' + r.n + '" onclick="offaEnterRoom(this.dataset.n)">دخول الروم الصوتي</button>' +
            (d.rooms.length > 1 ? '<button class="btn danger sm" data-n="' + r.n + '" onclick="offaDeleteRoom(this.dataset.n)">🗑️ حذف</button>' : '') + '</span></div>';
        h += '<div style="margin:8px 0;"><b style="color:var(--gold-soft);font-size:13px;">الداخلين الحين (' + r.participants.length + ')</b><div style="margin-top:6px;">';
        if (!r.participants.length) h += '<span style="color:var(--muted);font-size:13px;">ما أحد داخل</span>';
        r.participants.forEach(function (p) { h += '<span class="off-chip' + (p.isSenior ? ' sen' : '') + '">' + (p.isSenior ? '🎖️ ' : '') + spEsc(p.name) + '</span>'; });
        h += '</div></div>';
        h += '<div style="margin:8px 0;"><b style="color:var(--gold-soft);font-size:13px;">سجل الدخول والخروج</b><div style="max-height:150px;overflow-y:auto;margin-top:4px;">';
        if (!r.log.length) h += '<span style="color:var(--muted);font-size:13px;">لا يوجد سجل</span>';
        r.log.forEach(function (l) {
            h += '<div class="off-logrow">' + (l.action === 'join' ? '➡️ دخل' : '⬅️ طلع') + ' — ' + spEsc(l.name) + ' — ' + spEsc(offFmtTime(l.at)) + '</div>';
        });
        h += '</div></div>';
        h += '<div style="margin:8px 0;"><b style="color:var(--gold-soft);font-size:13px;">لوحة المقابلة (النتيجة)</b>';
        if (!r.interviewees.length) h += '<div style="color:var(--muted);font-size:13px;margin-top:4px;">لا يوجد متقدمين مجدولين بهذا الروم</div>';
        r.interviewees.forEach(function (a) {
            h += '<div class="log-item"><span>' + spEsc(a.name) + ' <small style="color:var(--muted);">— ' + spEsc(offFmt(a.at)) + (a.inRoom ? ' — 🟢 داخل الروم' : '') + '</small></span>';
            if (a.entered) {
                h += '<span><button class="btn sm" data-id="' + a.id + '" onclick="offaInterviewResult(this.dataset.id, 1)">✅ مقبول</button> ' +
                    '<button class="btn danger sm" data-id="' + a.id + '" onclick="offaInterviewResult(this.dataset.id, 0)">❌ مرفوض</button></span>';
            } else h += '<span class="badge pending">ما دخل بعد</span>';
            h += '</div>';
        });
        h += '</div></div>';
    });
    return h;
}
function offFmtTimeS(d) {
    try { return new Date(d).toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }); }
    catch (e) { return String(d); }
}
function offFmtDay(d) {
    try { return new Date(d).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (e) { return String(d); }
}
function offDur(ms) {
    var sec = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(sec / 3600); sec -= h * 3600;
    var m = Math.floor(sec / 60); sec -= m * 60;
    if (h > 0) return h + ' س ' + m + ' د';
    if (m > 0) return m + ' د ' + sec + ' ث';
    return sec + ' ث';
}
function offResultChip(r) {
    if (r === 'pass') return ' <span class="badge approved">مقبول بالمقابلة</span>';
    if (r === 'fail') return ' <span class="badge rejected">مرفوض بالمقابلة</span>';
    if (r === 'wait') return ' <span class="badge pending">بانتظار النتيجة</span>';
    return '';
}
function offaLogHtml(d) {
    var list = d.sessions || [];
    var h = '<div class="card"><h3>📼 تسجيل المقابلة</h3><p style="color:var(--muted);font-size:13px;line-height:1.8;">سجل كل جلسة مقابلة صارت بالرومات: من أول واحد دخل الروم إلى آخر واحد طلع، مع وقت دخول وخروج كل شخص، وتسجيل صوتي للمقابلة (يُحفظ ١٤ يوم)، وفيديو توضيحي يعيد لك الجلسة خطوة بخطوة.</p></div>';
    if (d.canClear) h += '<div class="card row" style="border-color:#7f1d1d;"><div><b style="color:#f87171;">🗑️ حذف سجلات المقابلة كلها</b><div style="font-size:12px;color:var(--muted);margin-top:3px;">يحذف كل الجلسات والتسجيلات الصوتية. يشتغل مرة وحدة بس، وبعدها الزر يختفي.</div></div><button class="btn danger sm" onclick="offaClearInterviewLog()">حذف السجلات</button></div>';
    if (!list.length) return h + '<div class="card center" style="color:var(--muted);">ما فيه جلسات مسجلة</div>';
    list.forEach(function (s, i) {
        var E = s.end || Date.now();
        var span = Math.max(1000, E - s.start);
        var uniq = {};
        s.stays.forEach(function (st) { uniq[st.uid] = 1; });
        var first = s.stays[0];
        var lastOut = null;
        s.stays.forEach(function (st) { if (st.end && (!lastOut || st.end >= lastOut.end)) lastOut = st; });
        h += '<div class="card"><div class="row"><h3>🎙️ مقابلة ' + s.room + '</h3>' + (s.live ? '<span class="badge approved">🟢 جارية الحين</span>' : '<span class="badge pending">انتهت</span>') + '</div>';
        h += '<div class="acc-row"><span>اليوم</span><b>' + spEsc(offFmtDay(s.start)) + '</b></div>';
        h += '<div class="acc-row"><span>أول واحد دخل</span><b>' + spEsc(first.name) + ' — ' + spEsc(offFmtTimeS(first.start)) + '</b></div>';
        if (s.live) h += '<div class="acc-row"><span>آخر واحد طلع</span><b>الجلسة جارية</b></div>';
        else h += '<div class="acc-row"><span>آخر واحد طلع</span><b>' + (lastOut ? spEsc(lastOut.name) + ' — ' + spEsc(offFmtTimeS(lastOut.end)) : spEsc(offFmtTimeS(s.end))) + '</b></div>';
        h += '<div class="acc-row"><span>مدة الجلسة</span><b>' + spEsc(offDur(span)) + '</b></div>';
        h += '<div class="acc-row"><span>عدد الحضور</span><b>' + Object.keys(uniq).length + '</b></div>';
        h += '<div class="off-gantt">';
        s.stays.forEach(function (st) {
            var en = st.end || (st.ongoing ? Date.now() : E);
            var right = Math.min(99, Math.max(0, (st.start - s.start) / span * 100));
            var w = Math.max(1.2, (en - st.start) / span * 100);
            if (right + w > 100) w = 100 - right;
            var cls = 'off-gbar' + (st.isSenior ? ' sen' : '') + (st.ongoing ? ' live' : '') + (st.lost ? ' lost' : '');
            h += '<div class="off-grow"><div class="off-gname">' + (st.isSenior ? '🎖️ ' : '') + spEsc(st.name) + '</div><div class="off-gtrack"><div class="' + cls + '" style="right:' + right.toFixed(2) + '%;width:' + w.toFixed(2) + '%;"></div></div></div>';
        });
        h += '<div class="off-gaxis"><span>' + spEsc(offFmtTimeS(s.start)) + '</span><span>' + (s.live ? 'الحين' : spEsc(offFmtTimeS(E))) + '</span></div></div>';
        h += '<div style="margin:8px 0;"><b style="color:var(--gold-soft);font-size:13px;">الدخول والخروج بالترتيب</b>';
        var talk = {};
        (s.recs || []).forEach(function (r) {
            var open = {};
            (r.speech || []).forEach(function (e) {
                if (e[1] === 1) { if (open[e[0]] === undefined) open[e[0]] = e[2]; }
                else if (open[e[0]] !== undefined) { talk[e[0]] = (talk[e[0]] || 0) + Math.max(0, e[2] - open[e[0]]); delete open[e[0]]; }
            });
        });
        s.stays.forEach(function (st, k) {
            var tail;
            if (st.end) tail = '⬅️ طلع: ' + offFmtTimeS(st.end) + ' — مدة البقاء: ' + offDur(st.end - st.start);
            else if (st.ongoing) tail = '🟢 داخل الروم الحين';
            else tail = '⚠️ انقطع اتصاله (وقت الخروج غير مسجل)';
            h += '<div class="off-stay"><div><b>' + (k + 1) + '- ' + spEsc(st.name) + '</b> <span class="off-chip' + (st.isSenior ? ' sen' : '') + '">' + (st.isSenior ? '🎖️ من الكبار' : 'متقدم') + '</span>' +
                (st.age ? ' <span style="color:var(--muted);font-size:12px;">عمره ' + spEsc(String(st.age)) + '</span>' : '') + offResultChip(st.result) +
                (talk[st.uid] ? ' <span class="off-talk">🎤 تحدث ' + spEsc(offDur(talk[st.uid])) + '</span>' : '') + '</div>' +
                '<div class="off-stayt">➡️ دخل: ' + spEsc(offFmtTimeS(st.start)) + ' — ' + spEsc(tail) + '</div></div>';
        });
        h += '</div>';
        if (s.recs && s.recs.length) h += '<div style="color:var(--muted);font-size:12px;margin:8px 0;">🎧 هذي الجلسة فيها تسجيل صوتي، يشتغل من زر الفيديو التوضيحي.</div>';
        h += '<button class="btn gold sm" data-i="' + i + '" onclick="offaReplay(this.dataset.i)">' + (s.recs && s.recs.length ? '▶️ فيديو توضيحي + التسجيل' : '▶️ فيديو توضيحي للجلسة') + '</button></div>';
    });
    return h;
}

var REP = null;
function offaReplayShell(s) {
    var h = '<h3>🎬 فيديو توضيحي — مقابلة ' + s.room + '</h3>';
    h += '<div class="rp-clock" id="rp-clock">--</div>';
    h += '<div style="text-align:center;font-size:12px;color:var(--muted);">مضى: <span id="rp-elapsed">0 ث</span> — داخل الروم: <b id="rp-count">0</b><span id="rp-aud"></span></div>';
    h += '<div class="rp-prog"><div id="rp-bar"></div></div>';
    s.stays.forEach(function (st, k) {
        h += '<div class="rp-row wait" id="rp-r' + k + '"><span>' + (st.isSenior ? '🎖️ ' : '') + spEsc(st.name) + ' <span class="rp-mic" id="rp-m' + k + '"></span></span><span id="rp-s' + k + '">لم يدخل</span></div>';
    });
    h += '<div class="rp-feed" id="rp-feed"></div>';
    h += '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;"><button class="btn sm" id="rp-pp" onclick="offaReplayToggle()">⏸️ إيقاف</button><button class="btn gray sm" id="rp-sp" onclick="offaReplaySpeed()">×1</button><button class="btn danger sm" onclick="offaReplayClose()">✖ إغلاق</button></div>';
    return h;
}
function offaRecUrl(i) { return '/api/officers/admin/rec/' + encodeURIComponent(REP.segs[i].sid); }
function offaReplay(i) {
    var s = OFFA.data && OFFA.data.sessions ? OFFA.data.sessions[parseInt(i, 10)] : null;
    if (!s) return;
    offaReplayStop();
    var E = s.end || Date.now();
    var span = Math.max(1000, E - s.start);
    var evs = [];
    s.stays.forEach(function (st, k) {
        evs.push({ t: st.start, k: k, a: 'join' });
        if (st.end) evs.push({ t: st.end, k: k, a: 'leave' });
    });
    evs.sort(function (x, y) { return x.t - y.t; });
    var segs = (s.recs || []).filter(function (r) { return r.sid; }).sort(function (a, b) { return a.start - b.start; });
    var sp = {};
    segs.forEach(function (r) {
        (r.speech || []).forEach(function (e) { (sp[e[0]] = sp[e[0]] || []).push([r.start + e[2], e[1]]); });
    });
    Object.keys(sp).forEach(function (u) { sp[u].sort(function (a, b) { return a[0] - b[0]; }); });
    REP = { s: s, E: E, span: span, evs: evs, T: 0, mult: 1, playing: true, timer: null, base: Math.max(1, span / 30000), states: {}, passed: -1, segs: segs, si: 0, audio: null, rate: 1, sp: sp };
    offModalOpen(offaReplayGate(s, segs.length > 0));
}
function offaReplayGate(s, hasAudio) {
    return '<h3>🎬 فيديو توضيحي — مقابلة ' + s.room + '</h3>' +
        '<div style="text-align:center;margin:14px 0;"><div style="font-size:46px;">' + (hasAudio ? '🎧' : '🎬') + '</div>' +
        '<p style="color:var(--muted);font-size:13px;line-height:1.9;margin:8px 0 0;">' +
        (hasAudio ? 'هذي المقابلة فيها تسجيل صوتي. اضغط تشغيل ويشتغل الصوت مع الخط الزمني، وجنب اسم اللي يتكلم يطلع المايك.' : 'هذي الجلسة بدون تسجيل صوتي. اضغط تشغيل لإعادة الدخول والخروج.') + '</p></div>' +
        '<div style="display:flex;gap:8px;justify-content:center;"><button class="btn" onclick="offaReplayStart()">▶️ تشغيل ' + (hasAudio ? 'التسجيل' : 'الفيديو') + '</button>' +
        '<button class="btn danger sm" onclick="offaReplayClose()">✖ إغلاق</button></div>';
}
function offaReplayStart() {
    if (!REP || REP.timer) return;
    offModalOpen(offaReplayShell(REP.s));
    if (REP.segs.length) offaReplayAudioStart();
    REP.timer = setInterval(offaReplayTick, 100);
    offaReplayTick(true);
}
function offaReplayAudioStart() {
    var a = new Audio();
    a.preload = 'auto';
    REP.audio = a;
    REP.si = 0;
    REP.T = Math.max(0, REP.segs[0].start - REP.s.start);
    a.onended = function () { offaReplayNextSeg(); };
    a.onerror = function () { if (!REP) return; toast('تعذر تشغيل الصوت، يتم العرض بدون صوت'); offaReplayAudioOff(); };
    a.src = offaRecUrl(0);
    a.playbackRate = REP.rate;
    var pr = a.play(); if (pr && pr.catch) pr.catch(function () {});
    var el = document.getElementById('rp-aud');
    if (el) el.textContent = ' — 🔊 الصوت شغال';
}
function offaReplayNextSeg() {
    if (!REP || !REP.audio) return;
    REP.si++;
    if (REP.si >= REP.segs.length) { REP.T = REP.span; REP.playing = false; offaReplayPaintBtn(); return; }
    var a = REP.audio;
    REP.T = Math.max(0, REP.segs[REP.si].start - REP.s.start);
    a.src = offaRecUrl(REP.si);
    a.playbackRate = REP.rate;
    var pr = a.play(); if (pr && pr.catch) pr.catch(function () {});
}
function offaReplayAudioOff() {
    if (!REP || !REP.audio) return;
    try { REP.audio.pause(); REP.audio.removeAttribute('src'); } catch (e) {}
    REP.audio = null;
    REP.sp = {};
    REP.states = {};
    var el = document.getElementById('rp-aud');
    if (el) el.textContent = '';
}
function offaReplaySpeak(uid, now) {
    var arr = REP.sp[uid];
    if (!arr) return 0;
    var spoke = false, on = false;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i][0] > now) break;
        if (arr[i][1] === 1) { spoke = true; on = true; } else on = false;
    }
    return on ? 2 : (spoke ? 1 : 0);
}
function offaReplayTick(first) {
    if (!REP) return;
    if (!document.getElementById('rp-clock')) { offaReplayStop(); return; }
    if (REP.audio) {
        var seg = REP.segs[REP.si];
        if (REP.playing && seg) REP.T = Math.min(REP.span, Math.max(0, seg.start + REP.audio.currentTime * 1000 - REP.s.start));
    } else if (REP.playing && first !== true) {
        REP.T += 100 * REP.base * REP.mult;
        if (REP.T >= REP.span) { REP.T = REP.span; REP.playing = false; offaReplayPaintBtn(); }
    }
    var now = REP.s.start + REP.T;
    document.getElementById('rp-clock').textContent = offFmtTimeS(now);
    document.getElementById('rp-elapsed').textContent = offDur(REP.T);
    document.getElementById('rp-bar').style.width = (REP.T / REP.span * 100) + '%';
    var inCount = 0;
    REP.s.stays.forEach(function (st, k) {
        var state = 'wait';
        if (now >= st.start) {
            if (st.end) state = now >= st.end ? 'out' : 'in';
            else if (REP.T >= REP.span && !st.ongoing) state = 'out';
            else state = 'in';
        }
        if (state === 'in') inCount++;
        var m = state === 'wait' ? 0 : offaReplaySpeak(st.uid, now);
        var key = state + '|' + m;
        if (REP.states[k] !== key) {
            REP.states[k] = key;
            var row = document.getElementById('rp-r' + k);
            var lab = document.getElementById('rp-s' + k);
            var mic = document.getElementById('rp-m' + k);
            if (row) row.className = 'rp-row ' + state + (m === 2 ? ' talk' : '');
            if (lab) lab.textContent = state === 'in' ? '🟢 داخل الروم' : (state === 'out' ? (st.end ? '⚫ طلع ' + offFmtTimeS(st.end) : '⚠️ انقطع') : 'لم يدخل');
            if (mic) { mic.className = 'rp-mic' + (m === 2 ? ' live' : ''); mic.textContent = m === 2 ? '🎤 يتحدث الحين' : (m === 1 ? '🎤 تحدث' : ''); }
        }
    });
    document.getElementById('rp-count').textContent = inCount;
    var passed = 0;
    for (var i = 0; i < REP.evs.length; i++) { if (REP.evs[i].t <= now) passed++; }
    if (passed !== REP.passed) {
        REP.passed = passed;
        var lines = [];
        for (var j = passed - 1; j >= 0 && lines.length < 8; j--) {
            var ev = REP.evs[j];
            var st2 = REP.s.stays[ev.k];
            lines.push('<div>' + (ev.a === 'join' ? '➡️ دخل ' : '⬅️ طلع ') + spEsc(st2.name) + ' — ' + spEsc(offFmtTimeS(ev.t)) + '</div>');
        }
        document.getElementById('rp-feed').innerHTML = lines.join('');
    }
}
function offaReplayPaintBtn() {
    var b = document.getElementById('rp-pp');
    if (!b || !REP) return;
    b.textContent = REP.playing ? '⏸️ إيقاف' : (REP.T >= REP.span ? '🔄 إعادة' : '▶️ تشغيل');
}
function offaReplayToggle() {
    if (!REP) return;
    var a = REP.audio;
    if (!REP.playing && REP.T >= REP.span) {
        REP.passed = -1; REP.states = {}; REP.playing = true;
        if (a) {
            REP.si = 0;
            REP.T = Math.max(0, REP.segs[0].start - REP.s.start);
            a.src = offaRecUrl(0);
            a.playbackRate = REP.rate;
            var pr = a.play(); if (pr && pr.catch) pr.catch(function () {});
        } else REP.T = 0;
    } else {
        REP.playing = !REP.playing;
        if (a) {
            if (REP.playing) { var p2 = a.play(); if (p2 && p2.catch) p2.catch(function () {}); }
            else a.pause();
        }
    }
    offaReplayPaintBtn();
}
function offaReplaySpeed() {
    if (!REP) return;
    var b = document.getElementById('rp-sp');
    if (REP.audio) {
        REP.rate = REP.rate === 1 ? 1.5 : (REP.rate === 1.5 ? 2 : 1);
        REP.audio.playbackRate = REP.rate;
        if (b) b.textContent = '×' + REP.rate;
        return;
    }
    REP.mult = REP.mult === 1 ? 2 : (REP.mult === 2 ? 4 : 1);
    if (b) b.textContent = '×' + REP.mult;
}
function offaReplayStop() {
    if (REP && REP.timer) clearInterval(REP.timer);
    if (REP && REP.audio) { try { REP.audio.pause(); REP.audio.removeAttribute('src'); } catch (e) {} }
    REP = null;
}
function offaReplayClose() {
    offaReplayStop();
    offModalClose();
}
function offaEnterRoom(n) { offJoinVoice(parseInt(n, 10)); }
async function offaDeleteRoom(n) {
    if (!(await confirmModal('تحذف مقابلة ' + n + '؟ اللي داخلها ينطردون، والمتقدمين المجدولين فيها ينتقلون لأول روم متبقي، وما يرجع بعد الحذف.'))) return;
    try {
        var r = await api('/api/officers/admin/rooms/' + n, { method: 'DELETE' });
        toast('🗑️ تم حذف الروم' + (r.moved ? ' ونقل ' + r.moved + ' متقدم لمقابلة ' + r.movedTo : ''));
        offaReload(false);
    } catch (e) { toast(e.message); }
}
async function offaNewRoom() {
    try { await api('/api/officers/admin/rooms', { method: 'POST', body: '{}' }); offaReload(false); }
    catch (e) { toast(e.message); }
}
async function offaClearInterviewLog() {
    if (!(await confirmModal('⚠️ بتنحذف كل سجلات تسجيل المقابلة والتسجيلات الصوتية نهائياً، والزر ما يرجع بعدها. متأكد؟'))) return;
    try {
        await offPost('/api/officers/admin/interview-log/clear', {});
        toast('🗑️ تم حذف سجلات المقابلة');
        offaReload(false);
    } catch (e) { toast(e.message); }
}

async function offaInterviewResult(id, ok) {
    if (!(await confirmModal(ok ? 'تأكيد قبول هذا المتقدم من المقابلة؟' : 'تأكيد رفض هذا المتقدم؟'))) return;
    try {
        await api('/api/officers/admin/applications/' + id + '/interview-result', { method: 'POST', body: JSON.stringify({ result: ok ? 'accepted' : 'rejected' }) });
        toast(ok ? '✅ تم القبول' : 'تم الرفض');
        offaReload(false);
    } catch (e) { toast(e.message); }
}
function offaTrainHtml(d) {
    var h = '<div class="card"><h3>➕ تسجيل متدرب</h3><p style="color:var(--muted);font-size:13px;">المقبولين من المقابلة فقط</p>';
    if (!d.eligible.length) h += '<div style="color:var(--muted);font-size:13px;">لا يوجد مقبولين بانتظار التسجيل</div>';
    d.eligible.forEach(function (a) {
        h += '<div class="log-item"><span>' + spEsc(a.name) + '</span><button class="btn sm" data-id="' + a.id + '" onclick="offaRegTrainee(this.dataset.id)">تسجيل متدرب</button></div>';
    });
    h += '</div><div class="card"><h3>👥 المتدربين المسجلين</h3>';
    if (!d.trainees.length) h += '<div style="color:var(--muted);font-size:13px;">ما أحد مسجل بالتدريب</div>';
    d.trainees.forEach(function (a) {
        h += '<div class="log-item"><span>' + spEsc(a.name) + (a.attendedAt ? ' <small style="color:#4ade80;">— حضر ' + spEsc(offFmtTime(a.attendedAt)) + '</small>' : '') + '</span>';
        if (!a.attendedAt) h += '<button class="btn gold sm" data-id="' + a.id + '" onclick="offaAttended(this.dataset.id)">✅ حضر التدريب</button>';
        else h += '<span><button class="btn sm" data-id="' + a.id + '" onclick="offaTrainAccept(this.dataset.id)">✅ قبول</button> ' +
            '<button class="btn danger sm" data-id="' + a.id + '" onclick="offaTrainReject(this.dataset.id)">❌ رفض</button></span>';
        h += '</div>';
    });
    return h + '</div>';
}
async function offaRegTrainee(id) {
    try { await api('/api/officers/admin/applications/' + id + '/register-trainee', { method: 'POST', body: '{}' }); toast('تم التسجيل'); offaReload(false); }
    catch (e) { toast(e.message); }
}
async function offaAttended(id) {
    try { await api('/api/officers/admin/applications/' + id + '/attended', { method: 'POST', body: '{}' }); toast('تم تسجيل الحضور'); offaReload(false); }
    catch (e) { toast(e.message); }
}
function offaTrainAccept(id) {
    var ranks = (OFFA.data && OFFA.data.ranks) || [];
    offModalOpen('<h3>🎖️ قبول وتحديد الرتبة</h3><label>الرتبة</label><select id="offm-rank">' +
        ranks.map(function (r) { return '<option value="' + spEsc(r) + '">' + spEsc(r) + '</option>'; }).join('') + '</select>' +
        '<div class="row" style="justify-content:flex-start;"><button class="btn" data-id="' + id + '" onclick="offaSubmitAccept(this.dataset.id)">✅ تأكيد القبول</button>' +
        '<button class="btn gray" onclick="offModalClose()">إلغاء</button></div>');
}
async function offaSubmitAccept(id) {
    var rank = document.getElementById('offm-rank').value;
    try {
        await api('/api/officers/admin/applications/' + id + '/training-result', { method: 'POST', body: JSON.stringify({ result: 'accepted', rank: rank }) });
        offModalClose(); toast('🎖️ صار ضابط');
        offaReload(false);
    } catch (e) { toast(e.message); }
}
async function offaTrainReject(id) {
    if (!(await confirmModal('تأكيد رفض هذا المتدرب نهائياً؟'))) return;
    try { await api('/api/officers/admin/applications/' + id + '/training-result', { method: 'POST', body: JSON.stringify({ result: 'rejected' }) }); toast('تم الرفض'); offaReload(false); }
    catch (e) { toast(e.message); }
}
/* تحديث تلقائي من الـ polling العام */
var OFFANN = { shown: false, id: null, tick: 0, busy: false };
async function offAnnCheck() {
    if (!ME || ME.blocked || OFFANN.shown || OFFANN.busy || VC) return;
    OFFANN.busy = true;
    try {
        var d = await offFetch('/api/officers/announcement');
        if (d.ann) {
            var later = null;
            try { later = sessionStorage.getItem('offAnnLater'); } catch (e) {}
            if (later !== d.ann.id) offAnnShow(d.ann);
        }
    } catch (e) {}
    OFFANN.busy = false;
}
function offAnnShow(a) {
    if (OFFANN.shown || document.getElementById('off-ann')) return;
    OFFANN.shown = true; OFFANN.id = a.id;
    var ov = document.createElement('div');
    ov.className = 'ann-ov'; ov.id = 'off-ann';
    ov.innerHTML = '<div class="ann-card"><button class="ann-x" data-s="dismissed" onclick="offAnnClose(this.dataset.s)" aria-label="إغلاق">✕</button>' +
        '<div class="ann-badge">📢 إعلان</div><div style="font-size:42px;line-height:1.2;">🎖️</div>' +
        '<h3>فتح باب التقديم على سلك الضباط</h3>' +
        '<p>تم فتح باب التقديم على سلك الضباط للأفراد من رتبة جندي إلى رئيس رقباء. تبي تقدّم؟</p>' +
        (a.test ? '<div class="ann-test">🧪 نسخة تجريبية — تظهر لحساب المالك فقط</div>' : '') +
        '<div class="ann-btns"><button class="btn" onclick="offAnnApply()">✅ تقديم</button><button class="btn gray" onclick="offAnnLater()">⏳ بقدم لاحقاً</button></div></div>';
    document.body.appendChild(ov);
    document.documentElement.classList.add('ann-open');
}
function offAnnRemove() {
    var el = document.getElementById('off-ann');
    if (el) el.remove();
    document.documentElement.classList.remove('ann-open');
    OFFANN.shown = false;
}
function offAnnClose(status) {
    var id = OFFANN.id;
    offAnnRemove();
    if (id) offPost('/api/officers/announcement/ack', { id: id, status: status }).catch(function () {});
}
function offAnnApply() {
    offAnnClose('applied');
    if (typeof renderOfficerPage === 'function') renderOfficerPage();
}
function offAnnLater() {
    try { sessionStorage.setItem('offAnnLater', OFFANN.id || ''); } catch (e) {}
    offAnnRemove();
}
document.addEventListener('touchmove', function (e) {
    if (!OFFANN.shown) return;
    var c = document.querySelector('#off-ann .ann-card');
    if (c && c.contains(e.target) && c.scrollHeight > c.clientHeight + 1) return;
    e.preventDefault();
}, { passive: false });

var FLASHUPD = { shown: false, id: null, busy: false };
async function flashUpdCheck() {
    if (!ME || ME.blocked || FLASHUPD.shown || FLASHUPD.busy || VC || OFFANN.shown) return;
    FLASHUPD.busy = true;
    try {
        var d = await offFetch('/api/updates/latest');
        if (d.update) flashUpdShow(d.update);
    } catch (e) {}
    FLASHUPD.busy = false;
}
function flashUpdShow(u) {
    if (FLASHUPD.shown || document.getElementById('flash-upd')) return;
    FLASHUPD.shown = true; FLASHUPD.id = u.id;
    var ov = document.createElement('div');
    ov.className = 'ann-ov'; ov.id = 'flash-upd';
    ov.innerHTML = '<div class="ann-card"><button class="ann-x" onclick="flashUpdClose()" aria-label="إغلاق">✕</button>' +
        '<div class="ann-badge">🆕 تحديث جديد</div><div style="font-size:42px;line-height:1.2;">🚀</div>' +
        '<h3>تم إصدار تحديث جديد على فلاش!</h3>' +
        '<p>سوّينا شغل وراكم هالفترة 👀 جرّبوا الموقع الحين وشوفوا الجديد بنفسكم.</p>' +
        '<div class="ann-btns"><button class="btn" onclick="flashUpdClose()">✅ يلا بشوف</button></div></div>';
    document.body.appendChild(ov);
    document.documentElement.classList.add('ann-open');
}
function flashUpdClose() {
    var id = FLASHUPD.id;
    var el = document.getElementById('flash-upd');
    if (el) el.remove();
    document.documentElement.classList.remove('ann-open');
    FLASHUPD.shown = false;
    if (id) offPost('/api/updates/' + id + '/ack', {}).catch(function () {});
}
document.addEventListener('touchmove', function (e) {
    if (!FLASHUPD.shown) return;
    var c = document.querySelector('#flash-upd .ann-card');
    if (c && c.contains(e.target) && c.scrollHeight > c.clientHeight + 1) return;
    e.preventDefault();
}, { passive: false });

function offOnPoll() {
    try {
        OFFANN.tick++;
        if (OFFANN.tick % 6 === 1) offAnnCheck();
        if (OFFANN.tick % 6 === 3) flashUpdCheck();
        if (document.getElementById('off-root') && !VC) offLoadMe(true);
        if (document.getElementById('offa-content') && !VC) offaReload(true);
    } catch (e) {}
}

init();
</script>
</body>
</html>`);
});

app.use((err, req, res, next) => {
    console.error("❌ خطأ غير متوقع بالسيرفر:", err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || "صار خطأ غير متوقع، حاول مرة ثانية" });
});

process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
});

app.listen(CONFIG.PORT, "0.0.0.0", () => {
    console.log(`🚀 ${CONFIG.SITE_NAME} server running on port ${CONFIG.PORT}`);
});
