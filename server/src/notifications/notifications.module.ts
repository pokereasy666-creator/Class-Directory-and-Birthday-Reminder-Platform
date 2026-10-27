import { Module } from '@nestjs/common';
import { BirthdaysModule } from '../birthdays/birthdays.module';
import { MailService } from './mail.service';
import { AdminRemindersController, NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderService } from './reminder.service';

@Module({
  imports: [BirthdaysModule],
  controllers: [NotificationsController, AdminRemindersController],
  providers: [NotificationsService, ReminderService, MailService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
