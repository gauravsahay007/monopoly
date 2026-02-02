<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../store/gameStore';
import { initPeer, initializeHost } from '../multiplayer/peer';
import { loginWithGoogle } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const router = useRouter();
const store = useGameStore();

const name = ref('');
const roomIdInput = ref('');
const initialized = ref(false);
const peerId = ref('');
const selectedColor = ref('#ef4444');
const authLoading = ref(true);
const recentRoomId = ref<string | null>(null);

const colors = [
    '#b84c4c', '#c87a3a', '#c4a24a', '#4f9a6a', '#4a6fb3', '#7a6fd6', '#b56db8', '#5fa7c6'
];

const rules = ref({
    doubleRentOnSet: false,
    vacationCash: false,
    auction: false,
    prisonNoRent: false,
    mortgage: false,
    evenBuild: true,
    startingCash: 1500,
    randomizeOrder: true,
    mapSelection: 'world'
});

watch(() => rules.value.mapSelection, (newMap) => {
    if (newMap === 'india' || newMap === 'bangalore') {
        rules.value.startingCash = 15000000;
    } else {
        rules.value.startingCash = 1500;
    }
});

watch(() => store.user, async (u) => {
    if (u) {
        console.log("Home: User auth settled:", u.displayName || u.email);
        name.value = u.displayName || u.email?.split('@')[0] || 'Player';
        authLoading.value = false;

        getDoc(doc(db, "users", u.uid)).then(userDoc => {
            if (userDoc.exists()) {
                recentRoomId.value = userDoc.data().lastRoomId;
            }
        }).catch(e => {
            console.warn("Home: Failed to fetch user meta", e);
        });

        if (!initialized.value) {
            initPeer(u.uid, (id) => {
                peerId.value = id;
                initialized.value = true;
            }, (err) => {
                console.warn("Home: Peer UID init failed, fallback to random", err);
                initPeer(undefined, (rid) => {
                    peerId.value = rid;
                    initialized.value = true;
                });
            });
        }
    } else {
        recentRoomId.value = null;
    }
}, { immediate: true });

onMounted(() => {
  setTimeout(() => {
    authLoading.value = false;
    
    if (!store.user && !initialized.value) {
        initPeer(undefined, (id) => {
            peerId.value = id;
            initialized.value = true;
        });
    }
  }, 2000);
});

async function handleGoogleLogin() {
    try {
        const u = await loginWithGoogle();
        store.user = u;
        name.value = u.displayName || '';
    } catch (e) {
        store.notify("Login failed", "error");
    }
}

async function createGame(resume = false) {
  if (!name.value) return store.notify("Please enter your name", "error");
  
  const actualPeerId = peerId.value;
  const storageKey = store.user?.uid || actualPeerId;

  if (!resume) {
      await store.deleteOldGame(storageKey);
      store.resetState(); // Force fresh state
  }
  
  initializeHost(actualPeerId);
  store.setIdentity(actualPeerId, true);
  store.setRoomId(actualPeerId);
  
  let loaded = false;
  if (resume) {
      loaded = await store.loadGame(storageKey);
  }
  
  if (loaded) {
      store.notify("Existing game progress restored!", "success");
  } else {
      store.gameState.settings = { ...store.gameState.settings, ...rules.value };
      store.addPlayer({
        id: actualPeerId,
        uid: store.user?.uid,
        name: name.value,
        cash: rules.value.startingCash,
        position: 0,
        color: selectedColor.value, 
        inJail: false,
        jailTurns: 0,
        isHost: true,
        avatar: '😎'
      });
      if (!resume) store.notify("New game created!", "success");
  }
  
  // Navigate to room
  router.push(`/room/${actualPeerId}`);
}

function joinGame() {
  if (!roomIdInput.value) return store.notify("Enter room ID", "error");
  router.push(`/room/${roomIdInput.value}`);
}

async function rejoinGame() {
    if (!recentRoomId.value) return;
    roomIdInput.value = recentRoomId.value;
    joinGame();
}
</script>

<template>
  <div class="home-container">
    <div class="hero-section">
      <div class="logo-wrapper">
        <img src="../assets/logo.svg" class="logo-icon" alt="Monopoly Logo" />
        <h1 class="logo-text">MONOPOLY</h1>
      </div>
      <p class="tagline">The Classic Board Game, Now Online!</p>
    </div>

    <div v-if="authLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>

    <div v-else class="main-content">
      <!-- Auth Section -->
      <div v-if="!store.user" class="auth-card">
        <h3>Sign in for Better Experience</h3>
        <p class="auth-desc">Save your progress, rejoin games, and track stats</p>
        <button @click="handleGoogleLogin" class="btn-google">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
        <div class="divider">OR</div>
      </div>

      <div class="user-info" v-if="store.user">
        <div class="avatar-circle-dynamic" :style="{ backgroundColor: selectedColor }">
            <img v-if="store.user.photoURL" :src="store.user.photoURL" class="avatar-img-home" />
            <span v-else class="initials-home">{{ (name || 'P').charAt(0).toUpperCase() }}</span>
        </div>
        <div>
          <p class="username">{{ store.user.displayName || store.user.email }}</p>
          <p class="user-email">{{ store.user.email }}</p>
        </div>
      </div>

      <!-- Name & Color Selection -->
      <div class="input-section">
        <div class="input-group">
          <label>Your Name</label>
          <input v-model="name" placeholder="Enter your name" maxlength="20" />
        </div>
        
        <div class="color-selector">
          <label>Your Color</label>
          <div class="color-grid">
            <div
              v-for="c in colors"
              :key="c"
              class="color-option"
              :class="{ selected: selectedColor === c }"
              :style="{ backgroundColor: c }"
              @click="selectedColor = c"
            ></div>
          </div>
        </div>
      </div>

      <!-- Game Settings -->
      <div class="settings-card">
        <h3>Game Settings</h3>
        
        <div class="setting-item">
          <label>Map</label>
          <select v-model="rules.mapSelection">
            <option value="world">Classic World</option>
            <option value="india">India Edition</option>
            <option value="bangalore">Bangalore Edition</option>
          </select>
        </div>

        <div class="setting-item">
          <label>Starting Cash</label>
          <input type="number" v-model.number="rules.startingCash" />
        </div>

        <div class="setting-item checkbox">
          <input type="checkbox" v-model="rules.randomizeOrder" id="randomize" />
          <label for="randomize">Randomize Player Order</label>
        </div>
      </div>

      <!-- Actions -->
      <div class="action-buttons">
        <button @click="createGame(false)" class="btn-primary" :disabled="!name">
          🎮 Create New Game
        </button>
        
        <button v-if="recentRoomId" @click="createGame(true)" class="btn-secondary">
          ♻️ Resume Game
        </button>
      </div>

      <!-- Join Section -->
      <div class="join-section">
        <div class="divider-text">OR JOIN A GAME</div>
        <div class="join-input-group">
          <input v-model="roomIdInput" placeholder="Enter room code" />
          <button @click="joinGame" class="btn-join" :disabled="!roomIdInput">
            Join →
          </button>
        </div>
        <button v-if="recentRoomId" @click="rejoinGame" class="btn-rejoin">
          🔄 Rejoin Last Room
        </button>
      </div>

      <!-- Quick Links -->
      <div class="quick-links">
        <router-link to="/rules" class="link-btn">📖 Game Rules</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1b26 0%, #24283b 100%);
  color: white;
  padding: 2rem;
  overflow-y: auto;
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
}

.logo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 1rem;
}

.logo-icon {
  height: 3rem;
  width: auto;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
}

.logo-text {
  font-family: 'Arial Black', sans-serif;
  font-size: 3rem;
  letter-spacing: 2px;
  background: linear-gradient(to right, #6366f1, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.tagline {
  color: #94a3b8;
  font-size: 1.2rem;
}

.loading-state {
  text-align: center;
  padding: 4rem;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255,255,255,0.1);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.main-content {
  max-width: 500px;
  margin: 0 auto;
}

.auth-card {
  background: rgba(255,255,255,0.05);
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  margin-bottom: 2rem;
  border: 1px solid rgba(255,255,255,0.1);
}

.auth-desc {
  color: #94a3b8;
  margin: 0.5rem 0 1.5rem;
}

.btn-google {
  background: white;
  color: #333;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: transform 0.2s;
}

.btn-google:hover {
  transform: translateY(-2px);
}

.divider {
  margin: 1.5rem 0;
  color: #64748b;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: rgba(255,255,255,0.1);
}

.divider::before { left: 0; }
.divider::after { right: 0; }

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255,255,255,0.05);
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 2rem;
}

.avatar-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.username {
  font-weight: 600;
  margin: 0;
}

.user-email {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0;
}

.input-section {
  margin-bottom: 2rem;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #cbd5e1;
  font-weight: 500;
}

.input-group input {
  width: 100%;
  padding: 12px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  color: white;
  font-size: 1rem;
}

.color-selector label {
  display: block;
  margin-bottom: 0.5rem;
  color: #cbd5e1;
  font-weight: 500;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}

.color-option {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all 0.2s;
}

.color-option.selected {
  border-color: white;
  transform: scale(1.1);
}

.settings-card {
  background: rgba(255,255,255,0.05);
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  border: 1px solid rgba(255,255,255,0.1);
}

.settings-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.setting-item {
  margin-bottom: 1rem;
}

.setting-item label {
  display: block;
  margin-bottom: 0.5rem;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.setting-item select,
.setting-item input[type="number"] {
  width: 100%;
  padding: 10px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  color: white;
}

.setting-item.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-item.checkbox input {
  width: auto;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn-primary,
.btn-secondary {
  padding: 14px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 2px solid #22c55e;
}

.btn-secondary:hover {
  background: rgba(34, 197, 94, 0.3);
}

.join-section {
  background: rgba(255,255,255,0.05);
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  border: 1px solid rgba(255,255,255,0.1);
}

.divider-text {
  text-align: center;
  color: #64748b;
  margin-bottom: 1rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.join-input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 1rem;
}

.join-input-group input {
  flex: 1;
  padding: 12px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  color: white;
}

.btn-join {
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

.btn-join:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-rejoin {
  width: 100%;
  padding: 10px;
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid #3b82f6;
  border-radius: 8px;
  cursor: pointer;
}

.quick-links {
  text-align: center;
  margin-top: 2rem;
}

.link-btn {
  color: #94a3b8;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.2s;
  display: inline-block;
}


.link-btn:hover {
  background: rgba(255,255,255,0.1);
  color: white;
}

.avatar-circle-dynamic {
  width: 48px; height: 48px;
  border-radius: 50%;
  overflow: hidden;
  display: flex; justify-content: center; align-items: center;
  border: 2px solid rgba(255,255,255,0.2);
  flex-shrink: 0;
}
.avatar-img-home { width: 100%; height: 100%; object-fit: cover; }
.initials-home { font-size: 1.2rem; font-weight: bold; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
</style>
