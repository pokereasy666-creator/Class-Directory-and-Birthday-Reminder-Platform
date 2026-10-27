<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { notificationApi } from '@/api';
import type { NotificationItem, NotificationType } from '@/api/types';
import { useNotificationStore } from '@/stores/notifications';
import { formatDateTime } from '@/utils/format';

const router = useRouter();
const store = useNotificationStore();
const items = ref<NotificationItem[]>([]);
const total = ref(0);
const loading = ref(false);
const query = reactive({ page: 1, pageSize: 20, unreadOnly: false });

const ICONS: Record<NotificationType, string> = {
  BIRTHDAY_TODAY: '🎂',
  BIRTHDAY_UPCOMING: '🎁',
  ANNOUNCEMENT: '📢',
};

async function load() {
  loading.value = true;
  try {
    const res = await notificationApi.list(query);
    items.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function open(n: NotificationItem) {
  if (!n.readAt) {
    await notificationApi.read(n.id);
    n.readAt = new Date().toISOString();
    void store.refresh();
  }
  if (n.type === 'ANNOUNCEMENT')
    void router.push({ path: '/announcements', query: { id: n.relatedId } });
  else void router.push('/birthdays');
}

async function readAll() {
  await notificationApi.readAll();
  await Promise.all([load(), store.refresh()]);
}

watch(
  () => query.unreadOnly,
  () => {
    query.page = 1;
    void load();
  },
);
onMounted(load);
</script>

<template>
  <el-card shadow="never">
    <div class="toolbar">
      <el-switch v-model="query.unreadOnly" active-text="只看未读" />
      <span class="spacer" />
      <el-button :disabled="!store.unread" @click="readAll">全部标为已读</el-button>
    </div>
    <div v-loading="loading">
      <el-empty v-if="!items.length && !loading" description="暂无消息" />
      <div
        v-for="n in items"
        :key="n.id"
        class="item"
        :class="{ unread: !n.readAt }"
        @click="open(n)"
      >
        <div class="icon">{{ ICONS[n.type] }}</div>
        <div class="body">
          <div class="title">
            <span v-if="!n.readAt" class="dot" />
            {{ n.title }}
          </div>
          <div class="content">{{ n.content }}</div>
          <div class="muted">{{ formatDateTime(n.createdAt) }}</div>
        </div>
      </div>
    </div>
    <el-pagination
      v-if="total > query.pageSize"
      v-model:current-page="query.page"
      :page-size="query.pageSize"
      :total="total"
      layout="prev, pager, next"
      class="pager"
      @current-change="load"
    />
  </el-card>
</template>

<style scoped>
.item {
  display: flex;
  gap: 12px;
  padding: 12px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
}
.item:hover {
  background: var(--el-fill-color-light);
}
.item:not(.unread) {
  opacity: 0.7;
}
.icon {
  font-size: 24px;
}
.body {
  flex: 1;
  min-width: 0;
}
.title {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-danger);
}
.content {
  margin: 4px 0;
  color: var(--el-text-color-regular);
}
.pager {
  margin-top: 12px;
  justify-content: center;
}
</style>
