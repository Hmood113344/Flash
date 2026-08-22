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
} = require("discord.js");

const {
    CONFIG,
    Personnel,
    Violation,
    Vehicle,
    getSettings,
} = require("./config");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

// حفظ مؤقت لربط كل مخالفة برسالتها في ديسكورد (عشان نقدر نعدلها بعد القبول/الرفض)
const pendingMessages = new Map(); // violationId -> { channelId, messageId }

// ══════════════════════════════════════════════════════════════════════════
// صلاحيات مساعدة
// ══════════════════════════════════════════════════════════════════════════
async function isSeniorAdmin(userId) {
    const settings = await getSettings();
    return settings.adminList.includes(userId);
}

async function hasCommandRole(member) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    const settings = await getSettings();
    const roles = Object.values(settings.commandRoles || {}).filter(Boolean);
    return roles.some(r => member.roles.cache.has(r));
}

// ══════════════════════════════════════════════════════════════════════════
// تعريف أوامر السلاش
// ══════════════════════════════════════════════════════════════════════════
const commands = [
    new SlashCommandBuilder()
        .setName("تسطيب-النظام")
        .setDescription("إعداد رتب القيادة الأساسية للنظام (للإدارة فقط)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(o => o.setName("قائد_الدوريات").setDescription("رول قائد الدوريات").setRequired(true))
        .addRoleOption(o => o.setName("نائب_قائد_الدوريات").setDescription("رول نائب قائد الدوريات").setRequired(true))
        .addRoleOption(o => o.setName("قائد_امن_الطرق").setDescription("رول قائد أمن الطرق").setRequired(true))
        .addRoleOption(o => o.setName("نائب_قائد_امن_الطرق").setDescription("رول نائب قائد أمن الطرق").setRequired(true))
        .addRoleOption(o => o.setName("قائد_مكافحة_المخدرات").setDescription("رول قائد مكافحة المخدرات").setRequired(true))
        .addRoleOption(o => o.setName("نائب_قائد_مكافحة_المخدرات").setDescription("رول نائب قائد مكافحة المخدرات").setRequired(true))
        .addRoleOption(o => o.setName("رتبة_الاداره").setDescription("رول الإدارة العليا").setRequired(true)),

    new SlashCommandBuilder()
        .setName("قبول-المخالفات")
        .setDescription("عرض المخالفات المعلّقة لقبولها أو رفضها (للإدارة فقط)"),

    new SlashCommandBuilder()
        .setName("لوحة-القيادة")
        .setDescription("أوامر القيادة العسكرية")
        .addSubcommand(s => s
            .setName("تعيين-يونت")
            .setDescription("تعيين يونت ورتبة لعسكري")
            .addUserOption(o => o.setName("العسكري").setDescription("العسكري المستهدف").setRequired(true))
            .addStringOption(o => o.setName("اليونت").setDescription("اسم اليونت").setRequired(true))
            .addStringOption(o => o.setName("الرتبة").setDescription("الرتبة (اختياري)").setRequired(false)))
        .addSubcommand(s => s
            .setName("عرض-ملف")
            .setDescription("عرض ملف عسكري")
            .addUserOption(o => o.setName("العسكري").setDescription("العسكري المستهدف").setRequired(true)))
        .addSubcommand(s => s
            .setName("تعديل-نقاط")
            .setDescription("إضافة أو خصم نقاط من عسكري")
            .addUserOption(o => o.setName("العسكري").setDescription("العسكري المستهدف").setRequired(true))
            .addIntegerOption(o => o.setName("العدد").setDescription("موجب للإضافة، سالب للخصم").setRequired(true))),
].map(c => c.toJSON());

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(CONFIG.BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID),
            { body: commands }
        );
        console.log("✅ تم تسجيل أوامر السلاش");
    } catch (e) {
        console.log("❌ خطأ بتسجيل الأوامر:", e);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// بناء إمبيد + أزرار مخالفة
// ══════════════════════════════════════════════════════════════════════════
function buildViolationEmbed(v) {
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

// ══════════════════════════════════════════════════════════════════════════
// أحداث السلاش
// ══════════════════════════════════════════════════════════════════════════
client.on("interactionCreate", async interaction => {
    // ── أوامر السلاش ──
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // /تسطيب-النظام
        if (commandName === "تسطيب-النظام") {
            const settings = await getSettings();
            settings.commandRoles = {
                patrolCommander: interaction.options.getRole("قائد_الدوريات").id,
                patrolDeputy: interaction.options.getRole("نائب_قائد_الدوريات").id,
                roadSecurityCommander: interaction.options.getRole("قائد_امن_الطرق").id,
                roadSecurityDeputy: interaction.options.getRole("نائب_قائد_امن_الطرق").id,
                antiDrugsCommander: interaction.options.getRole("قائد_مكافحة_المخدرات").id,
                antiDrugsDeputy: interaction.options.getRole("نائب_قائد_مكافحة_المخدرات").id,
                management: interaction.options.getRole("رتبة_الاداره").id,
            };
            await settings.save();
            return interaction.reply({ content: "✅ تم تسطيب النظام وحفظ رتب القيادة بنجاح.", ephemeral: true });
        }

        // /قبول-المخالفات
        if (commandName === "قبول-المخالفات") {
            const senior = await isSeniorAdmin(interaction.user.id);
            const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
            if (!senior && !isAdmin) {
                return interaction.reply({ content: "🚫 ما تملك صلاحية استخدام هذا الأمر.", ephemeral: true });
            }
            const list = await Violation.find({ status: "pending" }).sort({ createdAt: 1 });
            if (list.length === 0) {
                return interaction.reply({ content: "لا توجد مخالفات معلّقة حالياً.", ephemeral: true });
            }
            await interaction.reply({ content: `📋 يوجد ${list.length} مخالفة معلّقة:`, ephemeral: true });
            for (const v of list) {
                const msg = await interaction.channel.send({
                    embeds: [buildViolationEmbed(v)],
                    components: [buildViolationButtons(v._id.toString())],
                });
                pendingMessages.set(v._id.toString(), { channelId: msg.channelId, messageId: msg.id });
            }
            return;
        }

        // /لوحة-القيادة
        if (commandName === "لوحة-القيادة") {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const allowed = await hasCommandRole(member);
            if (!allowed) {
                return interaction.reply({ content: "🚫 هذا الأمر مخصص للقيادة العسكرية فقط.", ephemeral: true });
            }

            const sub = interaction.options.getSubcommand();
            const target = interaction.options.getUser("العسكري");

            if (sub === "تعيين-يونت") {
                const unit = interaction.options.getString("اليونت");
                const rank = interaction.options.getString("الرتبة");
                const update = { unit };
                if (rank) update.rank = rank;
                const p = await Personnel.findOneAndUpdate(
                    { discord: target.id },
                    { $set: update, $setOnInsert: { discordTag: target.username } },
                    { new: true, upsert: true }
                );
                return interaction.reply({ content: `✅ تم تعيين <@${target.id}> إلى يونت **${p.unit}**${rank ? ` برتبة **${p.rank}**` : ""}.` });
            }

            if (sub === "عرض-ملف") {
                const p = await Personnel.findOne({ discord: target.id });
                if (!p) return interaction.reply({ content: "لا يوجد ملف لهذا العضو بعد.", ephemeral: true });
                const embed = new EmbedBuilder()
                    .setTitle(`ملف: ${p.registeredName || target.username}`)
                    .setColor(0x2563eb)
                    .addFields(
                        { name: "اليونت", value: p.unit || "-", inline: true },
                        { name: "الرتبة", value: p.rank || "-", inline: true },
                        { name: "النقاط", value: String(p.points), inline: true },
                        { name: "الحالة", value: p.isBlocked ? "🚫 موقوف" : "✅ فعّال", inline: true },
                    );
                return interaction.reply({ embeds: [embed] });
            }

            if (sub === "تعديل-نقاط") {
                const amount = interaction.options.getInteger("العدد");
                const p = await Personnel.findOneAndUpdate(
                    { discord: target.id },
                    { $inc: { points: amount }, $setOnInsert: { discordTag: target.username } },
                    { new: true, upsert: true }
                );
                return interaction.reply({ content: `✅ تم تعديل نقاط <@${target.id}>. النقاط الحالية: **${p.points}**` });
            }
        }
        return;
    }

    // ── أزرار قبول / رفض المخالفات ──
    if (interaction.isButton()) {
        const [action, id] = interaction.customId.split("_");
        if (action !== "approve" && action !== "reject") return;

        const senior = await isSeniorAdmin(interaction.user.id);
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        if (!senior && !isAdmin) {
            return interaction.reply({ content: "🚫 ما تملك صلاحية.", ephemeral: true });
        }

        const v = await Violation.findById(id);
        if (!v || v.status !== "pending") {
            return interaction.reply({ content: "هذه المخالفة تمت مراجعتها مسبقاً.", ephemeral: true });
        }

        if (action === "approve") {
            v.status = "approved";
            v.reviewedBy = interaction.user.id;
            v.reviewedByTag = interaction.user.username;
            v.reviewedAt = new Date();
            await v.save();
            await Personnel.findOneAndUpdate({ discord: v.reporterDiscord }, { $inc: { points: CONFIG.POINTS_ON_APPROVE } });

            const embed = buildViolationEmbed(v).setColor(0x22c55e).setTitle("✅ مخالفة مقبولة");
            await interaction.update({ embeds: [embed], components: [buildViolationButtons(id, true)] });
            pendingMessages.delete(id);
            return;
        }

        if (action === "reject") {
            const modal = new ModalBuilder()
                .setCustomId(`rejectmodal_${id}`)
                .setTitle("سبب الرفض");
            const input = new TextInputBuilder()
                .setCustomId("reason")
                .setLabel("اكتب سبب رفض المخالفة")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(500);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }
    }

    // ── استلام سبب الرفض من المودال ──
    if (interaction.isModalSubmit() && interaction.customId.startsWith("rejectmodal_")) {
        const id = interaction.customId.split("_")[1];
        const reason = interaction.fields.getTextInputValue("reason");

        const v = await Violation.findById(id);
        if (!v || v.status !== "pending") {
            return interaction.reply({ content: "هذه المخالفة تمت مراجعتها مسبقاً.", ephemeral: true });
        }
        v.status = "rejected";
        v.rejectReason = reason;
        v.reviewedBy = interaction.user.id;
        v.reviewedByTag = interaction.user.username;
        v.reviewedAt = new Date();
        await v.save();
        await Personnel.findOneAndUpdate({ discord: v.reporterDiscord }, { $inc: { points: CONFIG.POINTS_ON_REJECT } });

        const ref = pendingMessages.get(id);
        if (ref) {
            try {
                const channel = await client.channels.fetch(ref.channelId);
                const msg = await channel.messages.fetch(ref.messageId);
                const embed = buildViolationEmbed(v).setColor(0xef4444).setTitle("❌ مخالفة مرفوضة");
                await msg.edit({ embeds: [embed], components: [buildViolationButtons(id, true)] });
            } catch (e) { /* تجاهل إن كانت الرسالة انحذفت */ }
        }
        pendingMessages.delete(id);
        return interaction.reply({ content: "✅ تم رفض المخالفة وحفظ السبب.", ephemeral: true });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// أوامر البريفكس (-مركبات)
// ══════════════════════════════════════════════════════════════════════════
const activeVehicleSessions = new Set(); // منع تشغيل الجلسة مرتين لنفس الشخص

client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith("-")) return;

    const [cmd] = message.content.slice(1).trim().split(/\s+/);

    if (cmd === "مركبات") {
        const senior = await isSeniorAdmin(message.author.id);
        if (!senior) return; // محد يشوف أي رد إذا مو كبير مسؤولين

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
                const prompt = await message.channel.send(`🚗 اكتب اسم المركبة رقم ${i} من ${count}:`);
                const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
                const nameMsg = collected.first();
                const name = nameMsg.content.trim();
                nameMsg.delete().catch(() => {});
                prompt.delete().catch(() => {});

                if (!name) { i--; continue; }
                try {
                    await Vehicle.create({ name, addedBy: message.author.id });
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
    }
});

client.once("ready", async () => {
    console.log(`🤖 البوت شغال: ${client.user.tag}`);
    await registerCommands();
});

client.login(CONFIG.BOT_TOKEN);
