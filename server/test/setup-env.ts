import { tmpdir } from 'os';
import { join } from 'path';

// e2e 测试使用独立的测试库，库名必须以 _test 结尾（helpers.resetDb 会校验）
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'mysql://classbook:classbook123@127.0.0.1:3306/class_directory_test';
process.env.JWT_SECRET = 'e2e-test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.REMINDER_CRON = 'off';
process.env.REMINDER_ADVANCE_DAYS = '1';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.SMTP_HOST = '';
process.env.UPLOAD_DIR = join(tmpdir(), 'class-directory-e2e-uploads');
