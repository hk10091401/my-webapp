import { useRef, useState } from "react";
import { DEFAULT_CONFIG, HAIR_COLORS, SHIRT_COLORS } from "../config/defaults";
import { isConfig } from "../config/storage";
import type { Department, OfficeConfig, Staff } from "../config/types";
import { MAX_TEAM_SIZE } from "../engine/world";
import Avatar from "./Avatar";

const FLOORS = ["#fff1c9", "#dcefff", "#f6e1f0", "#e3f5e8", "#ffe4d6", "#e6e6fb", "#efeedd", "#dff3f1"];
const MAX_TEAMS = 16;

type Props = { config: OfficeConfig; onSave: (config: OfficeConfig) => void; notify: (msg: string) => void };

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromTime = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function Settings({ config, onSave, notify }: Props) {
  const [draft, setDraft] = useState<OfficeConfig>(() => structuredClone(config));
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  const patch = (p: Partial<OfficeConfig>) => setDraft((d) => ({ ...d, ...p }));
  const patchDept = (id: string, p: Partial<Department>) =>
    setDraft((d) => ({ ...d, departments: d.departments.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const patchStaff = (id: string, p: Partial<Staff>) =>
    setDraft((d) => ({ ...d, staff: d.staff.map((x) => (x.id === id ? { ...x, ...p } : x)) }));

  const addDept = () =>
    setDraft((d) => ({
      ...d,
      departments: [
        ...d.departments,
        {
          id: uid("d"),
          name: "새 팀",
          icon: "⭐",
          routine: "",
          color: FLOORS[d.departments.length % FLOORS.length],
          keywords: "",
        },
      ],
    }));

  const removeDept = (id: string) =>
    setDraft((d) => {
      if (d.departments.length <= 1) return d;
      const departments = d.departments.filter((x) => x.id !== id);
      return {
        ...d,
        departments,
        staff: d.staff.filter((s) => s.deptId !== id),
        assistantDeptId: d.assistantDeptId === id ? departments[0].id : d.assistantDeptId,
      };
    });

  const moveDept = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      const list = [...d.departments];
      const i = list.findIndex((x) => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, departments: list };
    });

  const addStaff = (deptId: string) =>
    setDraft((d) => {
      const team = d.staff.filter((s) => s.deptId === deptId);
      const n = d.staff.length;
      return {
        ...d,
        staff: [
          ...d.staff,
          {
            id: uid("s"),
            deptId,
            rank: team.length ? "member" : "lead",
            name: "새 직원",
            role: team.length ? "팀원" : "팀장",
            hair: HAIR_COLORS[n % HAIR_COLORS.length],
            shirt: SHIRT_COLORS[(n * 3) % SHIRT_COLORS.length],
            thoughts: ["첫날이라 긴장돼요."],
          },
        ],
      };
    });

  const setLead = (s: Staff) =>
    setDraft((d) => ({
      ...d,
      staff: d.staff.map((x) =>
        x.deptId === s.deptId ? { ...x, rank: x.id === s.id ? "lead" : "member" } : x,
      ),
    }));

  const save = () => {
    const clean: OfficeConfig = {
      ...draft,
      officeName: draft.officeName.trim() || "나의 오피스",
      logo: [...(draft.logo.trim() || "◆")][0],
      closeAt: Math.max(draft.closeAt, draft.openAt + 180),
      departments: draft.departments.map((d) => ({ ...d, name: d.name.trim() || "이름 없는 팀" })),
      staff: draft.staff.map((s) => ({
        ...s,
        name: s.name.trim() || "이름 없음",
        thoughts: s.thoughts.map((t) => t.trim()).filter(Boolean),
      })),
    };
    onSave(clean);
    setDraft(structuredClone(clean));
    notify("저장했어요. 사무실을 새로 꾸몄습니다.");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-office.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isConfig(parsed)) throw new Error("shape");
      setDraft(parsed);
      notify("불러왔어요. 확인 후 ‘저장하기’를 눌러주세요.");
    } catch {
      notify("이 파일은 읽을 수 없어요. 여기서 내보낸 JSON 파일인지 확인해 주세요.");
    }
  };

  return (
    <div className="settings">
      <div className="save-bar">
        <p>{dirty ? "저장하지 않은 변경 사항이 있어요. 저장하면 오늘 하루가 처음부터 다시 시작됩니다." : "모든 변경 사항이 저장됐어요."}</p>
        <button className="btn" onClick={() => setDraft(structuredClone(config))} disabled={!dirty}>
          되돌리기
        </button>
        <button className="btn primary" onClick={save} disabled={!dirty}>
          저장하기
        </button>
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2>사무실</h2>
        </header>
        <div className="grid-form">
          <label className="field">
            <span>사무실 이름</span>
            <input value={draft.officeName} maxLength={24} onChange={(e) => patch({ officeName: e.target.value })} />
          </label>
          <label className="field narrow">
            <span>로고 글자</span>
            <input value={draft.logo} maxLength={4} onChange={(e) => patch({ logo: e.target.value })} />
          </label>
          <label className="field narrow">
            <span>출근</span>
            <input type="time" step={1800} value={toTime(draft.openAt)} onChange={(e) => patch({ openAt: fromTime(e.target.value) })} />
          </label>
          <label className="field narrow">
            <span>퇴근</span>
            <input type="time" step={1800} value={toTime(draft.closeAt)} onChange={(e) => patch({ closeAt: fromTime(e.target.value) })} />
          </label>
          <label className="field">
            <span>현황 보고를 맡을 팀</span>
            <select value={draft.assistantDeptId} onChange={(e) => patch({ assistantDeptId: e.target.value })}>
              {draft.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.icon} {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>나</h2>
        </header>
        <div className="grid-form with-avatar">
          <Avatar hair={draft.me.hair} shirt={draft.me.shirt} size={56} crown />
          <label className="field">
            <span>이름</span>
            <input value={draft.me.name} maxLength={12} onChange={(e) => patch({ me: { ...draft.me, name: e.target.value } })} />
          </label>
          <label className="field">
            <span>직함</span>
            <input value={draft.me.title} maxLength={24} onChange={(e) => patch({ me: { ...draft.me, title: e.target.value } })} />
          </label>
          <Swatches label="머리색" value={draft.me.hair} options={HAIR_COLORS} onPick={(hair) => patch({ me: { ...draft.me, hair } })} />
          <Swatches label="옷 색" value={draft.me.shirt} options={SHIRT_COLORS} onPick={(shirt) => patch({ me: { ...draft.me, shirt } })} />
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>팀과 직원</h2>
          <span className="muted">
            {draft.departments.length}/{MAX_TEAMS}팀 · 팀당 최대 {MAX_TEAM_SIZE}명
          </span>
        </header>
        <div className="dept-list">
          {draft.departments.map((d, i) => {
            const team = draft.staff.filter((s) => s.deptId === d.id);
            return (
              <article className="dept-edit" key={d.id} style={{ "--team": d.color } as React.CSSProperties}>
                <div className="dept-row">
                  <label className="field icon">
                    <span>아이콘</span>
                    <input value={d.icon} maxLength={4} onChange={(e) => patchDept(d.id, { icon: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>팀 이름</span>
                    <input value={d.name} maxLength={16} onChange={(e) => patchDept(d.id, { name: e.target.value })} />
                  </label>
                  <label className="field grow">
                    <span>매일 아침 기본 업무</span>
                    <input value={d.routine} maxLength={40} placeholder="비워두면 지시한 일만 해요" onChange={(e) => patchDept(d.id, { routine: e.target.value })} />
                  </label>
                  <label className="field grow">
                    <span>알아듣는 단어 (쉼표로 구분)</span>
                    <input value={d.keywords} maxLength={80} onChange={(e) => patchDept(d.id, { keywords: e.target.value })} />
                  </label>
                  <Swatches label="방 색" value={d.color} options={FLOORS} onPick={(color) => patchDept(d.id, { color })} />
                  <div className="dept-actions">
                    <button className="icon-btn" onClick={() => moveDept(d.id, -1)} disabled={i === 0} aria-label={`${d.name} 앞으로`}>
                      ↑
                    </button>
                    <button className="icon-btn" onClick={() => moveDept(d.id, 1)} disabled={i === draft.departments.length - 1} aria-label={`${d.name} 뒤로`}>
                      ↓
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => removeDept(d.id)}
                      disabled={draft.departments.length <= 1}
                      aria-label={`${d.name} 삭제`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <ul className="staff-list">
                  {team.map((s) => (
                    <li key={s.id} className="staff-edit">
                      <Avatar hair={s.hair} shirt={s.shirt} size={36} />
                      <label className="field">
                        <span>이름</span>
                        <input value={s.name} maxLength={10} onChange={(e) => patchStaff(s.id, { name: e.target.value })} />
                      </label>
                      <label className="field">
                        <span>역할</span>
                        <input value={s.role} maxLength={16} onChange={(e) => patchStaff(s.id, { role: e.target.value })} />
                      </label>
                      <label className="field grow">
                        <span>혼잣말 (한 줄에 하나)</span>
                        <textarea
                          rows={2}
                          value={s.thoughts.join("\n")}
                          onChange={(e) => patchStaff(s.id, { thoughts: e.target.value.split("\n") })}
                        />
                      </label>
                      <Swatches label="머리" value={s.hair} options={HAIR_COLORS} onPick={(hair) => patchStaff(s.id, { hair })} />
                      <Swatches label="옷" value={s.shirt} options={SHIRT_COLORS} onPick={(shirt) => patchStaff(s.id, { shirt })} />
                      <div className="dept-actions">
                        <button className={`pill ${s.rank === "lead" ? "on" : ""}`} onClick={() => setLead(s)} aria-pressed={s.rank === "lead"}>
                          팀장
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => setDraft((x) => ({ ...x, staff: x.staff.filter((y) => y.id !== s.id) }))}
                          aria-label={`${s.name} 내보내기`}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button className="btn small" onClick={() => addStaff(d.id)} disabled={team.length >= MAX_TEAM_SIZE}>
                  {team.length >= MAX_TEAM_SIZE ? "자리가 꽉 찼어요" : "직원 뽑기"}
                </button>
              </article>
            );
          })}
        </div>
        <button className="btn" onClick={addDept} disabled={draft.departments.length >= MAX_TEAMS}>
          팀 추가
        </button>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>백업</h2>
        </header>
        <p className="muted">설정은 이 브라우저에만 저장돼요. 다른 기기로 옮기려면 파일로 내보낸 뒤 불러오세요.</p>
        <div className="row wrap">
          <button className="btn" onClick={exportJson}>
            파일로 내보내기
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            파일 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = "";
            }}
          />
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm("기본 회사로 되돌릴까요? 저장하기를 눌러야 적용됩니다.")) setDraft(structuredClone(DEFAULT_CONFIG));
            }}
          >
            기본값으로 되돌리기
          </button>
        </div>
      </section>
    </div>
  );
}

function Swatches({ label, value, options, onPick }: { label: string; value: string; options: string[]; onPick: (v: string) => void }) {
  return (
    <fieldset className="swatches">
      <legend>{label}</legend>
      {options.map((c) => (
        <button
          key={c}
          type="button"
          className={c === value ? "on" : ""}
          style={{ background: c }}
          onClick={() => onPick(c)}
          aria-label={`${label} ${c}`}
          aria-pressed={c === value}
        />
      ))}
    </fieldset>
  );
}
