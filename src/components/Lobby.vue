<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useGameStore } from '../store/gameStore';
import { initPeer, connectToHost } from '../multiplayer/peer';
import { loginWithGoogle, auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const store = useGameStore();

const name = ref('');
const roomIdInput = ref('');
const initialized = ref(false);
const peerId = ref('');
const showRules = ref(false);
const selectedColor = ref('#ef4444');
const authLoading = ref(true);
const recentRoomId = ref<string | null>(null);
const joining = ref(false);

const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#64748b'
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

// Watch rules to update defaults based on map
watch(() => rules.value.mapSelection, (newMap) => {
    if (newMap === 'india' || newMap === 'bangalore') {
        rules.value.startingCash = 15000000;
    } else {
        rules.value.startingCash = 1500;
    }
});

onMounted(() => {
  // Check for room in URL
  const urlParams = new URLSearchParams(window.location.search);
  const rId = urlParams.get('room');
  if (rId) roomIdInput.value = rId;

  // Listen to Auth State
  auth.onAuthStateChanged(async (user) => {
      if (user) {
          console.log("Auth: Logged in as", user.displayName);
          store.user = user;
          name.value = user.displayName || 'Player';
          
          // Fetch Recent Room
          try {
              const userDoc = await getDoc(doc(db, "users", user.uid));
              if (userDoc.exists()) {
                  recentRoomId.value = userDoc.data().lastRoomId;
              }
          } catch (e) {
              console.warn("Firestore read failed", e);
          }

          // Initialize Peer with UID
          initPeer(user.uid, (id) => {
             peerId.value = id;
             initialized.value = true;
          }, (err) => {
             console.warn("Peer UID init failed (tab conflict?), falling back to random", err);
             initPeer(undefined, (id) => {
                 peerId.value = id;
                 initialized.value = true;
             });
          });
      } else {
          console.log("Auth: Not logged in");
          store.user = null;
          // Anonymous Peer Init
          initPeer(undefined, (id) => {
             peerId.value = id;
             initialized.value = true;
          });
      }
      authLoading.value = false;
  });
});

async function handleGoogleLogin() {
    try {
        await loginWithGoogle();
        // Auth state listener will handle the rest
    } catch (e) {
        store.notify("Login failed", "error");
    }
}

async function createGame() {
  if (!name.value) return alert("Enter name");
  
  // Use actual peer ID (which matches UID if logged in successfully)
  const actualId = peerId.value;
  store.setIdentity(actualId, true); // Host
  store.setRoomId(actualId);
  
  // Save room preferences/ID to Firestore if logged in
  if (store.user) {
      setDoc(doc(db, "users", store.user.uid), {
          lastRoomId: actualId,
          lastAccessed: Date.now()
      }, { merge: true });
  }
  
  store.gameState.settings = { ...store.gameState.settings, ...rules.value };
  
  store.addPlayer({
    id: actualId,
    name: name.value,
    cash: rules.value.startingCash,
    position: 0,
    color: selectedColor.value, 
    inJail: false,
    jailTurns: 0,
    isHost: true,
    avatar: store.user?.photoURL || '😎'
  });
}

function joinGame() {
  if (!name.value || !roomIdInput.value) return alert("Enter name and room ID");
  
  joining.value = true;
  store.setIdentity(peerId.value, false); // Client
  store.setRoomId(roomIdInput.value);
  
  // Connect with error handling
  connectToHost(
    roomIdInput.value, 
    () => {
        joining.value = false;
        store.notify("Connected! Joining game...", "success");
        store.requestAction({
            type: 'JOIN',
            payload: {
                id: peerId.value,
                name: name.value,
                cash: 1500, // Placeholder
                position: 0,
                color: selectedColor.value,
                inJail: false,
                jailTurns: 0,
                isHost: false,
                avatar: store.user?.photoURL || '🙂'
            },
            from: peerId.value
        });
    },
    (err: string) => {
        joining.value = false;
        store.notify(err, "error");
        alert("Failed to join: " + err); // Explicit UI
        store.setRoomId(""); // Reset room ID on failure
        store.gameState.status = 'LOBBY'; // Ensure logic stays in lobby
    }
  );
}

function startGame() {
  store.requestAction({
    type: 'START_GAME',
    payload: {},
    from: peerId.value
  });
}

function copyRoomCode() {
    navigator.clipboard.writeText(store.roomId!);
    store.notify("Room code copied!", "success");
}

function copyRoomLink() {
    const link = `${window.location.origin}${window.location.pathname}?room=${store.roomId}`;
    navigator.clipboard.writeText(link);
    store.notify("Room link copied!", "success");
}
</script>

<template>
  <div class="lobby-card">
    <h1 class="title">Monopoly</h1>
    
    <div v-if="!initialized || authLoading" class="loading">
        <span v-if="authLoading">Verifying Session...</span>
        <span v-else>Initializing Connection...</span>
    </div>
    
    <div v-else-if="!store.roomId" class="form">
      <!-- Google Login Button -->
      <button v-if="!store.user" class="btn-google" @click="handleGoogleLogin">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" />
          Sign in with Google
      </button>

      <div class="user-welcome" v-if="store.user">
         Hello, <strong>{{ store.user.displayName || 'Friend' }}</strong>!
      </div>

      <div class="input-group">
        <label>Your Name</label>
        <input v-model="name" placeholder="Enter your name" />
      </div>

      <div class="input-group">
        <label>Your Color</label>
        <div class="color-picker">
            <div 
               v-for="c in colors" 
               :key="c" 
               class="color-swatch"
               :style="{ backgroundColor: c }"
               :class="{ selected: selectedColor === c }"
               @click="selectedColor = c"
            ></div>
        </div>
      </div>
      
      <div class="divider-text">OR</div>
      
      <div class="rules-toggle" @click="showRules = !showRules">
         <span>⚙️ Custom Game Rules</span>
         <span>{{ showRules ? '▼' : '▶' }}</span>
      </div>
      
      <div v-if="showRules" class="rules-panel">
          <div class="rule-item">
              <span>x2 rent on full-set</span>
              <input type="checkbox" v-model="rules.doubleRentOnSet">
          </div>
          <!-- Other rules omitted for brevity but logic preserves them -->
           <div class="rule-item">
              <span>Map Type</span>
              <select v-model="rules.mapSelection">
                  <option value="world">World</option>
                  <option value="india">India</option>
                  <option value="bangalore">Bangalore</option>
              </select>
          </div>
      </div>
      
      <div class="actions">
        <button @click="createGame" class="btn-primary">Create Private Game</button>
        <div class="join-area">
          <input v-model="roomIdInput" placeholder="Room Code" />
          <button @click="joinGame" class="btn-secondary" :disabled="joining">
              {{ joining ? 'Joining...' : 'Join' }}
          </button>
        </div>
      </div>
    </div>
    
    <div v-else class="waiting-room">
      <div class="room-header">
          <h2>Room Code: <span class="code">{{ store.roomId }}</span></h2>
          <div class="share-actions">
               <button class="btn-icon" @click="copyRoomCode">📋</button>
               <button class="btn-icon" @click="copyRoomLink">🔗</button>
          </div>
      </div>
      <p>Share this code with your friends!</p>
      
      <div class="player-list">
        <div v-for="p in store.gameState.players" :key="p.id" class="player-item">
          <div class="swatch-small" :style="{ backgroundColor: p.color }"></div>
          <span class="p-name">{{ p.name }}</span>
          <span v-if="p.isHost" class="badge">HOST</span>
        </div>
      </div>
      
      <div v-if="store.isHost" class="host-actions">
        <button @click="startGame" class="btn-start" :disabled="store.gameState.players.length < 1">START GAME</button>
      </div>
      <div v-else>
        Waiting for host to start...
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby-card {
  background: var(--bg-panel);
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.title {
  font-family: 'Arial Black', sans-serif;
  color: var(--primary);
  margin-bottom: 2rem;
  letter-spacing: 2px;
}

.input-group {
  margin-bottom: 1rem;
  text-align: left;
}

input, select {
  width: 100%;
  padding: 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-dark);
  color: white;
  margin-top: 0.5rem;
}

.color-picker {
    display: flex;
    gap: 8px;
    margin-top: 5px;
    justify-content: center;
}

.color-swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
    transition: transform 0.2s;
}

.color-swatch.selected {
    transform: scale(1.2);
    border-color: white;
    box-shadow: 0 0 5px white;
}

.btn-google {
    background: white;
    color: #444;
    border: 1px solid #ddd;
    width: 100%;
    padding: 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-weight: bold;
    cursor: pointer;
    margin-bottom: 20px;
}
.btn-google img { width: 18px; }

.divider-text {
    color: #94a3b8;
    margin: 1rem 0;
    font-size: 0.9rem;
    font-weight: bold;
}

.rules-toggle {
    background: rgba(255,255,255,0.05);
    padding: 10px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    font-weight: bold;
}

.rules-panel {
    background: rgba(0,0,0,0.2);
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 1rem;
    text-align: left;
}

.rule-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.85rem;
}

.rule-item input[type="checkbox"] {
    width: auto;
    margin: 0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.join-area {
  display: flex;
  gap: 0.5rem;
}

.player-list {
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255,255,255,0.05);
  padding: 0.5rem;
  border-radius: 8px;
}

.swatch-small {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}

.badge {
  background: var(--primary);
  font-size: 0.6rem;
  padding: 2px 4px;
  border-radius: 4px;
  margin-left: auto;
}

.btn-primary { background: #374151; color: white; width: 100%; border: 1px solid #4b5563; }
.btn-secondary { background: var(--accent); color: white; }
.btn-start { background: var(--success); color: white; width: 100%; font-size: 1.2rem; padding: 1rem; }
.btn-secondary:disabled { opacity: 0.7; cursor: not-allowed; }

.room-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}
.btn-icon {
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    cursor: pointer;
    padding: 5px;
    border-radius: 4px;
}
</style>
