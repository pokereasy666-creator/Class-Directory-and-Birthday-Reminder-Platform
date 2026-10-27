import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

/** 邮件发送。未配置 SMTP_HOST 时整个功能关闭，站内通知不受影响 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    this.from = config.get<string>('SMTP_FROM') || user || '';
    this.transporter = host
      ? createTransport({
          host,
          port: Number(config.get('SMTP_PORT', 465)),
          secure: config.get('SMTP_SECURE', 'true') === 'true',
          auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
        })
      : null;
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
      return true;
    } catch (err) {
      this.logger.warn(`发送邮件到 ${to} 失败：${(err as Error).message}`);
      return false;
    }
  }
}
