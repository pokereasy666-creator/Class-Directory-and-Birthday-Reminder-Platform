<script setup lang="ts">
import { Lock, User } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import AuthCard from './AuthCard.vue';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const formRef = ref<FormInstance>();
const form = reactive({ username: '', password: '' });
const loading = ref(false);
const error = ref('');
const rules: FormRules = {
  username: [{ required: true, message: '请输入学号或管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  loading.value = true;
  error.value = '';
  try {
    const user = await auth.login(form.username.trim(), form.password);
    if (user.mustChangePassword) {
      await router.replace({ name: 'password' });
    } else {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
      await router.replace(redirect.startsWith('/') ? redirect : '/');
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthCard title="班级通讯录与生日提醒" subtitle="记住每一位同学的生日">
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="alert" />
    <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="submit">
      <el-form-item prop="username">
        <el-input
          v-model="form.username"
          :prefix-icon="User"
          placeholder="学号 / 管理员账号"
          autocomplete="username"
        />
      </el-form-item>
      <el-form-item prop="password">
        <el-input
          v-model="form.password"
          :prefix-icon="Lock"
          type="password"
          show-password
          placeholder="密码"
          autocomplete="current-password"
        />
      </el-form-item>
      <el-button type="primary" native-type="submit" :loading="loading" class="full"
        >登录</el-button
      >
    </el-form>
    <div class="footer">还没有账号？<router-link to="/register">注册</router-link></div>
  </AuthCard>
</template>

<style scoped>
.alert {
  margin-bottom: 16px;
}
.full {
  width: 100%;
}
.footer {
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
}
</style>
