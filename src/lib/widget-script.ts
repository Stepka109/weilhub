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

const COL = {
  bg: "#ffffff", text: "#14213d", muted: "#667085", cell: "#eef4fb", cellBorder: "#cdd9e8",
  red: "#db2d2d", green: "#4f9a12", purple: "#7c4ddc", orange: "#ff8a00", nowBg: "#fff7ee",
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
  const head = (day.relative === "Dnes" || day.relative === "Zítra" ? day.relative + " · " : "") + day.label;
  text(ctx, head, p + 2, p - 2, size.width - 120, 20, Font.boldSystemFont(15), col("text"), "left");
  const info = "týden " + day.cycleWeek + (day.group ? " · " + day.group : "") + (data.offline ? " · offline" : "");
  text(ctx, info, size.width - 130, p, 116, 16, Font.systemFont(11), col("muted"), "right");
  let y = p + 26;

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
  if (more) text("+ " + more + " další", p, y + 4, size.width - 2 * p, 16, Font.systemFont(11), col("muted"), "center");
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
const family = config.widgetFamily || "large";
const w = new ListWidget();
w.url = OPEN;
w.setPadding(0, 0, 0, 0);

if (data.error || !data.day) {
  w.setPadding(12, 12, 12, 12);
  w.backgroundColor = col("bg");
  line(w, "WeilHub", Font.boldSystemFont(14)).textColor = col("text");
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
  w.setPadding(12, 12, 12, 12);
  w.backgroundColor = col("bg");
  lockRect(w, data);
} else {
  w.backgroundImage = drawList(data, family === "extraLarge" ? "large" : family);
  w.addSpacer();
}
if (data.day) w.refreshAfterDate = nextRefresh(data.day);

if (config.runsInWidget) Script.setWidget(w);
else await w.presentLarge();
Script.complete();
`;

export function widgetScript(baseUrl: string, token: string): string {
  return SCRIPT.replaceAll("__URL__", baseUrl.replace(/\/$/, "")).replace("__KEY__", token);
}
