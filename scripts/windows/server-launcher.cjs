/**
 * 后台服务（Windows 计划任务）的启动入口。
 *
 * 计划任务没有控制台，这里把服务输出同时写入 server/logs/server.log。
 * 服务在本进程内运行（require 而不是再启动子进程），停止计划任务时会连同服务一起结束，
 * 不会留下占用端口的孤儿进程。
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.resolve(__dirname, '..', '..', 'server');
const logDir = path.join(serverDir, 'logs');
const logFile = path.join(logDir, 'server.log');
const MAX_LOG_BYTES = 10 * 1024 * 1024;

process.chdir(serverDir); // .env、uploads 都以 server 目录为基准
process.env.NO_COLOR = '1'; // 日志文件中不要终端颜色码

fs.mkdirSync(logDir, { recursive: true });
// 超过 10MB 时保留一份旧日志
if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_LOG_BYTES) {
  fs.renameSync(logFile, `${logFile}.1`);
}
const log = fs.createWriteStream(logFile, { flags: 'a' });
for (const stream of [process.stdout, process.stderr]) {
  const original = stream.write.bind(stream);
  stream.write = (chunk, ...args) => {
    log.write(chunk);
    try {
      return original(chunk, ...args);
    } catch {
      return true; // 计划任务中可能没有可用的控制台句柄，忽略
    }
  };
}
console.log(`\n===== ${new Date().toLocaleString('zh-CN', { hour12: false })} 服务启动 =====`);
process.on('uncaughtException', (err) => {
  console.error('未处理的异常：', err);
  process.exit(1); // 退出码非 0，计划任务会按设置自动重启
});

require(path.join(serverDir, 'dist', 'main.js'));
