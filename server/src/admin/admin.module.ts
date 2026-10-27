import { Module } from '@nestjs/common';
import { BirthdaysModule } from '../birthdays/birthdays.module';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { ExportService } from './export.service';

@Module({
  imports: [BirthdaysModule],
  controllers: [AdminController],
  providers: [AdminUsersService, ExportService],
})
export class AdminModule {}
