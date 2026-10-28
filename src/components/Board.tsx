import { useState } from "react";
import type { DeptStatus, Office, Snapshot, Task, TaskStatus } from "../engine/sim";
import { STATUS_COLOR } from "../engine/render";
import Avatar from "./Avatar";

type Props = { office: Office; snap: Snapshot; onPick: (id: string) => void; onChange: () => void };

const FILTERS: ("전체" | DeptStatus)[] = ["전체", "진행 중", "승인 대기", "대기", "완료"];
const ORDER: TaskStatus[] = ["승인 대기", "보고 중", "진행 중", "지시 전달 중", "대기", "완료"];

export default function Board({ office, snap, onPick, onChange }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const all = snap.tasks;
  const count = (s: TaskStatus) => all.filter((t) => t.status === s).length;
  const depts = office.config.departments.filter((d) => filter === "전체" || snap.deptStatus[d.id] === filter);

  return (
    <div className="board">
      <div className="board-top">
        <dl className="tally">
          <div>
            <dt>진행 중</dt>
            <dd>{count("진행 중") + count("지시 전달 중") + count("보고 중")}</dd>
          </div>
          <div className={count("승인 대기") ? "hot" : ""}>
            <dt>승인 대기</dt>
            <dd>{count("승인 대기")}</dd>
          </div>
          <div>
            <dt>대기</dt>
            <dd>{count("대기")}</dd>
          </div>
          <div>
            <dt>완료</dt>
            <dd>{count("완료")}</dd>
          </div>
        </dl>
        <div className="seg" role="group" aria-label="팀 상태로 거르기">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {depts.length ? (
        <div className="teams">
          {depts.map((d) => {
            const st = snap.deptStatus[d.id];
            const team = office.team(d.id);
            const tasks = all
              .filter((t) => t.deptId === d.id)
              .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
            return (
              <article className="team" key={d.id} style={{ "--team": d.color } as React.CSSProperties}>
                <header>
                  <h3>
                    <span aria-hidden="true">{d.icon}</span> {d.name}
                  </h3>
                  <span className="status">
                    <i style={{ background: STATUS_COLOR[st] }} />
                    {st}
                  </span>
                </header>
                <ul className="members">
                  {team.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => onPick(a.id)} title={`${a.name} · ${a.role}`}>
                        <Avatar hair={a.hair} shirt={a.shirt} skin={a.skin} size={30} />
                        <span>{a.name}</span>
                      </button>
                    </li>
                  ))}
                  {!team.length ? <li className="empty">설정에서 직원을 넣어주세요</li> : null}
                </ul>
                {tasks.length ? (
                  <ul className="tasks">
                    {tasks.map((t) => (
                      <TaskRow key={t.id} task={t} office={office} onChange={onChange} />
                    ))}
                  </ul>
                ) : (
                  <p className="empty">맡긴 일이 없어요.</p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty big">‘{filter}’ 상태인 팀이 없어요.</p>
      )}
    </div>
  );
}

function TaskRow({ task, office, onChange }: { task: Task; office: Office; onChange: () => void }) {
  const pct = Math.round(task.progress * 100);
  return (
    <li className={`task s-${ORDER.indexOf(task.status)}`}>
      <div className="task-line">
        <b>{task.title}</b>
        <span className="tag">{task.source === "routine" ? "기본 업무" : task.needsApproval ? "승인 필요" : "내 지시"}</span>
      </div>
      <div className="task-line">
        <span className="bar" aria-label={`진행률 ${pct}%`}>
          <i style={{ width: `${pct}%` }} />
        </span>
        <small>{task.status === "완료" ? `완료 · ${task.doneLabel ?? ""}` : `${task.status} · ${pct}%`}</small>
        {task.source === "me" && task.status !== "보고 중" && task.status !== "지시 전달 중" ? (
          <button
            className="link"
            onClick={() => {
              office.removeTask(task.id);
              onChange();
            }}
          >
            {task.status === "완료" ? "지우기" : "취소"}
          </button>
        ) : null}
      </div>
    </li>
  );
}
