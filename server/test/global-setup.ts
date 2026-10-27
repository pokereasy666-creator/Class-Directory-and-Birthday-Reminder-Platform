import { execSync } from 'child_process';

/** 运行 e2e 前把迁移应用到测试库 */
export default function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'mysql://classbook:classbook123@127.0.0.1:3306/class_directory_test';
  execSync('npx prisma migrate deploy', {
    cwd: `${__dirname}/..`,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
