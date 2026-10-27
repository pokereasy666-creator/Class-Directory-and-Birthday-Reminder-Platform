import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '@/api';
import type { Profile } from '@/api/types';
import { clearToken, setToken } from '@/utils/token';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<Profile | null>(null);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  function setSession(token: string, profile: Profile) {
    setToken(token);
    user.value = profile;
  }

  async function login(username: string, password: string) {
    const { token, user: profile } = await authApi.login(username, password);
    setSession(token, profile);
    return profile;
  }

  async function fetchMe() {
    user.value = await authApi.me({ silent: true });
    return user.value;
  }

  function logout() {
    clearToken();
    user.value = null;
  }

  return { user, isAdmin, setSession, login, fetchMe, logout };
});
