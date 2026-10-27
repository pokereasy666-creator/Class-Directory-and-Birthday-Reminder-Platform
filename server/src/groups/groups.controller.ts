import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { GroupDto } from './dto/group.dto';
import { GroupsService } from './groups.service';

@ApiTags('班级分组')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @ApiOperation({ summary: '小组列表（含人数）' })
  list() {
    return this.groups.list();
  }
}

@ApiTags('管理员 - 班级分组')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/groups')
export class AdminGroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  @ApiOperation({ summary: '新增小组' })
  create(@Body() dto: GroupDto) {
    return this.groups.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '修改小组' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: GroupDto) {
    return this.groups.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除小组，成员变为未分组' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.groups.remove(id);
  }
}
