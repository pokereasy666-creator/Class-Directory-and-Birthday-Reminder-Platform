import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/types';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementDto } from './dto/announcement.dto';

@ApiTags('班级公告')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: '公告列表（置顶优先）' })
  list(@Query() query: PaginationDto) {
    return this.announcements.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '公告详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.announcements.detail(id);
  }
}

@ApiTags('管理员 - 班级公告')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Post()
  @ApiOperation({ summary: '发布公告，并通知全班' })
  create(@CurrentUser() user: AuthUser, @Body() dto: AnnouncementDto) {
    return this.announcements.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑公告' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: AnnouncementDto) {
    return this.announcements.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除公告' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.announcements.remove(id);
  }
}
