import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/** 通讯录字段校验规则，"防止乱填"在这里统一落实 */
export const PATTERNS = {
  studentNo: /^\d{4,20}$/,
  // 中文、英文字母、间隔号（少数民族姓名）及空格
  name: /^[一-龥A-Za-z·\s]{2,20}$/,
  phone: /^1[3-9]\d{9}$/,
  qq: /^[1-9]\d{4,11}$/,
  username: /^[A-Za-z0-9_]{3,32}$/,
  // 6~32 位，至少包含字母和数字
  password: /^(?=.*[A-Za-z])(?=.*\d).{6,32}$/,
};

/** 前端表单清空的字段会以空字符串提交，统一转成 null 以便清除数据库中的值 */
export const EmptyToNull = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

/** 去掉首尾空格 */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const IsStudentNo = () =>
  applyDecorators(
    Trim(),
    IsString(),
    Matches(PATTERNS.studentNo, { message: '学号应为 4~20 位数字' }),
  );

export const IsPersonName = () =>
  applyDecorators(
    Trim(),
    IsString(),
    Matches(PATTERNS.name, { message: '姓名应为 2~20 个中文或英文字符' }),
  );

export const IsPassword = () =>
  applyDecorators(
    IsString(),
    Matches(PATTERNS.password, { message: '密码应为 6~32 位，且同时包含字母和数字' }),
  );

/** 可选的手机号，空字符串视为清除 */
export const OptionalPhone = () =>
  applyDecorators(
    EmptyToNull(),
    IsOptional(),
    IsString(),
    Matches(PATTERNS.phone, { message: '手机号格式不正确' }),
  );

export const OptionalQq = () =>
  applyDecorators(
    EmptyToNull(),
    IsOptional(),
    IsString(),
    Matches(PATTERNS.qq, { message: 'QQ 号格式不正确' }),
  );

export const OptionalText = (max: number, label: string) =>
  applyDecorators(
    Trim(),
    EmptyToNull(),
    IsOptional(),
    IsString(),
    Length(1, max, { message: `${label}不能超过 ${max} 个字符` }),
  );
