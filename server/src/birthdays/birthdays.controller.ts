import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BirthdaysService } from './birthdays.service';

@ApiTags('生日')
@ApiBearerAuth()
@Controller('birthdays')
export class BirthdaysController {
  constructor(private readonly birthdays: BirthdaysService) {}

  @Get('today')
  @ApiOperation({ summary: '今天过生日的同学' })
  today() {
    return this.birthdays.todayList();
  }

  @Get('upcoming')
  @ApiOperation({ summary: '未来 N 天（含今天）过生日的同学，默认 7 天' })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  upcoming(@Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number) {
    return this.birthdays.upcoming(days);
  }

  @Get('month')
  @ApiOperation({ summary: '某月过生日的同学（农历生日按当年对应的公历日期归入月份），默认本月' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  month(
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
  ) {
    return this.birthdays.month(year, month);
  }
}
