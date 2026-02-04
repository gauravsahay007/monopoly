<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useGameStore } from '../store/gameStore';
import { initPeer, connectToHost, initializeHost } from '../multiplayer/peer';
import { loginWithGoogle, onAuthChange } from '../firebase';

const store = useGameStore();

const name = ref('');
const roomIdInput = ref('');
const initialized = ref(false);
const peerId = ref('');
const showRules = ref(false);
const selectedColor = ref('#ef4444');
const authLoading = ref(true); // Initial Auth verification
const actionLoading = ref(false); // Action spinner (Login, Create, Join)

const recentRoomId = ref<string | null>(null); // Last room from Firestore
const recentHostUid = ref<string | null>(null); // Host UID for finding game state
const recentWasHost = ref(false); // Whether this user was the host
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

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
        rules.value.startingCash = 15000000; // ₹1.5Cr default
    } else {
        rules.value.startingCash = 1500;
    }
});

watch(() => store.user, async (u) => {
    if (u) {

        name.value = u.displayName || u.email?.split('@')[0] || 'Player';

        // Fetch Recent Room meta (Non-blocking)
        getDoc(doc(db, "users", u.uid)).then(userDoc => {
            if (userDoc.exists()) {
                const data = userDoc.data();
                recentRoomId.value = data.lastRoomId;
                recentHostUid.value = data.lastHostUid || data.lastRoomId;
                recentWasHost.value = data.wasHost || false;

            }
        }).catch(e => {
            console.warn("Lobby: Failed to fetch user meta (swallowed)", e);
        });

        // Init Peer with UID (Safe check)
        if (!initialized.value) {

            initPeer(u.uid, (id) => {
                peerId.value = id;
                initialized.value = true;

            }, (err) => {
                console.warn("⚠️ Lobby: Peer UID init failed, fallback to random", err);
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

watch(() => store.roomId, async (newRoom) => {
    if (newRoom && store.user) {
        try {
            const hostPlayer = store.gameState.players.find(p => p.isHost);
            const hostUid = hostPlayer?.uid || newRoom;
            
            await setDoc(doc(db, "users", store.user.uid), {
                lastRoomId: newRoom,
                lastHostUid: hostUid,
                lastAccessed: Date.now(),
                wasHost: store.isHost
            }, { merge: true });

        } catch (e) {
            console.warn("Failed to save room to user profile", e);
        }
    }
});

onMounted(() => {
  // Check for room in URL
  const urlParams = new URLSearchParams(window.location.search);
  const rId = urlParams.get('room');
  if (rId) {
      roomIdInput.value = rId;
  }
  
  // Listen for Firebase Auth Persistence
  onAuthChange((u) => {

      if (u) {
          store.user = u;
          name.value = u.displayName || u.email?.split('@')[0] || 'Player';
          // User watcher will handle the rest (store.user watcher)
      }
      // Stop loading once we get the initial auth signal (null or user)
      authLoading.value = false;

      // Fallback Peer Init if not logged in
      if (!u && !initialized.value) {
           initPeer(undefined, (id) => {
                peerId.value = id;
                initialized.value = true;
           });
      }
  });

  /* Removed fixed timeout as onAuthChange handles it. 
     Keeping a long failsafe just in case. */
  setTimeout(() => { if(authLoading.value) authLoading.value = false; }, 5000);
});

async function handleGoogleLogin() {
    if (actionLoading.value) return;
    actionLoading.value = true;
    try {
        const u = await loginWithGoogle();
        store.user = u;
        name.value = u.displayName || '';
    } catch (e) {
        store.notify("Login failed", "error");
    } finally {
        actionLoading.value = false;
    }
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

// Helper to generate random 6-char ID
function generateRandomRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createGame(resume = false) {
  if (actionLoading.value) return;
  if (!name.value) return store.notify("Please enter your name", "error");
  
  actionLoading.value = true;
  try {
      // Determine Room ID: Resume uses existing, New generates random
      let targetRoomId = '';
      let storageKey = ''; 
      
      if (resume) {
          // Resuming: Use the stored room ID
          if (!recentRoomId.value) throw new Error("No recent room to resume");
          targetRoomId = recentRoomId.value;
          storageKey = targetRoomId; // Persistence key is the Room ID now
      } else {
          // New Game: Generate Random ID
          targetRoomId = generateRandomRoomId();
          storageKey = targetRoomId; 
      }

      console.log('🎮 Creating/Resuming game. Room ID:', targetRoomId, 'Resume:', resume);

      // We need to re-initialize peer to match the Room ID if we are Host
      // This is because clients connect to "RoomID" which IS the Host's Peer ID in this P2P setup.
      if (peerId.value !== targetRoomId) {
           await new Promise<void>((resolve) => {
               initPeer(targetRoomId, (id) => {
                   peerId.value = id;
                   resolve();
               });
           });
      }

      const actualPeerId = peerId.value; // Should match targetRoomId

      if (!resume) {
          // Delete previous game session if starting fresh (cleanup old data for this ID if collision, unlikely)
          // Actually, we should check if it exists? Random ID collision is rare.
          // Better: Ensure we start clean.
          await store.deleteOldGame(storageKey);
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
          // If resuming failed or new game, setup fresh:
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
          if (!resume) store.notify("New game created! Code: " + targetRoomId, "success");
      }
      
  } catch (e) {
      console.error(e);
      store.notify("An error occurred creating the game.", "error");
  } finally {
      actionLoading.value = false;
  }
}

function joinGame() {
  if (!name.value || !roomIdInput.value) return store.notify("Enter name and room ID", "error");
  store.setIdentity(peerId.value, false); // Client
  store.setRoomId(roomIdInput.value);
  
  connectToHost(roomIdInput.value, () => {
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
          avatar: '🙂'
        },
        from: peerId.value
      });
  });
}

function startGame() {

  store.requestAction({
    type: 'START_GAME',
    payload: {},
    from: peerId.value
  });
}

// Play Online Button (Matches Random Queue Idea - but currently just creates game)
function playOnline() {
    store.notify("Matchmaking coming soon!", "info");
}

async function rejoinRecent() {
    if (!recentRoomId.value) return;
    
    // Use stored wasHost flag for more reliable detection
    const wasHost = recentWasHost.value || (store.user?.uid === recentRoomId.value);
    
    if (wasHost && recentRoomId.value) {
        // Host: Resume the game and load state from Firestore
        roomIdInput.value = recentRoomId.value;
        const targetId = recentRoomId.value;

        // Ensure we initialize with the correct ID before resuming logic checks it
        if (peerId.value !== targetId) {
             await new Promise<void>((resolve) => {
                 initPeer(targetId, (id) => {
                     peerId.value = id;
                     resolve();
                 });
             });
        }

        await createGame(true); // Call with resume = true
    } else {
        // Client: Connect to the game using the stored host info
        // The game might be stored under host UID or room ID
        const gameRoomId = recentHostUid.value || recentRoomId.value;
        roomIdInput.value = gameRoomId;
        joinGame();
    }
}
</script>

<template>
  <div class="lobby-card">
    <h1 class="title">
        <img src="../assets/logo.svg" class="logo-icon" />
        Monopoly
    </h1>
    
    <div v-if="!initialized || authLoading" class="loading">
       <span v-if="authLoading">Verifying Session...</span>
       <span v-else>Initializing Connection...</span>
    </div>
    
    <div v-else-if="!store.roomId" class="form">
      <button v-if="!store.user" class="btn-google" @click="handleGoogleLogin">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" />
          Sign in with Google
      </button>

      <div class="user-welcome" v-if="store.user">
         Hello, <strong>{{ store.user.displayName || 'Friend' }}</strong>!
      </div>

      <div class="input-group" v-if="store.user">
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
      
      <button v-if="store.user" class="btn-play-big" @click="playOnline">
          ▶ PLAY ONLINE
      </button>

      <!-- REJOIN SECTION -->
      <div v-if="recentRoomId" class="rejoin-panel">
          <p>Previous game detected!</p>
          <button @click="rejoinRecent" class="btn-rejoin">
              🔄 REJOIN: {{ recentRoomId.substring(0, 8) }}...
          </button>
      </div>
      
      <div class="divider-text" v-if="store.user">OR</div>
      
      <div class="rules-toggle" @click="showRules = !showRules">
         <span>⚙️ Custom Game Rules</span>
         <span>{{ showRules ? '▼' : '▶' }}</span>
      </div>
      
      <div v-if="showRules" class="rules-panel">
          <div class="rule-item">
              <span>x2 rent on full-set</span>
              <input type="checkbox" v-model="rules.doubleRentOnSet">
          </div>
          <div class="rule-item">
              <span>Vacation cash</span>
              <input type="checkbox" v-model="rules.vacationCash">
          </div>
          <div class="rule-item">
              <span>Auction</span>
              <input type="checkbox" v-model="rules.auction">
          </div>
          <div class="rule-item">
              <span>No rent in prison</span>
              <input type="checkbox" v-model="rules.prisonNoRent">
          </div>
          <div class="rule-item">
              <span>Starting Cash</span>
              <select v-model="rules.startingCash">
                  <template v-if="rules.mapSelection === 'india' || rules.mapSelection === 'bangalore'">
                    <option :value="10000000">₹1Cr</option>
                    <option :value="15000000">₹1.5Cr</option>
                    <option :value="20000000">₹2Cr</option>
                    <option :value="30000000">₹3Cr</option>
                  </template>
                  <template v-else>
                    <option :value="1500">$1500</option>
                    <option :value="2000">$2000</option>
                    <option :value="2500">$2500</option>
                  </template>
              </select>
          </div>
      </div>
      
      <div class="input-group" v-if="store.user">
        <label>Map Selection</label>
        <select v-model="rules.mapSelection">
          <option value="world">World Map 🌍</option>
          <option value="india">India Map 🇮🇳</option>
          <option value="bangalore">Bangalore Map 🚌</option>
        </select>
      </div>
      
      <div class="actions" v-if="store.user">
        <button @click="createGame()" class="btn-primary" :disabled="actionLoading">
            <span v-if="actionLoading">⏳ Processing...</span>
            <span v-else>Create Private Game</span>
        </button>
        <div class="join-area">
          <input v-model="roomIdInput" placeholder="Room Code" :disabled="actionLoading" />
          <button @click="joinGame" class="btn-secondary" :disabled="actionLoading">
             <span v-if="actionLoading">⏳</span>
             <span v-else>Join</span>
          </button>
        </div>
      </div>
    </div>
    
    <div v-else class="waiting-room">
      <div class="room-info">
          <h2>Room Code: <span class="code">{{ store.roomId }}</span></h2>
          <div class="share-actions">
              <button class="btn-icon" title="Copy Code" @click="copyRoomCode">📋</button>
              <button class="btn-icon" title="Copy Link" @click="copyRoomLink">🔗</button>
          </div>
      </div>
      <p>Share the code or link with your friends!</p>
      
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.logo-icon {
  height: 2.5rem;
  width: auto;
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

.user-welcome {
    margin: 1rem 0;
    font-size: 1.1rem;
    color: #e2e8f0;
}
.user-welcome strong { color: var(--primary); }

.btn-play-big {
    background: linear-gradient(135deg, #ec4899, #8b5cf6);
    color: white;
    font-size: 1.2rem;
    font-weight: bold;
    width: 100%;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 1rem;
    box-shadow: 0 4px 10px rgba(236, 72, 153, 0.4);
    transition: transform 0.2s;
}

.btn-play-big:hover {
    transform: translateY(-2px);
}

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

.btn-primary {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  font-weight: bold;
  padding: 0.9rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  transition: all 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
}

.btn-secondary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  font-weight: bold;
  padding: 0.9rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transition: all 0.2s;
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
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

.room-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}
.share-actions {
    display: flex;
    gap: 10px;
}
.btn-icon {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.1rem;
}
.btn-icon:hover { background: rgba(255,255,255,0.2); }

.rejoin-panel {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
}
.rejoin-panel p {
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
    color: #10b981;
}
.btn-rejoin {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.8rem;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    width: 100%;
}

.btn-primary { background: #374151; color: white; width: 100%; border: 1px solid #4b5563; }
.btn-secondary { background: var(--accent); color: white; }

.btn-start {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    width: 100%;
    font-size: 1.2rem;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    transition: all 0.2s;
}
.btn-start:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
}
.btn-start:disabled {
    background: #475569;
    color: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
}

.code {
    font-family: 'Courier New', monospace;
    background: rgba(0,0,0,0.4);
    padding: 2px 8px;
    border-radius: 6px;
    color: #a5b4fc;
    word-break: break-all;
    user-select: all;
}
</style>
