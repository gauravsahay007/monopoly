<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGameStore } from '../store/gameStore';
import { initPeer, connectToHost } from '../multiplayer/peer';

const store = useGameStore();

const name = ref('');
const roomIdInput = ref('');
const initialized = ref(false);
const peerId = ref('');
const showRules = ref(false);
const selectedColor = ref('#ef4444');

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

onMounted(() => {
  initPeer((id) => {
    peerId.value = id;
    initialized.value = true;
  });
});

function createGame() {
  if (!name.value) return alert("Enter name");
  store.setIdentity(peerId.value, true); // Host
  store.setRoomId(peerId.value);
  
  store.gameState.settings = { ...store.gameState.settings, ...rules.value };
  
  store.addPlayer({
    id: peerId.value,
    name: name.value,
    cash: rules.value.startingCash,
    position: 0,
    color: selectedColor.value, 
    inJail: false,
    jailTurns: 0,
    isHost: true,
    avatar: '😎'
  });
}

function joinGame() {
  if (!name.value || !roomIdInput.value) return alert("Enter name and room ID");
  store.setIdentity(peerId.value, false); // Client
  store.setRoomId(roomIdInput.value);
  
  connectToHost(roomIdInput.value, () => {
      store.requestAction({
        type: 'JOIN',
        payload: {
          id: peerId.value,
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
    alert("Matchmaking not implemented! Create a private game for now.");
}
</script>

<template>
  <div class="lobby-card">
    <h1 class="title">Monopoly</h1>
    
    <div v-if="!initialized" class="loading">Initializing Peer...</div>
    
    <div v-else-if="!store.roomId" class="form">
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
      
      <button class="btn-play-big" @click="playOnline">
          ▶ PLAY ONLINE
      </button>
      
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
                  <option :value="1500">$1500</option>
                  <option :value="2000">$2000</option>
                  <option :value="2500">$2500</option>
              </select>
          </div>
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
          <button @click="joinGame" class="btn-secondary">Join</button>
        </div>
      </div>
    </div>
    
    <div v-else class="waiting-room">
      <h2>Room Code: <span class="code">{{ store.roomId }}</span></h2>
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
</style>
