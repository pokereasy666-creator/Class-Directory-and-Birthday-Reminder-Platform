import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAnnouncementsController, AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AnnouncementsController, AdminAnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
