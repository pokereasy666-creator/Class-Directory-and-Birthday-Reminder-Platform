<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="logo">🎂</div>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="muted">{{ subtitle }}</p>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #ecf5ff 0%, #fef0f0 100%);
}
.auth-card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  border-radius: 12px;
  padding: 32px 28px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.logo {
  font-size: 40px;
  text-align: center;
}
h1 {
  margin: 8px 0 4px;
  font-size: 22px;
  text-align: center;
}
p {
  text-align: center;
  margin: 0 0 24px;
}
</style>
