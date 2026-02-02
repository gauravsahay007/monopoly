<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../store/gameStore';
import { initPeer, connectToHost } from '../multiplayer/peer';
import { loginWithGoogle } from '../firebase';
import Board from '../components/Board.vue';
import PlayerPanel from '../components/PlayerPanel.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import confetti from 'canvas-confetti';

const router = useRouter();
const store = useGameStore();

const props = defineProps<{
  roomId: string
}>();

const name = ref('');
const initialized = ref(false);
const peerId = ref('');
const joining = ref(false);
const isJoining = ref(false); // Track if user came from a direct link
const selectedColor = ref('#ef4444');
const showNamePrompt = ref(false);
const playerJoining = ref(false); // Loading state for when new player joins

const colors = [
    '#b84c4c', '#c87a3a', '#c4a24a', '#4f9a6a', '#4a6fb3', '#7a6fd6', '#b56db8', '#5fa7c6'
];

// Check if user is in a game
const inGame = computed(() => store.gameState.status !== 'LOBBY');

const takenColors = computed(() => store.gameState.players.map(p => p.color));

// Auto-fill name when user logs in (or session restores)
watch(() => store.user, (u) => {
  if (u) {
    name.value = u.displayName || u.email?.split('@')[0] || '';
  }
}, { immediate: true });

// Detect if this is a direct room link (not from home page)
onMounted(async () => {
  const roomIdFromRoute = props.roomId;
  
  // Check if user came from home (has setup completed) or direct link
  if (!store.myId) {
    // Direct link - need to setup peer and join
    isJoining.value = true;
    showNamePrompt.value = true;
    
    // Initialize peer
    // Note: We use whatever user state is available now. 
    // If persistence loads later, we still use this peer connection, 
    // but the JOIN payload will include the correct UID.
    if (store.user) {
      // name.value handled by watcher
      initPeer(store.user.uid, (id) => {
        peerId.value = id;
        initialized.value = true;
      }, () => {
        initPeer(undefined, (id) => {
          peerId.value = id;
          initialized.value = true;
        });
      });
    } else {
      initPeer(undefined, (id) => {
        peerId.value = id;
        initialized.value = true;
      });
    }
  } else if (store.isHost && store.roomId === roomIdFromRoute) {
    // User created game from home page - already setup
    isJoining.value = false;
  } else if (store.roomId !== roomIdFromRoute) {
    // User wants to join a different room
    isJoining.value = true;
    showNamePrompt.value = !name.value;
  }
});

// Watch for new players joining (for loader)
watch(() => store.gameState.players.length, (newCount, oldCount) => {
  if (oldCount && newCount > oldCount) {
    // New player joined
    playerJoining.value = true;
    setTimeout(() => {
      playerJoining.value = false;
    }, 1500);
  }
});

const gameOverCountdown = ref(5);
let countdownTimer: any = null;

function startGameOverSequence() {
    gameOverCountdown.value = 5;
    countdownTimer = setInterval(() => {
        gameOverCountdown.value--;
        if (gameOverCountdown.value <= 0) {
            goHomeNow();
        }
    }, 1000);
}

async function goHomeNow() {
    if (countdownTimer) clearInterval(countdownTimer);
    
    // Host cleans up global state
    if (store.isHost && store.roomId) {
        await store.deleteOldGame(store.roomId); 
    }
    
    // Everyone resets local state
    store.resetState();
    
    router.push('/');
}

// Watch for game ending - redirect to home
let wasPlaying = false;
watch(() => store.gameState.status, (newStatus, oldStatus) => {
  if (oldStatus === 'PLAYING') {
    wasPlaying = true;
  }
  
  if (newStatus === 'GAME_OVER') {
      triggerConfetti();
      startGameOverSequence();
  }
  
  // If game was playing and now returned to LOBBY, go home
  if (wasPlaying && newStatus === 'LOBBY') {
    wasPlaying = false;
    setTimeout(() => {
      router.push('/');
    }, 500);
  }
});

function triggerConfetti() {
    const duration = 5000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

async function handleGoogleLogin() {
  try {
    const u = await loginWithGoogle();
    store.user = u;
    name.value = u.displayName || u.email?.split('@')[0] || '';
  } catch (e) {
    store.notify("Login failed", "error");
  }
}

async function joinRoom() {
  if (!name.value || !initialized.value) {
    store.notify("Please enter your name", "error");
    return;
  }

  // Ensure color is not taken (if we have state)
  if (takenColors.value.includes(selectedColor.value)) {
      // Pick random available
      const available = colors.filter(c => !takenColors.value.includes(c));
      const nextColor = available[0];
      if (typeof nextColor === 'string') {
          selectedColor.value = nextColor;
          store.notify("Color was taken, switching to another.", "info");
      } else {
          store.notify("Room is full (colors exhausted)", "error");
          return;
      }
  }

  joining.value = true;
  
  store.setIdentity(peerId.value, false);
  store.setRoomId(props.roomId);
  
  connectToHost(props.roomId, () => {
    store.requestAction({
      type: 'JOIN',
      payload: {
        id: peerId.value,
        uid: store.user?.uid || '',
        name: name.value,
        cash: 1500,
        position: 0,
        color: selectedColor.value,
        inJail: false,
        jailTurns: 0,
        isHost: false,
        avatar: store.user?.photoURL || ''
      },
      from: peerId.value
    });
    showNamePrompt.value = false;
    joining.value = false;
  }, () => {
    store.notify("Failed to connect to room", "error");
    joining.value = false;
    // Redirect to home after failed connection
    setTimeout(() => router.push('/'), 2000);
  });
}

function copyRoomCode() {
    navigator.clipboard.writeText(store.roomId!);
    store.notify("Room code copied!", "success");
}

function copyRoomLink() {
    const link = `${window.location.origin}/room/${store.roomId}`;
    navigator.clipboard.writeText(link);
    store.notify("Room link copied!", "success");
}

function startGame() {
  store.requestAction({ type: 'START_GAME', payload: {}, from: store.myId! });
}

const showLeaveConfirm = ref(false);
const isLeaving = ref(false);

function leaveRoom() {
  showLeaveConfirm.value = true;
}

function confirmLeave() {
  isLeaving.value = true;
  setTimeout(() => {
    router.push('/');
  }, 1500); // Loader visible for 1.5s
}
</script>

<template>
  <div class="room-container">
    <!-- Join Prompt for Direct Links -->
    <div v-if="showNamePrompt" class="join-prompt">
      <div class="prompt-card">
        <h2>Join Game Room</h2>
        <p>Enter your details to join room: <span class="code">{{ roomId }}</span></p>
        
        <!-- Google Sign In Option -->
        <div v-if="!store.user" class="google-signin-section">
          <button @click="handleGoogleLogin" class="btn-google">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          <div class="divider-or">OR</div>
        </div>

        <div v-if="store.user" class="user-info-small">
          <div class="user-avatar-small">
            <img v-if="store.user.photoURL" :src="store.user.photoURL" alt="Profile" />
            <div v-else class="avatar-placeholder">👤</div>
          </div>
          <span>{{ store.user.displayName || store.user.email }}</span>
        </div>
        
        <!-- Only show name input if NOT logged in (per request) -->
        <div class="input-group" v-if="!store.user">
          <label>Your Name</label>
          <input v-model="name" placeholder="Enter your name" maxlength="20" @keyup.enter="joinRoom" />
        </div>
        
        <div class="color-selector">
          <label>Your Color</label>
          <div class="color-grid">
            <div
              v-for="c in colors"
              :key="c"
              class="color-option"
              :class="{ selected: selectedColor === c, disabled: takenColors.includes(c) }"
              :style="{ backgroundColor: c }"
              @click="!takenColors.includes(c) && (selectedColor = c)"
            ></div>
          </div>
        </div>

        <div class="prompt-actions">
          <button @click="joinRoom" :disabled="!name || joining || !initialized" class="btn-join">
            {{ joining ? 'Joining...' : 'Join Room' }}
          </button>
          <button @click="router.push('/')" class="btn-cancel">
            Cancel
          </button>
        </div>

        <p v-if="!initialized" class="loading-text">⏳ Initializing connection...</p>
      </div>
    </div>

    <!-- Game View -->
    <div v-else-if="inGame" class="game-view">
      <Board />
      <PlayerPanel />
    </div>

    <!-- Waiting Room -->
    <div v-else class="waiting-room">
      <!-- Player Joining Loader Overlay -->
      <div v-if="playerJoining" class="player-joining-overlay">
        <div class="loader-content">
          <div class="spinner-large"></div>
          <p>New player joining...</p>
        </div>
      </div>

      <div class="room-header">
        <button @click="leaveRoom" class="back-btn">← Leave Room</button>
        <h1>Waiting Room</h1>
      </div>

      <div class="room-info">
          <h2>Room Code: <span class="code">{{ store.roomId }}</span></h2>
          <div class="share-actions">
              <button class="btn-icon" title="Copy Code" @click="copyRoomCode">📋</button>
              <button class="btn-icon" title="Copy Link" @click="copyRoomLink">🔗</button>
          </div>
      </div>
      <p class="share-text">Share the code or link with your friends!</p>
      
      <div class="player-list">
        <h3>Players ({{ store.gameState.players.length }})</h3>
        <div v-for="p in store.gameState.players" :key="p.id" class="player-item">
          <div class="swatch-small" :style="{ backgroundColor: p.color }"></div>
          <span class="p-name">{{ p.name }}</span>
          <span v-if="p.isHost" class="badge">HOST</span>
        </div>
      </div>
      
      <!-- Only show start button if user is host AND came from home page -->
      <div v-if="store.isHost && !isJoining" class="host-actions">
        <button @click="startGame" class="btn-start" :disabled="store.gameState.players.length < 1">
          🎮 START GAME
        </button>
        <p class="player-count-hint">Minimum 1 player required</p>
      </div>
      <div v-else-if="store.isHost && isJoining" class="blocked-host">
        <p class="warning-text">⚠️ You joined via a room link</p>
        <p>Please go to the <router-link to="/">Home Page</router-link> to create and start a new game</p>
      </div>
      <div v-else class="waiting-text">
        <div class="spinner"></div>
        <p>Waiting for host to start the game...</p>
      </div>
    </div>
    
    <div v-if="store.gameState.status === 'GAME_OVER' && store.gameState.winner" class="winner-overlay">
       <div class="winner-card">
          <h1 class="winner-title">🏆 WINNER! 🏆</h1>
          
          <div class="winner-avatar-large" :style="{ backgroundColor: store.gameState.winner.color }">
              <img v-if="store.gameState.winner.avatar?.startsWith('http')" :src="store.gameState.winner.avatar" class="winner-img" />
              <span v-else class="winner-initial">{{ store.gameState.winner.name[0] }}</span>
          </div>

          <h2 class="winner-name">{{ store.gameState.winner.name }}</h2>
          <p class="winner-cash">Total Wealth: {{ store.currencySymbol }}{{ store.formatCurrency(store.gameState.winner.cash) }}</p>
          
          <div class="countdown-section">
             Going to home in <span class="count-big">{{ gameOverCountdown }}</span>
          </div>
          
          <button @click="goHomeNow" class="btn-home-now">Go Home Now</button>
       </div>
    </div>
    
    <ConfirmDialog 
      :show="showLeaveConfirm"
      title="Leave Room?"
      message="Are you sure you want to leave this room? You will be disconnected."
      :loading="isLeaving"
      @confirm="confirmLeave"
      @cancel="showLeaveConfirm = false"
    />
  </div>
</template>

<style scoped>
.room-container {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1b26 0%, #24283b 100%);
  color: white;
  overflow-y: auto;
}

/* Join Prompt */
.join-prompt {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
  overflow-y: auto;
}

.prompt-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 2.5rem;
  max-width: 500px;
  width: 100%;
  backdrop-filter: blur(10px);
  max-height: 90vh;
  overflow-y: auto;
}

.prompt-card h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  text-align: center;
  background: linear-gradient(to right, #6366f1, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.prompt-card p {
  text-align: center;
  color: #94a3b8;
  margin-bottom: 1.5rem;
}

.google-signin-section {
  margin-bottom: 1.5rem;
}

.btn-google {
  width: 100%;
  background: white;
  color: #333;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s;
  margin-bottom: 1rem;
}

.btn-google:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.divider-or {
  text-align: center;
  color: #64748b;
  position: relative;
  margin: 1rem 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.divider-or::before,
.divider-or::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 42%;
  height: 1px;
  background: rgba(255,255,255,0.1);
}

.divider-or::before { left: 0; }
.divider-or::after { right: 0; }

.user-info-small {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(99, 102, 241, 0.1);
  padding: 12px;
  border-radius: 10px;
  margin-bottom: 1.5rem;
}

.user-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 1.2rem;
}

.code {
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  padding: 4px 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 1.2em;
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
  margin-bottom: 2rem;
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

.color-option.disabled {
  opacity: 0.2;
  cursor: not-allowed;
  border: 1px solid #555;
}

.prompt-actions {
  display: flex;
  gap: 1rem;
}

.btn-join {
  flex: 1;
  padding: 12px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

.btn-join:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 12px 20px;
  background: transparent;
  border: 1px solid #475569;
  color: #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
}

.loading-text {
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
  margin-top: 1rem;
}

/* Game View */
.game-view {
  width: 100%;
  height: 100vh;
  display: flex;
}

/* Waiting Room */
.waiting-room {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.room-header {
  position: relative;
  margin-bottom: 2rem;
}

.back-btn {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.1);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}

.room-info {
  background: rgba(255,255,255,0.05);
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  display: inline-block;
  min-width: 300px;
}

.share-actions {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 10px;
}

.btn-icon {
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    width: 36px; height: 36px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}
.btn-icon:hover { background: rgba(255,255,255,0.2); }

.share-text {
  color: #94a3b8;
  margin-bottom: 3rem;
}

.player-list {
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.player-item:last-child {
  border-bottom: none;
}

.swatch-small {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.p-name {
  font-weight: 600;
  flex: 1;
  text-align: left;
}

.badge {
  background: #f59e0b;
  color: black;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-start {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  border: none;
  padding: 16px 40px;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
  transition: all 0.2s;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(34, 197, 94, 0.5);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.player-count-hint {
  margin-top: 1rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.blocked-host {
  background: rgba(239, 68, 68, 0.1);
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.waiting-text {
  color: #94a3b8;
  margin-top: 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.spinner-large {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255,255,255,0.1);
  border-top-color: #ec4899;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.player-joining-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
}

.loader-content {
  text-align: center;
  background: #24283b;
  padding: 30px;
  border-radius: 15px;
  border: 1px solid #334155;
}

/* Winner Overlay */
.winner-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex; justify-content: center; align-items: center;
  animation: fadeIn 0.5s ease;
}

.winner-card {
  background: linear-gradient(135deg, #1e293b, #0f172a);
  border: 2px solid #fbbf24;
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 0 50px rgba(251, 191, 36, 0.3);
  max-width: 400px;
  width: 90%;
}

.winner-title {
  color: #fbbf24;
  font-size: 2.5rem;
  margin-bottom: 2rem;
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
}

.winner-avatar-large {
  width: 120px; height: 120px;
  border-radius: 50%;
  margin: 0 auto 1.5rem;
  overflow: hidden;
  border: 4px solid white;
  display: flex; justify-content: center; align-items: center;
  box-shadow: 0 10px 20px rgba(0,0,0,0.5);
}

.winner-img { width: 100%; height: 100%; object-fit: cover; }
.winner-initial { font-size: 4rem; color: white; font-weight: bold; }

.winner-name { color: white; margin-bottom: 0.5rem; font-size: 2rem; }
.winner-cash { color: #34d399; font-size: 1.2rem; margin-bottom: 2rem; }

.countdown-section {
  color: #9ca3af;
  margin-bottom: 1.5rem;
}
.count-big { color: white; font-weight: bold; font-size: 1.5rem; }

.btn-home-now {
  background: white; color: #1e293b;
  border: none; padding: 12px 24px;
  border-radius: 8px; font-weight: bold; font-size: 1rem;
  cursor: pointer;
  transition: transform 0.2s;
}
.btn-home-now:hover { transform: scale(1.05); }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }


@media (max-width: 960px) {
  .game-view {
    flex-direction: column !important;
    height: auto !important;
    min-height: 100vh;
  }
}
</style>
