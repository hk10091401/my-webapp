// 사무실 지도. 부서 수에 맞춰 방이 4열로 자동 배치됩니다.
// 타일 단위 격자이며, 0 = 걸을 수 있음 / 1 = 벽·가구.

import type { Department } from "../config/types";

export const TILE = 16;

export type Pt = { x: number; y: number };
export type RoomKind = "dept" | "ceo" | "meeting" | "lounge";

export type Seat = Pt & { facing: Facing };
export type Facing = "up" | "down" | "left" | "right";

export type Room = {
  id: string;
  name: string;
  icon: string;
  kind: RoomKind;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  door: Pt[];
  seats: Seat[];
  /** 방 안에서 서성일 자리 */
  spots: Pt[];
};

export type PropKind =
  | "desk"
  | "ceo-desk"
  | "table"
  | "sofa"
  | "coffee"
  | "plant"
  | "shelf"
  | "board"
  | "rug"
  | "fridge"
  | "window";

export type Prop = { kind: PropKind; x: number; y: number; w: number; h: number; solid: boolean };

export type World = {
  cols: number;
  rows: number;
  rooms: Room[];
  props: Prop[];
  grid: Uint8Array;
  ceoRoom: Room;
  meetingRoom: Room;
  lounge: Room;
  ceoSeat: Seat;
  reportSpots: Pt[];
  meetingSeats: Seat[];
  entrance: Pt;
  deptRoom: Map<string, Room>;
};

const DEPT_W = 14;
const DEPT_H = 10;
const GAP = 3;
const PER_ROW = 4;
const TOP_H = 11;
const MAX_DESKS = 8;

export const MAX_TEAM_SIZE = MAX_DESKS;

export function buildWorld(departments: Department[], teamSizes = new Map<string, number>()): World {
  const cols = 2 + PER_ROW * DEPT_W + (PER_ROW - 1) * GAP + 2;
  const deptRows = Math.max(1, Math.ceil(departments.length / PER_ROW));
  const firstDeptY = 2 + TOP_H + GAP;
  const rows = firstDeptY + deptRows * (DEPT_H + GAP) + 3;
  const props: Prop[] = [];
  const add = (kind: PropKind, x: number, y: number, w: number, h: number, solid = true) =>
    props.push({ kind, x, y, w, h, solid });

  // ── 윗줄: 대표실 · 회의실 · 라운지 ──────────────────
  const ceoRoom: Room = {
    id: "ceo",
    name: "대표실",
    icon: "🪴",
    kind: "ceo",
    color: "#fdf3d8",
    x: 2,
    y: 2,
    w: 17,
    h: TOP_H,
    door: [{ x: 10, y: 2 + TOP_H - 1 }],
    seats: [],
    spots: [
      { x: 4, y: 9 },
      { x: 16, y: 9 },
      { x: 5, y: 4 },
    ],
  };
  const ceoSeat: Seat = { x: 10, y: 5, facing: "down" };
  add("ceo-desk", 8, 6, 5, 2);
  add("rug", 7, 8, 7, 3, false);
  add("shelf", 3, 3, 3, 1);
  add("plant", 17, 3, 1, 1);
  add("plant", 3, 11, 1, 1);
  add("window", 8, 2, 5, 1, false);
  const reportSpots: Pt[] = [
    { x: 10, y: 9 },
    { x: 9, y: 9 },
    { x: 11, y: 9 },
    { x: 8, y: 10 },
    { x: 12, y: 10 },
  ];

  const meetingRoom: Room = {
    id: "meeting",
    name: "회의실",
    icon: "💬",
    kind: "meeting",
    color: "#e9eefc",
    x: 21,
    y: 2,
    w: 24,
    h: TOP_H,
    door: [{ x: 33, y: 2 + TOP_H - 1 }],
    seats: [],
    spots: [
      { x: 23, y: 10 },
      { x: 42, y: 10 },
    ],
  };
  add("table", 27, 6, 12, 2);
  add("board", 29, 2, 8, 1, false);
  add("plant", 22, 3, 1, 1);
  add("plant", 43, 3, 1, 1);
  const meetingSeats: Seat[] = [];
  for (let i = 0; i < 6; i += 1) meetingSeats.push({ x: 28 + i * 2, y: 5, facing: "down" });
  for (let i = 0; i < 6; i += 1) meetingSeats.push({ x: 28 + i * 2, y: 8, facing: "up" });
  meetingSeats.push({ x: 26, y: 6, facing: "right" }, { x: 39, y: 7, facing: "left" });

  const loungeX = 47;
  const lounge: Room = {
    id: "lounge",
    name: "라운지",
    icon: "☕",
    kind: "lounge",
    color: "#e4f4ea",
    x: loungeX,
    y: 2,
    w: cols - 2 - loungeX,
    h: TOP_H,
    door: [{ x: loungeX + 6, y: 2 + TOP_H - 1 }],
    seats: [],
    spots: [],
  };
  add("sofa", loungeX + 2, 4, 6, 1);
  add("table", loungeX + 3, 6, 4, 1);
  add("coffee", loungeX + 11, 3, 3, 1);
  add("fridge", loungeX + 15, 3, 2, 1);
  add("plant", loungeX + 18, 3, 1, 1);
  add("plant", loungeX + 18, 11, 1, 1);
  add("rug", loungeX + 10, 6, 8, 4, false);
  for (let y = 5; y <= 11; y += 2) {
    for (let x = loungeX + 2; x < loungeX + lounge.w - 2; x += 2) {
      lounge.spots.push({ x, y });
    }
  }

  // ── 부서 방 ───────────────────────────────────────
  const deptRoom = new Map<string, Room>();
  const deptRooms: Room[] = departments.map((dept, i) => {
    const x = 2 + (i % PER_ROW) * (DEPT_W + GAP);
    const y = firstDeptY + Math.floor(i / PER_ROW) * (DEPT_H + GAP);
    const seats: Seat[] = [];
    // 인원에 맞춰 책상을 4개 또는 8개 놓는다
    const desks = (teamSizes.get(dept.id) ?? 0) > 4 ? MAX_DESKS : 4;
    for (let k = 0; k < desks; k += 1) {
      const deskX = x + 1 + (k % 4) * 3;
      const deskY = desks === 4 ? y + 4 : k < 4 ? y + 3 : y + 6;
      add("desk", deskX, deskY, 2, 1);
      seats.push({ x: deskX, y: deskY + 1, facing: "up" });
    }
    add("shelf", x + 1, y + 1, 3, 1);
    add("plant", x + DEPT_W - 2, y + 1, 1, 1);
    const room: Room = {
      id: dept.id,
      name: dept.name,
      icon: dept.icon,
      kind: "dept",
      color: dept.color,
      x,
      y,
      w: DEPT_W,
      h: DEPT_H,
      door: [{ x: x + 6, y }, { x: x + 7, y }],
      seats,
      spots: [
        { x: x + 2, y: y + 8 },
        { x: x + 6, y: y + 8 },
        { x: x + 11, y: y + 8 },
        { x: x + 12, y: y + 3 },
      ],
    };
    deptRoom.set(dept.id, room);
    return room;
  });

  const rooms = [ceoRoom, meetingRoom, lounge, ...deptRooms];
  const entrance: Pt = { x: Math.floor(cols / 2), y: rows - 1 };

  const grid = new Uint8Array(cols * rows);
  const block = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) grid[y * cols + x] = 1;
  };
  for (let x = 0; x < cols; x += 1) {
    block(x, 0);
    block(x, rows - 1);
  }
  for (let y = 0; y < rows; y += 1) {
    block(0, y);
    block(cols - 1, y);
  }
  for (const r of rooms) {
    for (let x = r.x; x < r.x + r.w; x += 1) {
      block(x, r.y);
      block(x, r.y + r.h - 1);
    }
    for (let y = r.y; y < r.y + r.h; y += 1) {
      block(r.x, y);
      block(r.x + r.w - 1, y);
    }
  }
  for (const p of props) {
    if (!p.solid) continue;
    for (let y = p.y; y < p.y + p.h; y += 1) for (let x = p.x; x < p.x + p.w; x += 1) block(x, y);
  }
  for (const r of rooms) for (const d of r.door) grid[d.y * cols + d.x] = 0;
  grid[entrance.y * cols + entrance.x] = 0;
  grid[entrance.y * cols + entrance.x - 1] = 0;

  return {
    cols,
    rows,
    rooms,
    props,
    grid,
    ceoRoom,
    meetingRoom,
    lounge,
    ceoSeat,
    reportSpots,
    meetingSeats,
    entrance,
    deptRoom,
  };
}

export function walkable(world: World, x: number, y: number) {
  return x >= 0 && y >= 0 && x < world.cols && y < world.rows && world.grid[y * world.cols + x] === 0;
}

export function roomAt(world: World, x: number, y: number): Room | null {
  return world.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;
}
