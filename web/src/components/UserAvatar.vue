<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ name: string; avatar?: string | null; size?: number }>(), {
  avatar: null,
  size: 40,
});

const COLORS = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#7b61ff', '#13c2c2'];

// 没有头像时用姓名最后一个字 + 按姓名固定的底色
const color = computed(() => {
  let hash = 0;
  for (const ch of props.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
});
const initial = computed(() => props.name.slice(-1));
</script>

<template>
  <el-avatar
    :size="size"
    :src="avatar ?? undefined"
    :style="avatar ? undefined : { background: color, fontSize: `${Math.round(size * 0.42)}px` }"
  >
    {{ initial }}
  </el-avatar>
</template>
