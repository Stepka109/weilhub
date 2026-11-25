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
const KEY = "__KEY__";

// Barvy Weilovky (navy, tyrkysová, limetková); karty hodin mají barvy rozvrhu
const COL = {
  bg: "#ffffff", page: "#f4f7f8", text: "#162b4f", muted: "#5b6676", navy: "#1b3a6b",
  teal: "#0a7c83", tealSoft: "#dbf2f1", lime: "#8dc63f", cyan: "#1fc2ca", line: "#e0e8ec",
  cell: "#eef4fb", cellBorder: "#cdd9e8",
  red: "#db2d2d", green: "#4f9a12", purple: "#7c4ddc", orange: "#ff8a00", orangeSoft: "#ffe6cc", nowBg: "#fff7ee",
  S1: "#0b7d73", S1bg: "#e2f5f2", S2: "#4b3fd1", S2bg: "#ebe8ff"
};
const col = (k) => new Color(COL[k]);
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
  roundRect(ctx, new Rect(x, y, size, size), 12 * k, col("navy"), null, 0);
  const book = new Path();
  book.move(P(8, 11.5));
  book.addCurve(P(17.6, 14.1), P(11.6, 10.9), P(14.9, 11.9));
  book.addLine(P(20, 16));
  book.addLine(P(22.4, 14.1));
  book.addCurve(P(32, 11.5), P(25.1, 11.9), P(28.4, 10.9));
  ctx.addPath(book);
  ctx.setStrokeColor(col("lime"));
  ctx.setLineWidth(2.2 * k);
  ctx.strokePath();
  const w = new Path();
  w.addLines([P(9, 15.5), P(14, 29), P(20, 18.5), P(26, 29), P(31, 15.5)]);
  ctx.addPath(w);
  ctx.setStrokeColor(col("cyan"));
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

// Pilulka s textem zarovnaná doprava k bodu „right“; vrací její levý okraj
function pill(ctx, str, right, y, fg, bg) {
  const w = str.length * 6.2 + 14;
  roundRect(ctx, new Rect(right - w, y, w, 18), 9, bg, null, 0);
  text(ctx, str, right - w, y + 2, w, 14, Font.boldSystemFont(10.5), fg, "center");
  return right - w;
}

function text(ctx, str, x, y, w, h, font, color, align) {
  if (!str || w <= 4) return;
  ctx.setFont(font);
  ctx.setTextColor(color);
  if (align === "center") ctx.setTextAlignedCenter();
  else if (align === "right") ctx.setTextAlignedRight();
  else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(str, new Rect(x, y, w, h));
}

function drawRow(ctx, l, x, y, w, h, isNow) {
  drawRowBody(ctx, l, x, y, w, h, isNow);
  // Probíhající hodina: tenký oranžový pruh, kolik už uplynulo
  if (isNow) {
    const cx = x + 38, cw = w - 38;
    const done = Math.max(0, Math.min(1, (nowMin - mins(l.start)) / Math.max(1, mins(l.end) - mins(l.start))));
    roundRect(ctx, new Rect(cx + 10, y + h - 5, cw - 20, 2.5), 1.25, col("orangeSoft"), null, 0);
    if (done > 0) roundRect(ctx, new Rect(cx + 10, y + h - 5, Math.max(2.5, (cw - 20) * done), 2.5), 1.25, col("orange"), null, 0);
  }
}

function drawRowBody(ctx, l, x, y, w, h, isNow) {
  const mid = y + h / 2;
  const numColor = isNow ? col("orange") : col("text");
  text(ctx, num(l), x, mid - 15, 34, 16, Font.boldSystemFont(13), numColor, "center");
  text(ctx, l.start, x, mid + 1, 34, 13, Font.systemFont(10), isNow ? col("orange") : col("muted"), "center");

  const cx = x + 38, cw = w - 38;
  const card = new Rect(cx, y, cw, h);
  let fill = col("cell"), border = col("cellBorder"), lw = 1, dashed = false, tag = null;
  if (l.status === "changed") { fill = col("bg"); border = col("red"); lw = 2; tag = border; }
  if (l.status === "roomchanged") { fill = col("bg"); border = col("red"); lw = 2; dashed = true; tag = border; }
  if (l.status === "cancelled") { fill = col("bg"); border = col(l.accent === "green" ? "green" : "red"); lw = 2; dashed = true; tag = border; }
  if (l.status === "event") { fill = col("bg"); border = col("green"); lw = 2; dashed = true; tag = border; }
  if (l.status === "new") { fill = col("bg"); border = col("green"); lw = 2; tag = border; }
  if (isNow && l.status === "default") { fill = col("nowBg"); border = col("orange"); lw = 2; }

  roundRect(ctx, card, 9, fill, dashed ? null : border, lw);
  if (dashed) dashedRect(ctx, card, 9, border, lw);
  // Probíhající hodina se změnou: oranžový rámeček uvnitř
  if (isNow && l.status !== "default") roundRect(ctx, new Rect(cx + 3, y + 3, cw - 6, h - 6), 7, null, col("orange"), 2);
  if (tag) {
    roundRect(ctx, new Rect(cx - 1, mid - 8, 14, 16), 4, tag, null, 0);
    text(ctx, TAG[l.status], cx - 1, mid - 7, 14, 14, Font.boldSystemFont(10), Color.white(), "center");
  }

  const groupW = l.group !== "all" ? 24 : 0;
  if (groupW) {
    roundRect(ctx, new Rect(cx + cw - groupW - 2, mid - 6, groupW - 4, 12), 3, col(l.group + "bg"), null, 0);
    text(ctx, l.group, cx + cw - groupW - 2, mid - 6, groupW - 4, 12, Font.boldSystemFont(8), col(l.group), "center");
  }
  const tx = cx + (tag ? 18 : 10);
  const right = cx + cw - groupW - 8;
  if (l.status === "cancelled") {
    text(ctx, title(l), cx + 16, mid - 9, cw - 32 - groupW, 18, Font.boldSystemFont(13), border, "center");
    return;
  }
  const roomW = 46;
  text(ctx, title(l), tx, mid - 9, 50, 18, Font.boldSystemFont(14), col("text"), "left");
  text(ctx, sub(l), tx + 50, mid - 7, right - roomW - (tx + 50) - 4, 15, Font.systemFont(11), col("muted"), "left");
  text(ctx, l.room || "", right - roomW, mid - 8, roomW, 16, Font.boldSystemFont(12), l.status === "roomchanged" ? col("red") : col("text"), "right");
}

function drawList(data, family) {
  const day = data.day;
  const st = stateOf(day);
  const size = widgetSize(family);
  const ctx = new DrawContext();
  ctx.size = size;
  ctx.opaque = true;
  ctx.respectScreenScale = true;
  ctx.setFillColor(col("bg"));
  ctx.fillRect(new Rect(0, 0, size.width, size.height));

  const p = 12;
  // Hlavička: logo, den a vpravo pilulky (skupina, týden, offline)
  drawLogo(ctx, p, p - 1, 22);
  let right = size.width - p;
  if (data.offline) right = pill(ctx, "offline", right, p, col("muted"), col("page")) - 4;
  if (day.group) right = pill(ctx, day.group, right, p, col(day.group), col(day.group + "bg")) - 4;
  right = pill(ctx, "týden " + day.cycleWeek, right, p, col("teal"), col("tealSoft")) - 6;
  const rel = day.relative === "Dnes" || day.relative === "Zítra" ? day.relative : "";
  const tx = p + 30;
  if (rel) {
    text(ctx, rel.toUpperCase(), tx, p - 2, right - tx, 13, Font.boldSystemFont(9.5), col("teal"), "left");
    text(ctx, day.label, tx, p + 9, right - tx, 17, Font.boldSystemFont(14), col("navy"), "left");
  } else {
    text(ctx, day.label, tx, p + 2, right - tx, 18, Font.boldSystemFont(15), col("navy"), "left");
  }
  // Proužek v barvách Weilovky pod hlavičkou
  const sy = p + 28, third = (size.width - 2 * p) / 3;
  ctx.setFillColor(col("lime"));
  ctx.fillRect(new Rect(p, sy, third, 2));
  ctx.setFillColor(col("teal"));
  ctx.fillRect(new Rect(p + third, sy, third, 2));
  ctx.setFillColor(col("cyan"));
  ctx.fillRect(new Rect(p + 2 * third, sy, third, 2));
  let y = sy + 8;

  if (day.dayOverride) {
    const isEvent = day.dayOverride.kind === "event";
    const rect = new Rect(p, y, size.width - 2 * p, size.height - y - p);
    roundRect(ctx, rect, 12, col("bg"), isEvent ? null : col("purple"), 2);
    if (isEvent) dashedRect(ctx, rect, 12, col("green"), 2);
    text(ctx, isEvent ? "Celodenní akce" : "Volno", p, y + rect.height / 2 - 26, rect.width, 16, Font.systemFont(12), col("muted"), "center");
    text(ctx, day.dayOverride.title, p + 10, y + rect.height / 2 - 8, rect.width - 20, 22, Font.boldSystemFont(16), col("text"), "center");
    return ctx.getImage();
  }

  const rowH = family === "medium" ? 30 : 34, gap = 4;
  const fit = Math.max(1, Math.floor((size.height - y - p + gap) / (rowH + gap)));
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
  for (const l of list) {
    const isNow = st.current.indexOf(l) >= 0;
    drawRow(ctx, l, p, y, size.width - 2 * p, rowH, isNow);
    y += rowH + gap;
  }
  if (more) text(ctx, "+ " + more + " další", p, y + 4, size.width - 2 * p, 16, Font.systemFont(11), col("muted"), "center");
  return ctx.getImage();
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
    const bar = new DrawContext();
    bar.size = new Size(130, 5);
    bar.opaque = false;
    bar.respectScreenScale = true;
    roundRect(bar, new Rect(0, 0, 130, 5), 2.5, col("orangeSoft"), null, 0);
    roundRect(bar, new Rect(0, 0, Math.max(5, 130 * done), 5), 2.5, col("orange"), null, 0);
    const img = w.addImage(bar.getImage());
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
if (!family) {
  // Náhled v aplikaci: zeptat se, jakou velikost ukázat
  const a = new Alert();
  a.title = "Náhled widgetu";
  a.addAction("Velký");
  a.addAction("Střední");
  a.addAction("Malý");
  family = ["large", "medium", "small"][Math.max(0, await a.presentSheet())];
}
const w = new ListWidget();
w.url = OPEN;
w.setPadding(0, 0, 0, 0);

if (data.error || !data.day) {
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
  w.backgroundImage = drawList(data, family === "extraLarge" ? "large" : family);
  w.addSpacer();
}
if (data.day) w.refreshAfterDate = nextRefresh(data.day);

if (config.runsInWidget) Script.setWidget(w);
else if (family === "small") await w.presentSmall();
else if (family === "medium") await w.presentMedium();
else await w.presentLarge();
Script.complete();
`;

export function widgetScript(baseUrl: string, token: string): string {
  return SCRIPT.replaceAll("__URL__", baseUrl.replace(/\/$/, "")).replace("__KEY__", token);
}
