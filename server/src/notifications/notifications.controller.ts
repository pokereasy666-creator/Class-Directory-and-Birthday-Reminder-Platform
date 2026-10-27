import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { RunReminderDto } from './dto/run-reminder.dto';
import { NotificationsService } from './notifications.service';
import { ReminderService } from './reminder.service';

@ApiTags('消息通知')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: '我的通知' })
  list(@CurrentUser() user: AuthUser, @Query() query: QueryNotificationsDto) {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '未读通知数' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Put('read-all')
  @ApiOperation({ summary: '全部标记为已读' })
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Put(':id/read')
  @ApiOperation({ summary: '标记为已读' })
  read(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.markRead(user.id, id);
  }
}

@ApiTags('管理员 - 生日提醒')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/reminders')
export class AdminRemindersController {
  constructor(private readonly reminder: ReminderService) {}

  @Post('run')
  @HttpCode(200)
  @ApiOperation({ summary: '立即执行一次生日提醒任务（重复执行不会重复通知）' })
  run(@Body() dto: RunReminderDto) {
    return this.reminder.run(dto.date);
  }
}
