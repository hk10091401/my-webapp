import { useEffect, useRef } from "react";
import type { Agent, Office, Snapshot } from "../engine/sim";
import Avatar from "./Avatar";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export function ProfileModal({
  agent,
  office,
  onClose,
  onAsk,
}: {
  agent: Agent;
  office: Office;
  onClose: () => void;
  onAsk: (agent: Agent) => void;
}) {
  const dept = office.dept(agent.deptId);
  const task = office.tasks.find((t) => t.deptId === agent.deptId && t.status === "진행 중");
  return (
    <Dialog title={`${agent.name} 프로필`} onClose={onClose}>
      <div className="profile">
        <Avatar hair={agent.hair} shirt={agent.shirt} skin={agent.skin} size={88} crown={agent.rank === "ceo"} />
        <div>
          <h2>{agent.name}</h2>
          <p className="muted">
            {agent.rank === "ceo" ? agent.role : `${dept?.icon ?? ""} ${dept?.name ?? ""} · ${agent.role}`}
            {agent.rank === "lead" ? " · 팀장" : ""}
          </p>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>지금</dt>
          <dd>{agent.present ? agent.job?.label ?? "잠깐 쉬는 중" : office.dayComplete ? "퇴근함" : "출근 전"}</dd>
        </div>
        {task ? (
          <div>
            <dt>팀 업무</dt>
            <dd>
              {task.title} · {Math.round(task.progress * 100)}%
            </dd>
          </div>
        ) : null}
        <div>
          <dt>요즘 생각</dt>
          <dd>
            {agent.thoughts.map((t) => (
              <q key={t}>{t}</q>
            ))}
          </dd>
        </div>
      </dl>
      {agent.rank !== "ceo" ? (
        <button className="btn primary wide" onClick={() => onAsk(agent)}>
          {agent.name}에게 지금 뭐 하는지 묻기
        </button>
      ) : null}
    </Dialog>
  );
}

export function BriefingModal({ office, snap, onClose }: { office: Office; snap: Snapshot; onClose: () => void }) {
  const done = snap.tasks.filter((t) => t.status === "완료");
  const waiting = snap.tasks.filter((t) => t.status === "승인 대기");
  const carry = snap.tasks.filter((t) => t.source === "me" && t.status !== "완료" && t.status !== "승인 대기");
  const name = (id: string) => office.dept(id)?.name ?? "";
  return (
    <Dialog title="하루 브리핑" onClose={onClose}>
      <h2>{snap.day}일차 브리핑</h2>
      <p className="muted">
        {office.lead(office.config.assistantDeptId)?.name ?? "비서실"}이(가) 정리했어요.
      </p>
      <section className="brief">
        <h3>끝낸 일 {done.length}건</h3>
        {done.length ? (
          <ul>
            {done.map((t) => (
              <li key={t.id}>
                <b>{name(t.deptId)}</b> {t.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">오늘 끝난 일은 없어요.</p>
        )}
      </section>
      {waiting.length ? (
        <section className="brief hot">
          <h3>내 승인이 필요한 일 {waiting.length}건</h3>
          <ul>
            {waiting.map((t) => (
              <li key={t.id}>
                <b>{name(t.deptId)}</b> {t.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="brief">
        <h3>내일로 넘어가는 일 {carry.length}건</h3>
        {carry.length ? (
          <ul>
            {carry.map((t) => (
              <li key={t.id}>
                <b>{name(t.deptId)}</b> {t.title} · {Math.round(t.progress * 100)}%
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">밀린 일 없이 깔끔하게 끝났어요.</p>
        )}
      </section>
      <button className="btn primary wide" onClick={onClose}>
        확인
      </button>
    </Dialog>
  );
}
