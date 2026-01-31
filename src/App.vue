<script setup lang="ts">
import { onMounted } from 'vue';
import { useGameStore } from './store/gameStore';
import { auth } from './firebase';
import Lobby from './components/Lobby.vue';
import Board from './components/Board.vue';
import PlayerPanel from './components/PlayerPanel.vue';
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
    <transition name="fade" mode="out-in">
      <div v-if="store.gameState.status === 'LOBBY'" key="lobby" class="lobby-view">
        <Lobby />
      </div>
      
      <div v-else key="game" class="game-view">
        <Board />
        <PlayerPanel />
      </div>
    </transition>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  background: var(--bg-dark);
  color: var(--text-light);
}

.lobby-view {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.game-view {
  display: flex;
  width: 100%;
  height: 100%;
}

/* Mobile responsive layout */
@media (max-width: 768px) {
  .game-view {
    flex-direction: column;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
