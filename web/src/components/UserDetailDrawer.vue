<script setup lang="ts">
import { computed } from 'vue';
import type { DirectoryUser } from '@/api/types';
import { useIsMobile } from '@/composables/useIsMobile';
import UserAvatar from './UserAvatar.vue';

const props = defineProps<{ user: DirectoryUser | null }>();
const visible = defineModel<boolean>('visible', { required: true });
const isMobile = useIsMobile();

const rows = computed(() => {
  const u = props.user;
  if (!u) return [];
  return [
    { label: '学号', value: u.studentNo },
    { label: '小组', value: u.group?.name },
    { label: '手机', value: u.phone, href: u.phone ? `tel:${u.phone}` : undefined },
    { label: 'QQ', value: u.qq },
    { label: '邮箱', value: u.email, href: u.email ? `mailto:${u.email}` : undefined },
    { label: '宿舍', value: u.dorm },
    { label: '生日', value: u.birthday?.text },
    { label: '备注', value: u.remark },
  ];
});
</script>

<template>
  <el-drawer v-model="visible" :size="isMobile ? '100%' : '420px'" title="同学信息">
    <template v-if="user">
      <div class="head">
        <UserAvatar :name="user.name" :avatar="user.avatar" :size="72" />
        <div>
          <div class="name">{{ user.name }}</div>
          <el-tag v-if="user.role === 'ADMIN'" size="small" type="warning">管理员</el-tag>
        </div>
      </div>
      <el-descriptions :column="1" border>
        <el-descriptions-item v-for="r in rows" :key="r.label" :label="r.label">
          <a v-if="r.href" :href="r.href">{{ r.value }}</a>
          <span v-else>{{ r.value || '—' }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </template>
  </el-drawer>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.name {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
