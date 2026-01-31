<script setup lang="ts">
import { useGameStore } from './store/gameStore';
import Lobby from './components/Lobby.vue';
import Board from './components/Board.vue';
import PlayerPanel from './components/PlayerPanel.vue';

const store = useGameStore();
</script>

<template>
  <div class="app-container">
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
