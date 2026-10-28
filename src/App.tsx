import { useCallback, useEffect, useMemo, useState } from "react";
import { loadConfig, saveConfig } from "./config/storage";
import type { OfficeConfig } from "./config/types";
import { Office, type Snapshot } from "./engine/sim";
import Board from "./components/Board";
import { BriefingModal, ProfileModal } from "./components/Modals";
import OfficeCanvas from "./components/OfficeCanvas";
import Rail from "./components/Rail";
import Settings from "./components/Settings";

type Tab = "office" | "board" | "settings";
const SPEEDS = [1, 2, 4, 8];

export default function App() {
  const [config, setConfig] = useState<OfficeConfig>(loadConfig);
  const office = useMemo(() => new Office(config, Office.loadTasks()), [config]);
  if (import.meta.env.DEV) (window as unknown as { office: Office }).office = office;
  const [snap, setSnap] = useState<Snapshot>(() => office.snapshot());
  const [tab, setTab] = useState<Tab>("office");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [toast, setToast] = useState("");

  const refresh = useCallback(() => setSnap(office.snapshot()), [office]);

  useEffect(() => {
    document.title = config.officeName;
  }, [config.officeName]);

  useEffect(() => {
    office.setDayEndHandler(() => setBriefing(true));
    office.setTasksHandler(Office.persistTasks);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      office.tick(dt);
      acc += dt;
      if (acc > 0.2) {
        acc = 0;
        setSnap(office.snapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    setSnap(office.snapshot());
    return () => {
      cancelAnimationFrame(raf);
      office.setDayEndHandler(null);
      office.setTasksHandler(null);
    };
  }, [office]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const start = () => {
    office.startDay();
    setBriefing(false);
    setTab("office");
    setToast(`${office.day}일차 — ${office.agents.length}명이 출근합니다`);
    refresh();
  };

  const save = (next: OfficeConfig) => {
    saveConfig(next);
    setConfig(next);
    setSelectedId(null);
  };

  const selected = selectedId ? office.agentById.get(selectedId) ?? null : null;
  const approvals = snap.tasks.filter((t) => t.status === "승인 대기").length;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            {config.logo}
          </span>
          <strong>{config.officeName}</strong>
        </div>
        <nav className="tabs" aria-label="화면">
          <button className={tab === "office" ? "on" : ""} onClick={() => setTab("office")} aria-current={tab === "office"}>
            사무실
          </button>
          <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")} aria-current={tab === "board"}>
            업무 보드{approvals ? <i className="badge">{approvals}</i> : null}
          </button>
          <button className={tab === "settings" ? "on" : ""} onClick={() => setTab("settings")} aria-current={tab === "settings"}>
            설정
          </button>
        </nav>
        <div className="clock" aria-live="off">
          <span className="day">{snap.day ? `${snap.day}일차` : "준비"}</span>
          <b>{snap.clock}</b>
          <span className="phase">{snap.phase}</span>
        </div>
      </header>

      {tab !== "settings" ? (
        <div className="controls">
          <button className="btn primary big" onClick={start} disabled={snap.running}>
            {snap.running ? "근무 중" : snap.day ? "다음 날 출근시키기" : "출근시키기"}
          </button>
          <button className="btn" onClick={() => { office.togglePause(); refresh(); }} disabled={!snap.running}>
            {snap.paused ? "이어서 진행" : "잠깐 멈춤"}
          </button>
          <div className="seg" role="group" aria-label="시간 흐름 속도">
            {SPEEDS.map((s) => (
              <button key={s} className={snap.speed === s ? "on" : ""} onClick={() => { office.setSpeed(s); refresh(); }}>
                {s}배
              </button>
            ))}
          </div>
          <div className="day-bar" aria-label="하루 진행">
            <i
              style={{
                width: `${Math.max(0, Math.min(100, ((snap.minute - config.openAt) / (config.closeAt - config.openAt)) * 100))}%`,
              }}
            />
          </div>
          <span className="present">
            출근 <b>{snap.present}</b>/{snap.total}명
          </span>
        </div>
      ) : null}

      <main>
        {tab === "office" ? (
          <div className="office-grid">
            <OfficeCanvas office={office} selectedId={selectedId} onSelect={(a) => setSelectedId(a?.id ?? null)} />
            <Rail office={office} snap={snap} onChange={refresh} />
          </div>
        ) : tab === "board" ? (
          <Board office={office} snap={snap} onPick={setSelectedId} onChange={refresh} />
        ) : (
          <Settings config={config} onSave={save} notify={setToast} />
        )}
      </main>

      {selected ? (
        <ProfileModal
          agent={selected}
          office={office}
          onClose={() => setSelectedId(null)}
          onAsk={(a) => {
            office.command(`${a.name} 지금 뭐해?`);
            setSelectedId(null);
            setTab("office");
            refresh();
          }}
        />
      ) : null}
      {briefing ? <BriefingModal office={office} snap={snap} onClose={() => setBriefing(false)} /> : null}
      <div className={`toast ${toast ? "show" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}
