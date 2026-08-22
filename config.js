const mongoose = require("mongoose");

// ══════════════════════════════════════════════════════════════════════════
// إعدادات عامة — عدّل القيم التالية حسب سيرفرك
// ══════════════════════════════════════════════════════════════════════════
const CONFIG = {
    // ── ديسكورد ──
    DISCORD_CLIENT_ID: "1270290369359384600",
    DISCORD_CLIENT_SECRET: "alqaq47MY2ge50dJ2YOp6wevAak0y1av",
    DISCORD_CALLBACK_URL: "https://flash-q5b2.onrender.com/auth/discord/callback",
    BOT_TOKEN: "MTI3MDI5MDM2OTM1OTM4NDYwMA.GFVn5O.IfoCs4LA8tBYKxeldzlXae98hfRcSKNhBmpPqo",
    GUILD_ID: "1497233353030766662",

    // ── قاعدة البيانات ──
    MONGO_URI: "mongodb+srv://hmooduu6_db_user:0ks7Ktqh5IIteciW@cluster0.6bk7qm9.mongodb.net/?appName=Cluster0",

    // ── الموقع ──
    SITE_NAME: "فلاش",
    SESSION_SECRET: "norv_moi_secret_789",
    PORT: process.env.PORT || 7770,

    // ── رتب العسكر المعتمدة لتسجيل الدخول (قابلة للزيادة، ضع آيدي الرتبة/الرول) ──
    // أي عضو يملك واحد من هذه الرولات يُعتبر "عسكري" ويقدر يدخل الموقع
    MILITARY_ROLE_IDS: [
        "1500064443537686588",
        "1500064767082233926",
        "1533192878510178304",
        // أضف المزيد هنا إذا احتجت
    ],

    // ── أنواع مخالفات المرور (لعبة المواطن خالد) ──
    VIOLATION_TYPES: [
        "تجاوز السرعة المحددة",
        "قطع الإشارة الحمراء",
        "الوقوف الخاطئ / التعدي على الرصيف",
        "عدم ربط حزام الأمان",
        "استخدام الجوال أثناء القيادة",
        "القيادة العكسية",
        "تجاوز في مكان ممنوع",
        "عدم وجود لوحات / لوحات غير واضحة",
        "التفحيط / القيادة المتهورة",
        "عدم الالتزام بالمسار",
        "الدخول لمنطقة محظورة",
        "الهروب من نقطة تفتيش",
    ],

    // نقاط عند القبول / الرفض
    POINTS_ON_APPROVE: 2,
    POINTS_ON_REJECT: 1,

    // أقصى عدد مركبات يمكن إضافتها دفعة واحدة عبر أمر -مركبات
    MAX_VEHICLES_ADD: 60,
};

// ══════════════════════════════════════════════════════════════════════════
// الاتصال بقاعدة البيانات
// ══════════════════════════════════════════════════════════════════════════
mongoose.connect(CONFIG.MONGO_URI)
    .then(() => console.log("✅ MOI MongoDB connected"))
    .catch(err => console.log("❌ MongoDB error:", err));

// ══════════════════════════════════════════════════════════════════════════
// الموديلات المشتركة
// ══════════════════════════════════════════════════════════════════════════

// ملف العسكري (يُنشأ تلقائياً أول ما يسجّل دخول)
const PersonnelSchema = new mongoose.Schema({
    discord: { type: String, required: true, unique: true },
    discordTag: String,
    registeredName: { type: String, default: null }, // الاسم داخل السيرفر (يحطه أول مرة)
    unit: { type: String, default: null },            // اليونت العسكري
    rank: { type: String, default: "فرد" },            // الرتبة (تصدرها القيادة)
    points: { type: Number, default: 0 },
    notes: [{
        text: String,
        addedBy: String,
        addedByTag: String,
        createdAt: { type: Date, default: Date.now }
    }],
    isBlocked: { type: Boolean, default: false }, // موقوف عن تسجيل مخالفات جديدة
    createdAt: { type: Date, default: Date.now }
});
const Personnel = mongoose.model("Personnel", PersonnelSchema);

// المخالفات المسجّلة
const ViolationSchema = new mongoose.Schema({
    reporterDiscord: String,
    reporterTag: String,
    reporterName: String,   // الاسم العسكري وقت التسجيل
    reporterUnit: String,   // اليونت وقت التسجيل
    violationType: String,
    vehicle: String,
    plateNumber: String,    // تتولد عشوائياً عند الإرسال
    status: { type: String, default: "pending" }, // pending / approved / rejected
    rejectReason: { type: String, default: null }, // سبب الرفض (يكتبه الأدمن عند الرفض)
    reviewedBy: String,
    reviewedByTag: String,
    reviewedAt: Date,
    createdAt: { type: Date, default: Date.now }
});
const Violation = mongoose.model("Violation", ViolationSchema);

// المركبات المتاحة (تُدار عبر أمر -مركبات في البوت)
const VehicleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    addedBy: String,
    createdAt: { type: Date, default: Date.now }
});
const Vehicle = mongoose.model("Vehicle", VehicleSchema);

// إعدادات الموقع العامة (صيانة / إغلاق دخول / إغلاق مخالفات / كبار المسؤولين)
const SettingsSchema = new mongoose.Schema({
    isMaintenance: { type: Boolean, default: false },
    disableLogin: { type: Boolean, default: false },
    disableViolations: { type: Boolean, default: false },
    adminList: { type: [String], default: [] }, // آيدي الديسكورد لكبار المسؤولين
    // آيدي رولات القيادة (تُحفظ من أمر /تسطيب-النظام)
    commandRoles: {
        patrolCommander: String,   // قائد الدوريات
        patrolDeputy: String,      // نائب قائد الدوريات
        roadSecurityCommander: String, // قائد أمن الطرق
        roadSecurityDeputy: String,    // نائب قائد أمن الطرق
        antiDrugsCommander: String,    // قائد مكافحة المخدرات
        antiDrugsDeputy: String,       // نائب قائد مكافحة المخدرات
        management: String,            // رتبة الإدارة
    },
    violationsChannelId: String, // القناة التي تُرسل فيها المخالفات لقبول/رفض الإدارة
}, { minimize: false });
const Settings = mongoose.model("Settings", SettingsSchema);

async function getSettings() {
    let s = await Settings.findOne();
    if (!s) s = await Settings.create({});
    return s;
}

// ══════════════════════════════════════════════════════════════════════════
// دوال مساعدة مشتركة
// ══════════════════════════════════════════════════════════════════════════

// توليد لوحة سيارة عشوائية (نمط: أ ب ج - 1234)
function generatePlate() {
    const letters = "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ";
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${pick()} ${pick()} ${pick()} - ${num}`;
}

module.exports = {
    CONFIG,
    mongoose,
    Personnel,
    Violation,
    Vehicle,
    Settings,
    getSettings,
    generatePlate,
};
