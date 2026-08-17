import { serve } from "bun";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config.js";
import { ApiRouter } from "./routes/api.js";

const PUBLIC_DIR = path.join(import.meta.dir, "public");

serve({
  port: CONFIG.PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. API Routing
    const apiRes = await ApiRouter.handle(req, url);
    if (apiRes) return apiRes;

    // 2. Static File Serving
    let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return new Response(Bun.file(filePath));
    }

    // SPA Fallback
    const indexFile = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexFile)) {
      return new Response(Bun.file(indexFile));
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[NanoClaw UAI] Servidor rodando em http://127.0.0.1:${CONFIG.PORT}`);
