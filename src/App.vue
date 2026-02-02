<script setup lang="ts">
import { onMounted } from 'vue';
import { useGameStore } from './store/gameStore';
import { auth } from './firebase';
import Toast from './components/Toast.vue';

const store = useGameStore();

onMounted(() => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      store.user = user;
    } else {
      store.user = null;
    }
  });
});
</script>

<template>
  <div class="app-container">
    <Toast />
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  background: var(--bg-dark);
  color: var(--text-light);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
