<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { useGameStore } from '../store/gameStore';

const router = useRouter();
const route = useRoute();
const store = useGameStore();

function goHome() {
  if (store.gameState.status !== 'LOBBY') {
    if (confirm('This will leave the current game. Are you sure?')) {
      router.push('/');
    }
  } else {
    router.push('/');
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <div class="logo-section" @click="goHome">
        <img src="../assets/logo.svg" class="header-logo" alt="Monopoly" />
        <h1 class="header-title">MONOPOLY</h1>
      </div>
      
      <nav class="nav-links">
        <router-link to="/" class="nav-link" :class="{ active: route.path === '/' }">
          🏠 Home
        </router-link>
        <router-link to="/rules" class="nav-link" :class="{ active: route.path === '/rules' }">
          📖 Rules
        </router-link>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: linear-gradient(135deg, rgba(26, 27, 38, 0.95) 0%, rgba(36, 40, 59, 0.95) 100%);
  border-bottom: 1px solid rgba(99, 102, 241, 0.3);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0.75rem 2rem;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}

.logo-section:hover {
  transform: scale(1.02);
}

.header-logo {
  height: 2rem;
  width: auto;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

.header-title {
  font-family: 'Arial Black', sans-serif;
  font-size: 1.5rem;
  letter-spacing: 1px;
  background: linear-gradient(to right, #6366f1, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  color: #94a3b8;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: all 0.2s;
  font-weight: 600;
  font-size: 0.95rem;
}

.nav-link:hover {
  background: rgba(99, 102, 241, 0.1);
  color: #a5b4fc;
}

.nav-link.active {
  background: rgba(99, 102, 241, 0.2);
  color: #6366f1;
}

@media (max-width: 768px) {
  .app-header {
    padding: 0.5rem 1rem;
  }

  .header-title {
    font-size: 1.2rem;
  }

  .header-logo {
    height: 1.5rem;
  }

  .nav-links {
    gap: 0.5rem;
  }

  .nav-link {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
  }
}
</style>
