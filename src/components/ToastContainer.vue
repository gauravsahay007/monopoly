<script setup lang="ts">
import { useGameStore } from '../store/gameStore';

const store = useGameStore();
</script>

<template>
  <div class="toast-container">
    <transition-group name="toast-slide">
       <div 
         v-for="n in store.notifications" 
         :key="n.id" 
         class="toast" 
         :class="n.type"
       >
          <span class="icon" v-if="n.type === 'success'">✅</span>
          <span class="icon" v-if="n.type === 'error'">🚨</span>
          <span class="icon" v-if="n.type === 'info'">ℹ️</span>
          {{ n.message }}
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
    pointer-events: none; /* Let clicks pass specific areas */
}

.toast {
    background: #1e293b;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 250px;
    max-width: 400px;
    border-left: 4px solid #3b82f6;
    font-weight: 500;
    pointer-events: auto;
}

.toast.success { border-left-color: #22c55e; }
.toast.error { border-left-color: #ef4444; }
.toast.info { border-left-color: #3b82f6; }

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s ease;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
