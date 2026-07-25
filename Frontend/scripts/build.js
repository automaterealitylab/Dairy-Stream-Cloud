import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.resolve(__dirname, "..", "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");

const result = spawnSync(viteBin, ["build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    BROWSERSLIST_IGNORE_OLD_DATA: "1",
  },
});

if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
