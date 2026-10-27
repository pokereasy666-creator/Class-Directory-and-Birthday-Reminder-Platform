<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { reactive, ref } from 'vue';
import { authApi } from '@/api';
import { ApiError } from '@/api/http';
import { rules as r } from '@/utils/validators';
import AuthCard from './AuthCard.vue';

const formRef = ref<FormInstance>();
const form = reactive({ studentNo: '', name: '', phone: '', password: '', confirm: '' });
const loading = ref(false);
const error = ref('');
const done = ref(false);

const rules: FormRules = {
  studentNo: r.studentNo(),
  name: r.name(),
  phone: r.phone(),
  password: r.password(),
  confirm: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) =>
        value === form.password ? callback() : callback(new Error('两次输入的密码不一致')),
      trigger: 'blur',
    },
  ],
};

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  loading.value = true;
  error.value = '';
  try {
    await authApi.register({
      studentNo: form.studentNo.trim(),
      name: form.name.trim(),
      password: form.password,
      phone: form.phone.trim() || undefined,
    });
    done.value = true;
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '注册失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthCard title="注册账号" :subtitle="done ? undefined : '注册后需班长或班主任审核通过才能登录'">
    <el-result
      v-if="done"
      icon="success"
      title="注册成功"
      sub-title="请等待管理员审核，审核通过后即可用学号登录"
    >
      <template #extra>
        <router-link to="/login"><el-button type="primary">返回登录</el-button></router-link>
      </template>
    </el-result>
    <template v-else>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="alert"
      />
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-form-item label="学号（登录账号）" prop="studentNo">
          <el-input v-model="form.studentNo" placeholder="如 2022010101" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请填写真实姓名，便于审核" />
        </el-form-item>
        <el-form-item label="手机号（选填）" prop="phone">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="6~32 位，包含字母和数字"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm">
          <el-input
            v-model="form.confirm"
            type="password"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" class="full"
          >提交注册</el-button
        >
      </el-form>
      <div class="footer">已有账号？<router-link to="/login">去登录</router-link></div>
    </template>
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
