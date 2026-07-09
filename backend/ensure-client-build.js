/**
 * Đảm bảo client (React SPA) đã được build trước khi server khởi động.
 * Nếu chưa có client/dist/index.html → chạy npm build trong workspace client.
 * Tránh lỗi /app/ trắng do React bundle thiếu.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const clientDist = path.join(__dirname, "..", "client", "dist", "index.html");

if (fs.existsSync(clientDist)) {
  console.log("✓ Client build đã có sẵn, skip build React.");
  process.exit(0);
}

console.log("⚠ client/dist không tìm thấy → đang build React (BUILD_TARGET=web)…");
const r = spawnSync("npm", ["run", "build", "-w", "client"], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, BUILD_TARGET: "web" },
});
process.exit(r.status || 0);
