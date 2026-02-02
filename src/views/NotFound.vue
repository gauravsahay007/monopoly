<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="not-found-container">
    <div class="error-content">
      <div class="error-icon">🎲</div>
      <h1 class="error-title">404</h1>
      <h2 class="error-subtitle">Page Not Found</h2>
      <p class="error-message">
        Oops! This page doesn't exist. You might have rolled the wrong number!
      </p>
      <div class="error-actions">
        <button @click="router.push('/')" class="btn-home">
          🏠 Go Home
        </button>
        <button @click="router.back()" class="btn-back">
          ← Go Back
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a1b26 0%, #24283b 100%);
  color: white;
  padding: 2rem;
}

.error-content {
  text-align: center;
  max-width: 600px;
}

.error-icon {
  font-size: 5rem;
  margin-bottom: 1rem;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.error-title {
  font-size: 6rem;
  margin: 0;
  background: linear-gradient(to right, #6366f1, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 900;
}

.error-subtitle {
  font-size: 2rem;
  margin: 1rem 0;
  color: #cbd5e1;
}

.error-message {
  font-size: 1.2rem;
  color: #94a3b8;
  margin: 2rem 0;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

.btn-home,
.btn-back {
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-home {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.btn-home:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
}

.btn-back {
  background: transparent;
  border: 2px solid #94a3b8;
  color: #94a3b8;
}

.btn-back:hover {
  background: rgba(148, 163, 184, 0.1);
  border-color: #cbd5e1;
  color: #cbd5e1;
}

@media (max-width: 768px) {
  .error-title {
    font-size: 4rem;
  }

  .error-subtitle {
    font-size: 1.5rem;
  }

  .error-message {
    font-size: 1rem;
  }

  .error-actions {
    flex-direction: column;
  }

  .btn-home,
  .btn-back {
    width: 100%;
  }
}
</style>
