import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class RunReminderDto {
  @ApiPropertyOptional({
    description: '按指定日期执行（YYYY-MM-DD），用于演示，默认今天',
    example: '2026-10-27',
  })
  @IsOptional()
  @IsDateString({ strict: true }, { message: '日期格式应为 YYYY-MM-DD' })
  date?: string;
}
