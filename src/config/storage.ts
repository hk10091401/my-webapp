// 브라우저 저장소. 사생활 보호 모드 등에서 막혀도 앱은 기본값으로 돌아갑니다.

import { DEFAULT_CONFIG } from "./defaults";
import type { OfficeConfig } from "./types";

const CONFIG_KEY = "my-office:config:v1";

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장이 막힌 환경 — 이번 세션 동안만 유지됩니다.
  }
}

export function loadConfig(): OfficeConfig {
  const saved = loadJson<OfficeConfig | null>(CONFIG_KEY, null);
  return saved && isConfig(saved) ? saved : structuredClone(DEFAULT_CONFIG);
}

export function saveConfig(config: OfficeConfig) {
  saveJson(CONFIG_KEY, config);
}

export function isConfig(value: unknown): value is OfficeConfig {
  const v = value as OfficeConfig;
  return (
    !!v &&
    typeof v.officeName === "string" &&
    !!v.me &&
    Array.isArray(v.departments) &&
    v.departments.length > 0 &&
    Array.isArray(v.staff)
  );
}
