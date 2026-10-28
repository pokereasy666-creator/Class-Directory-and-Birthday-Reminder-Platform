/**
 * 由 server-launcher.cjs 通过 `node -r parent-watch.cjs dist/main.js` 预加载到服务进程中。
 * 每 3 秒检查一次启动器进程是否还在，不在了（例如计划任务被停止、窗口被强制关闭）就退出，
 * 避免服务进程变成孤儿继续占用端口。
 */
const launcherPid = Number(process.env.CD_LAUNCHER_PID);

if (launcherPid > 0) {
  const timer = setInterval(() => {
    try {
      process.kill(launcherPid, 0); // 信号 0 只检查进程是否存在
    } catch (err) {
      // EPERM 表示进程存在但无权发信号，只有 ESRCH（进程不存在）才退出
      if (err.code === 'ESRCH') process.exit(0);
    }
  }, 3_000);
  timer.unref(); // 不阻止服务进程正常退出
}
