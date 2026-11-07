"use strict";
/**
 * 🕴 MAFIA BOT — Telegram (Node.js + Telegraf)
 * Hamma kod shu faylda. Token .env faylidan olinadi: BOT_TOKEN=xxxx
 *
 * O'rnatish:   npm init -y && npm i telegraf dotenv
 * Ishga tushirish:   node index.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Telegraf } = require("telegraf");

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error(
    "❌ .env faylida BOT_TOKEN topilmadi. Misol: BOT_TOKEN=123456:ABC...",
  );
  process.exit(1);
}

/* ───────────────────────── SOZLAMALAR ───────────────────────── */
const CFG = {
  MIN_PLAYERS: Math.max(3, +process.env.MIN_PLAYERS || 4),
  MAX_PLAYERS: +process.env.MAX_PLAYERS || 30,
  REG_SEC: +process.env.REG_SEC || 120, // ro'yxatdan o'tish
  NIGHT_SEC: +process.env.NIGHT_SEC || 45, // tun
  DAY_SEC: +process.env.DAY_SEC || 60, // muhokama
  VOTE_SEC: +process.env.VOTE_SEC || 45, // ovoz berish
  CONFIRM_SEC: +process.env.CONFIRM_SEC || 20, // osishni tasdiqlash
  AFK_NIGHTS: +process.env.AFK_NIGHTS || 2, // necha tun harakatsiz bo'lsa o'yindan chiqariladi
};

/* ───────────────────────── ROLLAR ───────────────────────── */
const ROLES = {
  civilian: {
    emoji: "👨🏼",
    name: "Tinch aholi",
    team: "town",
    desc: "Siz oddiy shahar aholisisiz. Kechasi uxlaysiz, kunduzi esa muhokama qilib, ovoz berish orqali mafiyani topishga yordam berasiz.",
  },
  commissar: {
    emoji: "🕵🏼",
    name: "Komissar Katani",
    team: "town",
    desc: "Shaharning asosiy himoyachisi. Har tun ikki variantdan birini tanlaysiz:\n🔍 <b>Tekshirish</b> — o'yinchi mafiyami yoki yo'qligini bilasiz.\n🔫 <b>Otish</b> — o'yinchini o'ldirasiz.",
  },
  doctor: {
    emoji: "👨🏼‍⚕️",
    name: "Doktor",
    team: "town",
    desc: "Har tun bir o'yinchini davolaysiz. Unga hujum bo'lsa, tirik qoladi. O'zingizni ham davolay olasiz, lekin ketma-ket ikki tun bir odamni emas.",
  },
  bum: {
    emoji: "🧙🏼‍♂️",
    name: "Bomj",
    team: "town",
    desc: "Har tun bir o'yinchinikiga «shisha so'rab» borasiz va o'sha tunda uning uyiga yana kimlar kelganini ko'rasiz.",
  },
  mistress: {
    emoji: "💃🏼",
    name: "Kezuvchi",
    team: "town",
    desc: "Har tun bir o'yinchinikiga borib, uni «band» qilasiz — u o'sha tunda hech qanday harakat qila olmaydi. Ketma-ket bir odamga bora olmaysiz.",
  },
  lucky: {
    emoji: "🤞🏼",
    name: "Omadli",
    team: "town",
    desc: "Sizda maxsus harakat yo'q, lekin tunda sizga hujum qilishsa, <b>50%</b> ehtimol bilan omadingiz kelib, tirik qolasiz.",
  },
  mafia: {
    emoji: "🤵🏼",
    name: "Mafia",
    team: "mafia",
    desc: "Mafiya jamoasi a'zosi. Har tun jamoangiz bilan birga bitta qurbonni tanlaysiz. Kunduzi esa begunoh ko'rinishga harakat qiling.",
  },
  don: {
    emoji: "🎩",
    name: "Don",
    team: "mafia",
    desc: "Mafiya boshlig'i. Har tun qurbonni tanlaysiz. Mafiya ovozlari teng bo'lib qolsa, sizning tanlovingiz hal qiluvchi.",
  },
  lawyer: {
    emoji: "👨🏼‍💼",
    name: "Advokat",
    team: "mafia",
    desc: "Mafiya himoyachisi. Har tun bir mafiyachini himoya qilasiz — Komissar uni tekshirsa, «tinch aholi» bo'lib chiqadi. Boshqa qotillar qolmasa, o'zingiz o'ldirishga o'tasiz.",
  },
  maniac: {
    emoji: "🔪",
    name: "Manyak",
    team: "maniac",
    desc: "Yolg'iz qotil. Har tun bir kishini o'ldirasiz. Siz hech kim bilan emassiz — hamma sizga dushman.",
  },
};
const TEAM_NAME = {
  town: "👨🏼 Tinch aholi",
  mafia: "🤵🏼 Mafiya",
  maniac: "🔪 Manyak",
  draw: "🤝 Durang",
};
const WIN_GOAL = {
  town: "barcha mafiya va manyaklarni shahardan haydash.",
  mafia: "mafiyachilar soni qolganlarga teng yoki ko'p bo'lishi.",
  maniac: "shaharda oxirgi (yoki oxirgidan oldingi) tirik qolish.",
};

/* ───────────────────────── MATNLAR (atmosfera) ───────────────────────── */
const FLAVOR = {
  night: [
    "Shahar ko'chalari huvillab qoldi. Faqat eng jasur va qo'rqmas kimsalargina qorong'ida tashqariga chiqadi. Tong otganda kimlar tirik qolganini sanab ko'ramiz...",
    "Qorong'i tushdi. Derazalar yopildi, chiroqlar o'chdi. Shahar jim... lekin hamma ham uxlamayapti.",
    "Tun cho'kdi. Ko'chalarda faqat soyalar kezadi. Kimdir o'z rejasini amalga oshirmoqda...",
  ],
  morning: [
    "Quyosh ufqdan ko'tarilib, faqat tirik qolganlarni yoritmoqda. Tunda nimalar bo'lganini bilib olamiz...",
    "Tong otdi. Shahar uyg'ondi va o'tgan tunning oqibatlarini ko'rmoqda...",
    "Yangi kun boshlandi. Eshiklar ochildi, odamlar xavotir bilan ko'chaga chiqdi...",
  ],
  kill: [
    (n) => `Bu tunda <b>${n}</b> berahm o'ldirildi.`,
    (n) => `Ertalab <b>${n}</b>ning jasadi topildi.`,
    (n) => `Qo'shnilar tunda shubhali shovqin eshitgan. <b>${n}</b> endi yo'q.`,
  ],
  quiet: [
    "🕊 Bu tun g'alati darajada tinch o'tdi — hech kim o'lmadi.",
    "🕊 Ertalab hamma tirik va sog'. Bu tun hech kim o'lmadi.",
    "🕊 Shahar omadli ekan: bu tunda hech kim jabr ko'rmadi.",
  ],
  noHang: [
    "⚖️ Shahar bir qarorga kela olmadi — bugun hech kim osilmadi.",
    "⚖️ Ovozlar bo'linib ketdi. Bugun jazo yo'q.",
  ],
};

/* ───────────────────────── MA'LUMOTLAR BAZASI (JSON) ───────────────────────── */
const DB_FILE = path.join(__dirname, "data.json");
let db = { users: {} };
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (!db.users) db.users = {};
} catch (_) {}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(
    () => fs.writeFile(DB_FILE, JSON.stringify(db), () => {}),
    500,
  );
}

/* ───────────────────────── YORDAMCHI FUNKSIYALAR ───────────────────────── */
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fullName = (u) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") ||
  u.username ||
  String(u.id);
const short = (s, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const nm = (p) => `<b>${esc(p.name)}</b>`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chunk = (arr, n) => {
  const o = [];
  for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n));
  return o;
};
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getUser(u) {
  const id = String(u.id);
  let r = db.users[id];
  if (!r) {
    r = db.users[id] = {
      id: u.id,
      games: 0,
      wins: 0,
      coins: 50,
      roles: {},
      streak: 0,
      best: 0,
      since: Date.now(),
      last: null,
    };
  }
  r.name = fullName(u);
  r.username = u.username || null;
  return r;
}

const bot = new Telegraf(TOKEN);
let BOT_USERNAME = "";
let BOT_ID = 0;

async function say(chatId, text, extra = {}) {
  try {
    return await bot.telegram.sendMessage(chatId, text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
  } catch (e) {
    if (!(e && e.response && e.response.error_code === 403))
      console.error("say error:", chatId, e.message);
    return null;
  }
}
const editMsg = (chatId, msgId, text, markup) =>
  bot.telegram
    .editMessageText(chatId, msgId, undefined, text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: markup || { inline_keyboard: [] },
    })
    .catch(() => {});
const delMsg = (chatId, msgId) =>
  bot.telegram.deleteMessage(chatId, msgId).catch(() => {});

async function botCanManage(chatId) {
  try {
    const m = await bot.telegram.getChatMember(chatId, BOT_ID);
    return m.status === "administrator" && m.can_delete_messages === true;
  } catch (_) {
    return false;
  }
}
async function isChatAdmin(chatId, userId) {
  try {
    const m = await bot.telegram.getChatMember(chatId, userId);
    return m.status === "creator" || m.status === "administrator";
  } catch (_) {
    return false;
  }
}

/* ───────────────────────── MENYU / PROFIL / REYTING ───────────────────────── */
const addUrl = () =>
  `https://t.me/${BOT_USERNAME}?startgroup=true&admin=delete_messages+restrict_members+pin_messages`;
const mainKb = () => ({
  inline_keyboard: [
    [{ text: "➕ O'yinni o'z chatimga qo'shish", url: addUrl() }],
    [
      { text: "👤 Profil", callback_data: "m:profile" },
      { text: "🏆 Reyting", callback_data: "m:top" },
    ],
    [
      { text: "🎭 Rollar", callback_data: "m:roles" },
      { text: "❓ Qo'llanma", callback_data: "m:help" },
    ],
  ],
});
const backKb = {
  inline_keyboard: [[{ text: "⬅️ Menyu", callback_data: "m:menu" }]],
};

const WELCOME =
  "Salom! 👋\nMen <b>🕴 Mafia</b> o'yini uchun bot-boshlovchiman.\n\n" +
  "Meni guruhingizga qo'shing, <b>admin</b> qiling va <b>/game</b> buyrug'i bilan o'yinni boshlang!";

const HELP =
  "❓ <b>Mafia — qanday o'ynaladi?</b>\n\n" +
  "<b>Maqsad:</b> shaharda ikki tomon kurashadi — 👨🏼 <b>Tinch aholi</b> mafiyani topishi, 🤵🏼 <b>Mafiya</b> esa hammani yo'q qilishi kerak.\n\n" +
  "<b>O'yin bosqichlari:</b>\n" +
  "🌙 <b>Tun</b> — guruhda hamma jim. Maxsus rollar (mafiya, doktor, komissar...) botning <b>shaxsiy chatida</b> tugmalar orqali harakat qiladi.\n" +
  "☀️ <b>Kun</b> — tun natijalari e'lon qilinadi. Hamma muhokama qiladi: kim mafiya?\n" +
  "⚖️ <b>Ovoz berish</b> — guruhdagi tugmalar orqali eng shubhali odamga ovoz beriladi. Eng ko'p ovoz olgan odam uchun yana bir marta «osamizmi?» deb so'raladi (👍/👎).\n" +
  "Shu tarzda tun va kun almashib turadi, to'rtta tomondan biri g'alaba qilguncha.\n\n" +
  "<b>Boshlash:</b>\n" +
  "1️⃣ Meni guruhga qo'shing va <b>admin</b> qiling (xabarlarni o'chirish huquqi bilan).\n" +
  "2️⃣ Guruhda <b>/game</b> yozing.\n" +
  "3️⃣ «➕ Qo'shilish» tugmasini bosing → bot ochiladi → <b>Start</b> bosing → guruhga qayting.\n" +
  `4️⃣ Kamida <b>${CFG.MIN_PLAYERS}</b> o'yinchi yig'ilsa, o'yin boshlanadi. Rolingiz shaxsiy xabarda keladi.\n\n` +
  "<b>Guruh buyruqlari:</b>\n" +
  "/game — yangi o'yin\n/begin — ro'yxatni yopib darrov boshlash\n/extend — ro'yxatga +30 soniya\n/leave — ro'yxatdan chiqish\n" +
  "/players — o'yinchilar ro'yxati\n/stop — o'yinni to'xtatish (admin)\n/profile — profil (xabarga reply qilsangiz, o'sha odamniki)\n\n" +
  "💡 O'yin davomida guruhda yozish cheklanadi: tunda hamma jim, o'lganlar esa yozolmaydi.";

function rolesText() {
  let t = "🎭 <b>O'yin rollari</b>\n";
  for (const team of ["town", "mafia", "maniac"]) {
    t += `\n<b>${TEAM_NAME[team]}</b>\n`;
    for (const r of Object.values(ROLES).filter((x) => x.team === team))
      t += `${r.emoji} <b>${r.name}</b> — ${r.desc.replace(/\n/g, " ")}\n`;
  }
  return t;
}

function rankTitle(wins) {
  if (wins >= 50) return "👑 Afsona";
  if (wins >= 25) return "🥇 Ekspert";
  if (wins >= 10) return "🥈 Usta";
  if (wins >= 3) return "🥉 Tajribali";
  return "🌱 Yangi o'yinchi";
}
function profileText(r) {
  const losses = r.games - r.wins;
  const rate = r.games ? Math.round((r.wins / r.games) * 100) : 0;
  const fav = Object.entries(r.roles || {}).sort((a, b) => b[1] - a[1])[0];
  const favTxt =
    fav && ROLES[fav[0]]
      ? `${ROLES[fav[0]].emoji} ${ROLES[fav[0]].name} (${fav[1]})`
      : "—";
  return (
    `👤 <b>${esc(r.name)}</b>${r.username ? ` (@${esc(r.username)})` : ""}\n` +
    `🆔 <code>${r.id}</code>\n` +
    `🎖 Daraja: <b>${rankTitle(r.wins)}</b>\n` +
    `━━━━━━━━━━━━━━\n` +
    `💰 Tangalar: <b>${r.coins}</b>\n` +
    `🎮 O'yinlar: <b>${r.games}</b>\n` +
    `🏆 G'alabalar: <b>${r.wins}</b> (${rate}%)\n` +
    `💀 Mag'lubiyatlar: <b>${losses}</b>\n` +
    `🔥 G'alaba seriyasi: <b>${r.streak}</b> (rekord: ${r.best})\n` +
    `🎭 Sevimli rol: ${favTxt}\n` +
    `📅 Ro'yxatdan o'tgan: ${new Date(r.since).toLocaleDateString("ru-RU")}`
  );
}
function topText() {
  const list = Object.values(db.users)
    .filter((u) => u.games > 0)
    .sort((a, b) => b.wins - a.wins || a.games - b.games)
    .slice(0, 10);
  if (!list.length)
    return "🏆 <b>Reyting</b>\n\nHali hech kim o'ynamagan. Birinchi bo'ling!";
  const medals = ["🥇", "🥈", "🥉"];
  return (
    "🏆 <b>Eng yaxshi o'yinchilar</b>\n\n" +
    list
      .map(
        (u, i) =>
          `${medals[i] || `${i + 1}.`} <b>${esc(u.name)}</b> — 🏆 ${u.wins} / 🎮 ${u.games}`,
      )
      .join("\n")
  );
}

async function nav(ctx, text, markup) {
  const extra = {
    parse_mode: "HTML",
    reply_markup: markup,
    disable_web_page_preview: true,
  };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch (_) {}
    try {
      await ctx.deleteMessage();
    } catch (_) {}
  }
  await ctx.reply(text, extra);
}

async function sendProfile(ctx, tgUser, markup) {
  const r = getUser(tgUser);
  save();
  const text = profileText(r);
  if (ctx.callbackQuery) {
    try {
      await ctx.deleteMessage();
    } catch (_) {}
  }
  try {
    const ph = await ctx.telegram.getUserProfilePhotos(tgUser.id, 0, 1);
    if (ph.total_count > 0) {
      const sizes = ph.photos[0];
      return await ctx.replyWithPhoto(sizes[sizes.length - 1].file_id, {
        caption: text,
        parse_mode: "HTML",
        reply_markup: markup,
      });
    }
  } catch (_) {}
  return ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
}

/* ───────────────────────── O'YIN HOLATI ───────────────────────── */
const games = new Map(); // chatId -> game
const inGame = new Map(); // userId -> chatId
const getP = (g, id) => g.players.find((p) => p.id === id);
const aliveOf = (g) => g.players.filter((p) => p.alive);
const live = (g) => games.get(g.chatId) === g;
const aliveList = (g) =>
  aliveOf(g)
    .map((p, i) => `${i + 1}. ${nm(p)}`)
    .join("\n");
const backLinkKb = (g) =>
  g && g.link
    ? { inline_keyboard: [[{ text: "↩️ Guruhga qaytish", url: g.link }]] }
    : undefined;

function buildRoles(n) {
  const team = [];
  const mafiaCnt = Math.max(1, Math.floor(n / 4));
  for (let i = 0; i < mafiaCnt; i++) team.push("mafia");
  if (n >= 6) team[0] = "don";
  if (n >= 8) team[team.length - 1] = "lawyer";
  const roles = [...team];
  if (n >= 4) roles.push("commissar");
  if (n >= 5) roles.push("doctor");
  if (n >= 7) roles.push("maniac");
  if (n >= 9) roles.push("mistress");
  if (n >= 10) roles.push("bum");
  if (n >= 11) roles.push("lucky");
  while (roles.length < n) roles.push("civilian");
  return shuffle(roles).slice(0, n);
}

const TIMER_KEYS = [
  "timer",
  "warnT",
  "regTimer",
  "remindTimer",
  "renderT",
  "regRenderT",
  "regTick",
];
function clearTimers(g) {
  TIMER_KEYS.forEach((k) => {
    clearTimeout(g[k]);
    clearInterval(g[k]);
    g[k] = null;
  });
}
function destroyGame(g) {
  clearTimers(g);
  g.state = "end";
  games.delete(g.chatId);
  g.players.forEach((p) => {
    if (inGame.get(p.id) === g.chatId) inGame.delete(p.id);
  });
}
// Bosqich taymeri: tugash vaqti + 15 soniya qolganda ogohlantirish
function setPhase(g, sec, onEnd, warn) {
  clearTimeout(g.timer);
  clearTimeout(g.warnT);
  g.timer = setTimeout(onEnd, sec * 1000);
  if (warn && sec > 25) g.warnT = setTimeout(warn, (sec - 15) * 1000);
}

/* ───────────────────────── RO'YXATDAN O'TISH ───────────────────────── */
const joinUrl = (g) => `https://t.me/${BOT_USERNAME}?start=j_${g.chatId}`;
const regKb = (g) => ({
  inline_keyboard: [
    [{ text: "➕ Qo'shilish", url: joinUrl(g) }],
    [
      { text: "▶️ Hoziroq boshlash", callback_data: "r:begin" },
      { text: "🛑 Bekor qilish", callback_data: "s:ask" },
    ],
  ],
});
function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function regText(g, footer) {
  const list =
    g.players.map((p, i) => `${i + 1}. ${nm(p)}`).join("\n") ||
    "<i>hali hech kim yo'q</i>";
  const left = g.regEnd - Date.now();
  const need = Math.max(0, CFG.MIN_PLAYERS - g.players.length);
  return (
    `🕴 <b>Mafia o'yiniga ro'yxat ochiq!</b>\n` +
    `👤 Boshlovchi: <b>${esc(g.hostName)}</b>\n\n` +
    `👥 Ro'yxatdan o'tganlar (<b>${g.players.length}</b>):\n${list}\n\n` +
    (footer ||
      `⏳ Qolgan vaqt: <b>${fmtLeft(left)}</b>\n` +
        (need > 0
          ? `ℹ️ Boshlash uchun yana kamida <b>${need}</b> ta o'yinchi kerak.\n`
          : `✅ O'yinchilar yetarli — vaqt tugagach o'yin boshlanadi.\n`) +
        `\n👇 «Qo'shilish» ni bosing → bot ochiladi → <b>Start</b> bosing → guruhga qayting.\n` +
        `Tugma ko'rinmasa, <a href="${joinUrl(g)}">shu havolani bosing</a>.`)
  );
}
function scheduleRegRender(g) {
  if (g.regRenderT) return;
  g.regRenderT = setTimeout(() => {
    g.regRenderT = null;
    if (g.state === "reg") editMsg(g.chatId, g.regMsgId, regText(g), regKb(g));
  }, 700);
}
function scheduleReg(g) {
  clearTimeout(g.regTimer);
  clearTimeout(g.remindTimer);
  clearInterval(g.regTick);
  g.regTick = setInterval(() => {
    if (g.state !== "reg") return clearInterval(g.regTick);
    editMsg(g.chatId, g.regMsgId, regText(g), regKb(g));
  }, 5000);
  const left = g.regEnd - Date.now();
  g.regTimer = setTimeout(() => startGame(g), Math.max(left, 0));
  if (left > 35000) {
    g.remindTimer = setTimeout(() => {
      if (g.state === "reg")
        say(
          g.chatId,
          "⏳ Ro'yxat yopilishiga <b>30 soniya</b> qoldi! Qo'shilishga ulguring 👇",
          {
            reply_markup: {
              inline_keyboard: [[{ text: "➕ Qo'shilish", url: joinUrl(g) }]],
            },
          },
        );
    }, left - 30000);
  }
}

/* ───────────────────────── O'YINNI BOSHLASH ───────────────────────── */
const goalText = (role) =>
  `\n\n🎯 <b>G'alaba sharti:</b> ${WIN_GOAL[ROLES[role].team]}`;

async function startGame(g) {
  if (g.state !== "reg") return;
  clearTimeout(g.regTimer);
  clearTimeout(g.remindTimer);
  clearInterval(g.regTick);
  if (g.players.length < CFG.MIN_PLAYERS) {
    g.reopen = (g.reopen || 0) + 1;
    if (g.reopen >= 3) {
      await editMsg(
        g.chatId,
        g.regMsgId,
        regText(g, "❌ <b>Bekor qilindi</b> — o'yinchilar yetarli emas."),
      );
      bot.telegram.unpinChatMessage(g.chatId, g.regMsgId).catch(() => {});
      await say(
        g.chatId,
        `❌ O'yin bekor qilindi: kamida ${CFG.MIN_PLAYERS} ta o'yinchi yig'ilmadi. Qayta boshlash: /game`,
      );
      destroyGame(g);
      return;
    }
    g.regEnd = Date.now() + CFG.REG_SEC * 1000;
    await say(
      g.chatId,
      `⏳ O'yinni boshlash uchun kamida <b>${CFG.MIN_PLAYERS}</b> ta o'yinchi kerak. Ro'yxat yana ochiq — qo'shiling!`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "➕ Qo'shilish", url: joinUrl(g) }]],
        },
      },
    );
    scheduleReg(g);
    return;
  }
  g.state = "starting";
  const roles = buildRoles(g.players.length);
  g.players.forEach((p, i) => {
    p.role = roles[i];
    p.alive = true;
    p.lastTarget = null;
    p.afk = 0;
  });

  await editMsg(
    g.chatId,
    g.regMsgId,
    regText(g, "🔒 <b>Ro'yxat yopildi — o'yin boshlanmoqda!</b>"),
  );
  bot.telegram.unpinChatMessage(g.chatId, g.regMsgId).catch(() => {});

  const mafiaTeam = g.players.filter((p) => ROLES[p.role].team === "mafia");
  await Promise.all(
    g.players.map((p) => {
      let t = `${ROLES[p.role].emoji} <b>Siz — ${ROLES[p.role].name}!</b>\n\n${ROLES[p.role].desc}${goalText(p.role)}`;
      if (ROLES[p.role].team === "mafia" && mafiaTeam.length > 1) {
        t +=
          `\n\n🤝 <b>Jamoadoshlaringiz:</b>\n` +
          mafiaTeam
            .filter((x) => x !== p)
            .map(
              (x) => `${ROLES[x.role].emoji} ${nm(x)} — ${ROLES[x.role].name}`,
            )
            .join("\n");
      }
      t += `\n\n💡 Tun boshlanganda shu yerga harakat tugmalari keladi.`;
      return say(p.id, t, { reply_markup: backLinkKb(g) });
    }),
  );
  if (!live(g)) return;

  const counts = {};
  g.players.forEach((p) => {
    counts[p.role] = (counts[p.role] || 0) + 1;
  });
  const summary = Object.entries(counts)
    .map(
      ([r, c]) => `${ROLES[r].emoji} ${ROLES[r].name}${c > 1 ? ` ×${c}` : ""}`,
    )
    .join("\n");
  await say(
    g.chatId,
    `🎬 <b>O'yin boshlandi!</b>\n\n` +
      `👥 <b>O'yinchilar (${g.players.length}):</b>\n${g.players.map((p, i) => `${i + 1}. ${nm(p)}`).join("\n")}\n\n` +
      `🎭 <b>Rollar:</b>\n${summary}\n\n` +
      `📩 Rollar shaxsiy xabarda yuborildi. Tekshirib ko'ring!\n` +
      `⚠️ O'yin davomida guruhda yozish cheklanadi: tunda hamma jim, o'lganlar yozolmaydi.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛑 O'yinni to'xtatish", callback_data: "s:ask" }],
        ],
      },
    },
  );
  await sleep(4000);
  if (live(g)) startNight(g);
}

/* ───────────────────────── TUN ───────────────────────── */
function actionKind(g, p) {
  switch (p.role) {
    case "mafia":
    case "don":
      return "kill";
    case "lawyer":
      return aliveOf(g).some((x) => x.role === "mafia" || x.role === "don")
        ? "protect"
        : "kill";
    case "commissar":
      return "check";
    case "doctor":
      return "heal";
    case "maniac":
      return "maniac";
    case "mistress":
      return "block";
    case "bum":
      return "visit";
    default:
      return null;
  }
}
function nightTargets(g, p) {
  const al = aliveOf(g);
  switch (p.kind) {
    case "kill":
      return al.filter((x) => ROLES[x.role].team !== "mafia");
    case "protect":
      return al.filter((x) => ROLES[x.role].team === "mafia");
    case "heal":
      return al.filter((x) => x.id !== p.lastTarget);
    case "block":
      return al.filter((x) => x.id !== p.id && x.id !== p.lastTarget);
    default:
      return al.filter((x) => x.id !== p.id);
  }
}
const PROMPT = {
  kill: "🔫 <b>Kimni o'ldiramiz?</b>\nJamoangiz bilan kelishib, qurbonni tanlang.",
  protect:
    "🛡 <b>Kimni himoya qilasiz?</b>\n<i>Komissar uni tekshirsa, «tinch aholi» bo'lib chiqadi.</i>",
  heal: "💉 <b>Kimni davolaysiz?</b>\n<i>Unga hujum bo'lsa, tirik qoladi.</i>",
  maniac: "🔪 <b>Kimni o'ldirasiz?</b>",
  block:
    "💃🏼 <b>Kimnikiga borasiz?</b>\n<i>U bu tunda hech narsa qila olmaydi.</i>",
  visit:
    "🧙🏼‍♂️ <b>Kimnikiga shisha so'rab borasiz?</b>\n<i>U yerga kimlar kelganini ko'rasiz.</i>",
};
const targetKb = (g, p) => ({
  inline_keyboard: chunk(
    nightTargets(g, p).map((x) => ({
      text: short(x.name),
      callback_data: `n:${x.id}`,
    })),
    2,
  ),
});
const commissarKb = () => ({
  inline_keyboard: [
    [
      { text: "🔍 Tekshirish", callback_data: "c:check" },
      { text: "🔫 Otish", callback_data: "c:shoot" },
    ],
  ],
});
const commissarPrompt = (g) =>
  `🕵🏼 <b>${g.day}-tun</b>\nNima qilasiz?\n\n🔍 <b>Tekshirish</b> — mafiyami yoki yo'qligini bilasiz\n🔫 <b>Otish</b> — o'yinchini o'ldirasiz`;

async function startNight(g) {
  if (!live(g)) return;
  g.state = "night";
  g.day += 1;
  g.night = { acted: new Map(), mode: new Map() };
  g.players.forEach((p) => {
    p.kind = p.alive ? actionKind(g, p) : null;
  });

  await say(
    g.chatId,
    `🌃 <b>${g.day}-tun</b>\n${pick(FLAVOR.night)}\n\n` +
      `👥 <b>Tirik o'yinchilar (${aliveOf(g).length}):</b>\n${aliveList(g)}\n\n` +
      `💤 Hamma uxlasin. Maxsus rollar — botga o'tib harakat qilsin!\n⏳ Tun <b>${CFG.NIGHT_SEC}</b> soniya davom etadi.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🤖 Botga o'tish", url: `https://t.me/${BOT_USERNAME}` }],
        ],
      },
    },
  );
  if (!live(g) || g.state !== "night") return;

  await Promise.all(
    aliveOf(g)
      .filter((p) => p.kind)
      .map(async (p) => {
        const sent =
          p.kind === "check"
            ? await say(p.id, commissarPrompt(g), {
                reply_markup: commissarKb(),
              })
            : await say(p.id, `🌙 <b>${g.day}-tun</b>\n${PROMPT[p.kind]}`, {
                reply_markup: targetKb(g, p),
              });
        p.promptMsg = sent ? sent.message_id : null;
      }),
  );
  if (!live(g) || g.state !== "night") return;

  setPhase(
    g,
    CFG.NIGHT_SEC,
    () => endNight(g),
    () => {
      if (g.state !== "night") return;
      say(g.chatId, "⏰ Tun tugashiga <b>15 soniya</b> qoldi!");
      aliveOf(g)
        .filter((p) => p.kind && !g.night.acted.has(p.id))
        .forEach((p) =>
          say(
            p.id,
            "⏰ <b>15 soniya qoldi!</b> Tezroq tanlang, aks holda harakatingiz o'tib ketadi.",
          ),
        );
    },
  );
  checkNightDone(g);
}

function checkNightDone(g) {
  if (g.state !== "night") return;
  const actors = aliveOf(g).filter((p) => p.kind);
  if (actors.every((p) => g.night.acted.has(p.id))) {
    clearTimeout(g.timer);
    clearTimeout(g.warnT);
    g.timer = setTimeout(() => endNight(g), 1500);
  }
}

// Komissar: harakat turini tanlash
bot.action(/^c:(check|shoot|back)$/, async (ctx) => {
  const uid = ctx.from.id;
  const g = games.get(inGame.get(uid));
  if (!g || g.state !== "night")
    return ctx
      .answerCbQuery("⏳ Hozir tun emas.", { show_alert: true })
      .catch(() => {});
  const me = getP(g, uid);
  if (!me || !me.alive || me.kind !== "check" || g.night.acted.has(uid))
    return ctx.answerCbQuery().catch(() => {});
  ctx.answerCbQuery().catch(() => {});
  const mode = ctx.match[1];
  if (mode === "back") {
    g.night.mode.delete(uid);
    return ctx
      .editMessageText(commissarPrompt(g), {
        parse_mode: "HTML",
        reply_markup: commissarKb(),
      })
      .catch(() => {});
  }
  g.night.mode.set(uid, mode);
  const rows = targetKb(g, me).inline_keyboard;
  rows.push([{ text: "⬅️ Orqaga", callback_data: "c:back" }]);
  ctx
    .editMessageText(
      `🕵🏼 <b>${g.day}-tun</b>\n${mode === "check" ? "🔍 <b>Kimni tekshirasiz?</b>" : "🔫 <b>Kimni otasiz?</b>"}`,
      { parse_mode: "HTML", reply_markup: { inline_keyboard: rows } },
    )
    .catch(() => {});
});

// Tungi tanlov (hamma rollar uchun)
bot.action(/^n:(\d+)$/, async (ctx) => {
  const uid = ctx.from.id;
  const g = games.get(inGame.get(uid));
  if (!g || g.state !== "night")
    return ctx
      .answerCbQuery("⏳ Hozir tun emas.", { show_alert: true })
      .catch(() => {});
  const me = getP(g, uid);
  if (!me || !me.alive || !me.kind) return ctx.answerCbQuery().catch(() => {});
  if (g.night.acted.has(uid))
    return ctx.answerCbQuery("Siz allaqachon tanlagansiz.").catch(() => {});
  if (me.kind === "check" && !g.night.mode.has(uid))
    return ctx.answerCbQuery("Avval harakatni tanlang.").catch(() => {});
  const tid = +ctx.match[1];
  const target = nightTargets(g, me).find((x) => x.id === tid);
  if (!target)
    return ctx
      .answerCbQuery("Bu o'yinchini tanlab bo'lmaydi.", { show_alert: true })
      .catch(() => {});

  g.night.acted.set(uid, tid);
  ctx.answerCbQuery("✅ Qabul qilindi").catch(() => {});
  const verbs = {
    kill: "🔫 Qurbon tanlandi",
    protect: "🛡 Himoyaga olindi",
    heal: "💉 Davolash uchun tanlandi",
    maniac: "🔪 Qurbon tanlandi",
    block: "💃🏼 Tashrif uchun tanlandi",
    visit: "🧙🏼‍♂️ Tashrif uchun tanlandi",
  };
  const verb =
    me.kind === "check"
      ? g.night.mode.get(uid) === "shoot"
        ? "🔫 Otish uchun tanlandi"
        : "🔍 Tekshirish uchun tanlandi"
      : verbs[me.kind];
  ctx
    .editMessageText(
      `✅ ${verb}: ${nm(target)}\n\nEndi guruhga qayting va tong otishini kuting.`,
      { parse_mode: "HTML", reply_markup: backLinkKb(g) },
    )
    .catch(() => {});

  if (me.kind === "kill") {
    for (const mate of aliveOf(g).filter(
      (x) => x !== me && ROLES[x.role].team === "mafia",
    )) {
      say(mate.id, `${ROLES[me.role].emoji} ${nm(me)} tanladi: ${nm(target)}`);
    }
  }
  checkNightDone(g);
});

async function endNight(g) {
  if (g.state !== "night") return;
  g.state = "resolving";
  clearTimeout(g.timer);
  clearTimeout(g.warnT);

  const A = g.night.acted; // userId -> targetId
  const M = g.night.mode; // komissar rejimi
  const alive = aliveOf(g);
  const blocked = new Set(
    alive
      .filter((p) => p.kind === "block" && A.has(p.id))
      .map((p) => A.get(p.id)),
  );
  const valid = (p) => A.has(p.id) && !blocked.has(p.id);
  const by = (k) => alive.filter((p) => p.kind === k && valid(p));

  for (const id of blocked)
    say(
      id,
      "💃🏼 Bu kecha sizni kezuvchi band qildi — hech qayoqqa chiqa olmadingiz.",
    );

  // Mafiya nishoni
  let mafiaT = null;
  const kv = by("kill");
  if (kv.length) {
    const cnt = new Map();
    kv.forEach((p) => cnt.set(A.get(p.id), (cnt.get(A.get(p.id)) || 0) + 1));
    const mx = Math.max(...cnt.values());
    const top = [...cnt].filter(([, c]) => c === mx).map(([t]) => t);
    if (top.length > 1) {
      const don = kv.find((p) => p.role === "don");
      mafiaT = don && top.includes(A.get(don.id)) ? A.get(don.id) : pick(top);
    } else mafiaT = top[0];
  }
  const man = by("maniac")[0];
  const maniacT = man ? A.get(man.id) : null;
  const com = by("check")[0];
  const comMode = com ? M.get(com.id) : null;
  const shotT = com && comMode === "shoot" ? A.get(com.id) : null;
  const doc = by("heal")[0];
  const healT = doc ? A.get(doc.id) : null;
  const lawyer = by("protect")[0];
  const protectT = lawyer ? A.get(lawyer.id) : null;

  // Hujumlar va o'limlar
  const attacks = new Map();
  if (mafiaT != null) attacks.set(mafiaT, "kill");
  if (maniacT != null && !attacks.has(maniacT)) attacks.set(maniacT, "kill");
  if (shotT != null && !attacks.has(shotT)) attacks.set(shotT, "shot");
  const deaths = [];
  let savedSomeone = false;
  for (const [id, cause] of attacks) {
    const v = getP(g, id);
    if (!v || !v.alive) continue;
    if (healT === id) {
      savedSomeone = true;
      say(
        id,
        "🩺 Bu kecha sizga hujum bo'ldi, lekin <b>doktor</b> sizni qutqardi!",
      );
    } else if (v.role === "lucky" && Math.random() < 0.5) {
      say(
        id,
        "🍀 Bu kecha sizga hujum bo'ldi, lekin <b>omadingiz keldi</b> — tirik qoldingiz!",
      );
    } else {
      v.alive = false;
      deaths.push({ p: v, cause });
    }
  }
  if (savedSomeone && doc)
    say(doc.id, `✅ Siz ${nm(getP(g, healT))} ni o'limdan qutqardingiz!`);

  // Komissar tekshiruvi
  if (com && comMode === "check") {
    const t = getP(g, A.get(com.id));
    const bad = ROLES[t.role].team === "mafia" && t.id !== protectT;
    say(
      com.id,
      `🕵🏼 <b>Tekshiruv natijasi:</b>\n${nm(t)} — ${bad ? "🔴 <b>MAFIYA!</b>" : "🟢 <b>Tinch aholi</b>"}`,
    );
  }

  // Bomj
  const bum = by("visit")[0];
  if (bum) {
    const bt = A.get(bum.id);
    const visitors = alive.filter(
      (p) => p !== bum && valid(p) && A.get(p.id) === bt,
    );
    const t = getP(g, bt);
    say(
      bum.id,
      visitors.length
        ? `🧙🏼‍♂️ ${nm(t)} nikida sizdan boshqa quyidagilarni ko'rdingiz:\n` +
            visitors.map((v) => `• ${nm(v)}`).join("\n")
        : `🧙🏼‍♂️ ${nm(t)} nikiga bu tunda hech kim kelmadi.`,
    );
  }

  // Doktor/Kezuvchi ketma-ket takrorlanmasligi uchun
  alive.forEach((p) => {
    if (p.kind === "heal" || p.kind === "block")
      p.lastTarget = A.has(p.id) ? A.get(p.id) : null;
  });

  // Harakatsiz (AFK) o'yinchilar
  const afkOut = [];
  for (const p of alive) {
    if (!p.kind || !p.alive) continue;
    if (A.has(p.id)) {
      p.afk = 0;
      continue;
    }
    p.afk = (p.afk || 0) + 1;
    if (p.afk >= CFG.AFK_NIGHTS) {
      p.alive = false;
      afkOut.push(p);
      say(
        p.id,
        "💤 Siz ketma-ket bir necha tun harakat qilmadingiz va o'yindan chiqarildingiz.",
      );
    }
  }
  deaths.forEach((d) =>
    say(
      d.p.id,
      "💀 Siz bu kecha o'ldirildingiz. Endi tomoshabinsiz — guruhda yozish mumkin emas.",
    ),
  );

  // Ertalabki hisobot
  let t = `🌞 <b>${g.day}-kun</b>\n${pick(FLAVOR.morning)}\n\n`;
  const lines = deaths.map((d) => {
    const head =
      d.cause === "shot"
        ? `🔫 Komissar Katani <b>${esc(d.p.name)}</b> ni otib o'ldirdi.`
        : `💀 ${pick(FLAVOR.kill)(esc(d.p.name))}`;
    return `${head}\nU — ${ROLES[d.p.role].emoji} <i>${ROLES[d.p.role].name}</i> edi.`;
  });
  afkOut.forEach((p) =>
    lines.push(
      `💤 <b>${esc(p.name)}</b> uxlab qoldi va o'yindan chiqarildi.\nU — ${ROLES[p.role].emoji} <i>${ROLES[p.role].name}</i> edi.`,
    ),
  );
  t += lines.length ? lines.join("\n\n") : pick(FLAVOR.quiet);
  const left = aliveOf(g);
  t += `\n\n👥 <b>Tirik o'yinchilar (${left.length}):</b>\n${aliveList(g)}`;

  const w = checkWin(g);
  if (w) {
    await say(g.chatId, t);
    if (live(g)) endGame(g, w);
    return;
  }
  t += `\n\n💬 <b>Muhokama vaqti!</b> Tungi voqealarni muhokama qiling, shubhali kimsalarni toping.\n⚖️ Ovoz berish <b>${CFG.DAY_SEC}</b> soniyadan so'ng boshlanadi.`;
  g.state = "day";
  await say(g.chatId, t);
  if (!live(g) || g.state !== "day") return;
  setPhase(g, CFG.DAY_SEC, () => startVote(g));
}

/* ───────────────────────── OVOZ BERISH ───────────────────────── */
function voteKb(g) {
  const cnt = new Map();
  for (const t of g.votes.values()) cnt.set(t, (cnt.get(t) || 0) + 1);
  const btns = aliveOf(g).map((p) => ({
    text: `${short(p.name)}${cnt.get(p.id) ? ` · ${cnt.get(p.id)}` : ""}`,
    callback_data: `v:${p.id}`,
  }));
  const rows = chunk(btns, 2);
  rows.push([
    {
      text: `🚫 Hech kim${cnt.get("skip") ? ` · ${cnt.get("skip")}` : ""}`,
      callback_data: "v:skip",
    },
  ]);
  return { inline_keyboard: rows };
}
function voteText(g, closed) {
  const lines = [...g.votes].map(
    ([v, t]) =>
      `🗳 ${esc(getP(g, v).name)} → ${t === "skip" ? "🚫 hech kim" : `<b>${esc(getP(g, t).name)}</b>`}`,
  );
  return (
    `⚖️ <b>Ovoz berish${closed ? " yakunlandi" : " vaqti!"}</b>\n` +
    (closed
      ? ""
      : `Kim aybdor? Eng shubhali o'yinchini tanlang.\n⏳ Vaqt: <b>${CFG.VOTE_SEC}</b> soniya. Ovozni o'zgartirish mumkin.\n`) +
    (lines.length
      ? `\n${lines.join("\n")}`
      : closed
        ? "\nHech kim ovoz bermadi."
        : "")
  );
}
function scheduleVoteRender(g) {
  if (g.renderT) return;
  g.renderT = setTimeout(() => {
    g.renderT = null;
    if (g.state === "vote")
      editMsg(g.chatId, g.voteMsgId, voteText(g), voteKb(g));
  }, 800);
}

async function startVote(g) {
  if (!live(g) || g.state !== "day") return;
  g.state = "vote";
  g.votes = new Map();
  const sent = await say(g.chatId, voteText(g), { reply_markup: voteKb(g) });
  if (!live(g) || g.state !== "vote") return;
  g.voteMsgId = sent ? sent.message_id : null;
  setPhase(
    g,
    CFG.VOTE_SEC,
    () => endVote(g),
    () => {
      if (g.state === "vote")
        say(g.chatId, "⏰ Ovoz berish tugashiga <b>15 soniya</b> qoldi!");
    },
  );
}

bot.action(/^v:(\d+|skip)$/, async (ctx) => {
  const g = ctx.chat && games.get(ctx.chat.id);
  if (
    !g ||
    g.state !== "vote" ||
    ctx.callbackQuery.message.message_id !== g.voteMsgId
  )
    return ctx.answerCbQuery("Ovoz berish tugagan.").catch(() => {});
  const me = getP(g, ctx.from.id);
  if (!me || !me.alive)
    return ctx
      .answerCbQuery("Siz ovoz bera olmaysiz.", { show_alert: true })
      .catch(() => {});
  const tid = ctx.match[1] === "skip" ? "skip" : +ctx.match[1];
  if (tid !== "skip") {
    if (tid === me.id)
      return ctx
        .answerCbQuery("O'zingizga ovoz bera olmaysiz.", { show_alert: true })
        .catch(() => {});
    const tp = getP(g, tid);
    if (!tp || !tp.alive) return ctx.answerCbQuery().catch(() => {});
  }
  g.votes.set(me.id, tid);
  ctx.answerCbQuery("✅ Ovoz qabul qilindi").catch(() => {});
  scheduleVoteRender(g);
  if (aliveOf(g).every((p) => g.votes.has(p.id))) {
    clearTimeout(g.timer);
    clearTimeout(g.warnT);
    g.timer = setTimeout(() => endVote(g), 1200);
  }
});

async function endVote(g) {
  if (g.state !== "vote") return;
  g.state = "resolving";
  clearTimeout(g.timer);
  clearTimeout(g.warnT);
  clearTimeout(g.renderT);
  g.renderT = null;
  await editMsg(g.chatId, g.voteMsgId, voteText(g, true));
  if (!live(g)) return;

  const cnt = new Map();
  for (const t of g.votes.values()) cnt.set(t, (cnt.get(t) || 0) + 1);
  const skip = cnt.get("skip") || 0;
  cnt.delete("skip");
  let cand = null;
  if (cnt.size) {
    const mx = Math.max(...cnt.values());
    const top = [...cnt].filter(([, c]) => c === mx).map(([id]) => id);
    if (top.length === 1 && mx > skip) cand = getP(g, top[0]);
  }
  if (cand) return startConfirm(g, cand);
  await say(g.chatId, pick(FLAVOR.noHang));
  afterDay(g);
}

/* Osishni tasdiqlash (👍/👎) */
function confirmKb(g) {
  let yes = 0,
    no = 0;
  for (const v of g.confirm.votes.values()) v ? yes++ : no++;
  return {
    inline_keyboard: [
      [
        { text: `👍 Osish${yes ? ` · ${yes}` : ""}`, callback_data: "y:1" },
        {
          text: `👎 Qo'yib yuborish${no ? ` · ${no}` : ""}`,
          callback_data: "y:0",
        },
      ],
    ],
  };
}
function confirmText(g, closed) {
  const target = getP(g, g.confirm.target);
  const lines = [...g.confirm.votes].map(
    ([v, y]) => `${y ? "👍" : "👎"} ${esc(getP(g, v).name)}`,
  );
  return (
    `⚖️ Eng ko'p ovoz olgan: <b>${esc(target.name)}</b>\n` +
    (closed
      ? ""
      : `Uni osamizmi? ${CFG.CONFIRM_SEC} soniya ichida ovoz bering.\n`) +
    (lines.length ? `\n${lines.join("\n")}` : "")
  );
}
async function startConfirm(g, target) {
  g.state = "confirm";
  g.confirm = { target: target.id, votes: new Map() };
  const sent = await say(g.chatId, confirmText(g), {
    reply_markup: confirmKb(g),
  });
  if (!live(g) || g.state !== "confirm") return;
  g.confirmMsgId = sent ? sent.message_id : null;
  setPhase(g, CFG.CONFIRM_SEC, () => endConfirm(g));
}
bot.action(/^y:([01])$/, async (ctx) => {
  const g = ctx.chat && games.get(ctx.chat.id);
  if (
    !g ||
    g.state !== "confirm" ||
    ctx.callbackQuery.message.message_id !== g.confirmMsgId
  )
    return ctx.answerCbQuery("Ovoz berish tugagan.").catch(() => {});
  const me = getP(g, ctx.from.id);
  if (!me || !me.alive)
    return ctx
      .answerCbQuery("Siz ovoz bera olmaysiz.", { show_alert: true })
      .catch(() => {});
  if (me.id === g.confirm.target)
    return ctx
      .answerCbQuery("O'zingiz haqingizda ovoz bera olmaysiz.", {
        show_alert: true,
      })
      .catch(() => {});
  g.confirm.votes.set(me.id, ctx.match[1] === "1");
  ctx.answerCbQuery("✅ Ovoz qabul qilindi").catch(() => {});
  if (!g.renderT) {
    g.renderT = setTimeout(() => {
      g.renderT = null;
      if (g.state === "confirm")
        editMsg(g.chatId, g.confirmMsgId, confirmText(g), confirmKb(g));
    }, 800);
  }
  const voters = aliveOf(g).filter((p) => p.id !== g.confirm.target);
  if (voters.every((p) => g.confirm.votes.has(p.id))) {
    clearTimeout(g.timer);
    g.timer = setTimeout(() => endConfirm(g), 1200);
  }
});
async function endConfirm(g) {
  if (g.state !== "confirm") return;
  g.state = "resolving";
  clearTimeout(g.timer);
  clearTimeout(g.renderT);
  g.renderT = null;
  await editMsg(g.chatId, g.confirmMsgId, confirmText(g, true));
  if (!live(g)) return;
  const target = getP(g, g.confirm.target);
  let yes = 0,
    no = 0;
  for (const v of g.confirm.votes.values()) v ? yes++ : no++;
  if (yes > no) {
    target.alive = false;
    say(
      target.id,
      "⚖️ Shahar sizni osishga qaror qildi. Siz o'yindan chiqdingiz — endi tomoshabinsiz.",
    );
    await say(
      g.chatId,
      `⚖️ Shahar hukmi: <b>${esc(target.name)}</b> osildi.\nU — ${ROLES[target.role].emoji} <i>${ROLES[target.role].name}</i> edi.`,
    );
  } else {
    await say(
      g.chatId,
      `⚖️ Shahar <b>${esc(target.name)}</b> ni oqladi — osishga ovoz yetmadi.`,
    );
  }
  afterDay(g);
}

async function afterDay(g) {
  if (!live(g)) return;
  const w = checkWin(g);
  if (w) return endGame(g, w);
  await sleep(3500);
  if (live(g)) startNight(g);
}

/* ───────────────────────── G'ALABA / TUGASH ───────────────────────── */
function checkWin(g) {
  const al = aliveOf(g);
  if (!al.length) return "draw";
  const mafia = al.filter((p) => ROLES[p.role].team === "mafia").length;
  const maniac = al.filter((p) => p.role === "maniac").length;
  const other = al.length - mafia - maniac;
  if (!mafia && !maniac) return "town";
  if (!mafia && maniac && other <= 1) return "maniac";
  if (!maniac && mafia >= other) return "mafia";
  return null;
}
const WIN_TEXT = {
  town: "🎉 Mafiya tor-mor qilindi! Shahar tinchligi tiklandi.",
  mafia: "🕶 Mafiya shaharni egalladi. Endi hukm ularniki!",
  maniac: "🔪 Shaharda faqat Manyak qoldi... Hamma narsa tugadi.",
  draw: "🤝 Hamma yo'q bo'ldi — hech kim g'alaba qozonmadi.",
};

async function endGame(g, winTeam) {
  const winners =
    winTeam === "draw"
      ? []
      : g.players.filter((p) => ROLES[p.role].team === winTeam);
  const wset = new Set(winners.map((p) => p.id));
  for (const p of g.players) {
    const r = getUser({ id: p.id, first_name: p.name, username: p.username });
    r.games += 1;
    r.roles[p.role] = (r.roles[p.role] || 0) + 1;
    r.last = Date.now();
    r.coins += 5;
    if (wset.has(p.id)) {
      r.wins += 1;
      r.coins += 25;
      r.streak += 1;
      r.best = Math.max(r.best, r.streak);
    } else r.streak = 0;
  }
  save();

  let t = `🏁 <b>O'yin tugadi!</b>\n\n${WIN_TEXT[winTeam]}\n🏆 G'olib: <b>${TEAM_NAME[winTeam]}</b>\n\n👥 <b>Ishtirokchilar:</b>\n`;
  t += g.players
    .map(
      (p) =>
        `${p.alive ? "🟢" : "💀"} ${nm(p)} — ${ROLES[p.role].emoji} ${ROLES[p.role].name}${wset.has(p.id) ? " 🏆" : ""}`,
    )
    .join("\n");
  t += `\n\n⏱ Davomiyligi: ${g.day} kecha\n💰 G'oliblarga +30, qolganlarga +5 tanga berildi.\n\n🔄 Yangi o'yin: /game`;
  destroyGame(g);
  await say(g.chatId, t);
}

/* ───────────────────────── O'YINNI TO'XTATISH ───────────────────────── */
const canControl = async (g, uid) =>
  uid === g.hostId || (await isChatAdmin(g.chatId, uid));

async function stopGame(g, by) {
  const started = g.state !== "reg";
  const players = g.players.slice();
  destroyGame(g);
  if (!started) {
    editMsg(g.chatId, g.regMsgId, regText(g, "❌ <b>Bekor qilindi</b>"));
    bot.telegram.unpinChatMessage(g.chatId, g.regMsgId).catch(() => {});
  }
  let t = `🛑 O'yin <b>${esc(fullName(by))}</b> tomonidan to'xtatildi.`;
  if (started && players.length && players[0].role) {
    t +=
      `\n\n🎭 <b>Rollar:</b>\n` +
      players
        .map(
          (p) =>
            `${p.alive ? "🟢" : "💀"} ${nm(p)} — ${ROLES[p.role].emoji} ${ROLES[p.role].name}`,
        )
        .join("\n");
  }
  t += `\n\n🔄 Yangi o'yin: /game`;
  await say(g.chatId, t);
}

async function askStop(ctx, g) {
  if (!(await canControl(g, ctx.from.id))) {
    if (ctx.callbackQuery)
      return ctx
        .answerCbQuery("Faqat admin yoki o'yinni ochgan odam to'xtata oladi.", {
          show_alert: true,
        })
        .catch(() => {});
    return ctx.reply("Faqat admin yoki o'yinni ochgan odam to'xtata oladi.");
  }
  if (ctx.callbackQuery) ctx.answerCbQuery().catch(() => {});
  return say(
    g.chatId,
    "🛑 <b>O'yinni to'xtatamizmi?</b>\nBu amalni qaytarib bo'lmaydi.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Ha, to'xtatish", callback_data: "s:yes" },
            { text: "↩️ Yo'q", callback_data: "s:no" },
          ],
        ],
      },
    },
  );
}

bot.action(/^s:(ask|yes|no)$/, async (ctx) => {
  const g = ctx.chat && games.get(ctx.chat.id);
  const act = ctx.match[1];
  if (!g) {
    ctx.answerCbQuery("Faol o'yin yo'q.").catch(() => {});
    return ctx.deleteMessage().catch(() => {});
  }
  if (act === "ask") return askStop(ctx, g);
  if (!(await canControl(g, ctx.from.id)))
    return ctx
      .answerCbQuery("Faqat admin yoki o'yinni ochgan odam qaror qila oladi.", {
        show_alert: true,
      })
      .catch(() => {});
  ctx.answerCbQuery().catch(() => {});
  ctx.deleteMessage().catch(() => {});
  if (act === "yes") return stopGame(g, ctx.from);
});

bot.action("r:begin", async (ctx) => {
  const g = ctx.chat && games.get(ctx.chat.id);
  if (!g || g.state !== "reg")
    return ctx.answerCbQuery("Ro'yxat yopilgan.").catch(() => {});
  if (!(await canControl(g, ctx.from.id)))
    return ctx
      .answerCbQuery("Faqat admin yoki o'yinni ochgan odam boshlay oladi.", {
        show_alert: true,
      })
      .catch(() => {});
  if (g.players.length < CFG.MIN_PLAYERS)
    return ctx
      .answerCbQuery(
        `Kamida ${CFG.MIN_PLAYERS} ta o'yinchi kerak (hozir ${g.players.length}).`,
        { show_alert: true },
      )
      .catch(() => {});
  ctx.answerCbQuery("▶️ Boshlanmoqda...").catch(() => {});
  startGame(g);
});

/* ───────────────────────── GURUHDA XABARLARNI NAZORAT QILISH ───────────────────────── */
bot.use(async (ctx, next) => {
  const m = ctx.message;
  if (!m || !ctx.chat || ctx.chat.type === "private" || !ctx.from)
    return next();
  if (
    m.new_chat_members ||
    m.left_chat_member ||
    m.pinned_message ||
    m.new_chat_title
  )
    return next();
  const g = games.get(ctx.chat.id);
  if (!g || g.state === "reg" || g.state === "end") return next();
  if (m.text && m.text.startsWith("/")) return next();
  const pl = getP(g, ctx.from.id);
  const del = g.state === "night" ? true : !pl || !pl.alive;
  if (del) {
    ctx.deleteMessage().catch(() => {});
    return;
  }
  return next();
});

/* ───────────────────────── BUYRUQLAR ───────────────────────── */
bot.start(async (ctx) => {
  if (ctx.chat.type !== "private")
    return ctx.reply(
      "Men tayyorman! 🕴 O'yinni boshlash uchun /game ni yozing.",
    );
  getUser(ctx.from);
  save();
  const payload = (ctx.startPayload || "").trim();
  if (payload.startsWith("j_")) return joinFromDM(ctx, +payload.slice(2));
  return ctx.reply(WELCOME, { parse_mode: "HTML", reply_markup: mainKb() });
});

async function joinFromDM(ctx, chatId) {
  const g = games.get(chatId);
  if (!g || g.state !== "reg")
    return ctx.reply(
      "😕 Bu o'yin uchun ro'yxat yopilgan yoki bekor qilingan.",
      { reply_markup: mainKb() },
    );
  const uid = ctx.from.id;
  const existing = inGame.get(uid);
  if (existing && existing !== chatId)
    return ctx.reply("⚠️ Siz boshqa o'yinda ishtirok etyapsiz.");
  if (getP(g, uid))
    return ctx.reply("✅ Siz allaqachon ro'yxatdasiz.", {
      reply_markup: backLinkKb(g),
    });
  if (g.players.length >= CFG.MAX_PLAYERS)
    return ctx.reply("😕 Ro'yxat to'lgan.");
  g.players.push({
    id: uid,
    name: fullName(ctx.from),
    username: ctx.from.username || null,
    alive: true,
    role: null,
  });
  inGame.set(uid, chatId);
  scheduleRegRender(g);
  return ctx.reply(
    `✅ Siz <b>${esc(g.title)}</b> o'yiniga qo'shildingiz!\n\n` +
      `Guruhga qaytib, o'yin boshlanishini kuting. Rolingiz va tungi tugmalar shu yerga keladi — botni <b>o'chirib qo'ymang</b> 🔔`,
    { parse_mode: "HTML", reply_markup: backLinkKb(g) },
  );
}

bot.command(["game", "newgame", "startgame"], async (ctx) => {
  if (ctx.chat.type === "private")
    return ctx.reply(
      "Bu buyruq faqat guruhda ishlaydi. Avval meni guruhga qo'shing 👇",
      { reply_markup: mainKb() },
    );
  const chatId = ctx.chat.id;
  if (games.has(chatId))
    return ctx.reply(
      "⚠️ Bu chatda o'yin allaqachon ketmoqda. To'xtatish: /stop",
    );
  if (!(await botCanManage(chatId)))
    return ctx.reply(
      "⚠️ Avval meni <b>admin</b> qiling (kamida «Xabarlarni o'chirish» huquqi bilan), keyin /game ni qayta yozing.",
      { parse_mode: "HTML" },
    );

  const link = ctx.chat.username
    ? `https://t.me/${ctx.chat.username}`
    : String(chatId).startsWith("-100")
      ? `https://t.me/c/${String(chatId).slice(4)}`
      : null;
  const g = {
    chatId,
    title: ctx.chat.title || "Guruh",
    link,
    hostId: ctx.from.id,
    hostName: fullName(ctx.from),
    state: "reg",
    players: [],
    day: 0,
    regEnd: Date.now() + CFG.REG_SEC * 1000,
    votes: new Map(),
    night: null,
  };
  games.set(chatId, g);
  const sent = await say(chatId, regText(g), { reply_markup: regKb(g) });
  if (!sent) {
    games.delete(chatId);
    return;
  }
  g.regMsgId = sent.message_id;
  bot.telegram
    .pinChatMessage(chatId, sent.message_id, { disable_notification: true })
    .catch(() => {});
  scheduleReg(g);
});

bot.command("extend", (ctx) => {
  const g = games.get(ctx.chat.id);
  if (!g || g.state !== "reg") return;
  g.regEnd += 30000;
  scheduleReg(g);
  editMsg(g.chatId, g.regMsgId, regText(g), regKb(g));
  ctx.reply("⏳ Ro'yxat yopilishi 30 soniyaga uzaytirildi.");
});

bot.command(["begin", "go"], async (ctx) => {
  const g = games.get(ctx.chat.id);
  if (!g || g.state !== "reg") return;
  if (!(await canControl(g, ctx.from.id)))
    return ctx.reply("Faqat admin yoki o'yinni ochgan odam boshlay oladi.");
  if (g.players.length < CFG.MIN_PLAYERS)
    return ctx.reply(
      `Kamida ${CFG.MIN_PLAYERS} ta o'yinchi kerak (hozir ${g.players.length}).`,
    );
  startGame(g);
});

bot.command("leave", (ctx) => {
  const g = games.get(ctx.chat.id);
  if (!g) return;
  if (g.state !== "reg")
    return ctx.reply("O'yin boshlangan — chiqib bo'lmaydi 😉");
  const i = g.players.findIndex((p) => p.id === ctx.from.id);
  if (i < 0) return;
  g.players.splice(i, 1);
  inGame.delete(ctx.from.id);
  scheduleRegRender(g);
});

bot.command(["stop", "stopgame", "endgame"], async (ctx) => {
  if (ctx.chat.type === "private")
    return ctx.reply("Bu buyruq guruhda ishlaydi.");
  const g = games.get(ctx.chat.id);
  if (!g) return ctx.reply("Hozir faol o'yin yo'q. Yangi o'yin: /game");
  return askStop(ctx, g);
});

bot.command(["players", "alive"], (ctx) => {
  const g = games.get(ctx.chat.id);
  if (!g) return ctx.reply("Hozir faol o'yin yo'q. Yangi o'yin: /game");
  if (g.state === "reg")
    return ctx.reply(
      `👥 <b>Ro'yxatdagilar (${g.players.length}):</b>\n${g.players.map((p, i) => `${i + 1}. ${nm(p)}`).join("\n") || "—"}`,
      { parse_mode: "HTML" },
    );
  return ctx.reply(
    `👥 <b>Tirik o'yinchilar (${aliveOf(g).length}):</b>\n${aliveList(g)}`,
    { parse_mode: "HTML" },
  );
});

bot.command("profile", (ctx) => {
  const target =
    (ctx.message.reply_to_message && ctx.message.reply_to_message.from) ||
    ctx.from;
  if (target.is_bot) return ctx.reply("🤖 Botlarning profili yo'q.");
  return sendProfile(
    ctx,
    target,
    ctx.chat.type === "private" ? backKb : undefined,
  );
});
bot.command("top", (ctx) => ctx.reply(topText(), { parse_mode: "HTML" }));
bot.command("roles", (ctx) => ctx.reply(rolesText(), { parse_mode: "HTML" }));
bot.command("help", (ctx) => ctx.reply(HELP, { parse_mode: "HTML" }));

/* Menyu tugmalari */
bot.action("m:menu", async (ctx) => {
  ctx.answerCbQuery().catch(() => {});
  await nav(ctx, WELCOME, mainKb());
});
bot.action("m:profile", async (ctx) => {
  ctx.answerCbQuery().catch(() => {});
  await sendProfile(ctx, ctx.from, backKb);
});
bot.action("m:top", async (ctx) => {
  ctx.answerCbQuery().catch(() => {});
  await nav(ctx, topText(), backKb);
});
bot.action("m:roles", async (ctx) => {
  ctx.answerCbQuery().catch(() => {});
  await nav(ctx, rolesText(), backKb);
});
bot.action("m:help", async (ctx) => {
  ctx.answerCbQuery().catch(() => {});
  await nav(ctx, HELP, backKb);
});

/* Bot guruhga qo'shilganda / admin qilinganda */
bot.on("my_chat_member", (ctx) => {
  const u = ctx.myChatMember;
  if (ctx.chat.type === "private") return;
  const ns = u.new_chat_member.status,
    os = u.old_chat_member.status;
  if (ns === "administrator" && os !== "administrator") {
    say(
      ctx.chat.id,
      "✅ Rahmat! Endi o'yinni boshlash uchun <b>/game</b> ni yozing.",
    );
  } else if (ns === "member" && (os === "left" || os === "kicked")) {
    say(
      ctx.chat.id,
      "👋 Salom! Meni <b>admin</b> qiling (xabarlarni o'chirish huquqi bilan), keyin <b>/game</b> ni yozing.",
    );
  }
});

bot.catch((err, ctx) =>
  console.error(`Xatolik [${ctx && ctx.updateType}]:`, err.message),
);

/* ───────────────────────── ISHGA TUSHIRISH ───────────────────────── */
(async () => {
  const me = await bot.telegram.getMe();
  BOT_USERNAME = me.username;
  BOT_ID = me.id;
  await bot.telegram
    .setMyCommands(
      [
        { command: "start", description: "Botni ishga tushirish" },
        { command: "profile", description: "Mening profilim" },
        { command: "top", description: "Eng yaxshi o'yinchilar" },
        { command: "roles", description: "Rollar haqida" },
        { command: "help", description: "Qo'llanma" },
      ],
      { scope: { type: "all_private_chats" } },
    )
    .catch(() => {});
  await bot.telegram
    .setMyCommands(
      [
        { command: "game", description: "O'yinni boshlash" },
        { command: "begin", description: "Ro'yxatni yopib boshlash" },
        { command: "extend", description: "+30 soniya" },
        { command: "leave", description: "Ro'yxatdan chiqish" },
        { command: "players", description: "O'yinchilar ro'yxati" },
        { command: "stop", description: "O'yinni to'xtatish" },
        { command: "profile", description: "Profil" },
      ],
      { scope: { type: "all_group_chats" } },
    )
    .catch(() => {});

  bot.launch({ dropPendingUpdates: true }).catch((e) => {
    console.error("Launch xatosi:", e.message);
    process.exit(1);
  });
  console.log(`✅ Mafia bot ishga tushdi: @${BOT_USERNAME}`);
})().catch((e) => {
  console.error("Start xatosi:", e.message);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
