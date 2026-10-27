<script setup lang="ts">
import {
  Bell,
  Calendar,
  Collection,
  Expand,
  HomeFilled,
  Key,
  Notebook,
  Present,
  SwitchButton,
  User,
  UserFilled,
} from '@element-plus/icons-vue';
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { adminApi } from '@/api';
import UserAvatar from '@/components/UserAvatar.vue';
import { useIsMobile } from '@/composables/useIsMobile';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';

interface MenuItem {
  path: string;
  title: string;
  icon: Component;
}

const auth = useAuthStore();
const notifications = useNotificationStore();
const route = useRoute();
const router = useRouter();
const isMobile = useIsMobile();
const drawerOpen = ref(false);
const pendingCount = ref(0);

const studentMenu: MenuItem[] = [
  { path: '/', title: '首页', icon: HomeFilled },
  { path: '/directory', title: '班级通讯录', icon: Notebook },
  { path: '/birthdays', title: '生日', icon: Present },
  { path: '/announcements', title: '班级公告', icon: Collection },
  { path: '/notifications', title: '消息通知', icon: Bell },
  { path: '/profile', title: '个人中心', icon: User },
];

const adminMenu: MenuItem[] = [
  { path: '/admin/users', title: '用户管理', icon: UserFilled },
  { path: '/admin/groups', title: '分组管理', icon: Collection },
  { path: '/admin/announcements', title: '公告管理', icon: Notebook },
  { path: '/admin/birthdays', title: '生日总览', icon: Calendar },
];

const activePath = computed(() => route.path);

async function refreshPending() {
  if (!auth.isAdmin) return;
  try {
    pendingCount.value = (await adminApi.stats()).pending;
  } catch {
    /* 忽略 */
  }
}

function navigate(path: string) {
  drawerOpen.value = false;
  void router.push(path);
}

function onCommand(command: string) {
  if (command === 'logout') {
    notifications.stopPolling();
    auth.logout();
    void router.replace({ name: 'login' });
  } else {
    navigate(command);
  }
}

// 进入管理页面或审核操作后刷新待审核数
watch(() => route.fullPath, refreshPending);
onMounted(() => {
  notifications.startPolling();
  void refreshPending();
});
onBeforeUnmount(() => notifications.stopPolling());
</script>

<template>
  <el-container class="layout">
    <el-aside v-if="!isMobile" class="aside">
      <div class="brand" @click="navigate('/')">🎂 班级通讯录</div>
      <el-menu :default-active="activePath" @select="navigate">
        <el-menu-item v-for="m in studentMenu" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
        <el-menu-item-group v-if="auth.isAdmin" title="班级管理">
          <el-menu-item v-for="m in adminMenu" :key="m.path" :index="m.path">
            <el-icon><component :is="m.icon" /></el-icon>
            <span>{{ m.title }}</span>
            <el-badge
              v-if="m.path === '/admin/users' && pendingCount"
              :value="pendingCount"
              class="menu-badge"
            />
          </el-menu-item>
        </el-menu-item-group>
      </el-menu>
    </el-aside>

    <el-drawer v-model="drawerOpen" direction="ltr" size="240px" :with-header="false">
      <div class="brand">🎂 班级通讯录</div>
      <el-menu :default-active="activePath" @select="navigate">
        <el-menu-item v-for="m in studentMenu" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
        <el-menu-item-group v-if="auth.isAdmin" title="班级管理">
          <el-menu-item v-for="m in adminMenu" :key="m.path" :index="m.path">
            <el-icon><component :is="m.icon" /></el-icon>
            <span>{{ m.title }}</span>
            <el-badge
              v-if="m.path === '/admin/users' && pendingCount"
              :value="pendingCount"
              class="menu-badge"
            />
          </el-menu-item>
        </el-menu-item-group>
      </el-menu>
    </el-drawer>

    <el-container>
      <el-header class="header">
        <el-button
          v-if="isMobile"
          :icon="Expand"
          text
          aria-label="打开菜单"
          @click="drawerOpen = true"
        />
        <span class="title">{{ route.meta.title }}</span>
        <span class="spacer" />
        <el-badge :value="notifications.unread" :hidden="!notifications.unread" :max="99">
          <el-button
            :icon="Bell"
            circle
            text
            aria-label="消息通知"
            @click="navigate('/notifications')"
          />
        </el-badge>
        <el-dropdown v-if="auth.user" trigger="click" @command="onCommand">
          <span class="user">
            <UserAvatar :name="auth.user.name" :avatar="auth.user.avatar" :size="32" />
            <span v-if="!isMobile">{{ auth.user.name }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="/profile" :icon="User">个人中心</el-dropdown-item>
              <el-dropdown-item command="/password" :icon="Key">修改密码</el-dropdown-item>
              <el-dropdown-item command="logout" :icon="SwitchButton" divided
                >退出登录</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main class="main">
        <router-view v-slot="{ Component: View }">
          <component :is="View" @pending-changed="refreshPending" />
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100%;
}
.aside {
  width: var(--app-sidebar-width);
  background: #fff;
  border-right: 1px solid var(--el-border-color-light);
}
.aside .el-menu,
.el-drawer .el-menu {
  border-right: none;
}
.brand {
  height: var(--app-header-height);
  display: flex;
  align-items: center;
  padding-left: 20px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
}
.menu-badge {
  margin-left: 8px;
  display: inline-flex;
}
.header {
  height: var(--app-header-height);
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-light);
}
.title {
  font-size: 16px;
  font-weight: 500;
}
.spacer {
  flex: 1;
}
.user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.main {
  padding: 20px;
}
@media (max-width: 768px) {
  .header {
    padding: 0 8px;
  }
  .main {
    padding: 12px;
  }
}
</style>
