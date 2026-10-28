import { useEffect, useRef, useState } from "react";
import { Renderer, type Camera } from "../engine/render";
import type { Agent, Office } from "../engine/sim";
import { TILE } from "../engine/world";

type Mode = "fit" | "close" | "me";

type Props = {
  office: Office;
  selectedId: string | null;
  onSelect: (agent: Agent | null) => void;
};

export default function OfficeCanvas({ office, selectedId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const targetRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const modeRef = useRef<Mode>("fit");
  const selectedRef = useRef(selectedId);
  const drag = useRef({ on: false, x: 0, y: 0, moved: false });
  const [mode, setMode] = useState<Mode>("fit");

  selectedRef.current = selectedId;
  modeRef.current = mode;

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const renderer = new Renderer(office);
    let raf = 0;
    let viewW = 0;
    let viewH = 0;
    let dpr = 1;
    let first = true;

    const fitScale = () => Math.min(viewW / renderer.width, viewH / renderer.height) * 0.98;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewW = rect.width;
      viewH = rect.height;
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
      if (modeRef.current === "fit" || first) {
        targetRef.current = { x: renderer.width / 2, y: renderer.height / 2, scale: fitScale() };
        if (first) camRef.current = { ...targetRef.current };
        first = false;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    // 픽셀 글꼴이 늦게 도착하면 한 번 더 그린다
    document.fonts?.ready.then(() => renderer.bake());

    const frame = () => {
      const cam = camRef.current;
      const target = targetRef.current;
      const m = modeRef.current;
      if (m === "fit") targetRef.current = { x: renderer.width / 2, y: renderer.height / 2, scale: fitScale() };
      else if (m === "me" || selectedRef.current) {
        const who = office.agentById.get(selectedRef.current ?? "me");
        if (who?.present && m === "me") {
          target.x = (who.x + 0.5) * TILE;
          target.y = (who.y + 0.5) * TILE;
        }
      }
      const t = targetRef.current;
      cam.x += (t.x - cam.x) * 0.12;
      cam.y += (t.y - cam.y) * 0.12;
      cam.scale += (t.scale - cam.scale) * 0.14;
      office.expireSpeech();
      renderer.draw(ctx, cam, viewW, viewH, dpr, selectedRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const fit = fitScale();
      const next = clamp(targetRef.current.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), fit * 0.9, 4);
      if (modeRef.current === "fit") setMode("close");
      modeRef.current = "close";
      targetRef.current = { ...targetRef.current, scale: next };
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("wheel", onWheel);
    };
  }, [office]);

  const setView = (next: Mode) => {
    setMode(next);
    modeRef.current = next;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const w = office.world.cols * TILE;
    const h = office.world.rows * TILE;
    const fit = Math.min(rect.width / w, rect.height / h);
    if (next === "close") targetRef.current = { ...targetRef.current, scale: Math.max(fit * 2.2, 1.6) };
    if (next === "me") targetRef.current = { ...targetRef.current, scale: Math.max(fit * 2.6, 2) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { on: true, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!d.moved && modeRef.current !== "close") setView("close");
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    const s = camRef.current.scale;
    targetRef.current = { ...targetRef.current, x: targetRef.current.x - dx / s, y: targetRef.current.y - dy / s };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.on && !d.moved && !(e.target as HTMLElement).closest("button")) {
      const rect = wrapRef.current!.getBoundingClientRect();
      const hit = hitTest(office, camRef.current, rect, e.clientX - rect.left, e.clientY - rect.top);
      onSelect(hit);
    }
    d.on = false;
  };

  return (
    <div
      className="office-view"
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => (drag.current.on = false)}
    >
      <canvas ref={canvasRef} aria-label="사무실 지도. 직원을 누르면 프로필이 열립니다." role="img" />
      <div className="view-tools" role="group" aria-label="지도 보기">
        <button className={mode === "fit" ? "on" : ""} onClick={() => setView("fit")}>
          전체
        </button>
        <button className={mode === "close" ? "on" : ""} onClick={() => setView("close")}>
          확대
        </button>
        <button className={mode === "me" ? "on" : ""} onClick={() => setView("me")}>
          나 따라가기
        </button>
      </div>
    </div>
  );
}

function hitTest(office: Office, cam: Camera, rect: DOMRect, sx: number, sy: number) {
  const wx = (sx - (rect.width / 2 - cam.x * cam.scale)) / cam.scale;
  const wy = (sy - (rect.height / 2 - cam.y * cam.scale)) / cam.scale;
  let best: Agent | null = null;
  let bestD = 14;
  for (const a of office.agents) {
    if (!a.present) continue;
    const d = Math.hypot((a.x + 0.5) * TILE - wx, (a.y + 1) * TILE - 10 - wy);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
