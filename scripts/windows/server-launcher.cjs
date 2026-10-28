/**
 * 平台的启动器（start.bat 与后台服务共用），负责：
 *   1. 以子进程运行后端服务，输出同时写到控制台和 server/logs/server.log；
 *   2. 子进程退出后自动重启（间隔 5→10→20→40→60 秒，稳定运行 60 秒后重置）。
 *      开机时数据库还没启动、运行中意外崩溃都能自动恢复。
 *      不依赖任务计划程序的"失败时重新启动"：该设置只在任务启动失败时生效，
 *      程序启动后以非 0 退出码结束并不会触发。
 *   3. 收到 Ctrl+C 或结束信号时停止子进程后退出。
 *
 * 停止计划任务只会结束本进程；子进程通过 parent-watch.cjs 发现本进程不在后自行退出，
 * 不会留下占用端口的孤儿进程。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const serverDir = path.resolve(__dirname, '..', '..', 'server');
const mainJs = path.join(serverDir, 'dist', 'main.js');
const parentWatch = path.join(__dirname, 'parent-watch.cjs');
const logDir = path.join(serverDir, 'logs');
const logFile = path.join(logDir, 'server.log');
const MAX_LOG_BYTES = 10 * 1024 * 1024;
const MIN_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;
const STABLE_MS = 60_000;

fs.mkdirSync(logDir, { recursive: true });
// 超过 10MB 时保留一份旧日志
if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_LOG_BYTES) {
  fs.renameSync(logFile, `${logFile}.1`);
}
const log = fs.createWriteStream(logFile, { flags: 'a' });
log.on('error', () => {}); // 磁盘写满等情况下不影响服务本身

function write(stream, chunk) {
  log.write(chunk);
  try {
    stream.write(chunk);
  } catch {
    // 计划任务中可能没有可用的控制台句柄，忽略
  }
}

function info(message) {
  const time = new Date().toLocaleString('zh-CN', { hour12: false });
  write(process.stdout, `[启动器 ${time}] ${message}\n`);
}

let child = null;
let stopping = false;
let delay = MIN_DELAY_MS;
let restartTimer = null;

function startServer() {
  restartTimer = null;
  if (!fs.existsSync(mainJs)) {
    info(`未找到 ${mainJs}，请先运行 setup.bat 构建项目`);
    process.exit(1);
  }
  const startedAt = Date.now();
  child = spawn(process.execPath, ['-r', parentWatch, mainJs], {
    cwd: serverDir, // .env、uploads、WEB_DIST 都以 server 目录为基准
    env: { ...process.env, NO_COLOR: '1', CD_LAUNCHER_PID: String(process.pid) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  info(`服务进程已启动（PID ${child.pid}）`);
  child.stdout.on('data', (chunk) => write(process.stdout, chunk));
  child.stderr.on('data', (chunk) => write(process.stderr, chunk));
  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) return;
    if (Date.now() - startedAt >= STABLE_MS) delay = MIN_DELAY_MS;
    info(`服务进程已退出（${signal ? `信号 ${signal}` : `退出码 ${code}`}），${delay / 1000} 秒后自动重启`);
    restartTimer = setTimeout(startServer, delay);
    delay = Math.min(delay * 2, MAX_DELAY_MS);
  });
}

function shutdown(reason) {
  if (stopping) return;
  stopping = true;
  info(`收到 ${reason}，正在停止服务`);
  if (restartTimer) clearTimeout(restartTimer);
  if (!child) return finish();
  const timer = setTimeout(() => child && child.kill('SIGKILL'), 5_000);
  child.once('exit', () => {
    clearTimeout(timer);
    finish();
  });
  child.kill();
}

function finish() {
  log.end(() => process.exit(0));
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) {
  process.on(signal, () => shutdown(signal));
}

info('启动器已启动');
startServer();
