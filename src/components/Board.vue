<script setup lang="ts">
import { useGameStore } from '../store/gameStore';
import Tile from './Tile.vue';
import Dice from './Dice.vue';
import PropertyModal from './PropertyModal.vue';
import TradeModal from './TradeModal.vue';
import { ref, watch, nextTick, onMounted } from 'vue';
import type { Tile as TileType } from '../types';

const store = useGameStore();
const selectedTile = ref<TileType | null>(null);
const showTrade = ref(false);
const eventLogRef = ref<HTMLElement | null>(null);

// Function to scroll to top (newest events are at index 0 due to unshift)
const scrollToTop = () => {
  if (eventLogRef.value) {
    eventLogRef.value.scrollTop = 0;
  }
};

// Auto-scroll to latest event on mount
onMounted(async () => {
  await nextTick();
  setTimeout(scrollToTop, 100);
});

// Auto-scroll to latest event when new events are added
watch(() => [...store.gameState.lastActionLog], async () => {
  await nextTick();
  setTimeout(scrollToTop, 100);
}, { deep: true });

function getGridStyle(index: number) {
  // 13x13 Grid
  if (index === 0) return { gridColumnStart: 1, gridRowStart: 1 };
  if (index >= 1 && index <= 11) return { gridColumnStart: index + 1, gridRowStart: 1 };
  if (index === 12) return { gridColumnStart: 13, gridRowStart: 1 };
  if (index >= 13 && index <= 23) return { gridColumnStart: 13, gridRowStart: index - 12 + 1 };
  if (index === 24) return { gridColumnStart: 13, gridRowStart: 13 };
  if (index >= 25 && index <= 35) return { gridColumnStart: 37 - index, gridRowStart: 13 };
  if (index === 36) return { gridColumnStart: 1, gridRowStart: 13 };
  if (index >= 37 && index <= 47) return { gridColumnStart: 1, gridRowStart: 49 - index };
  return {};
}

function getPlayersOnTile(tileId: number) {
  return store.gameState.players.filter(p => p.position === tileId);
}

function handleTileClick(tile: TileType) {
    selectedTile.value = tile;
}

function getOwner(tile: TileType | null) {
    if (!tile || !tile.owner) return undefined;
    return store.gameState.players.find(p => p.id === tile.owner);
}




</script>

<template>
  <div class="board-container">
    <div class="board">
      <div class="center-area">
        <div class="logo-wrapper">
            <img src="../assets/logo.svg" alt="logo" class="logo-icon" />
            <h1 class="logo-text">Monopoly!</h1>
        </div>
        
        <Dice />

        <div class="event-log" ref="eventLogRef">
           <div 
              v-for="(event, index) in store.gameState.lastActionLog" 
              :key="index"
              class="event-item"
           >

              <span class="event-text">{{ typeof event === 'string' ? event : event.message }}</span>
           </div>
           <div v-if="store.gameState.lastActionLog.length === 0" class="event-placeholder">
              Game events will appear here...
           </div>
        </div>
      </div>
      
      <Tile 
        v-for="tile in store.gameState.board" 
        :key="tile.id"
        :tile="tile"
        :players="getPlayersOnTile(tile.id)"
        :style="getGridStyle(tile.id)"
        @click="handleTileClick(tile)"
        style="cursor: pointer;"
      />
      
      <PropertyModal 
         :tile="selectedTile" 
         :owner="getOwner(selectedTile)"
         @close="selectedTile = null" 
      />
      
      <TradeModal 
         v-if="showTrade"
         @close="showTrade = false"
      />
    </div>
  </div>
</template>

<style scoped>
/* New styles for Event Avatars */
.event-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.event-avatars {
    display: flex;
    align-items: center;
    gap: 4px; /* Space between avatars */
    flex-shrink: 0;
}
.mini-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.3);
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    background-color: #333;
}
.mini-img { width: 100%; height: 100%; object-fit: cover; }
.mini-initial { font-size: 0.8rem; color: white; font-weight: bold; }
.event-text { flex: 1; font-size: 0.95rem; line-height: 1.4; }

.board-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  background: var(--bg-dark);
  height: 100vh;
  width: 100%;
  overflow: auto;
}

.board {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  grid-template-rows: repeat(13, 1fr);
  gap: 2px;
  width: min(95vh, 95vw);
  height: min(95vh, 95vw);
  background: #0f172a; 
  border: 4px solid #334155;
  border-radius: 8px;
  position: relative;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

.center-area {
  grid-column: 2 / 13;
  grid-row: 2 / 13;
  background: #111827;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  color: white;
  gap: 1rem; /* Added gap for spacing */
}

.logo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 0.5rem;
}

.logo-icon {
  height: 2.5rem;
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
  color: transparent;
  margin: 0;
  text-transform: uppercase;
}

.event-log {
  /* Removed absolute positioning to allow stacking */
  width: 90%;
  height: 180px; /* Fixed height for clean UI */
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 1rem;
  overflow-y: auto;
  backdrop-filter: blur(8px);
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.3);
  margin-top: 10px; /* Space from dice */
}

.event-log::-webkit-scrollbar {
  width: 8px;
}

.event-log::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
}

.event-log::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.5);
  border-radius: 4px;
}

.event-log::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.7);
}

.event-item {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  background: rgba(255,255,255,0.05);
  border-left: 3px solid #6366f1;
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 0.85rem;
  line-height: 1.4;
  animation: slideIn 0.3s ease-out;
}

.event-placeholder {
  color: #64748b;
  font-style: italic;
  text-align: center;
  padding: 2rem;
  font-size: 0.9rem;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}


.decks {
  display: flex;
  justify-content: space-around;
  width: 100%;
  position: absolute;
  bottom: 20%;
}

.deck {
  width: 110px;
  height: 70px;
  border-radius: 6px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 0.9rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.2);
  cursor: pointer;
  transition: transform 0.2s;
}
.deck:hover { transform: translateY(-2px); }

.deck.treasure {
   background: var(--warning);
   color: #111;
}

.deck.surprise {
   background: var(--secondary);
   color: white;
}

/* Mobile Responsive Styles */
@media (max-width: 1024px) {
  .board {
    width: min(90vh, 98vw);
    height: min(90vh, 98vw);
    gap: 1px;
  }
  
  .logo {
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  .status-msg {
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
  }
}

@media (max-width: 768px) {
  .board-container {
    padding: 5px;
    height: auto;
    min-height: 100vh;
  }
  
  .board {
    width: min(85vh, 100vw);
    height: min(85vh, 100vw);
    gap: 1px;
    border-width: 2px;
  }
  
  .logo {
    font-size: 1.5rem;
    letter-spacing: 1px;
    margin-bottom: 0.5rem;
  }
  
  .status-msg {
    font-size: 0.7rem;
    padding: 0.3rem 0.6rem;
    max-width: 90%;
    top: 5%;
  }
}

@media (max-width: 480px) {
  .board-container {
    padding: 2px;
  }
  
  .board {
    width: 100vw;
    height: 100vw;
    gap: 0px;
    border-width: 1px;
    border-radius: 0;
  }
  
  .logo {
    font-size: 1.2rem;
    margin-bottom: 0.3rem;
  }
  
  .status-msg {
    font-size: 0.65rem;
    padding: 0.25rem 0.5rem;
  }
  
  .deck {
    width: 80px;
    height: 50px;
    font-size: 0.7rem;
  }
}

</style>
