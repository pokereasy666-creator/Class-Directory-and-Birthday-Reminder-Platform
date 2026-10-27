<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { announcementApi } from '@/api';
import type { Announcement } from '@/api/types';
import { formatDateTime } from '@/utils/format';

const route = useRoute();
const items = ref<Announcement[]>([]);
const total = ref(0);
const loading = ref(false);
const query = reactive({ page: 1, pageSize: 10 });
const current = ref<Announcement | null>(null);
const dialogVisible = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await announcementApi.list(query);
    items.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function open(a: Announcement) {
  current.value = a;
  dialogVisible.value = true;
}

onMounted(async () => {
  await load();
  // 从首页或通知跳转过来时直接打开对应公告
  const id = Number(route.query.id);
  if (id) open(items.value.find((a) => a.id === id) ?? (await announcementApi.detail(id)));
});
</script>

<template>
  <div v-loading="loading">
    <el-empty v-if="!items.length && !loading" description="暂无公告" />
    <el-card v-for="a in items" :key="a.id" shadow="hover" class="item" @click="open(a)">
      <div class="title">
        <el-tag v-if="a.pinned" size="small" type="danger">置顶</el-tag>
        {{ a.title }}
      </div>
      <div class="summary">{{ a.content }}</div>
      <div class="muted">{{ a.author?.name ?? '管理员' }} · {{ formatDateTime(a.createdAt) }}</div>
    </el-card>
    <el-pagination
      v-if="total > query.pageSize"
      v-model:current-page="query.page"
      :page-size="query.pageSize"
      :total="total"
      layout="prev, pager, next"
      class="pager"
      @current-change="load"
    />
    <el-dialog v-model="dialogVisible" :title="current?.title" width="min(600px, 92vw)">
      <template v-if="current">
        <div class="muted meta">
          {{ current.author?.name ?? '管理员' }} · {{ formatDateTime(current.createdAt) }}
        </div>
        <div class="content">{{ current.content }}</div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.item {
  margin-bottom: 12px;
  cursor: pointer;
}
.title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}
.summary {
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}
.meta {
  margin-bottom: 12px;
}
.content {
  white-space: pre-wrap;
  line-height: 1.8;
}
.pager {
  justify-content: center;
}
</style>
