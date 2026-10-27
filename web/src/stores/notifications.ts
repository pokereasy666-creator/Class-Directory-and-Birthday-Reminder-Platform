import { defineStore } from 'pinia';
import { ref } from 'vue';
import { notificationApi } from '@/api';

const POLL_INTERVAL = 60_000;

export const useNotificationStore = defineStore('notifications', () => {
  const unread = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    try {
      unread.value = (await notificationApi.unreadCount()).count;
    } catch {
      /* 轮询失败不打扰用户 */
    }
  }

  function startPolling() {
    void refresh();
    timer ??= setInterval(refresh, POLL_INTERVAL);
  }

  function stopPolling() {
    if (timer) clearInterval(timer);
    timer = null;
    unread.value = 0;
  }

  return { unread, refresh, startPolling, stopPolling };
});
