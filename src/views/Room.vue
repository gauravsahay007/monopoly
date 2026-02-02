<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../store/gameStore';
import { initPeer, connectToHost } from '../multiplayer/peer';
import Board from '../components/Board.vue';
import PlayerPanel from '../components/PlayerPanel.vue';

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
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#64748b'
];

// Check if user is in a game
const inGame = computed(() => store.gameState.status !== 'LOBBY');

// Detect if this is a direct room link (not from home page)
onMounted(async () => {
  const roomIdFromRoute = props.roomId;
  
  // Check if user came from home (has setup completed) or direct link
  if (!store.myId) {
    // Direct link - need to setup peer and join
    isJoining.value = true;
    showNamePrompt.value = true;
    
    // Initialize peer
    if (store.user) {
      name.value = store.user.displayName || store.user.email?.split('@')[0] || '';
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

async function joinRoom() {
  if (!name.value || !initialized.value) {
    store.notify("Please enter your name", "error");
    return;
  }

  joining.value = true;
  
  store.setIdentity(peerId.value, false);
  store.setRoomId(props.roomId);
  
  connectToHost(props.roomId, () => {
    store.requestAction({
      type: 'JOIN',
      payload: {
        id: peerId.value,
        uid: store.user?.uid,
        name: name.value,
        cash: 1500,
        position: 0,
        color: selectedColor.value,
        inJail: false,
        jailTurns: 0,
        isHost: false,
        avatar: '🎮'
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

function leaveRoom() {
  if (confirm('Are you sure you want to leave this room?')) {
    router.push('/');
  }
}
</script>

<template>
  <div class="room-container">
    <!-- Join Prompt for Direct Links -->
    <div v-if="showNamePrompt" class="join-prompt">
      <div class="prompt-card">
        <h2>Join Game Room</h2>
        <p>Enter your details to join room: <span class="code">{{ roomId }}</span></p>
        
        <div class="input-group">
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
              :class="{ selected: selectedColor === c }"
              :style="{ backgroundColor: c }"
              @click="selectedColor = c"
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
  </div>
</template>

<style scoped>
.room-container {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #1a1b26 0%, #24283b 100%);
  color: white;
  overflow: hidden;
}

/* Join Prompt */
.join-prompt {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  padding: 2rem;
}

.prompt-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 2.5rem;
  max-width: 500px;
  width: 100%;
  backdrop-filter: blur(10px);
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

.code {
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  padding: 4px 12px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 1.1rem;
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

.color-selector {
  margin-bottom: 2rem;
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

.prompt-actions {
  display: flex;
  gap: 1rem;
}

.btn-join,
.btn-cancel {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-join {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.btn-join:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  background: transparent;
  border: 2px solid #ef4444;
  color: #ef4444;
}

.loading-text {
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
  margin-top: 1rem;
}

/* Game View */
.game-view {
  display: flex;
  width: 100%;
  height: 100%;
}

/* Waiting Room */
.waiting-room {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 2rem;
  position: relative;
}

.player-joining-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.loader-content {
  text-align: center;
}

.spinner-large {
  width: 60px;
  height: 60px;
  border: 5px solid rgba(255,255,255,0.1);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.room-header {
  text-align: center;
  margin-bottom: 2rem;
}

.back-btn {
  background: rgba(255,255,255,0.1);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 1rem;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255,255,255,0.2);
}

.room-header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(to right, #6366f1, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.room-info {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  text-align: center;
}

.room-info h2 {
  margin: 0 0 1rem;
  font-size: 1.5rem;
}

.share-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-icon {
  background: rgba(99, 102, 241, 0.2);
  color: white;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: rgba(99, 102, 241, 0.4);
  transform: scale(1.1);
}

.share-text {
  color: #94a3b8;
  margin-bottom: 2rem;
}

.player-list {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 1.5rem;
  min-width: 400px;
  max-width: 500px;
  margin-bottom: 2rem;
}

.player-list h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #cbd5e1;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  border-radius: 10px;
  margin-bottom: 8px;
}

.swatch-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.3);
}

.p-name {
  flex: 1;
  font-weight: 600;
  font-size: 1.1rem;
}

.badge {
  background: #6366f1;
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.host-actions {
  text-align: center;
}

.btn-start {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  padding: 16px 48px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1.3rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(99, 102, 241, 0.5);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.player-count-hint {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0;
}

.blocked-host {
  background: rgba(239, 68, 68, 0.1);
  border: 2px solid #ef4444;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  max-width: 400px;
}

.warning-text {
  color: #fca5a5;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.blocked-host p {
  color: #94a3b8;
  margin: 0.5rem 0;
}

.blocked-host a {
  color: #6366f1;
  text-decoration: underline;
}

.waiting-text {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255,255,255,0.1);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.waiting-text p {
  color: #94a3b8;
}

@media (max-width: 768px) {
  .game-view {
    flex-direction: column;
  }

  .player-list {
    min-width: auto;
    width: 100%;
  }

  .prompt-card {
    padding: 1.5rem;
  }

  .color-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
