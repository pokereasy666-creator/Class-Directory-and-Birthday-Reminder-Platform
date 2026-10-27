import { Module } from '@nestjs/common';
import { AdminGroupsController, GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  controllers: [GroupsController, AdminGroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
