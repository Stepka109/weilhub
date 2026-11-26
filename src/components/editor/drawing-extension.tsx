"use client";

import * as React from "react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { ChevronsDown, Eraser, Hand, Highlighter, PenLine, Trash2 } from "lucide-react";
import {
  DRAWING_WIDTH,
  MAX_HEIGHT,
  MAX_POINTS,
  PAPERS,
  normalizeDrawing,
  paperPattern,
  strokeHit,
  strokeOpacity,
  strokePath,
  type Paper,
  type Stroke,
} from "@/lib/drawing";
import { cn } from "@/lib/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    drawing: {
      /** Vloží kreslicí plochu (a za ni prázdný odstavec pro další psaní) */
      insertDrawing: (opts?: { height?: number; paper?: Paper }) => ReturnType;
    };
  }
}

type Tool = "pen" | "hl" | "eraser";

const PEN_COLORS = [
  ["#1f2937", "Černá"],
  ["#2563eb", "Modrá"],
  ["#dc2626", "Červená"],
  ["#16a34a", "Zelená"],
  ["#ea580c", "Oranžová"],
  ["#7c3aed", "Fialová"],
] as const;
const HL_COLORS = [
  ["#facc15", "Žlutá"],
  ["#4ade80", "Zelená"],
  ["#f472b6", "Růžová"],
  ["#60a5fa", "Modrá"],
] as const;
const SIZES: Record<"pen" | "hl", number[]> = { pen: [2.5, 4.5, 8], hl: [16, 26, 38] };
const ERASER_RADIUS = 14;

/**
 * Poslední zvolené nástroje (sdílí všechny kresby na stránce). Prst ve
 * výchozím stavu jen posouvá stránku – opření dlaně při psaní perem nevadí.
 */
const prefs = { tool: "pen" as Tool, pen: PEN_COLORS[0][0] as string, hl: HL_COLORS[0][0] as string, size: 1, finger: false };

function ToolBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl transition-colors [&_svg]:size-[18px]",
        active ? "bg-light-blue text-primary" : "text-slate-ink hover:bg-slate-soft",
      )}
    >
      {children}
    </button>
  );
}

function DrawingView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const data = React.useMemo(() => normalizeDrawing(node.attrs), [node.attrs]);
  const editable = editor.isEditable;
  const [tool, setToolState] = React.useState<Tool>(prefs.tool);
  const [penColor, setPenColor] = React.useState(prefs.pen);
  const [hlColor, setHlColor] = React.useState(prefs.hl);
  const [size, setSize] = React.useState(prefs.size);
  const [finger, setFinger] = React.useState(prefs.finger);
  const [live, setLive] = React.useState<Stroke | null>(null);
  const [erased, setErasedState] = React.useState<Set<number>>(() => new Set());
  const erasedRef = React.useRef<Set<number>>(new Set());
  const setErased = (next: Set<number>) => {
    erasedRef.current = next;
    setErasedState(next);
  };
  const svgRef = React.useRef<SVGSVGElement>(null);
  const current = React.useRef<{ id: number; pts: number[]; pen: boolean } | null>(null);
  const frame = React.useRef(0);
  const patternId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const setTool = (t: Tool) => {
    prefs.tool = t;
    setToolState(t);
  };

  const paths = React.useMemo(() => data.strokes.map((s) => strokePath(s)), [data.strokes]);

  // Apple Pencil na iPadu: dotyk pera nesmí posouvat stránku (prst ano)
  React.useEffect(() => {
    const el = svgRef.current;
    if (!el || !editable) return;
    const block = (e: TouchEvent) => {
      const stylus = Array.from(e.touches).some((t) => (t as Touch & { touchType?: string }).touchType === "stylus");
      if (stylus || finger) e.preventDefault();
    };
    el.addEventListener("touchstart", block, { passive: false });
    el.addEventListener("touchmove", block, { passive: false });
    return () => {
      el.removeEventListener("touchstart", block);
      el.removeEventListener("touchmove", block);
    };
  }, [editable, finger]);

  function local(e: { clientX: number; clientY: number }) {
    const r = svgRef.current!.getBoundingClientRect();
    const k = DRAWING_WIDTH / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  }

  function canDraw(e: React.PointerEvent) {
    if (!editable) return false;
    if (e.pointerType === "pen") return true;
    if (e.pointerType === "mouse") return e.button === 0;
    // Prst kreslí jen se zapnutým „Kreslit prstem“ (na tabletu s perem se prstem posouvá)
    return finger;
  }

  function addPoint(e: PointerEvent | React.PointerEvent) {
    const c = current.current!;
    if (c.pts.length >= MAX_POINTS * 3) return;
    const { x, y } = local(e);
    const pressure = c.pen ? Math.max(0.05, e.pressure || 0.5) : 0.5;
    c.pts.push(Math.round(x * 10), Math.round(Math.max(0, y) * 10), Math.round(pressure * 100));
    if (tool === "eraser") {
      // Při rychlém pohybu projít i úsečku od minulého bodu, ať guma nic nepřeskočí
      const n = c.pts.length;
      const px = n >= 6 ? c.pts[n - 6] / 10 : x;
      const py = n >= 6 ? c.pts[n - 5] / 10 : y;
      const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / (ERASER_RADIUS / 2)));
      const hit = new Set<number>();
      for (let k = 0; k <= steps; k++) {
        const sx = px + ((x - px) * k) / steps;
        const sy = py + ((y - py) * k) / steps;
        data.strokes.forEach((s, i) => {
          if (!hit.has(i) && strokeHit(s, sx, sy, ERASER_RADIUS)) hit.add(i);
        });
      }
      if (hit.size) setErased(new Set([...erasedRef.current, ...hit]));
    }
  }

  function render() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const c = current.current;
      if (!c || tool === "eraser") return setLive(null);
      setLive({ t: tool, c: tool === "hl" ? hlColor : penColor, s: SIZES[tool][size], p: [...c.pts] });
    });
  }

  function onDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!canDraw(e)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = { id: e.pointerId, pts: [], pen: e.pointerType === "pen" };
    setErased(new Set());
    addPoint(e);
    render();
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const c = current.current;
    if (!c || c.id !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) addPoint(ev);
    render();
  }

  function onUp(e: React.PointerEvent<SVGSVGElement>) {
    const c = current.current;
    if (!c || c.id !== e.pointerId) return;
    current.current = null;
    cancelAnimationFrame(frame.current);
    setLive(null);
    if (tool === "eraser") {
      const gone = erasedRef.current;
      if (gone.size) updateAttributes({ strokes: data.strokes.filter((_, i) => !gone.has(i)) });
      setErased(new Set());
      return;
    }
    if (c.pts.length < 3) return;
    const stroke: Stroke = { t: tool, c: tool === "hl" ? hlColor : penColor, s: SIZES[tool][size], p: c.pts };
    // Plocha se sama prodlouží, když se píše u spodního okraje
    let maxY = 0;
    for (let i = 1; i < c.pts.length; i += 3) maxY = Math.max(maxY, c.pts[i] / 10);
    const height = maxY > data.height - 80 ? Math.min(MAX_HEIGHT, Math.ceil((maxY + 260) / 100) * 100) : data.height;
    updateAttributes({ strokes: [...data.strokes, stroke], height });
  }

  const colors = tool === "hl" ? HL_COLORS : PEN_COLORS;
  const activeColor = tool === "hl" ? hlColor : penColor;
  const pattern = paperPattern(data.paper, patternId);

  return (
    <NodeViewWrapper className="wh-drawing-node my-4" data-drag-handle="">
      {editable && (
        <div
          data-drawing-ui=""
          contentEditable={false}
          className="scrollbar-none sticky top-12 z-[5] mb-1.5 flex items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-card/95 p-1 shadow-sm backdrop-blur"
        >
          <ToolBtn label="Pero" active={tool === "pen"} onClick={() => setTool("pen")}>
            <PenLine />
          </ToolBtn>
          <ToolBtn label="Zvýrazňovač" active={tool === "hl"} onClick={() => setTool("hl")}>
            <Highlighter />
          </ToolBtn>
          <ToolBtn label="Guma – smaže celý tah" active={tool === "eraser"} onClick={() => setTool("eraser")}>
            <Eraser />
          </ToolBtn>
          {tool !== "eraser" && (
            <>
              <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
              {colors.map(([c, name]) => (
                <button
                  key={c}
                  type="button"
                  title={name}
                  aria-label={`Barva ${name.toLowerCase()}`}
                  aria-pressed={activeColor === c}
                  onClick={() => {
                    if (tool === "hl") setHlColor((prefs.hl = c));
                    else setPenColor((prefs.pen = c));
                  }}
                  className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-slate-soft"
                >
                  <span
                    className={cn("block size-6 rounded-full border border-black/10", activeColor === c && "ring-2 ring-primary ring-offset-2 ring-offset-card")}
                    style={{ background: c }}
                  />
                </button>
              ))}
              <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  type="button"
                  title={["Tenké", "Střední", "Silné"][i]}
                  aria-label={`Tloušťka: ${["tenká", "střední", "silná"][i]}`}
                  aria-pressed={size === i}
                  onClick={() => setSize((prefs.size = i))}
                  className={cn("grid size-10 shrink-0 place-items-center rounded-xl", size === i ? "bg-light-blue" : "hover:bg-slate-soft")}
                >
                  <span className="block rounded-full bg-ink" style={{ width: 4 + i * 5, height: 4 + i * 5, opacity: tool === "hl" ? 0.45 : 1 }} />
                </button>
              ))}
            </>
          )}
          <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
          <select
            aria-label="Papír"
            value={data.paper}
            onChange={(e) => updateAttributes({ paper: e.target.value })}
            className="h-10 shrink-0 rounded-xl border border-line bg-card px-2 text-sm text-ink"
          >
            {PAPERS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <ToolBtn
            label={finger ? "Kreslení prstem je zapnuté" : "Kreslit prstem (bez pera)"}
            active={finger}
            onClick={() => setFinger((prefs.finger = !finger))}
          >
            <Hand />
          </ToolBtn>
          <ToolBtn label="Prodloužit plochu" onClick={() => updateAttributes({ height: Math.min(MAX_HEIGHT, data.height + 400) })}>
            <ChevronsDown />
          </ToolBtn>
          <ToolBtn label="Smazat kresbu" onClick={() => deleteNode()}>
            <Trash2 />
          </ToolBtn>
        </div>
      )}
      <div className="wh-drawing" data-drawing-ui="">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${DRAWING_WIDTH} ${data.height}`}
          role="img"
          aria-label={editable ? "Kreslicí plocha – kresli perem, myší nebo prstem" : "Kresba"}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ touchAction: editable && finger ? "none" : "pan-y pinch-zoom", cursor: editable ? (tool === "eraser" ? "cell" : "crosshair") : "default" }}
        >
          {pattern && (
            <>
              <defs dangerouslySetInnerHTML={{ __html: pattern }} />
              <rect width="100%" height="100%" fill={`url(#${patternId})`} />
            </>
          )}
          {data.strokes.map((s, i) =>
            paths[i] ? (
              <path key={i} d={paths[i]} fill={s.c} fillOpacity={erased.has(i) ? 0.12 : strokeOpacity(s)} />
            ) : null,
          )}
          {live && <path d={strokePath(live, true)} fill={live.c} fillOpacity={strokeOpacity(live)} />}
        </svg>
      </div>
    </NodeViewWrapper>
  );
}

export const Drawing = Node.create({
  name: "drawing",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      height: { default: 500, rendered: false },
      paper: { default: "plain", rendered: false },
      strokes: { default: [], rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="drawing"]',
        getAttrs: (el) => {
          try {
            return { ...normalizeDrawing(JSON.parse((el as HTMLElement).getAttribute("data-drawing") || "{}")) };
          } catch {
            return false;
          }
        },
      },
    ];
  },

  renderHTML({ node }) {
    return ["div", { "data-type": "drawing", "data-drawing": JSON.stringify(normalizeDrawing(node.attrs)) }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingView, {
      // Události v kreslicí ploše a na liště nástrojů si řídí kresba sama
      stopEvent: ({ event }) => !!(event.target as Element | null)?.closest?.("[data-drawing-ui]"),
    });
  },

  addCommands() {
    return {
      insertDrawing:
        (opts = {}) =>
        ({ commands }) =>
          commands.insertContent([
            { type: this.name, attrs: { height: opts.height ?? 500, paper: opts.paper ?? "plain", strokes: [] } },
            { type: "paragraph" },
          ]),
    };
  },
});
