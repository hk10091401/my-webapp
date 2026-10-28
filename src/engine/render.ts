// 캔버스 그리기. 바닥·벽·가구는 한 번만 그려 두고, 직원과 말풍선만 매 프레임 그립니다.

import type { Agent, DeptStatus, Office } from "./sim";
import { TILE, type Prop, type Room } from "./world";

export const INK = "#1f3a3d";
const CORRIDOR = "#d3ddd6";
const CORRIDOR_ALT = "#cbd6cf";
const WALL = "#9dbab2";
const WALL_FACE = "#7fa39b";
const MARIGOLD = "#f2b33d";

export const STATUS_COLOR: Record<DeptStatus, string> = {
  "대기": "#ffffff",
  "진행 중": "#f2b33d",
  "승인 대기": "#e86f8a",
  "완료": "#5fbf8f",
  "인원 없음": "#b9c4c0",
};

/** 정적 레이어 해상도 배율 — 확대해도 가구 선이 뭉개지지 않게 */
const BAKE = 3;

export type Camera = { x: number; y: number; scale: number };

export class Renderer {
  private readonly office: Office;
  private readonly baked: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;

  constructor(office: Office) {
    this.office = office;
    this.width = office.world.cols * TILE;
    this.height = office.world.rows * TILE;
    this.baked = document.createElement("canvas");
    this.bake();
  }

  bake() {
    const c = this.baked;
    c.width = this.width * BAKE;
    c.height = this.height * BAKE;
    const g = c.getContext("2d")!;
    g.setTransform(BAKE, 0, 0, BAKE, 0, 0);
    g.imageSmoothingEnabled = false;
    const { world } = this.office;

    // 복도 바닥
    for (let y = 0; y < world.rows; y += 1) {
      for (let x = 0; x < world.cols; x += 1) {
        g.fillStyle = (x + y) % 2 ? CORRIDOR : CORRIDOR_ALT;
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // 건물 외벽
    this.wallRing(g, 0, 0, world.cols, world.rows);

    for (const room of world.rooms) this.room(g, room);
    for (const prop of world.props) this.prop(g, prop);

    // 출입구
    const e = world.entrance;
    g.fillStyle = CORRIDOR;
    g.fillRect((e.x - 1) * TILE, e.y * TILE, TILE * 2, TILE);
    g.fillStyle = "#3f7d73";
    g.fillRect((e.x - 2) * TILE + 4, (e.y - 2) * TILE + 4, TILE * 4 - 8, TILE * 2 - 6);
    g.fillStyle = "#5c9a8f";
    for (let i = 0; i < 6; i += 1) g.fillRect((e.x - 2) * TILE + 8 + i * 9, (e.y - 2) * TILE + 8, 4, TILE * 2 - 14);
  }

  private wallRing(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const px = x * TILE;
    const py = y * TILE;
    const pw = w * TILE;
    const ph = h * TILE;
    g.fillStyle = WALL;
    g.fillRect(px, py, pw, TILE);
    g.fillRect(px, py + ph - TILE, pw, TILE);
    g.fillRect(px, py, TILE, ph);
    g.fillRect(px + pw - TILE, py, TILE, ph);
    // 위쪽 벽은 정면이 보이게 진하게
    g.fillStyle = WALL_FACE;
    g.fillRect(px + TILE, py + TILE * 0.45, pw - TILE * 2, TILE * 0.55);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    g.lineWidth = 1;
    g.strokeRect(px + TILE - 0.5, py + TILE - 0.5, pw - TILE * 2 + 1, ph - TILE * 2 + 1);
  }

  private room(g: CanvasRenderingContext2D, r: Room) {
    const ix = (r.x + 1) * TILE;
    const iy = (r.y + 1) * TILE;
    const iw = (r.w - 2) * TILE;
    const ih = (r.h - 2) * TILE;
    g.fillStyle = r.color;
    g.fillRect(ix, iy, iw, ih);
    // 마루 결
    g.fillStyle = "rgba(31,58,61,0.05)";
    for (let y = 0; y < r.h - 2; y += 1) {
      g.fillRect(ix, iy + y * TILE + TILE - 1, iw, 1);
      const offset = (y % 2) * 3 + 2;
      for (let x = offset; x < r.w - 2; x += 5) g.fillRect(ix + x * TILE, iy + y * TILE, 1, TILE - 1);
    }
    this.wallRing(g, r.x, r.y, r.w, r.h);
    for (const d of r.door) {
      g.fillStyle = r.color;
      g.fillRect(d.x * TILE, d.y * TILE, TILE, TILE);
      g.fillStyle = MARIGOLD;
      const top = d.y === r.y;
      g.fillRect(d.x * TILE, d.y * TILE + (top ? 0 : TILE - 3), TILE, 3);
    }
  }

  private prop(g: CanvasRenderingContext2D, p: Prop) {
    const x = p.x * TILE;
    const y = p.y * TILE;
    const w = p.w * TILE;
    const h = p.h * TILE;
    const box = (bx: number, by: number, bw: number, bh: number, fill: string, r = 2) => {
      g.fillStyle = INK;
      roundRect(g, bx - 1, by - 1, bw + 2, bh + 2, r + 1);
      g.fill();
      g.fillStyle = fill;
      roundRect(g, bx, by, bw, bh, r);
      g.fill();
    };

    switch (p.kind) {
      case "desk": {
        box(x + 1, y + 3, w - 2, h - 4, "#d9b98c");
        g.fillStyle = "#c4a273";
        g.fillRect(x + 2, y + h - 3, w - 4, 1);
        box(x + w / 2 - 6, y - 3, 12, 8, "#2b5559", 1);
        g.fillStyle = INK;
        g.fillRect(x + w / 2 - 1, y + 5, 2, 2);
        g.fillStyle = "#eef2ef";
        g.fillRect(x + w / 2 - 5, y + 9, 10, 2);
        break;
      }
      case "ceo-desk": {
        box(x, y + 2, w, h - 2, "#b98a5e", 3);
        g.fillStyle = "#a3784f";
        g.fillRect(x + 2, y + h - 4, w - 4, 2);
        box(x + w / 2 - 9, y - 4, 18, 11, "#2b5559", 1);
        box(x + 6, y + 6, 10, 7, "#f7fbf9", 1);
        box(x + w - 14, y + 5, 6, 6, "#c8794e", 1);
        g.fillStyle = "#4f9d69";
        g.fillRect(x + w - 15, y + 1, 8, 5);
        break;
      }
      case "table":
        box(x + 1, y + 2, w - 2, h - 3, "#e8d6b5", 4);
        g.fillStyle = "rgba(255,255,255,0.45)";
        g.fillRect(x + 4, y + 4, w - 8, 2);
        break;
      case "sofa":
        box(x, y - 4, w, h + 4, "#3f7d73", 4);
        g.fillStyle = "#5c9a8f";
        for (let i = 0; i < p.w; i += 2) g.fillRect(x + i * TILE + 3, y + 2, TILE * 2 - 6, 8);
        break;
      case "coffee":
        box(x, y, w, h, "#9aa8a4");
        box(x + 4, y - 8, 14, 14, INK, 2);
        g.fillStyle = MARIGOLD;
        g.fillRect(x + 8, y - 4, 6, 3);
        g.fillStyle = "#f7fbf9";
        g.fillRect(x + 26, y + 3, 5, 6);
        g.fillRect(x + 34, y + 3, 5, 6);
        break;
      case "fridge":
        box(x + 2, y - 10, w - 4, h + 10, "#f4f1e8", 2);
        g.fillStyle = INK;
        g.fillRect(x + 2, y - 1, w - 4, 1);
        g.fillRect(x + w - 8, y - 7, 1, 4);
        break;
      case "plant":
        box(x + 4, y + 8, 8, 7, "#c8794e", 1);
        g.fillStyle = INK;
        g.beginPath();
        g.arc(x + 8, y + 5, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#4f9d69";
        g.beginPath();
        g.arc(x + 8, y + 5, 6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#79c08d";
        g.fillRect(x + 5, y + 2, 3, 3);
        break;
      case "shelf": {
        box(x, y - 6, w, h + 4, "#b98a5e", 1);
        const books = ["#6fb7e8", "#e86f8a", MARIGOLD, "#8fd1a8", "#a58ee0", "#f4f1e8"];
        for (let i = 0; i < p.w * 4; i += 1) {
          g.fillStyle = books[(i + p.x) % books.length];
          g.fillRect(x + 2 + i * 4, y - 4 + (i % 3), 3, 8 - (i % 3));
        }
        g.fillStyle = INK;
        g.fillRect(x, y + 5, w, 1);
        break;
      }
      case "board":
        box(x, y + 2, w, h - 4, "#f7fbf9", 1);
        g.fillStyle = "#6fb7e8";
        g.fillRect(x + 6, y + 5, w * 0.4, 1);
        g.fillStyle = "#e86f8a";
        g.fillRect(x + 6, y + 8, w * 0.25, 1);
        g.fillStyle = MARIGOLD;
        g.fillRect(x + w * 0.6, y + 4, 10, 6);
        break;
      case "window":
        box(x + 2, y + 2, w - 4, h - 5, "#bfe3f5", 1);
        g.fillStyle = INK;
        g.fillRect(x + w / 2, y + 2, 1, h - 5);
        g.fillStyle = "rgba(255,255,255,0.7)";
        g.fillRect(x + 5, y + 4, 6, 1);
        break;
      case "rug":
        g.fillStyle = "rgba(242,179,61,0.22)";
        roundRect(g, x + 2, y + 2, w - 4, h - 4, 6);
        g.fill();
        g.strokeStyle = "rgba(242,179,61,0.55)";
        g.setLineDash([3, 3]);
        g.lineWidth = 1;
        roundRect(g, x + 5, y + 5, w - 10, h - 10, 4);
        g.stroke();
        g.setLineDash([]);
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, viewW: number, viewH: number, dpr: number, selectedId: string | null) {
    const office = this.office;
    const ox = viewW / 2 - cam.x * cam.scale;
    const oy = viewH / 2 - cam.y * cam.scale;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#b9c9c2";
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * ox, dpr * oy);
    ctx.imageSmoothingEnabled = cam.scale < 1;
    ctx.drawImage(this.baked, 0, 0, this.width, this.height);
    ctx.imageSmoothingEnabled = false;

    // 일하는 자리의 모니터 불빛
    const blink = Math.floor(office.realTime * 3) % 2;
    for (const a of office.agents) {
      if (!a.present || a.job?.kind !== "work" || !a.arrived || a.rank === "ceo") continue;
      ctx.fillStyle = blink ? "#9be3d3" : "#8fd1c4";
      ctx.fillRect(a.seat.x * TILE + TILE - 5, (a.seat.y - 1) * TILE - 2, 10, 6);
    }

    const sorted = office.agents.filter((a) => a.present).sort((p, q) => p.y - q.y);
    for (const a of sorted) drawPerson(ctx, a, a.id === selectedId, office.realTime);

    // ── 화면 좌표로 글자 그리기 ──
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const toScreen = (wx: number, wy: number) => ({ x: ox + wx * cam.scale, y: oy + wy * cam.scale });
    const status = office.deptStatus();

    ctx.textBaseline = "middle";
    for (const room of office.world.rooms) {
      const p = toScreen(room.x * TILE + 6, room.y * TILE);
      const label = `${room.icon} ${room.name}`;
      const size = clamp(11 * cam.scale, 9, 13);
      ctx.font = `700 ${size}px Galmuri11, sans-serif`;
      const st = status[room.id];
      const tw = ctx.measureText(label).width + (st ? 14 : 0);
      const ph = size + 8;
      ctx.fillStyle = INK;
      roundRect(ctx, p.x, p.y - ph / 2, tw + 14, ph, ph / 2);
      ctx.fill();
      ctx.fillStyle = "#f7fbf9";
      ctx.fillText(label, p.x + 7, p.y + 1);
      if (st) {
        ctx.fillStyle = STATUS_COLOR[st];
        ctx.beginPath();
        ctx.arc(p.x + tw + 4, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const showNames = cam.scale >= 1.25;
    ctx.font = `400 ${clamp(10 * cam.scale * 0.7, 9, 12)}px Galmuri11, sans-serif`;
    for (const a of sorted) {
      const head = toScreen((a.x + 0.5) * TILE, (a.y + 1) * TILE - 22);
      if (showNames || a.id === selectedId || a.rank === "ceo") {
        const feet = toScreen((a.x + 0.5) * TILE, (a.y + 1) * TILE + 2);
        const name = a.rank === "ceo" ? `★ ${a.name}` : a.rank === "lead" ? `${a.name} ·팀장` : a.name;
        const w = ctx.measureText(name).width + 8;
        ctx.fillStyle = a.id === selectedId ? MARIGOLD : "rgba(247,251,249,0.92)";
        roundRect(ctx, feet.x - w / 2, feet.y, w, 14, 3);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.fillText(name, feet.x, feet.y + 7.5);
        ctx.textAlign = "left";
      }
      if (a.speech) drawBubble(ctx, head.x, head.y - 4, a.speech, a.speechKind === "think");
    }
  }
}

// ── 픽셀 사람 ──────────────────────────────────────────
function drawPerson(ctx: CanvasRenderingContext2D, a: Agent, selected: boolean, t: number) {
  const cx = Math.round((a.x + 0.5) * TILE);
  const by = Math.round((a.y + 1) * TILE - 1);
  const walking = a.path.length > 0;
  const step = walking ? Math.floor(a.walked * 3) % 2 : 0;
  const typing = !walking && a.arrived && a.job?.kind === "work" && a.facing === "up";
  const bob = typing ? Math.floor(t * 6) % 2 : 0;

  ctx.fillStyle = selected ? "rgba(242,179,61,0.8)" : "rgba(31,58,61,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, by, selected ? 8 : 6, selected ? 3.5 : 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const shirtDark = shade(a.shirt, -0.18);
  const parts: [number, number, number, number, string][] = [];
  // 다리
  parts.push([cx - 3, by - 5 - (step ? 1 : 0), 2, 4 + (step ? 1 : 0), "#3a4250"]);
  parts.push([cx + 1, by - 5 - (step ? 0 : 1) * (walking ? 1 : 0), 2, 4 + (walking && !step ? 1 : 0), "#3a4250"]);
  // 몸통
  parts.push([cx - 4, by - 11, 8, 7, a.shirt]);
  // 팔
  if (typing) {
    parts.push([cx - 5, by - 11 - bob, 2, 4, shirtDark]);
    parts.push([cx + 3, by - 11 - (1 - bob), 2, 4, shirtDark]);
  } else if (a.facing === "left" || a.facing === "right") {
    const dir = a.facing === "left" ? -1 : 1;
    parts.push([cx - 1 + dir * (step ? 1 : -1), by - 10, 2, 5, shirtDark]);
  } else {
    parts.push([cx - 5, by - 10 + (step ? 1 : 0), 2, 5, shirtDark]);
    parts.push([cx + 3, by - 10 + (step ? 0 : 1) * (walking ? 1 : 0), 2, 5, shirtDark]);
  }
  // 머리
  parts.push([cx - 4, by - 18, 8, 7, a.skin]);

  ctx.fillStyle = INK;
  for (const [x, y, w, h] of parts) ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  for (const [x, y, w, h, c] of parts) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }

  // 머리카락
  ctx.fillStyle = a.hair;
  if (a.facing === "up") {
    ctx.fillRect(cx - 4, by - 19, 8, 7);
  } else {
    ctx.fillRect(cx - 4, by - 19, 8, 3);
    if (a.facing === "left") ctx.fillRect(cx + 2, by - 17, 2, 4);
    else if (a.facing === "right") ctx.fillRect(cx - 4, by - 17, 2, 4);
    else {
      ctx.fillRect(cx - 4, by - 17, 1, 3);
      ctx.fillRect(cx + 3, by - 17, 1, 3);
    }
  }
  ctx.fillStyle = INK;
  ctx.fillRect(cx - 5, by - 20, 10, 1);
  // 눈
  if (a.facing === "down") {
    ctx.fillRect(cx - 2, by - 15, 1, 2);
    ctx.fillRect(cx + 1, by - 15, 1, 2);
  } else if (a.facing === "left") {
    ctx.fillRect(cx - 3, by - 15, 1, 2);
  } else if (a.facing === "right") {
    ctx.fillRect(cx + 2, by - 15, 1, 2);
  }
  // 대표는 금색 배지, 팀장은 작은 명찰
  if (a.rank === "ceo") {
    ctx.fillStyle = MARIGOLD;
    ctx.fillRect(cx - 3, by - 22, 6, 2);
    ctx.fillRect(cx - 3, by - 24, 1, 2);
    ctx.fillRect(cx, by - 24, 1, 2);
    ctx.fillRect(cx + 2, by - 24, 1, 2);
  } else if (a.rank === "lead" && a.facing !== "up") {
    ctx.fillStyle = MARIGOLD;
    ctx.fillRect(cx + 1, by - 10, 2, 2);
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, think: boolean) {
  ctx.font = "400 11px Galmuri11, sans-serif";
  const lines = wrap(ctx, text, 150);
  const lh = 14;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
  const h = lines.length * lh + 8;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - h - 7);

  ctx.fillStyle = INK;
  roundRect(ctx, bx - 1.5, by - 1.5, w + 3, h + 3, 7);
  ctx.fill();
  ctx.fillStyle = think ? "#e9f3ef" : "#ffffff";
  roundRect(ctx, bx, by, w, h, 6);
  ctx.fill();
  if (think) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x - 2, by + h + 4, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 1, by + h + 9, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x - 5, by + h);
    ctx.lineTo(x, by + h + 6);
    ctx.lineTo(x + 5, by + h);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x - 3, by + h - 1);
    ctx.lineTo(x, by + h + 3);
    ctx.lineTo(x + 3, by + h - 1);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => ctx.fillText(line, bx + 7, by + 4 + lh / 2 + i * lh + 0.5));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > max && line) {
      out.push(line);
      line = ch === " " ? "" : ch;
    } else line += ch;
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function shade(hex: string, amount: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = (v: number) => Math.round(clamp(v + v * amount, 0, 255));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
