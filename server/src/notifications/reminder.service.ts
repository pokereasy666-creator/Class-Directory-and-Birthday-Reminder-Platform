import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { nextOccurrence } from '../birthdays/birthday.util';
import { BirthdaysService } from '../birthdays/birthdays.service';
import { APP_TIMEZONE, DateStr, diffDays, today } from '../common/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { NotificationInput, NotificationsService } from './notifications.service';

export interface ReminderResult {
  date: DateStr;
  /** 今天过生日的人数 */
  birthdayToday: number;
  /** 提前提醒的人数 */
  birthdayUpcoming: number;
  /** 新生成的站内通知数 */
  created: number;
  /** 成功发送的邮件数 */
  emailed: number;
}

/**
 * 每日生日提醒。
 * 对每个已填生日的同学 b，计算 nextOccurrence(b, 今天)：
 *   - 等于今天：通知全班其他人"今天是 b 的生日"，并给 b 本人发送祝福；
 *   - 距今恰好 REMINDER_ADVANCE_DAYS 天：通知全班其他人提前准备。
 * 通知表上 (user_id, type, related_id, ref_date) 唯一，重复执行不会重复通知。
 */
@Injectable()
export class ReminderService implements OnModuleInit {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly birthdays: BirthdaysService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    const cron = this.config.get<string>('REMINDER_CRON', '0 8 * * *');
    if (cron === 'off') return;
    const job = CronJob.from({
      cronTime: cron,
      timeZone: APP_TIMEZONE,
      onTick: () => {
        this.run()
          .then((r) => this.logger.log(`生日提醒完成：${JSON.stringify(r)}`))
          .catch((err) => this.logger.error('生日提醒失败', err));
      },
    });
    this.scheduler.addCronJob('birthday-reminder', job);
    job.start();
    this.logger.log(`生日提醒已启动，执行时间 "${cron}"（${APP_TIMEZONE}）`);
  }

  async run(date: DateStr = today()): Promise<ReminderResult> {
    const advanceDays = Number(this.config.get('REMINDER_ADVANCE_DAYS', 1));
    const [list, recipients] = await Promise.all([
      this.birthdays.activeWithBirthday(),
      this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, email: true, emailNotify: true },
      }),
    ]);

    const rows: NotificationInput[] = [];
    let birthdayToday = 0;
    let birthdayUpcoming = 0;

    for (const { user, birthday } of list) {
      const occurrence = nextOccurrence(birthday, date);
      const daysLeft = diffDays(occurrence, date);
      const others = recipients.filter((r) => r.id !== user.id);
      const base = { relatedId: user.id, refDate: occurrence };

      if (daysLeft === 0) {
        birthdayToday++;
        rows.push({
          ...base,
          userId: user.id,
          type: 'BIRTHDAY_TODAY',
          title: `${user.name}，生日快乐！`,
          content: '今天是你的生日，全班同学祝你生日快乐，天天开心！',
        });
        for (const r of others) {
          rows.push({
            ...base,
            userId: r.id,
            type: 'BIRTHDAY_TODAY',
            title: `今天是 ${user.name} 的生日`,
            content: `今天是 ${user.name} 的生日，别忘了送上祝福~`,
          });
        }
      } else if (advanceDays > 0 && daysLeft === advanceDays) {
        birthdayUpcoming++;
        const when = advanceDays === 1 ? '明天' : `${advanceDays} 天后（${occurrence}）`;
        for (const r of others) {
          rows.push({
            ...base,
            userId: r.id,
            type: 'BIRTHDAY_UPCOMING',
            title: `${when}是 ${user.name} 的生日`,
            content: `${when}是 ${user.name} 的生日，可以提前准备祝福哦。`,
          });
        }
      }
    }

    const created = await this.notifications.createIfAbsent(rows);
    const emailed = await this.sendEmails(created, recipients);
    return { date, birthdayToday, birthdayUpcoming, created: created.length, emailed };
  }

  private async sendEmails(
    rows: NotificationInput[],
    recipients: { id: number; email: string | null; emailNotify: boolean }[],
  ): Promise<number> {
    if (!this.mail.enabled) return 0;
    const byId = new Map(recipients.map((r) => [r.id, r]));
    let sent = 0;
    for (const row of rows) {
      const r = byId.get(row.userId);
      if (r?.emailNotify && r.email && (await this.mail.send(r.email, row.title, row.content)))
        sent++;
    }
    return sent;
  }
}
