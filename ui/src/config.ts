import path from "node:path";
import { randomBytes } from "node:crypto";

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  ALLOWED_EMAILS: (process.env.ALLOWED_EMAIL || "")
    .toLowerCase()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean),
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  FROM_EMAIL: process.env.FROM_EMAIL || "NanoClaw UAI <auth@example.com>",
  SESSION_SECRET: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
  COOKIE_NAME: "nanoclaw_session",
  SESSION_MAX_AGE_DAYS: 30,
  NANOCLAW_PATH: process.env.NANOCLAW_PATH || "/opt/nanoclaw",
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
};
