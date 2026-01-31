<script setup lang="ts">
defineProps<{ 
    avatar?: string; 
    size?: string;
}>();
</script>

<template>
  <div class="avatar-wrapper" :style="{ width: size || '32px', height: size || '32px' }">
      <img 
        v-if="avatar?.startsWith('http')" 
        :src="avatar" 
        class="avatar-img"
        alt="avatar"
      />
      <!-- If it's an SVG string (DiceBear) or Emoji -->
      <div 
        v-else 
        class="avatar-content" 
        v-html="avatar || '👤'"
      ></div>
  </div>
</template>

<style scoped>
.avatar-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    border-radius: 50%;
}

.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.avatar-content {
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.2rem; /* adaptable? */
    width: 100%;
    height: 100%;
}
/* Ensure inner SVG scales */
:deep(svg) {
    width: 100%;
    height: 100%;
}
</style>
