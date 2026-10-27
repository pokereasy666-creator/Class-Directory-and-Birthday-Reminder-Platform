<script setup lang="ts">
import type { BirthdayEntry } from '@/api/types';
import { daysLeftTagType, daysLeftText } from '@/utils/birthday';
import { formatMonthDay } from '@/utils/format';
import UserAvatar from './UserAvatar.vue';

withDefaults(defineProps<{ entries: BirthdayEntry[]; emptyText?: string; loading?: boolean }>(), {
  emptyText: '暂无生日',
  loading: false,
});
defineEmits<{ select: [entry: BirthdayEntry] }>();
</script>

<template>
  <div v-loading="loading" class="birthday-list">
    <el-empty v-if="!entries.length && !loading" :description="emptyText" :image-size="80" />
    <div
      v-for="e in entries"
      :key="`${e.user.id}-${e.date}`"
      class="item"
      :class="{ today: e.daysLeft === 0 }"
      @click="$emit('select', e)"
    >
      <UserAvatar :name="e.user.name" :avatar="e.user.avatar" :size="40" />
      <div class="info">
        <div class="name">
          {{ e.user.name }}
          <span v-if="e.user.group" class="muted">· {{ e.user.group.name }}</span>
        </div>
        <div class="muted">
          {{ formatMonthDay(e.date) }} · {{ e.birthdayText }}
          <template v-if="e.age !== null"> · {{ e.age }} 岁</template>
        </div>
      </div>
      <el-tag :type="daysLeftTagType(e.daysLeft)" effect="light" round>
        {{ e.daysLeft === 0 ? '🎂 今天' : daysLeftText(e.daysLeft) }}
      </el-tag>
    </div>
  </div>
</template>

<style scoped>
.birthday-list {
  min-height: 60px;
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.item:hover {
  background: var(--el-fill-color-light);
}
.item.today {
  background: var(--el-color-danger-light-9);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 500;
  margin-bottom: 2px;
}
</style>
