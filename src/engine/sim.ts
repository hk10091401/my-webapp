// 오피스 시뮬레이션 — 하루 일정, 직원 이동, 업무 진행을 모두 여기서 돌립니다.
// 화면(React)은 snapshot()으로 상태를 읽고, 캔버스는 agents를 직접 읽습니다.

import type { Department, OfficeConfig } from "../config/types";
import { findPath } from "./path";
import { buildWorld, roomAt, type Facing, type Pt, type Seat, type World } from "./world";

// ── 타입 ────────────────────────────────────────────────
export type TaskStatus = "대기" | "지시 전달 중" | "진행 중" | "보고 중" | "승인 대기" | "완료";
export type TaskSize = "small" | "medium" | "large";

export type Task = {
  id: string;
  title: string;
  deptId: string;
  status: TaskStatus;
  progress: number;
  /** 팀 전원이 붙었을 때 걸리는 게임 시간(분) */
  effort: number;
  needsApproval: boolean;
  source: "me" | "routine";
  createdAt: number;
  doneLabel?: string;
};

export type JobKind = "work" | "meeting" | "break" | "report" | "leave" | "wander";

type Job = {
  kind: JobKind;
  label: string;
  target: Pt;
  facing?: Facing;
  /** 도착 후 머무는 시간(게임 분). 없으면 계속 머문다. */
  stay?: number;
  until?: number;
  onArrive?: () => void;
  onDone?: () => void;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  rank: "ceo" | "lead" | "member";
  deptId: string;
  hair: string;
  shirt: string;
  skin: string;
  thoughts: string[];
  seat: Seat;
  x: number;
  y: number;
  path: Pt[];
  facing: Facing;
  walked: number;
  present: boolean;
  arriveAt: number;
  leaveAt: number;
  job: Job | null;
  arrived: boolean;
  speech: string | null;
  speechKind: "say" | "think";
  speechUntil: number;
};

export type LogEntry = { id: number; time: string; icon: string; text: string };
export type ChatEntry = { id: number; from: "me" | "staff" | "system"; name: string; text: string };
export type DeptStatus = "대기" | "진행 중" | "승인 대기" | "완료" | "인원 없음";

export type Snapshot = {
  day: number;
  clock: string;
  minute: number;
  phase: string;
  running: boolean;
  paused: boolean;
  speed: number;
  dayComplete: boolean;
  tasks: Task[];
  logs: LogEntry[];
  chat: ChatEntry[];
  deptStatus: Record<string, DeptStatus>;
  present: number;
  total: number;
};

// ── 상수 ────────────────────────────────────────────────
const SKINS = ["#f6d2b8", "#eec19f", "#d9a27c", "#f9dcc8"];
/** 1배속에서 게임 1분 = 실제 0.5초 (하루 9시간 ≈ 4분 30초) */
const MINUTES_PER_SECOND = 2;
const WALK_TILES_PER_SECOND = 6;
const EFFORT: Record<TaskSize, number> = { small: 60, medium: 150, large: 300 };
const TASKS_KEY = "my-office:tasks:v1";

export const SIZE_LABEL: Record<TaskSize, string> = { small: "가볍게", medium: "보통", large: "크게" };

export function clockText(minute: number) {
  const m = Math.max(0, Math.floor(minute));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// ── 엔진 ────────────────────────────────────────────────
export class Office {
  readonly config: OfficeConfig;
  readonly world: World;
  readonly agents: Agent[] = [];
  readonly agentById = new Map<string, Agent>();
  readonly me: Agent;

  minute: number;
  day = 0;
  running = false;
  paused = false;
  speed = 1;
  dayComplete = false;
  /** 실제 경과 시간(초) — 말풍선 표시 시간 계산용 */
  realTime = 0;

  tasks: Task[] = [];
  logs: LogEntry[] = [];
  chat: ChatEntry[] = [];

  private seq = 1;
  private firedEvents = new Set<string>();
  private lastWholeMinute = -1;
  private onDayEnd: (() => void) | null = null;
  private onTasksChange: ((tasks: Task[]) => void) | null = null;

  constructor(config: OfficeConfig, savedTasks: Task[] = []) {
    this.config = config;
    const sizes = new Map<string, number>();
    for (const s of config.staff) sizes.set(s.deptId, (sizes.get(s.deptId) ?? 0) + 1);
    this.world = buildWorld(config.departments, sizes);
    this.minute = config.openAt - 30;

    this.me = this.makeAgent({
      id: "me",
      name: config.me.name,
      role: config.me.title,
      rank: "ceo",
      deptId: "ceo",
      hair: config.me.hair,
      shirt: config.me.shirt,
      thoughts: ["오늘 결정할 건 하나만 남기자.", "다들 잘하고 있네.", "커피 한 잔 할까."],
      seat: this.world.ceoSeat,
      index: 0,
    });

    const perDept = new Map<string, number>();
    config.staff.forEach((s, i) => {
      if (!this.world.deptRoom.has(s.deptId)) return;
      const room = this.world.deptRoom.get(s.deptId)!;
      const n = perDept.get(s.deptId) ?? 0;
      perDept.set(s.deptId, n + 1);
      this.makeAgent({ ...s, seat: room.seats[n % room.seats.length], index: i + 1 });
    });

    // 저장된 내 지시 중 아직 끝나지 않은 일은 다음 날로 이어진다
    this.tasks = savedTasks
      .filter((t) => t.source === "me" && this.world.deptRoom.has(t.deptId))
      .map((t) => ({ ...t, status: settle(t.status) }));
    this.seq = this.tasks.reduce((max, t) => Math.max(max, Number(t.id.split("-")[1]) || 0), 0) + 1;

    this.pushChat(
      "system",
      "오피스",
      `${config.officeName}에 오신 걸 환영해요. ‘출근시키기’를 누르면 하루가 시작됩니다.\n아래 지시창에 “디자인팀 배너 만들어줘”처럼 적으면 해당 팀에 일이 들어가요.`,
    );
  }

  static loadTasks(): Task[] {
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      return raw ? (JSON.parse(raw) as Task[]) : [];
    } catch {
      return [];
    }
  }

  setDayEndHandler(fn: (() => void) | null) {
    this.onDayEnd = fn;
  }

  setTasksHandler(fn: ((tasks: Task[]) => void) | null) {
    this.onTasksChange = fn;
  }

  // ── 직원 생성 ──
  private makeAgent(seed: {
    id: string;
    name: string;
    role: string;
    rank: Agent["rank"];
    deptId: string;
    hair: string;
    shirt: string;
    thoughts: string[];
    seat: Seat;
    index: number;
  }): Agent {
    const agent: Agent = {
      id: seed.id,
      name: seed.name,
      role: seed.role,
      rank: seed.rank,
      deptId: seed.deptId,
      hair: seed.hair,
      shirt: seed.shirt,
      skin: SKINS[seed.index % SKINS.length],
      thoughts: seed.thoughts.length ? seed.thoughts : ["오늘도 화이팅."],
      seat: seed.seat,
      x: this.world.entrance.x,
      y: this.world.entrance.y,
      path: [],
      facing: "up",
      walked: 0,
      present: false,
      arriveAt: 0,
      leaveAt: 0,
      job: null,
      arrived: false,
      speech: null,
      speechKind: "say",
      speechUntil: 0,
    };
    this.agents.push(agent);
    this.agentById.set(agent.id, agent);
    return agent;
  }

  dept(id: string): Department | undefined {
    return this.config.departments.find((d) => d.id === id);
  }

  team(deptId: string) {
    return this.agents.filter((a) => a.deptId === deptId);
  }

  lead(deptId: string): Agent | undefined {
    const team = this.team(deptId);
    return team.find((a) => a.rank === "lead") ?? team[0];
  }

  private assistant(): Agent {
    return this.lead(this.config.assistantDeptId) ?? this.agents.find((a) => a.rank === "lead") ?? this.me;
  }

  // ── 하루 진행 ──
  startDay() {
    this.day += 1;
    this.running = true;
    this.paused = false;
    this.dayComplete = false;
    this.minute = this.config.openAt - 30;
    this.lastWholeMinute = -1;
    this.firedEvents.clear();

    this.tasks = this.tasks.filter((t) => t.source === "me" && t.status !== "완료");
    for (const dept of this.config.departments) {
      if (!dept.routine.trim() || !this.team(dept.id).length) continue;
      this.tasks.push(this.newTask(dept.routine, dept.id, "routine", Math.round(rand(110, 210)), false));
    }
    this.emitTasks();

    for (const a of this.agents) {
      a.present = false;
      a.job = null;
      a.path = [];
      a.speech = null;
      a.x = this.world.entrance.x;
      a.y = this.world.entrance.y;
      a.arriveAt = this.config.openAt - rand(28, 2);
      a.leaveAt = this.config.closeAt + rand(0, 25);
    }
    this.me.arriveAt = this.config.openAt - 30;

    this.log("🌅", `${this.day}일차 시작 — ${this.agents.length}명이 출근합니다`);
  }

  togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
  }

  setSpeed(value: number) {
    this.speed = value;
  }

  tick(dtReal: number) {
    const dt = Math.min(dtReal, 0.1);
    this.realTime += dt;
    if (!this.running || this.paused) return;

    const step = dt * this.speed;
    this.minute += step * MINUTES_PER_SECOND;

    const whole = Math.floor(this.minute);
    while (this.lastWholeMinute < whole) {
      this.lastWholeMinute = this.lastWholeMinute < 0 ? whole : this.lastWholeMinute + 1;
      this.everyMinute(this.lastWholeMinute);
    }

    for (const a of this.agents) this.moveAgent(a, step);
  }

  private everyMinute(m: number) {
    const { openAt, closeAt } = this.config;

    for (const a of this.agents) {
      if (!a.present && !this.dayComplete && m >= a.arriveAt && m < closeAt) {
        a.present = true;
        a.x = this.world.entrance.x;
        a.y = this.world.entrance.y;
        this.goHome(a);
      }
      if (a.present && a.job?.until !== undefined && a.arrived && m >= a.job.until) {
        const done = a.job.onDone;
        a.job = null;
        if (done) done();
        else this.goHome(a);
      }
      if (a.present && m >= a.leaveAt && a.job?.kind !== "leave" && a.job?.kind !== "report") {
        this.leave(a);
      }
    }

    this.once("standup", m >= openAt + 60, () => this.callMeeting("스탠드업 회의", 30));
    this.once("lunch", m >= 720 && m < 780 && openAt < 720, () => this.lunch());
    this.once("coffee", m >= 900 && m < closeAt - 60, () => this.coffee(false));
    this.once("wrap", m >= closeAt - 30, () => this.wrapUp());
    this.once("close", m >= closeAt, () => {
      this.log("🌙", `${clockText(closeAt)} 퇴근 시간입니다`);
      this.reconcileTasksAtClose();
    });

    if (m >= closeAt && this.agents.every((a) => !a.present)) this.endDay();
    else if (m >= closeAt + 90) this.endDay();

    if (m >= openAt && m < closeAt) this.workTasks();
    this.idleChatter();
  }

  private once(key: string, cond: boolean, fn: () => void) {
    if (cond && !this.firedEvents.has(key)) {
      this.firedEvents.add(key);
      fn();
    }
  }

  private endDay() {
    if (this.dayComplete) return;
    for (const a of this.agents) {
      a.present = false;
      a.job = null;
      a.path = [];
    }
    this.running = false;
    this.dayComplete = true;
    this.log("📋", "오늘 브리핑이 준비됐어요");
    this.onDayEnd?.();
  }

  private reconcileTasksAtClose() {
    for (const t of this.tasks) {
      const prev = t.status;
      t.status = settle(t.status);
      if (prev !== t.status) t.progress = Math.min(t.progress, 0.999);
    }
    this.emitTasks();
  }

  // ── 이동 ──
  private send(a: Agent, job: Job) {
    const from = { x: Math.round(a.x), y: Math.round(a.y) };
    a.job = job;
    a.arrived = false;
    a.path = findPath(this.world, from, job.target);
    // 목적지가 막혔다면(가구 위 자리 등) 제자리에서 바로 도착 처리한다
    if (!a.path.length && (from.x !== job.target.x || from.y !== job.target.y)) {
      a.x = job.target.x;
      a.y = job.target.y;
    }
  }

  private moveAgent(a: Agent, step: number) {
    if (!a.present) return;
    let budget = step * WALK_TILES_PER_SECOND;
    while (budget > 0 && a.path.length) {
      const next = a.path[0];
      const dx = next.x - a.x;
      const dy = next.y - a.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dx !== 0 || dy !== 0) {
        a.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      }
      if (dist <= budget) {
        a.x = next.x;
        a.y = next.y;
        a.path.shift();
        budget -= dist;
        a.walked += dist;
      } else {
        a.x += Math.sign(dx) * Math.min(Math.abs(dx), budget);
        a.y += Math.sign(dy) * Math.min(Math.abs(dy), budget);
        a.walked += budget;
        budget = 0;
      }
    }

    if (!a.path.length && a.job && !a.arrived) {
      a.arrived = true;
      if (a.job.facing) a.facing = a.job.facing;
      if (a.job.stay !== undefined) a.job.until = this.minute + a.job.stay;
      if (a.job.kind === "leave") {
        a.present = false;
        a.job = null;
        return;
      }
      a.job.onArrive?.();
    }
  }

  isWalking(a: Agent) {
    return a.path.length > 0;
  }

  goHome(a: Agent) {
    this.send(a, {
      kind: "work",
      label: a.rank === "ceo" ? "대표실에서 결재 중" : "자리에서 업무 중",
      target: a.seat,
      facing: a.seat.facing,
    });
  }

  private leave(a: Agent) {
    this.send(a, { kind: "leave", label: "퇴근하는 중", target: this.world.entrance });
    if (Math.random() < 0.35) this.say(a, pick(["수고하셨습니다!", "내일 봬요~", "오늘 끝!"]));
  }

  // ── 일정 이벤트 ──
  callMeeting(title: string, length: number) {
    if (!this.running) return false;
    const seats = [...this.world.meetingSeats];
    const attendees = [this.me, ...this.config.departments.map((d) => this.lead(d.id)).filter(Boolean)] as Agent[];
    let placed = 0;
    for (const a of attendees) {
      if (!a.present || a.job?.kind === "leave" || a.job?.kind === "report") continue;
      const seat = seats.shift();
      if (!seat) break;
      placed += 1;
      this.send(a, { kind: "meeting", label: `${title} 참석 중`, target: seat, facing: seat.facing, stay: length });
    }
    if (!placed) return false;
    this.log("💬", `${clockText(this.minute)} ${title} — 팀장 ${placed - 1}명 참석`);
    window.setTimeout(() => this.say(this.me, "오늘 각 팀 핵심 하나씩만 말해주세요."), 2200);
    return true;
  }

  private lunch() {
    this.log("🍱", "점심시간 — 다들 라운지로 모여요");
    for (const a of this.agents) {
      if (!a.present || a.job?.kind === "leave" || a.job?.kind === "report") continue;
      this.toLounge(a, 780 - this.minute + rand(-5, 5), "점심 먹는 중");
    }
  }

  coffee(all: boolean) {
    if (!this.running) return false;
    let n = 0;
    for (const a of this.agents) {
      if (!a.present || a.job?.kind === "leave" || a.job?.kind === "report") continue;
      if (!all && Math.random() > 0.35) continue;
      n += 1;
      this.toLounge(a, rand(15, 25), "커피 마시는 중");
    }
    if (n) this.log("☕", `${clockText(this.minute)} 커피 타임 — ${n}명이 라운지에`);
    return n > 0;
  }

  private toLounge(a: Agent, stay: number, label: string) {
    const taken = new Set(
      this.agents.filter((o) => o !== a && o.job?.kind === "break").map((o) => `${o.job!.target.x},${o.job!.target.y}`),
    );
    const free = this.world.lounge.spots.filter((p) => !taken.has(`${p.x},${p.y}`));
    const spot = pick(free.length ? free : this.world.lounge.spots);
    this.send(a, {
      kind: "break",
      label,
      target: spot,
      stay,
      facing: pick<Facing>(["left", "right", "down"]),
      onArrive: () => {
        if (Math.random() < 0.3) this.think(a, pick(["오늘 점심 뭐 먹지?", "아 커피 맛있다", "잠깐 숨 돌리기", ...a.thoughts]));
      },
    });
  }

  private wrapUp() {
    const helper = this.assistant();
    if (!helper.present) return;
    const spot = this.world.reportSpots[0];
    this.send(helper, {
      kind: "report",
      label: "하루 마무리 보고 중",
      target: spot,
      facing: "up",
      stay: 15,
      onArrive: () => this.say(helper, "오늘 정리해서 브리핑 올릴게요."),
    });
    this.log("📝", `${helper.name}이(가) 하루 마무리 보고를 하러 대표실로 갑니다`);
  }

  leaveNow() {
    if (!this.running) return false;
    for (const a of this.agents) {
      if (a.present) a.leaveAt = this.minute + rand(0, 6);
    }
    this.log("🏃", "대표 지시로 오늘은 일찍 퇴근해요");
    return true;
  }

  // ── 업무 ──
  private newTask(title: string, deptId: string, source: Task["source"], effort: number, needsApproval: boolean): Task {
    return {
      id: `t-${this.seq++}`,
      title,
      deptId,
      status: "대기",
      progress: 0,
      effort,
      needsApproval,
      source,
      createdAt: Date.now(),
    };
  }

  addTask(title: string, deptId: string, size: TaskSize, needsApproval: boolean) {
    const task = this.newTask(title.trim(), deptId, "me", EFFORT[size], needsApproval);
    this.tasks.push(task);
    const dept = this.dept(deptId);
    this.log("📌", `${dept?.icon ?? ""} ${dept?.name ?? ""}에 새 업무 — ${task.title}`);
    this.emitTasks();
    return task;
  }

  removeTask(id: string) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.emitTasks();
  }

  approve(id: string) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.status !== "승인 대기") return;
    task.status = "완료";
    task.doneLabel = `${this.day}일차 ${clockText(this.minute)}`;
    const lead = this.lead(task.deptId);
    this.log("✅", `승인 — ${task.title}`);
    if (lead) {
      this.pushChat("staff", lead.name, `승인 감사합니다! ‘${task.title}’ 마무리할게요.`);
      if (lead.present) this.say(lead, "승인 났다!");
    }
    this.emitTasks();
  }

  requestChanges(id: string) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.status !== "승인 대기") return;
    task.status = "진행 중";
    task.progress = 0.6;
    const lead = this.lead(task.deptId);
    this.log("↩️", `수정 요청 — ${task.title}`);
    if (lead) this.pushChat("staff", lead.name, `알겠습니다. ‘${task.title}’ 다시 다듬어 올릴게요.`);
    this.emitTasks();
  }

  private workTasks() {
    let changed = false;
    for (const dept of this.config.departments) {
      const team = this.team(dept.id);
      if (!team.length) continue;
      const lead = this.lead(dept.id)!;
      const mine = this.tasks.filter((t) => t.deptId === dept.id);
      const active = mine.find((t) => t.status === "진행 중" || t.status === "지시 전달 중" || t.status === "보고 중");

      if (!active) {
        const next =
          mine.find((t) => t.status === "대기" && t.source === "me") ?? mine.find((t) => t.status === "대기");
        if (!next || !this.available(lead)) continue;
        if (next.source === "routine") {
          next.status = "진행 중";
          changed = true;
          continue;
        }
        next.status = "지시 전달 중";
        changed = true;
        this.toCeo(lead, "지시 받으러 대표실에 가는 중", () => {
          this.say(lead, `‘${short(next.title)}’ 맡겠습니다!`);
        }, () => {
          if (next.status === "지시 전달 중") next.status = "진행 중";
          this.pushChat("staff", lead.name, `${dept.icon} ${dept.name}에서 ‘${next.title}’ 시작했어요.`);
          this.emitTasks();
          this.goHome(lead);
        });
        continue;
      }

      if (active.status !== "진행 중") continue;

      const working = team.filter((a) => a.present && a.job?.kind === "work" && a.arrived).length;
      if (working && active.progress < 1) {
        active.progress = Math.min(1, active.progress + working / team.length / active.effort);
        changed = true;
      }
      if (active.progress >= 1) {
        if (active.source === "routine") {
          active.status = "완료";
          active.doneLabel = `${this.day}일차 ${clockText(this.minute)}`;
          this.log("✔️", `${dept.icon} ${dept.name} — ${active.title} 완료`);
          changed = true;
        } else if (this.available(lead)) {
          active.status = "보고 중";
          changed = true;
          this.toCeo(lead, "결과 보고하러 가는 중", () => {
            this.say(lead, active.needsApproval ? "확인 부탁드려요!" : "끝났습니다!");
          }, () => {
            if (active.status !== "보고 중") return this.goHome(lead);
            if (active.needsApproval) {
              active.status = "승인 대기";
              this.log("🔔", `승인 요청 — ${active.title}`);
              this.pushChat("staff", lead.name, `‘${active.title}’ 끝냈어요. 확인하시고 승인해 주세요.`);
            } else {
              active.status = "완료";
              active.doneLabel = `${this.day}일차 ${clockText(this.minute)}`;
              this.log("🎉", `${dept.icon} ${dept.name} — ${active.title} 완료`);
              this.pushChat("staff", lead.name, `‘${active.title}’ 완료했습니다.`);
            }
            this.emitTasks();
            this.goHome(lead);
          });
        }
      }
    }
    if (changed) this.emitTasks(true);
  }

  private available(a: Agent) {
    return a.present && a.job?.kind === "work" && a.arrived;
  }

  private toCeo(a: Agent, label: string, onArrive: () => void, onDone: () => void) {
    const taken = new Set(
      this.agents.filter((o) => o !== a && o.job?.kind === "report").map((o) => `${o.job!.target.x},${o.job!.target.y}`),
    );
    const spot = this.world.reportSpots.find((p) => !taken.has(`${p.x},${p.y}`)) ?? this.world.reportSpots[0];
    this.send(a, { kind: "report", label, target: spot, facing: "up", stay: 12, onArrive, onDone });
  }

  private idleChatter() {
    for (const a of this.agents) {
      if (!a.present || this.isWalking(a) || a.speech) continue;
      if (a.job?.kind === "work" && a.arrived) {
        if (Math.random() < 0.0035) this.think(a, pick(a.thoughts));
        // 가끔 팀원이 자리에서 일어나 방 안을 서성인다
        if (a.rank === "member" && Math.random() < 0.0012) {
          const room = this.world.deptRoom.get(a.deptId);
          if (room) {
            this.send(a, { kind: "wander", label: "잠깐 기지개 켜는 중", target: pick(room.spots), stay: rand(4, 9) });
          }
        }
      } else if (a.job?.kind === "break" && a.arrived && Math.random() < 0.006) {
        this.say(a, pick(["이번 주 너무 빠르다", "그거 봤어요?", "라떼 최고", "오후에 회의 있죠?", ...a.thoughts]));
      }
    }
  }

  // ── 말풍선·기록 ──
  say(a: Agent, text: string, seconds = 3.2) {
    a.speech = text;
    a.speechKind = "say";
    a.speechUntil = this.realTime + seconds;
  }

  think(a: Agent, text: string) {
    a.speech = text;
    a.speechKind = "think";
    a.speechUntil = this.realTime + 3;
  }

  expireSpeech() {
    for (const a of this.agents) if (a.speech && this.realTime > a.speechUntil) a.speech = null;
  }

  log(icon: string, text: string) {
    this.logs = [{ id: this.seq++, time: clockText(this.minute), icon, text }, ...this.logs].slice(0, 80);
  }

  pushChat(from: ChatEntry["from"], name: string, text: string) {
    this.chat = [...this.chat, { id: this.seq++, from, name, text }].slice(-60);
  }

  private lastEmit = 0;
  private emitTasks(throttle = false) {
    const now = this.realTime;
    if (throttle && now - this.lastEmit < 1) return;
    this.lastEmit = now;
    this.onTasksChange?.(this.tasks);
  }

  // ── 지시창 ──
  command(raw: string) {
    const text = raw.trim();
    if (!text) return;
    this.pushChat("me", this.config.me.name, text);
    const lower = text.toLowerCase();

    const named = this.agents.find((a) => a.rank !== "ceo" && text.includes(a.name));
    if (named && /뭐\s?해|상태|어디|뭐하/.test(text)) {
      this.pushChat("staff", named.name, this.describe(named));
      if (named.present) this.say(named, "저요?");
      return;
    }

    if (/회의/.test(text) && !/회의록/.test(text)) {
      if (!this.callMeeting("긴급 회의", 25)) this.reply("지금은 출근한 팀장이 없어요. 하루를 먼저 시작해 주세요.");
      else this.reply("팀장들 회의실로 모입니다.");
      return;
    }
    if (/커피|휴식|쉬자|쉬어/.test(text)) {
      if (!this.coffee(true)) this.reply("지금은 사무실에 아무도 없어요.");
      else this.reply("다 같이 라운지로 갑니다 ☕");
      return;
    }
    if (/퇴근/.test(text)) {
      if (!this.leaveNow()) this.reply("이미 다들 퇴근했어요.");
      else this.reply("오늘은 여기까지! 다들 정리하고 퇴근할게요.");
      return;
    }
    if (/현황|브리핑|보고해|상황/.test(text)) {
      this.reply(this.summary());
      return;
    }

    const dept = this.matchDept(lower);
    if (dept || /해줘|해 줘|부탁|만들어|정리|써줘|찾아/.test(text)) {
      const target = dept ?? this.dept(this.config.assistantDeptId) ?? this.config.departments[0];
      const title = cleanTitle(text, target);
      if (!this.team(target.id).length) {
        this.reply(`${target.name}에는 아직 직원이 없어요. 설정 탭에서 직원을 먼저 넣어주세요.`);
        return;
      }
      this.addTask(title, target.id, "medium", false);
      const lead = this.lead(target.id)!;
      this.pushChat("staff", lead.name, `${target.icon} 접수했어요 — ‘${title}’. ${this.running ? "곧 지시 받으러 갈게요." : "출근하면 바로 시작할게요."}`);
      return;
    }

    this.reply(
      "이렇게 말해보세요.\n· “마케팅팀 이번 주 게시물 정리해줘” — 업무 지시\n· “회의 소집” · “커피 타임” · “퇴근”\n· “현황 알려줘” · “윤하람 뭐해?”",
    );
  }

  private reply(text: string) {
    this.pushChat("staff", this.assistant().name, text);
  }

  private matchDept(lower: string): Department | undefined {
    for (const d of this.config.departments) {
      const words = [d.name, d.name.replace(/(팀|실|랩|스튜디오)$/, ""), ...d.keywords.split(",")]
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 2);
      if (words.some((w) => lower.includes(w))) return d;
    }
    for (const a of this.agents) if (a.rank !== "ceo" && lower.includes(a.name.toLowerCase())) return this.dept(a.deptId);
    return undefined;
  }

  describe(a: Agent): string {
    if (!a.present) return this.dayComplete ? "오늘은 퇴근했어요. 내일 봬요!" : "아직 출근 전이에요.";
    const task = this.tasks.find((t) => t.deptId === a.deptId && (t.status === "진행 중" || t.status === "보고 중"));
    const where = roomAt(this.world, Math.round(a.x), Math.round(a.y));
    const parts = [`지금 ${a.job?.label ?? "잠깐 쉬는 중"}이에요${where ? ` (${where.name})` : ""}.`];
    if (task) parts.push(`우리 팀은 ‘${task.title}’ ${Math.round(task.progress * 100)}% 진행 중입니다.`);
    return parts.join(" ");
  }

  summary(): string {
    const by = (s: TaskStatus) => this.tasks.filter((t) => t.status === s);
    const lines = [`${clockText(this.minute)} 현황입니다.`];
    const working = by("진행 중");
    if (working.length) {
      lines.push(
        "진행 중: " +
          working.map((t) => `${this.dept(t.deptId)?.name} ${Math.round(t.progress * 100)}%`).join(" · "),
      );
    }
    const waiting = by("승인 대기");
    if (waiting.length) lines.push(`승인 기다리는 일 ${waiting.length}건 — 오른쪽 ‘결재함’에서 확인해 주세요.`);
    lines.push(`오늘 끝낸 일 ${by("완료").length}건 · 대기 ${by("대기").length}건 · 출근 ${this.presentCount()}명.`);
    return lines.join("\n");
  }

  presentCount() {
    return this.agents.filter((a) => a.present).length;
  }

  phase(): string {
    const m = this.minute;
    const { openAt, closeAt } = this.config;
    if (this.dayComplete) return "업무 종료";
    if (!this.running) return this.day ? "일시 정지" : "출근 전";
    if (m < openAt) return "출근 중";
    if (m >= closeAt) return "퇴근 중";
    if (m >= openAt + 60 && m < openAt + 90) return "스탠드업 회의";
    if (m >= 720 && m < 780) return "점심시간";
    if (m >= 900 && m < 920) return "커피 타임";
    if (m >= closeAt - 30) return "하루 마무리";
    return "업무 시간";
  }

  deptStatus(): Record<string, DeptStatus> {
    const out: Record<string, DeptStatus> = {};
    for (const d of this.config.departments) {
      const mine = this.tasks.filter((t) => t.deptId === d.id);
      if (!this.team(d.id).length) out[d.id] = "인원 없음";
      else if (mine.some((t) => t.status === "승인 대기")) out[d.id] = "승인 대기";
      else if (mine.some((t) => t.status === "진행 중" || t.status === "지시 전달 중" || t.status === "보고 중"))
        out[d.id] = "진행 중";
      else if (mine.length && mine.every((t) => t.status === "완료")) out[d.id] = "완료";
      else out[d.id] = "대기";
    }
    return out;
  }

  snapshot(): Snapshot {
    return {
      day: this.day,
      clock: clockText(this.minute),
      minute: this.minute,
      phase: this.phase(),
      running: this.running,
      paused: this.paused,
      speed: this.speed,
      dayComplete: this.dayComplete,
      tasks: this.tasks.map((t) => ({ ...t })),
      logs: this.logs,
      chat: this.chat,
      deptStatus: this.deptStatus(),
      present: this.presentCount(),
      total: this.agents.length,
    };
  }

  static persistTasks(tasks: Task[]) {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks.filter((t) => t.source === "me")));
    } catch {
      // 저장이 막힌 환경에서는 새로고침하면 사라집니다.
    }
  }
}

/** 하루가 끊긴 시점에 이동 중이던 업무를 다음 날 이어받을 수 있는 상태로 되돌린다 */
function settle(status: TaskStatus): TaskStatus {
  if (status === "지시 전달 중") return "대기";
  if (status === "보고 중") return "진행 중";
  return status;
}

function short(title: string) {
  return title.length > 14 ? `${title.slice(0, 13)}…` : title;
}

/** "디자인팀 배너 시안 만들어줘" → "배너 시안 만들기" */
function cleanTitle(text: string, dept: Department) {
  const stems = [dept.name, dept.name.replace(/(팀|실|랩|스튜디오)$/, ""), ...dept.keywords.split(",")]
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  const words = text.trim().split(/\s+/);
  // 맨 앞 단어가 팀을 부르는 말이면 뗀다 (디자인팀, 디자인팀에, 마케팅팀한테 …)
  const first = words[0];
  if (words.length > 1 && (first === dept.name || stems.some((st) => first.startsWith(st) && first.length > st.length))) {
    words.shift();
  }
  let t = words.join(" ");
  t = t
    .replace(/만들어\s?(줘|주세요)[.!~]*$/, "만들기")
    .replace(/써\s?(줘|주세요)[.!~]*$/, "쓰기")
    .replace(/찾아\s?(줘|주세요)[.!~]*$/, "찾기")
    .replace(/정리해\s?(줘|주세요)[.!~]*$/, "정리")
    .replace(/\s*(해\s?줘|해\s?주세요|부탁해요|부탁해|부탁)[.!~]*$/, "")
    .trim();
  return t || text.trim();
}
