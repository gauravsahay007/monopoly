<script setup lang="ts">
defineProps<{
  show: boolean;
  title: string;
  message: string;
  loading?: boolean;
}>();

const emit = defineEmits(['confirm', 'cancel']);
</script>

<template>
  <div v-if="show" class="backdrop">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      
      <div class="actions">
        <button class="btn-cancel" @click="$emit('cancel')" :disabled="loading">
          Cancel
        </button>
        <button class="btn-confirm" @click="$emit('confirm')" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span v-else>Confirm</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 400px;
  text-align: center;
  color: white;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

h3 {
  margin-top: 0;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #f3f4f6;
}

p {
  color: #9ca3af;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

button {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #4b5563;
  color: #d1d5db;
}
.btn-cancel:hover {
  background: rgba(255,255,255,0.05);
}

.btn-confirm {
  background: #ef4444;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
}
.btn-confirm:hover {
  background: #dc2626;
  transform: translateY(-1px);
}
.btn-confirm:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.spinner {
  width: 18px; height: 18px;
  border: 2px solid white;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
