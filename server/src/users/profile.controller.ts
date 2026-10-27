import { Body, Controller, Get, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { AVATAR_MAX_BYTES } from '../common/upload.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('个人信息')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取自己的资料' })
  get(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Put()
  @ApiOperation({ summary: '修改自己的资料（联系方式、宿舍、备注、生日、邮件提醒）' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @ApiOperation({ summary: '上传头像（JPG/PNG/WEBP，不超过 2MB）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(
    // 超过大小限制由 multer 直接拒绝（413）
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: AVATAR_MAX_BYTES } }),
  )
  uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.users.updateAvatar(user.id, file);
  }
}
