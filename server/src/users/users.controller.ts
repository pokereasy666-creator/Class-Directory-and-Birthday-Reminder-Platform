import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueryUsersDto } from './dto/query-users.dto';
import { UsersService } from './users.service';

@ApiTags('班级通讯录')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: '通讯录列表，支持按姓名/学号搜索、按小组筛选' })
  list(@Query() query: QueryUsersDto) {
    return this.users.directory(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '同学详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.users.detail(id);
  }
}
