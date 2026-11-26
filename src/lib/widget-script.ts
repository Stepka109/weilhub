/**
 * Skript pro aplikaci Scriptable (iPhone) – widget rozvrhu na plochu
 * a na zamčenou obrazovku. Student si ho zkopíruje v Nastavení; adresa
 * a osobní klíč se do skriptu doplní při vytvoření.
 */
const SCRIPT = String.raw`// WeilHub – rozvrh na plochu a zamčenou obrazovku (aplikace Scriptable)
// Vytvořeno ve WeilHubu (Nastavení → Widget pro iPhone). Skript obsahuje
// tvůj osobní klíč – nikomu ho neposílej.
const API = "__URL__/api/widget";
const OPEN = "__URL__/rozvrh";
const CANTEEN_OPEN = "__URL__/jidelna";
const KEY = "__KEY__";

// Barvy Weilovky (navy, tyrkysová, limetková); karty hodin mají barvy rozvrhu
const COL = {
  bg: "#ffffff", page: "#f4f7f8", text: "#162b4f", muted: "#5b6676", navy: "#1b3a6b",
  teal: "#0a7c83", tealSoft: "#dbf2f1", lime: "#8dc63f", cyan: "#1fc2ca", line: "#e0e8ec",
  cell: "#eef4fb", cellBorder: "#cdd9e8",
  red: "#db2d2d", green: "#4f9a12", purple: "#7c4ddc", orange: "#ff8a00", orangeSoft: "#ffe6cc", nowBg: "#fff7ee",
  S1: "#0b7d73", S1bg: "#e2f5f2", S2: "#4b3fd1", S2bg: "#ebe8ff"
};
// Tmavý vzhled telefonu: stejné barvy ve tmavé variantě (iOS přepíná sám)
const DARK = {
  bg: "#1c1c1e", page: "#2c2c2e", text: "#f2f5f7", muted: "#9aa6b2", navy: "#eef4f7",
  teal: "#3cc7c0", tealSoft: "#143d3e", line: "#3a3a3c",
  cell: "#2c2c2e", cellBorder: "#3d3d40",
  red: "#ff5c5c", green: "#7fd13f", purple: "#b99dff", orange: "#ff9f2e", orangeSoft: "#4a3216", nowBg: "#3b2a14",
  S1: "#62d6c8", S1bg: "#153f3b", S2: "#b4aaff", S2bg: "#2d2853"
};
const col = (k) => Color.dynamic(new Color(COL[k]), new Color(DARK[k] || COL[k]));
// Pevná barva pro obrázky (logo, čárkované rámečky) – v obou režimech stejná
const fixed = (k) => new Color(COL[k]);
const TAG = { changed: "S", roomchanged: "M", event: "A", cancelled: "O", new: "N" };

// ---------------------------------------------------------------- data
async function load() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.documentsDirectory(), "weilhub-widget.json");
  try {
    const req = new Request(API);
    req.headers = { Authorization: "Bearer " + KEY };
    req.timeoutInterval = 20;
    const res = await req.loadJSON();
    if (!res || !res.ok) return { error: (res && res.error) || "Rozvrh se nepodařilo načíst." };
    fm.writeString(cache, JSON.stringify(res));
    return res;
  } catch (e) {
    if (fm.fileExists(cache)) {
      const res = JSON.parse(fm.readString(cache));
      res.offline = true;
      return res;
    }
    return { error: "Bez připojení k internetu." };
  }
}

const pad2 = (n) => (n < 10 ? "0" : "") + n;
const now = new Date();
const nowMin = now.getHours() * 60 + now.getMinutes();
const todayIso = now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
const mins = (t) => {
  const p = t.split(":");
  return Number(p[0]) * 60 + Number(p[1]);
};

function stateOf(day) {
  const isToday = !!day && day.date === todayIso;
  const lessons = (day && day.lessons) || [];
  const current = isToday ? lessons.filter((l) => nowMin >= mins(l.start) && nowMin < mins(l.end)) : [];
  const upcoming = isToday ? lessons.filter((l) => mins(l.start) > nowMin) : lessons;
  return { isToday, lessons, current, upcoming };
}

const num = (l) => (l.lessonTo > l.lesson ? l.lesson + ".–" + l.lessonTo + "." : l.lesson + ".");
function title(l) {
  if (l.status === "cancelled") return (l.code ? l.code + " " : "") + "odpadá";
  if (l.status === "event") return l.code || "AKT";
  return l.code;
}
function sub(l) {
  if (l.status === "event") return l.name || l.detail || "";
  return l.detail || l.teacher || "";
}

// ------------------------------------------------------------ kreslení
function widgetSize(family) {
  const w = Device.screenSize().width;
  const t = w >= 428 ? [170, 364, 382] : w >= 414 ? [169, 360, 379] : w >= 390 ? [158, 338, 354] : w >= 375 ? [155, 329, 345] : [141, 292, 311];
  if (family === "small") return new Size(t[0], t[0]);
  if (family === "medium") return new Size(t[1], t[0]);
  return new Size(t[1], t[2]);
}

function roundRect(ctx, rect, r, fill, stroke, lw) {
  const p = new Path();
  p.addRoundedRect(rect, r, r);
  if (fill) {
    ctx.addPath(p);
    ctx.setFillColor(fill);
    ctx.fillPath();
  }
  if (stroke) {
    ctx.addPath(p);
    ctx.setStrokeColor(stroke);
    ctx.setLineWidth(lw);
    ctx.strokePath();
  }
}

// Šrafované (čárkované) ohraničení jako u odpadlé hodiny, akce a změny místnosti
function dashedRect(ctx, rect, r, color, lw) {
  ctx.setFillColor(color);
  const dash = 4, gap = 3;
  const x0 = rect.x, y0 = rect.y, x1 = rect.x + rect.width, y1 = rect.y + rect.height;
  for (let x = x0 + r; x < x1 - r; x += dash + gap) {
    const w = Math.min(dash, x1 - r - x);
    ctx.fillRect(new Rect(x, y0, w, lw));
    ctx.fillRect(new Rect(x, y1 - lw, w, lw));
  }
  for (let y = y0 + r; y < y1 - r; y += dash + gap) {
    const h = Math.min(dash, y1 - r - y);
    ctx.fillRect(new Rect(x0, y, lw, h));
    ctx.fillRect(new Rect(x1 - lw, y, lw, h));
  }
}

// Logo WeilHub: „W“ z listů otevřené knihy (stejné jako na webu, mřížka 40 × 40)
function drawLogo(ctx, x, y, size) {
  const k = size / 40;
  const P = (px, py) => new Point(x + px * k, y + py * k);
  roundRect(ctx, new Rect(x, y, size, size), 12 * k, fixed("navy"), null, 0);
  const book = new Path();
  book.move(P(8, 11.5));
  book.addCurve(P(17.6, 14.1), P(11.6, 10.9), P(14.9, 11.9));
  book.addLine(P(20, 16));
  book.addLine(P(22.4, 14.1));
  book.addCurve(P(32, 11.5), P(25.1, 11.9), P(28.4, 10.9));
  ctx.addPath(book);
  ctx.setStrokeColor(fixed("lime"));
  ctx.setLineWidth(2.2 * k);
  ctx.strokePath();
  const w = new Path();
  w.addLines([P(9, 15.5), P(14, 29), P(20, 18.5), P(26, 29), P(31, 15.5)]);
  ctx.addPath(w);
  ctx.setStrokeColor(fixed("cyan"));
  ctx.setLineWidth(3.4 * k);
  ctx.strokePath();
}

function logoImage(size) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  drawLogo(ctx, 0, 0, size);
  return ctx.getImage();
}

// Obrázek s čárkovaným rámečkem (průhledný uvnitř), pro změny a akce
function dashedImage(w, h, r, color) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  dashedRect(ctx, new Rect(0, 0, w, h), r, color, 2);
  return ctx.getImage();
}

function barImage(w, h, done) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  roundRect(ctx, new Rect(0, 0, w, h), h / 2, new Color("#ff8a00", 0.22), null, 0);
  if (done > 0) roundRect(ctx, new Rect(0, 0, Math.max(h, w * done), h), h / 2, fixed("orange"), null, 0);
  return ctx.getImage();
}

function stripeImage(w) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, 2);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const third = w / 3;
  ["lime", "teal", "cyan"].forEach((k, i) => {
    ctx.setFillColor(fixed(k));
    ctx.fillRect(new Rect(i * third, 0, third, 2));
  });
  return ctx.getImage();
}

function addT(stack, str, font, color, lines) {
  const t = stack.addText(str || " ");
  t.font = font;
  t.textColor = color;
  t.lineLimit = lines || 1;
  t.minimumScaleFactor = 0.75;
  return t;
}

function pill(stack, str, fg, bg) {
  const s = stack.addStack();
  s.backgroundColor = bg;
  s.cornerRadius = 9;
  s.setPadding(2, 7, 2, 7);
  addT(s, str, Font.boldSystemFont(10.5), fg);
  return s;
}

function badge(stack, str, fg, bg) {
  const s = stack.addStack();
  s.backgroundColor = bg;
  s.cornerRadius = 3;
  s.setPadding(1, 4, 1, 4);
  addT(s, str, Font.boldSystemFont(8), fg);
}

function addRow(parent, l, W, h, isNow) {
  const r = parent.addStack();
  r.size = new Size(W, h);
  r.centerAlignContent();

  const nc = r.addStack();
  nc.size = new Size(34, h);
  nc.layoutVertically();
  nc.centerAlignContent();
  nc.addSpacer();
  addT(nc, num(l), Font.boldSystemFont(13), isNow ? col("orange") : col("text")).centerAlignText();
  addT(nc, l.start, Font.systemFont(10), isNow ? col("orange") : col("muted")).centerAlignText();
  nc.addSpacer();
  r.addSpacer(4);

  const cw = W - 38;
  const card = r.addStack();
  card.size = new Size(cw, h);
  card.cornerRadius = 9;
  card.layoutVertically();

  let border = null, dashed = false, tag = false;
  if (l.status === "changed") { border = "red"; tag = true; }
  if (l.status === "roomchanged") { border = "red"; dashed = true; tag = true; }
  if (l.status === "cancelled") { border = l.accent === "green" ? "green" : "red"; dashed = true; tag = true; }
  if (l.status === "event") { border = "green"; dashed = true; tag = true; }
  if (l.status === "new") { border = "green"; tag = true; }
  if (!border) {
    card.backgroundColor = col(isNow ? "nowBg" : "cell");
    card.borderColor = col(isNow ? "orange" : "cellBorder");
    card.borderWidth = isNow ? 2 : 1;
  } else if (dashed) {
    card.backgroundImage = dashedImage(cw, h, 9, fixed(border));
  } else {
    card.borderColor = col(border);
    card.borderWidth = 2;
  }

  const c = card.addStack();
  c.size = new Size(cw, isNow ? h - 5 : h);
  c.centerAlignContent();
  c.setPadding(0, tag ? 4 : 10, 0, 7);
  if (tag) {
    const t = c.addStack();
    t.size = new Size(14, 16);
    t.cornerRadius = 4;
    t.backgroundColor = col(border);
    t.centerAlignContent();
    addT(t, TAG[l.status], Font.boldSystemFont(10), Color.white());
    c.addSpacer(5);
  }
  if (l.status === "cancelled") {
    c.addSpacer();
    addT(c, title(l), Font.boldSystemFont(13), col(border));
    c.addSpacer();
  } else {
    const ts = c.addStack();
    ts.size = new Size(46, 0);
    addT(ts, title(l), Font.boldSystemFont(14), col("text"));
    ts.addSpacer();
    addT(c, sub(l), Font.systemFont(11), col("muted"));
    c.addSpacer(4);
    c.addSpacer();
    addT(c, l.room || "", Font.boldSystemFont(12), l.status === "roomchanged" ? col("red") : col("text"));
  }
  if (l.group !== "all") {
    c.addSpacer(5);
    badge(c, l.group, col(l.group), col(l.group + "bg"));
  }
  // Probíhající hodina: tenký oranžový pruh, kolik už uplynulo
  if (isNow) {
    const done = Math.max(0, Math.min(1, (nowMin - mins(l.start)) / Math.max(1, mins(l.end) - mins(l.start))));
    const b = card.addStack();
    b.setPadding(0, 10, 0, 10);
    b.addImage(barImage(cw - 20, 2.5, done)).imageSize = new Size(cw - 20, 2.5);
  }
}

// Velký a střední widget: hlavička s logem a hodiny dne. Skládá se ze
// „stacků“, takže se barvy samy přepínají se světlým a tmavým vzhledem.
function listWidget(w, data, family) {
  const day = data.day;
  const st = stateOf(day);
  const size = widgetSize(family);
  const p = 12, W = size.width - 2 * p;
  w.setPadding(p - 1, p, p, p);
  w.backgroundColor = col("bg");

  const head = w.addStack();
  head.size = new Size(W, 24);
  head.centerAlignContent();
  head.addImage(logoImage(22)).imageSize = new Size(22, 22);
  head.addSpacer(8);
  const titles = head.addStack();
  titles.layoutVertically();
  const rel = day.relative === "Dnes" || day.relative === "Zítra" ? day.relative : "";
  if (rel) addT(titles, rel.toUpperCase(), Font.boldSystemFont(9.5), col("teal"));
  addT(titles, day.label, Font.boldSystemFont(rel ? 14 : 15), col("navy"));
  head.addSpacer();
  pill(head, "týden " + day.cycleWeek, col("teal"), col("tealSoft"));
  if (day.group) {
    head.addSpacer(4);
    pill(head, day.group, col(day.group), col(day.group + "bg"));
  }
  if (data.offline) {
    head.addSpacer(4);
    pill(head, "offline", col("muted"), col("page"));
  }
  w.addSpacer(5);
  w.addImage(stripeImage(W)).imageSize = new Size(W, 2);
  w.addSpacer(6);
  const avail = size.height - (p - 1) - p - 24 - 5 - 2 - 6;

  if (day.dayOverride) {
    const isEvent = day.dayOverride.kind === "event";
    const box = w.addStack();
    box.size = new Size(W, avail);
    box.cornerRadius = 12;
    box.layoutVertically();
    box.centerAlignContent();
    if (isEvent) box.backgroundImage = dashedImage(W, avail, 12, fixed("green"));
    else {
      box.borderColor = col("purple");
      box.borderWidth = 2;
    }
    box.addSpacer();
    addT(box, isEvent ? "Celodenní akce" : "Volno", Font.systemFont(12), col("muted")).centerAlignText();
    addT(box, day.dayOverride.title, Font.boldSystemFont(16), col("text"), 2).centerAlignText();
    box.addSpacer();
    return;
  }

  const rowH = family === "medium" ? 31 : 34, gap = 4;
  const fit = Math.max(1, Math.floor((avail + gap) / (rowH + gap)));
  let list = st.lessons;
  // Když se všechno nevejde (a vždy u středního widgetu), začít probíhající / další hodinou
  if (st.isToday && (family === "medium" || list.length > fit)) {
    const idx = list.findIndex((l) => mins(l.end) > nowMin);
    if (idx > 0) list = list.slice(idx);
  }
  let more = 0;
  if (list.length > fit) {
    more = list.length - (fit - 1);
    list = list.slice(0, fit - 1);
  }
  list.forEach((l, i) => {
    if (i) w.addSpacer(gap);
    addRow(w, l, W, rowH, st.current.indexOf(l) >= 0);
  });
  if (more) {
    w.addSpacer(4);
    const m = w.addStack();
    m.size = new Size(W, 16);
    m.centerAlignContent();
    addT(m, "+ " + more + " další", Font.systemFont(11), col("muted"));
  }
  w.addSpacer();
}

// ------------------------------------------------- zamčená obrazovka
function line(w, str, font, opacity) {
  const t = w.addText(str);
  t.font = font;
  t.textOpacity = opacity || 1;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  // Na zamčené obrazovce barvy určuje iOS, na ploše tmavý text na bílé
  if (family.indexOf("accessory") !== 0) t.textColor = col("text");
  return t;
}

function pickLessons(day, st) {
  const pick = st.current[0] || st.upcoming[0];
  const rest = st.current.length ? st.upcoming : st.upcoming.slice(1);
  return { pick, next: rest.find((l) => !pick || l.lesson !== pick.lesson) };
}

function lockRect(w, data) {
  const day = data.day;
  const st = stateOf(day);
  if (day.dayOverride) {
    line(w, day.relative + " · " + (day.dayOverride.kind === "event" ? "akce" : "volno"), Font.systemFont(11), 0.8);
    line(w, day.dayOverride.title, Font.boldSystemFont(15));
    return;
  }
  const { pick, next } = pickLessons(day, st);
  if (!pick) return line(w, "Dnes už žádná hodina", Font.systemFont(13));
  const when = st.current.length ? "Teď · " + num(pick) + " do " + pick.end : (st.isToday ? "Další · " : day.relative + " · ") + num(pick) + " v " + pick.start;
  line(w, when, Font.systemFont(11), 0.8);
  line(w, title(pick) + (pick.room ? " · " + pick.room : ""), Font.boldSystemFont(15));
  if (next) line(w, "Pak: " + num(next) + " " + title(next) + (next.room ? " " + next.room : ""), Font.systemFont(12), 0.9);
}

function lockInline(w, data) {
  const day = data.day;
  const st = stateOf(day);
  if (day.dayOverride) return line(w, day.relative + ": " + day.dayOverride.title, Font.systemFont(12));
  const { pick } = pickLessons(day, st);
  if (!pick) return line(w, "Dnes už žádná hodina", Font.systemFont(12));
  const tail = st.current.length ? " · do " + pick.end : " · " + pick.start;
  line(w, num(pick) + " " + title(pick) + (pick.room ? " " + pick.room : "") + tail, Font.systemFont(12));
}

function lockCircular(w, data) {
  const day = data.day;
  const st = stateOf(day);
  const { pick } = pickLessons(day, st);
  w.addAccessoryWidgetBackground = true;
  const a = line(w, pick ? num(pick) : "–", Font.boldSystemFont(16));
  a.centerAlignText();
  const b = line(w, pick ? (pick.status === "cancelled" ? "odp." : pick.code) : "", Font.systemFont(11));
  b.centerAlignText();
}

// ------------------------------------------------------- malý widget
// Probíhající nebo další hodina velkým písmem, učebna a odpočet, který
// iOS počítá sám (aktuální i mezi obnovami widgetu).
function smallWidget(w, data) {
  const day = data.day;
  const st = stateOf(day);
  w.setPadding(14, 14, 12, 14);
  w.backgroundColor = col("bg");

  const head = w.addStack();
  head.centerAlignContent();
  const logo = head.addImage(logoImage(20));
  logo.imageSize = new Size(20, 20);
  head.addSpacer(7);

  const label = (str, color) => {
    const t = head.addText(str.toUpperCase());
    t.font = Font.boldSystemFont(10.5);
    t.textColor = color || col("teal");
    t.lineLimit = 1;
    t.minimumScaleFactor = 0.7;
  };
  const add = (str, font, color, lines) => {
    const t = w.addText(str);
    t.font = font;
    t.textColor = color;
    t.lineLimit = lines || 1;
    t.minimumScaleFactor = 0.6;
    return t;
  };

  if (day.dayOverride) {
    const isEvent = day.dayOverride.kind === "event";
    label(day.relative + " · " + (isEvent ? "akce" : "volno"), isEvent ? col("green") : col("purple"));
    w.addSpacer();
    add(day.dayOverride.title, Font.boldSystemFont(18), col("navy"), 3);
    if (day.dayOverride.room) add(day.dayOverride.room, Font.semiboldSystemFont(13), col("teal"));
    return;
  }

  const { pick, next } = pickLessons(day, st);
  if (!pick) {
    label("Dnes");
    w.addSpacer();
    add("Dnes už žádná hodina", Font.boldSystemFont(16), col("navy"), 2);
    return;
  }
  const isNow = st.current.length > 0;
  label((isNow ? "Teď · " : st.isToday ? "Další · " : day.relative + " · ") + num(pick) + " hodina", isNow ? col("orange") : col("teal"));
  w.addSpacer(8);

  const cancelled = pick.status === "cancelled";
  add(cancelled ? pick.code || "Hodina" : title(pick), Font.heavySystemFont(30), cancelled ? col("red") : col("navy"));
  if (cancelled) add("odpadá", Font.boldSystemFont(14), col("red"));
  else {
    add(pick.room || " ", Font.boldSystemFont(15), pick.status === "roomchanged" ? col("red") : col("teal"));
    const s = sub(pick);
    if (s) add(s, Font.systemFont(12), col("muted"));
  }
  w.addSpacer();

  // Odpočet: do konce probíhající hodiny, nebo do začátku další
  const base = new Date(now.getTime());
  base.setHours(0, 0, 0, 0);
  const at = (t) => new Date(base.getTime() + mins(t) * 60000);
  if (isNow) {
    const done = Math.max(0, Math.min(1, (nowMin - mins(pick.start)) / Math.max(1, mins(pick.end) - mins(pick.start))));
    const img = w.addImage(barImage(130, 5, done));
    img.imageSize = new Size(130, 5);
    w.addSpacer(5);
  }
  const row = w.addStack();
  row.centerAlignContent();
  if (st.isToday) {
    const pre = row.addText(isNow ? "konec za " : "začíná za ");
    pre.font = Font.systemFont(12);
    pre.textColor = col("muted");
    const d = row.addDate(at(isNow ? pick.end : pick.start));
    d.applyTimerStyle();
    d.font = Font.boldSystemFont(12);
    d.textColor = isNow ? col("orange") : col("teal");
    d.lineLimit = 1;
  } else {
    const t = row.addText("začíná v " + pick.start);
    t.font = Font.systemFont(12);
    t.textColor = col("muted");
  }
  if (isNow && next) {
    w.addSpacer(2);
    add("Pak " + num(next) + " " + title(next) + (next.room ? " " + next.room : ""), Font.systemFont(11), col("muted"));
  }
}

// ------------------------------------------------------- jídelna
const DAYS = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];
function canteenLabel(iso) {
  if (iso === todayIso) return "Dnes";
  const t = new Date(now.getTime() + 86400000);
  if (iso === t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate())) return "Zítra";
  const p = iso.split("-").map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  return DAYS[d.getDay()] + " " + p[2] + ". " + p[1] + ".";
}

// Oběd ve školní jídelně: polévka a jídla na výběr (velký widget 2 dny)
function canteenWidget(w, data, family) {
  const days = (data.canteen || []).slice(0, family === "large" || family === "extraLarge" ? 2 : 1);
  const small = family === "small";
  w.setPadding(small ? 13 : 14, 14, 12, 14);
  w.backgroundColor = col("bg");

  const head = w.addStack();
  head.centerAlignContent();
  head.addImage(logoImage(20)).imageSize = new Size(20, 20);
  head.addSpacer(7);
  const title = head.addText(days.length ? "OBĚD · " + canteenLabel(days[0].date).toUpperCase() : "JÍDELNA");
  title.font = Font.boldSystemFont(10.5);
  title.textColor = col("orange");
  title.lineLimit = 1;
  w.addSpacer(small ? 6 : 8);

  if (!days.length) {
    addT(w, "Jídelníček zatím není zveřejněný.", Font.systemFont(13), col("muted"), 3);
    w.addSpacer();
    return;
  }

  days.forEach((day, di) => {
    if (di > 0) {
      w.addSpacer(10);
      const h = addT(w, canteenLabel(day.date).toUpperCase(), Font.boldSystemFont(10.5), col("orange"));
      h.lineLimit = 1;
      w.addSpacer(4);
    }
    day.dishes.forEach((d, i) => {
      if (i) w.addSpacer(small ? 4 : 6);
      const soup = d.kind === "soup";
      if (small) {
        // Malý widget: jen názvy, polévka šedě
        addT(w, d.name, soup ? Font.systemFont(11) : Font.semiboldSystemFont(12), soup ? col("muted") : col("text"), soup ? 1 : 2);
        return;
      }
      const row = w.addStack();
      row.topAlignContent();
      const lab = row.addStack();
      lab.size = new Size(58, 0);
      addT(lab, soup ? "Polévka" : d.label, Font.boldSystemFont(10.5), soup ? col("orange") : col("teal"));
      lab.addSpacer();
      row.addSpacer(6);
      addT(row, d.name, Font.semiboldSystemFont(13), col("text"), soup ? 1 : 2);
    });
  });
  w.addSpacer();
}

// ---------------------------------------------------------------- widget
function nextRefresh(day) {
  const st = stateOf(day);
  const marks = [];
  for (const l of st.lessons) {
    if (!st.isToday) break;
    if (mins(l.start) > nowMin) marks.push(mins(l.start));
    if (mins(l.end) > nowMin) marks.push(mins(l.end));
  }
  const next = marks.length ? Math.min.apply(null, marks) : nowMin + 60;
  const d = new Date(now.getTime());
  d.setHours(0, 0, 0, 0);
  return new Date(Math.max(d.getTime() + next * 60000 + 30000, now.getTime() + 5 * 60000));
}

const data = await load();
let family = config.widgetFamily;
// Widget jídelny: v nastavení widgetu (Parameter) napiš „jidelna“
let canteenMode = /j[ií]d/i.test(String(args.widgetParameter || ""));
if (!family) {
  // Náhled v aplikaci: zeptat se, jakou velikost ukázat
  const a = new Alert();
  a.title = "Náhled widgetu";
  ["Rozvrh – velký", "Rozvrh – střední", "Rozvrh – malý", "Jídelna – střední", "Jídelna – malý"].forEach((t) => a.addAction(t));
  const pick = Math.max(0, await a.presentSheet());
  family = ["large", "medium", "small", "medium", "small"][pick];
  canteenMode = pick >= 3;
}
const w = new ListWidget();
w.url = canteenMode ? CANTEEN_OPEN : OPEN;

if (canteenMode && !data.error && family.indexOf("accessory") !== 0) {
  canteenWidget(w, data, family);
} else if (data.error || !data.day) {
  w.setPadding(12, 12, 12, 12);
  w.backgroundColor = col("bg");
  const top = w.addStack();
  top.centerAlignContent();
  top.addImage(logoImage(20)).imageSize = new Size(20, 20);
  top.addSpacer(6);
  const name = top.addText("WeilHub");
  name.font = Font.boldSystemFont(14);
  name.textColor = col("navy");
  w.addSpacer(6);
  const msg = line(w, data.error || "V nejbližších dnech není výuka.", Font.systemFont(12));
  msg.textColor = col("muted");
  msg.lineLimit = 4;
  w.refreshAfterDate = new Date(now.getTime() + 60 * 60000);
} else if (family === "accessoryRectangular") {
  lockRect(w, data);
} else if (family === "accessoryInline") {
  lockInline(w, data);
} else if (family === "accessoryCircular") {
  lockCircular(w, data);
} else if (family === "small") {
  smallWidget(w, data);
} else {
  listWidget(w, data, family === "extraLarge" ? "large" : family);
}
if (canteenMode) w.refreshAfterDate = new Date(now.getTime() + 60 * 60000);
else if (data.day) w.refreshAfterDate = nextRefresh(data.day);

if (config.runsInWidget) Script.setWidget(w);
else if (family === "small") await w.presentSmall();
else if (family === "medium") await w.presentMedium();
else await w.presentLarge();
Script.complete();
`;

export function widgetScript(baseUrl: string, token: string): string {
  return SCRIPT.replaceAll("__URL__", baseUrl.replace(/\/$/, "")).replace("__KEY__", token);
}
