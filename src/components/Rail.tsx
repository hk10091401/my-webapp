import { useEffect, useRef, useState } from "react";
import type { Office, Snapshot, TaskSize } from "../engine/sim";
import { SIZE_LABEL } from "../engine/sim";

type Props = { office: Office; snap: Snapshot; onChange: () => void };

export default function Rail({ office, snap, onChange }: Props) {
  const approvals = snap.tasks.filter((t) => t.status === "승인 대기");

  return (
    <aside className="rail">
      <section className="panel" aria-labelledby="inbox-title">
        <header className="panel-head">
          <h2 id="inbox-title">결재함</h2>
          <span className={`count ${approvals.length ? "hot" : ""}`}>{approvals.length}</span>
        </header>
        {approvals.length ? (
          <ul className="approvals">
            {approvals.map((t) => {
              const dept = office.dept(t.deptId);
              return (
                <li key={t.id}>
                  <p>
                    <span aria-hidden="true">{dept?.icon}</span> {dept?.name}
                  </p>
                  <b>{t.title}</b>
                  <div className="row">
                    <button
                      className="btn small primary"
                      onClick={() => {
                        office.approve(t.id);
                        onChange();
                      }}
                    >
                      승인
                    </button>
                    <button
                      className="btn small"
                      onClick={() => {
                        office.requestChanges(t.id);
                        onChange();
                      }}
                    >
                      수정 요청
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty">결재할 일이 없어요. ‘승인 받기’를 켠 업무가 끝나면 여기로 올라옵니다.</p>
        )}
      </section>

      <NewTask office={office} onChange={onChange} />
      <Console office={office} snap={snap} onChange={onChange} />

      <section className="panel" aria-labelledby="log-title">
        <header className="panel-head">
          <h2 id="log-title">오늘 기록</h2>
        </header>
        {snap.logs.length ? (
          <ol className="log">
            {snap.logs.slice(0, 30).map((l) => (
              <li key={l.id}>
                <time>{l.time}</time>
                <span aria-hidden="true">{l.icon}</span>
                <p>{l.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">출근하면 사무실에서 일어난 일이 여기에 쌓여요.</p>
        )}
      </section>
    </aside>
  );
}

function NewTask({ office, onChange }: { office: Office; onChange: () => void }) {
  const depts = office.config.departments;
  const [title, setTitle] = useState("");
  const [deptId, setDeptId] = useState(depts[0]?.id ?? "");
  const [size, setSize] = useState<TaskSize>("medium");
  const [approval, setApproval] = useState(true);

  useEffect(() => {
    if (!depts.some((d) => d.id === deptId)) setDeptId(depts[0]?.id ?? "");
  }, [depts, deptId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !deptId) return;
    office.addTask(title, deptId, size, approval);
    setTitle("");
    onChange();
  };

  return (
    <section className="panel" aria-labelledby="new-title">
      <header className="panel-head">
        <h2 id="new-title">업무 맡기기</h2>
      </header>
      <form className="new-task" onSubmit={submit}>
        <label className="field">
          <span>할 일</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 다음 주 뉴스레터 초안" maxLength={60} />
        </label>
        <div className="row">
          <label className="field grow">
            <span>맡을 팀</span>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.icon} {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>분량</span>
            <select value={size} onChange={(e) => setSize(e.target.value as TaskSize)}>
              {(Object.keys(SIZE_LABEL) as TaskSize[]).map((k) => (
                <option key={k} value={k}>
                  {SIZE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} />
          끝나면 내 승인 받기
        </label>
        <button className="btn primary" type="submit" disabled={!title.trim()}>
          팀에 맡기기
        </button>
      </form>
    </section>
  );
}

const QUICK = ["현황 알려줘", "회의 소집", "커피 타임", "퇴근"];

function Console({ office, snap, onChange }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [snap.chat.length]);

  const send = (value: string) => {
    if (!value.trim()) return;
    office.command(value);
    setText("");
    onChange();
  };

  return (
    <section className="panel console" id="console" aria-labelledby="console-title">
      <header className="panel-head">
        <h2 id="console-title">지시창</h2>
      </header>
      <ol className="chat" ref={listRef} aria-live="polite">
        {snap.chat.map((c) => (
          <li key={c.id} className={`msg ${c.from}`}>
            <b>{c.name}</b>
            <p>{c.text}</p>
          </li>
        ))}
      </ol>
      <div className="chips">
        {QUICK.map((q) => (
          <button key={q} className="chip" onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="say"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          id="console-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="디자인팀 배너 시안 만들어줘"
          aria-label="팀에게 할 말"
        />
        <button className="btn primary" type="submit">
          보내기
        </button>
      </form>
    </section>
  );
}
