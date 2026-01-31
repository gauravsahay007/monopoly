<script setup lang="ts">
import { useGameStore } from '../store/gameStore';
const store = useGameStore();
</script>

<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div 
        v-for="n in store.notifications" 
        :key="n.id" 
        class="toast" 
        :class="n.type"
      >
        <div class="toast-content">
          <span v-if="n.type === 'success'" class="icon">✅</span>
          <span v-else-if="n.type === 'error'" class="icon">❌</span>
          <span v-else class="icon">ℹ️</span>
          <p>{{ n.message }}</p>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  min-width: 250px;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  pointer-events: auto;
}

.toast.success {
  border-left: 4px solid #10b981;
}

.toast.error {
  border-left: 4px solid #ef4444;
}

.toast.info {
  border-left: 4px solid #3b82f6;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toast-content p {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
}

.icon {
  font-size: 1.2rem;
}

/* Animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}
</style>
