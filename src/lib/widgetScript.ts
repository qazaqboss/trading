/**
 * Builds a self-contained Scriptable (https://scriptable.app) widget script for iOS.
 * Supports Home Screen widgets (small / medium / large / extra large) and Lock Screen widgets
 * (inline / circular / rectangular). The widget parameter (long-press → Edit Widget → Parameter)
 * overrides the tickers, e.g. "NVDA, TSLA, BTC-USD".
 */
export function buildWidgetScript(opts: { base: string; symbols: string[]; refreshMin?: number }): string {
  const base = opts.base.replace(/\/+$/, "");
  const symbols = JSON.stringify(opts.symbols.map((s) => s.toUpperCase()));
  const refresh = Math.max(5, Math.round(opts.refreshMin ?? 5));
  return `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: chart-line;

// ─────────────────────────────────────────────────────────
//  NEON//PULSE — виджет котировок для iPhone (Scriptable)
//  Сайт: ${base}
//  Тикеры можно поменять в параметре виджета: «NVDA, TSLA, BTC-USD»
// ─────────────────────────────────────────────────────────
const BASE = "${base}";
const DEFAULT_SYMBOLS = ${symbols};
const REFRESH_MIN = ${refresh};

const C = {
  bg1: "#05010d", bg2: "#1a0833", cyan: "#05d9e8", pink: "#ff2a6d",
  green: "#00ff9f", yellow: "#f9f002", text: "#e8fbff", muted: "#7fd8e6", faint: "#8a5fa8",
};
const col = (h, a) => new Color(h, a === undefined ? 1 : a);

const param = (typeof args !== "undefined" && args.widgetParameter ? String(args.widgetParameter) : "").trim();
const SYMBOLS = (param ? param.split(/[,;\\s]+/) : DEFAULT_SYMBOLS).filter(Boolean).map((s) => s.toUpperCase()).slice(0, 12);
const FAMILY = config.widgetFamily || "large";

// ── data ────────────────────────────────────────────────
async function load() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.cacheDirectory(), "neonpulse-" + SYMBOLS.join("_").replace(/[^A-Z0-9_-]/g, "") + ".json");
  try {
    const req = new Request(BASE + "/api/widget?symbols=" + encodeURIComponent(SYMBOLS.join(",")));
    req.timeoutInterval = 12;
    const data = await req.loadJSON();
    if (!data || !Array.isArray(data.items)) throw new Error("bad response");
    fm.writeString(cache, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fm.fileExists(cache)) {
      const d = JSON.parse(fm.readString(cache));
      d.stale = true;
      return d;
    }
    return { items: [], error: String(e), updatedAt: new Date().toISOString() };
  }
}

// ── formatting ──────────────────────────────────────────
function fmtPrice(v) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  const a = Math.abs(v);
  let s;
  if (a >= 100000) s = Math.round(v).toString();
  else if (a >= 1) s = v.toFixed(2);
  else if (a === 0) s = "0.00";
  else s = v.toFixed(Math.min(Math.floor(-Math.log10(a)) + 4, 12));
  const [i, d] = s.split(".");
  const int = i.replace(/\\B(?=(\\d{3})+(?!\\d))/g, " ");
  return d ? int + "," + d : int;
}
const fmtPct = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v || 0).toFixed(2).replace(".", ",") + "%";
const tone = (v) => (v > 0 ? C.green : v < 0 ? C.pink : C.muted);
const SESSION = { open: "NYSE · торги", pre: "NYSE · премаркет", post: "NYSE · постмаркет", closed: "NYSE · закрыта" };

// ── drawing ─────────────────────────────────────────────
function sparkline(values, w, h, color) {
  const dc = new DrawContext();
  dc.size = new Size(w, h);
  dc.opaque = false;
  dc.respectScreenScale = true;
  if (values && values.length > 1) {
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const span = max - min || 1;
    const pts = values.map((v, i) => new Point((i / (values.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)));
    const fill = new Path();
    fill.move(new Point(0, h));
    pts.forEach((p) => fill.addLine(p));
    fill.addLine(new Point(w, h));
    fill.closeSubpath();
    dc.addPath(fill);
    dc.setFillColor(new Color(color, 0.14));
    dc.fillPath();
    const line = new Path();
    pts.forEach((p, i) => (i ? line.addLine(p) : line.move(p)));
    dc.addPath(line);
    dc.setStrokeColor(new Color(color));
    dc.setLineWidth(2);
    dc.strokePath();
  }
  return dc.getImage();
}

function text(stack, s, font, color, opts) {
  const t = stack.addText(s);
  t.font = font;
  t.textColor = col(color);
  t.lineLimit = 1;
  t.minimumScaleFactor = (opts && opts.scale) || 0.6;
  return t;
}

function pill(stack, v, size) {
  const p = stack.addStack();
  p.backgroundColor = col(tone(v), 0.16);
  p.cornerRadius = 4;
  p.setPadding(1, 4, 1, 4);
  text(p, fmtPct(v), Font.semiboldMonospacedSystemFont(size || 11), tone(v));
  return p;
}

function newWidget() {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [col(C.bg2), col(C.bg1)];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.url = BASE;
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000);
  return w;
}

function header(w, data, small) {
  const h = w.addStack();
  h.centerAlignContent();
  text(h, "NEON//PULSE", Font.heavySystemFont(small ? 10 : 11), C.cyan);
  h.addSpacer();
  const t = new Date(data.updatedAt || Date.now());
  const hhmm = ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2);
  text(h, (data.stale ? "⚠ " : "") + hhmm, Font.mediumMonospacedSystemFont(small ? 9 : 10), data.stale ? C.yellow : C.faint);
}

function row(w, it, opts) {
  const r = w.addStack();
  r.centerAlignContent();
  const name = r.addStack();
  name.size = new Size(opts.nameW, 0);
  text(name, it.label, Font.boldSystemFont(opts.font), C.cyan);
  name.addSpacer();
  if (opts.spark) {
    r.addSpacer(4);
    const img = r.addImage(sparkline(it.spark, opts.sparkW, opts.font + 6, tone(it.chPct)));
    img.imageSize = new Size(opts.sparkW, opts.font + 6);
  }
  r.addSpacer();
  text(r, fmtPrice(it.price), Font.semiboldMonospacedSystemFont(opts.font), C.text);
  r.addSpacer(6);
  const p = r.addStack();
  p.size = new Size(opts.pillW, 0);
  p.addSpacer();
  pill(p, it.chPct, opts.font - 2);
}

function empty(w, data) {
  w.addSpacer();
  text(w, data.error ? "Нет связи с сайтом" : "Нет данных", Font.semiboldSystemFont(12), C.pink);
  text(w, BASE.replace(/^https?:\\/\\//, ""), Font.regularSystemFont(9), C.faint);
  w.addSpacer();
}

// ── layouts ─────────────────────────────────────────────
function small(data) {
  const w = newWidget();
  w.setPadding(12, 12, 12, 12);
  header(w, data, true);
  const it = data.items[0];
  if (!it) return empty(w, data), w;
  w.addSpacer(6);
  text(w, it.label, Font.boldSystemFont(15), C.cyan);
  text(w, fmtPrice(it.price), Font.boldMonospacedSystemFont(22), C.text, { scale: 0.4 });
  const p = w.addStack();
  pill(p, it.chPct, 12);
  w.addSpacer(4);
  const img = w.addImage(sparkline(it.spark, 130, 34, tone(it.chPct)));
  img.imageSize = new Size(130, 34);
  w.addSpacer();
  const second = data.items[1];
  if (second) {
    const s = w.addStack();
    s.centerAlignContent();
    text(s, second.label, Font.boldSystemFont(10), C.muted);
    s.addSpacer();
    text(s, fmtPct(second.chPct), Font.semiboldMonospacedSystemFont(10), tone(second.chPct));
  }
  return w;
}

function list(data, max, big) {
  const w = newWidget();
  w.setPadding(12, 14, 12, 14);
  header(w, data, false);
  if (!data.items.length) return empty(w, data), w;
  w.addSpacer(big ? 8 : 6);
  const items = data.items.slice(0, max);
  items.forEach((it, i) => {
    row(w, it, { font: big ? 14 : 13, nameW: big ? 74 : 64, spark: true, sparkW: big ? 90 : 70, pillW: 72 });
    if (i < items.length - 1) w.addSpacer(big ? 7 : 4);
  });
  w.addSpacer();
  const f = w.addStack();
  text(f, SESSION[data.session] || "", Font.mediumSystemFont(9), data.session === "open" ? C.green : C.faint);
  f.addSpacer();
  text(f, data.source === "demo" ? "DEMO" : "онлайн", Font.mediumSystemFont(9), data.source === "demo" ? C.yellow : C.faint);
  return w;
}

function lockRect(data) {
  const w = new ListWidget();
  w.url = BASE;
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000);
  data.items.slice(0, 3).forEach((it) => {
    const r = w.addStack();
    const n = r.addText(it.label);
    n.font = Font.boldSystemFont(12);
    r.addSpacer();
    const p = r.addText(fmtPrice(it.price) + "  " + fmtPct(it.chPct));
    p.font = Font.mediumMonospacedSystemFont(12);
    p.minimumScaleFactor = 0.6;
    p.lineLimit = 1;
  });
  if (!data.items.length) w.addText("NeonPulse: нет данных");
  return w;
}

function lockCircle(data) {
  const w = new ListWidget();
  w.url = BASE;
  const it = data.items[0];
  const a = w.addText(it ? it.label : "—");
  a.font = Font.boldSystemFont(11);
  a.centerAlignText();
  a.minimumScaleFactor = 0.5;
  const b = w.addText(it ? fmtPct(it.chPct) : "");
  b.font = Font.semiboldMonospacedSystemFont(11);
  b.centerAlignText();
  b.minimumScaleFactor = 0.5;
  return w;
}

function lockInline(data) {
  const w = new ListWidget();
  const it = data.items[0];
  w.addText(it ? it.label + " " + fmtPrice(it.price) + " " + fmtPct(it.chPct) : "NeonPulse");
  return w;
}

// ── main ────────────────────────────────────────────────
const data = await load();
let widget;
switch (FAMILY) {
  case "small": widget = small(data); break;
  case "medium": widget = list(data, 4, false); break;
  case "accessoryRectangular": widget = lockRect(data); break;
  case "accessoryCircular": widget = lockCircle(data); break;
  case "accessoryInline": widget = lockInline(data); break;
  case "extraLarge": widget = list(data, 12, true); break;
  default: widget = list(data, 9, true);
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (FAMILY === "small") {
  await widget.presentSmall();
} else if (FAMILY === "medium") {
  await widget.presentMedium();
} else {
  await widget.presentLarge();
}
Script.complete();
`;
}
