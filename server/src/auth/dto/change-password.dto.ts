import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from '../../common/validation';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '请输入原密码' })
  oldPassword: string;

  @ApiProperty()
  @IsPassword()
  newPassword: string;
}
