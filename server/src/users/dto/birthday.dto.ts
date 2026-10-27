import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CalendarType } from '@prisma/client';

export class BirthdayDto {
  @ApiProperty({ enum: CalendarType, description: 'SOLAR 公历 / LUNAR 农历' })
  @IsIn(Object.values(CalendarType), { message: '请选择公历或农历' })
  calendar: CalendarType;

  @ApiPropertyOptional({ description: '出生年份，留空表示不公开年龄', nullable: true })
  @IsOptional()
  @IsInt({ message: '出生年份不合法' })
  year?: number | null;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @IsInt({ message: '生日月份不合法' })
  @Min(1, { message: '生日月份应为 1~12' })
  @Max(12, { message: '生日月份应为 1~12' })
  month: number;

  @ApiProperty({ minimum: 1, maximum: 31 })
  @IsInt({ message: '生日日期不合法' })
  @Min(1, { message: '生日日期不合法' })
  @Max(31, { message: '生日日期不合法' })
  day: number;

  @ApiPropertyOptional({ description: '农历闰月出生', default: false })
  @IsOptional()
  @IsBoolean()
  isLeapMonth?: boolean;
}
