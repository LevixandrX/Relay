/**
 * Надёжный запуск Relay:
 * 1) освобождает порт 3000
 * 2) чистит зависший .next/dev при --clean
 * 3) стартует next dev только из папки relay
 */
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const clean = process.argv.includes("--clean");

function killPort(p) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${p}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          console.log(`[relay] остановлен процесс PID ${pid} на порту ${p}`);
        } catch {
          // ignore
        }
      }
    } else {
      execSync(`lsof -ti:${p} | xargs -r kill -9`, { stdio: "ignore" });
    }
  } catch {
    // порт свободен
  }
}

function rmrf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`[relay] удалено ${path.relative(root, target)}`);
}

killPort(port);
if (clean) {
  rmrf(path.join(root, ".next"));
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "-p", String(port)],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "1" },
    shell: process.platform === "win32",
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
