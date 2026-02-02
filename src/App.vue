<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useGameStore } from './store/gameStore';
import { auth } from './firebase';
import Toast from './components/Toast.vue';
import Header from './components/Header.vue';

const route = useRoute();
const store = useGameStore();

// Hide header during gameplay
const showHeader = computed(() => {
  // Hide header when in a room and game is playing
  if (route.path.startsWith('/room/')) {
    return store.gameState.status === 'LOBBY';
  }
  return true;
});

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
    <Header v-if="showHeader" />
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
  min-height: 100vh;
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
