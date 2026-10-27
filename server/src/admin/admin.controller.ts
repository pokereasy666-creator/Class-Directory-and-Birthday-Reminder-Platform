import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { BirthdaysService } from '../birthdays/birthdays.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { today } from '../common/date.util';
import { AuthUser } from '../common/types';
import { AdminUsersService } from './admin-users.service';
import {
  AdminCreateUserDto,
  AdminQueryUsersDto,
  AdminUpdateUserDto,
  ResetPasswordDto,
  UpdateStatusDto,
} from './dto/admin-user.dto';
import { ExportService } from './export.service';

@ApiTags('管理员 - 用户与通讯录管理')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly birthdays: BirthdaysService,
    private readonly exporter: ExportService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: '账号统计（总数、待审核、禁用、未填生日）' })
  stats() {
    return this.users.stats();
  }

  @Get('users')
  @ApiOperation({ summary: '用户列表，可按状态（含待审核）、角色、小组筛选' })
  list(@Query() query: AdminQueryUsersDto) {
    return this.users.list(query);
  }

  @Post('users')
  @ApiOperation({ summary: '新增学生/管理员账号（无需审核，首次登录需改密码）' })
  create(@Body() dto: AdminCreateUserDto) {
    return this.users.create(dto);
  }

  @Put('users/:id')
  @ApiOperation({ summary: '编辑学生信息' })
  update(
    @CurrentUser() operator: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.users.update(operator.id, id, dto);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: '审核通过 / 启用 / 禁用账号' })
  setStatus(
    @CurrentUser() operator: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.users.setStatus(operator.id, id, dto);
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: '重置密码' })
  resetPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '删除学生信息（也用于驳回注册申请）' })
  remove(@CurrentUser() operator: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.remove(operator.id, id);
  }

  @Get('birthdays')
  @ApiOperation({ summary: '全部生日记录（按下次生日排序）及未填写生日名单' })
  birthdayOverview() {
    return this.birthdays.overview();
  }

  @Get('export/directory')
  @ApiOperation({ summary: '导出通讯录 Excel' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportDirectory() {
    const filename = encodeURIComponent(`班级通讯录-${today()}.xlsx`);
    return new StreamableFile(await this.exporter.directoryXlsx(), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="directory.xlsx"; filename*=UTF-8''${filename}`,
    });
  }
}
