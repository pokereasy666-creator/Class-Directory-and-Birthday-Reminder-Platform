import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getToken } from '@/utils/token';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** 无需登录 */
    public?: boolean;
    /** 仅管理员 */
    admin?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { title: '注册', public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '首页' },
        },
        {
          path: 'directory',
          name: 'directory',
          component: () => import('@/views/DirectoryView.vue'),
          meta: { title: '班级通讯录' },
        },
        {
          path: 'birthdays',
          name: 'birthdays',
          component: () => import('@/views/BirthdayView.vue'),
          meta: { title: '生日' },
        },
        {
          path: 'announcements',
          name: 'announcements',
          component: () => import('@/views/AnnouncementView.vue'),
          meta: { title: '班级公告' },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/views/NotificationView.vue'),
          meta: { title: '消息通知' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { title: '个人中心' },
        },
        {
          path: 'password',
          name: 'password',
          component: () => import('@/views/PasswordView.vue'),
          meta: { title: '修改密码' },
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('@/views/admin/UsersView.vue'),
          meta: { title: '用户管理', admin: true },
        },
        {
          path: 'admin/groups',
          name: 'admin-groups',
          component: () => import('@/views/admin/GroupsView.vue'),
          meta: { title: '分组管理', admin: true },
        },
        {
          path: 'admin/announcements',
          name: 'admin-announcements',
          component: () => import('@/views/admin/AnnouncementsView.vue'),
          meta: { title: '公告管理', admin: true },
        },
        {
          path: 'admin/birthdays',
          name: 'admin-birthdays',
          component: () => import('@/views/admin/BirthdaysView.vue'),
          meta: { title: '生日总览', admin: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  if (!getToken()) return { name: 'login', query: { redirect: to.fullPath } };

  const auth = useAuthStore();
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
      return { name: 'login', query: { redirect: to.fullPath } };
    }
  }
  // 管理员新建或重置过密码的账号，必须先修改初始密码
  if (auth.user!.mustChangePassword && to.name !== 'password') return { name: 'password' };
  if (to.meta.admin && !auth.isAdmin) return { name: 'home' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - 班级通讯录` : '班级通讯录';
});

export default router;
