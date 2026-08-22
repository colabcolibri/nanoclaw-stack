import path from "node:path";
import { randomBytes } from "node:crypto";
import { requireEnv, requireIntEnv } from "./require-env.js";

const nanoclawPath = requireEnv("NANOCLAW_PATH");
const defaultGroupFolder = requireEnv("NANOCLAW_DEFAULT_GROUP");

export const CONFIG = {
  PORT: requireIntEnv("PORT"),
  ALLOWED_EMAILS: requireEnv("ALLOWED_EMAIL")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean),
  RESEND_API_KEY: requireEnv("RESEND_API_KEY"),
  FROM_EMAIL: requireEnv("FROM_EMAIL"),
  SESSION_SECRET: requireEnv("SESSION_SECRET"),
  COOKIE_NAME: "nanoclaw_session",
  SESSION_MAX_AGE_DAYS: 30,
  NANOCLAW_PATH: nanoclawPath,
  DEFAULT_GROUP_FOLDER: defaultGroupFolder,
  /** URL pública do painel — usada em mensagens de erro do agente e OAuth quando necessário. */
  UI_PUBLIC_URL: requireEnv("UI_PUBLIC_URL"),
  get GROUPS_PATH() {
    return path.join(this.NANOCLAW_PATH, "groups");
  },
  get DATA_PATH() {
    return path.join(this.NANOCLAW_PATH, "data");
  },
  get DB_PATH() {
    return path.join(this.DATA_PATH, "v2.db");
  },
  get SKILLS_PATH() {
    return path.join(this.NANOCLAW_PATH, "container", "skills");
  },
  get AGENTS_PATH() {
    return path.join(this.NANOCLAW_PATH, "container", "agents");
  },
};
