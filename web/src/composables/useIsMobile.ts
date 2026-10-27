import { onBeforeUnmount, onMounted, ref } from 'vue';

const MOBILE_QUERY = '(max-width: 768px)';

/** 是否为手机等窄屏，用于切换表格/卡片等布局 */
export function useIsMobile() {
  const query = window.matchMedia(MOBILE_QUERY);
  const isMobile = ref(query.matches);
  const update = (e: MediaQueryListEvent) => (isMobile.value = e.matches);
  onMounted(() => query.addEventListener('change', update));
  onBeforeUnmount(() => query.removeEventListener('change', update));
  return isMobile;
}
