<template>
  <div class="spinner-container">
      <div class="spinner"></div>
      <div v-if="text" class="loading-text">{{ text }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ text?: string }>();
</script>

<style scoped>
.spinner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255,255,255,0.1);
    border-top-color: #7aa2f7; /* Primary color */
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
}

.loading-text {
    color: #94a3b8;
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.5px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
