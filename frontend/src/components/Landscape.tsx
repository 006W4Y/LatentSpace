import { useEffect, useRef, useState } from "react";
import {
  Box,
  Crosshair,
  Maximize2,
  MousePointer2,
  RotateCcw,
  Scan,
} from "lucide-react";
import type { DataRow } from "../api";
import { clusterColor, number } from "../api";

type Props = {
  rows: DataRow[];
  onInspect: (row: DataRow) => void;
  onSelect: (ids: number[]) => void;
  selected: number | null;
  compact?: boolean;
};
type ScreenPoint = { x: number; y: number; z: number; row: DataRow };

export default function Landscape({
  rows,
  onInspect,
  onSelect,
  selected,
  compact = false,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const points = useRef<ScreenPoint[]>([]);
  const [size, setSize] = useState({ width: 800, height: 470 });
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [tool, setTool] = useState<"move" | "select">("move");
  const [camera, setCamera] = useState({
    x: -0.25,
    y: 0.4,
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const [box, setBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [hover, setHover] = useState<ScreenPoint | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    select: boolean;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setCamera((c) => ({
        ...c,
        zoom: Math.max(
          0.3,
          Math.min(6, c.zoom * (event.deltaY > 0 ? 0.9 : 1.1)),
        ),
      }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const bounds = entries[0].contentRect;
      setSize({ width: bounds.width, height: bounds.height });
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    element.width = size.width * dpr;
    element.height = size.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.width, size.height);
    const { width: w, height: h } = size;
    ctx.strokeStyle = "#e6eae2";
    ctx.lineWidth = 1;
    for (let x = 24; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 24; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    if (!rows.length) {
      points.current = [];
      return;
    }
    const center = [0, 0, 0];
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const row of rows)
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], row.coords[axis]);
        max[axis] = Math.max(max[axis], row.coords[axis]);
      }
    for (let axis = 0; axis < 3; axis++)
      center[axis] = (min[axis] + max[axis]) / 2;
    const range = Math.max(
      ...max.map((value, axis) => value - min[axis]),
      0.001,
    );
    const scale = (Math.min(w, h) * 0.73 * camera.zoom) / range;
    const projected = rows
      .map((row) => {
        let [x, y, z] = row.coords.map((value, axis) => value - center[axis]);
        if (mode === "3d") {
          const xx = x * Math.cos(camera.y) + z * Math.sin(camera.y);
          z = -x * Math.sin(camera.y) + z * Math.cos(camera.y);
          x = xx;
          const yy = y * Math.cos(camera.x) - z * Math.sin(camera.x);
          z = y * Math.sin(camera.x) + z * Math.cos(camera.x);
          y = yy;
        }
        return {
          x: w / 2 + x * scale + camera.panX,
          y: h / 2 - y * scale + camera.panY,
          z,
          row,
        };
      })
      .sort((a, b) => a.z - b.z);
    points.current = projected;
    for (const point of projected) {
      const active = selected === point.row.id;
      ctx.globalAlpha = active ? 1 : 0.72;
      ctx.fillStyle = clusterColor(point.row.cluster);
      ctx.beginPath();
      ctx.arc(point.x, point.y, active ? 6 : compact ? 3 : 3.8, 0, Math.PI * 2);
      ctx.fill();
      if (point.row.anomaly || active) {
        ctx.strokeStyle = active ? "#173f35" : "#cf754b";
        ctx.lineWidth = active ? 2 : 1.1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, active ? 9 : 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (box) {
      ctx.fillStyle = "#356f5b18";
      ctx.strokeStyle = "#356f5b";
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
  }, [rows, camera, mode, size, selected, compact, box]);

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function nearest(x: number, y: number) {
    let found: ScreenPoint | null = null;
    let distance = 12;
    for (const point of points.current) {
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < distance) {
        distance = d;
        found = point;
      }
    }
    return found;
  }
  return (
    <div className={`landscape ${compact ? "compact" : ""}`}>
      {!compact && (
        <div className="landscape-toolbar">
          <div className="segmented">
            <button
              className={mode === "2d" ? "active" : ""}
              onClick={() => setMode("2d")}
            >
              <Crosshair size={14} />
              2D
            </button>
            <button
              className={mode === "3d" ? "active" : ""}
              onClick={() => setMode("3d")}
            >
              <Box size={14} />
              3D
            </button>
          </div>
          <div className="segmented">
            <button
              className={tool === "move" ? "active" : ""}
              onClick={() => setTool("move")}
              title="Punkte untersuchen und Ansicht bewegen"
            >
              <MousePointer2 size={14} />
              Erkunden
            </button>
            <button
              className={tool === "select" ? "active" : ""}
              onClick={() => setTool("select")}
            >
              <Scan size={14} />
              Auswählen
            </button>
          </div>
          <button
            className="icon-button"
            aria-label="Ansicht zurücksetzen"
            onClick={() =>
              setCamera({ x: -0.25, y: 0.4, zoom: 1, panX: 0, panY: 0 })
            }
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
      <div ref={host} className="canvas-host">
        <canvas
          ref={canvas}
          aria-label="Interaktive Datenlandschaft. Punkte anklicken oder über die Datentabelle auswählen."
          role="img"
          style={{
            width: "100%",
            height: "100%",
            cursor: tool === "select" ? "crosshair" : "grab",
            touchAction: "none",
          }}
          onPointerDown={(event) => {
            const p = position(event);
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              ...p,
              lastX: p.x,
              lastY: p.y,
              select: tool === "select" || event.shiftKey,
              moved: false,
            };
            setHover(null);
          }}
          onPointerMove={(event) => {
            const p = position(event);
            const d = drag.current;
            if (d) {
              const dx = p.x - d.lastX,
                dy = p.y - d.lastY;
              if (Math.hypot(p.x - d.x, p.y - d.y) > 4) d.moved = true;
              if (d.select)
                setBox({
                  x: Math.min(d.x, p.x),
                  y: Math.min(d.y, p.y),
                  w: Math.abs(d.x - p.x),
                  h: Math.abs(d.y - p.y),
                });
              else if (d.moved)
                setCamera((c) =>
                  mode === "3d"
                    ? { ...c, y: c.y + dx * 0.008, x: c.x + dy * 0.008 }
                    : { ...c, panX: c.panX + dx, panY: c.panY + dy },
                );
              d.lastX = p.x;
              d.lastY = p.y;
            } else setHover(nearest(p.x, p.y));
          }}
          onPointerUp={(event) => {
            const p = position(event);
            const d = drag.current;
            if (d?.select && d.moved) {
              const ids = points.current
                .filter(
                  (v) =>
                    v.x >= Math.min(d.x, p.x) &&
                    v.x <= Math.max(d.x, p.x) &&
                    v.y >= Math.min(d.y, p.y) &&
                    v.y <= Math.max(d.y, p.y),
                )
                .map((v) => v.row.id);
              onSelect(ids);
            } else if (d && !d.moved) {
              const found = nearest(p.x, p.y);
              if (found) onInspect(found.row);
            }
            drag.current = null;
            setBox(null);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setBox(null);
          }}
          onPointerLeave={() => setHover(null)}
        />
        {hover && (
          <div
            className="point-tooltip"
            style={{
              left: Math.min(hover.x + 14, size.width - 190),
              top: Math.max(8, hover.y - 56),
            }}
          >
            <strong>Zeile {hover.row.id + 1}</strong>
            <span>
              {hover.row.cluster < 0
                ? "Ohne Cluster"
                : `Gruppe ${hover.row.cluster + 1}`}
              {hover.row.anomaly ? " · Isolation-Forest-Markierung" : ""}
            </span>
          </div>
        )}
        {!rows.length && (
          <div className="canvas-empty">Keine Punkte in dieser Auswahl.</div>
        )}
        <div className="canvas-caption">
          <span>
            <i className="status-dot" />
            {number(rows.length, 0)} Datenpunkte
          </span>
          <span>
            <Maximize2 size={12} />
            {mode === "3d" ? "Ziehen zum Drehen" : "Scrollen zum Zoomen"}
          </span>
        </div>
      </div>
    </div>
  );
}
