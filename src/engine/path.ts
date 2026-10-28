// 격자 위 A* 길찾기 (상하좌우 4방향)

import { walkable, type Pt, type World } from "./world";

export function findPath(world: World, from: Pt, to: Pt): Pt[] {
  const { cols } = world;
  const start = from.y * cols + from.x;
  const goal = to.y * cols + to.x;
  if (start === goal) return [];
  if (!walkable(world, to.x, to.y)) return [];

  const g = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const open = new MinHeap();
  open.push(start, h(from, to));
  const closed = new Set<number>();

  while (open.size) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % cols;
    const cy = (cur - cx) / cols;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      // 출발점이 가구 위(앉은 자리 등)일 수도 있으니 이웃만 검사한다
      if (!walkable(world, nx, ny)) continue;
      const n = ny * cols + nx;
      const cost = (g.get(cur) ?? 0) + 1;
      if (cost < (g.get(n) ?? Infinity)) {
        g.set(n, cost);
        came.set(n, cur);
        open.push(n, cost + h({ x: nx, y: ny }, to));
      }
    }
  }

  if (!came.has(goal)) return [];
  const path: Pt[] = [];
  let node = goal;
  while (node !== start) {
    path.push({ x: node % cols, y: Math.floor(node / cols) });
    node = came.get(node)!;
  }
  return path.reverse();
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function h(a: Pt, b: Pt) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

class MinHeap {
  private items: { id: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(id: number, f: number) {
    const a = this.items;
    a.push({ id, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.id;
  }
}
