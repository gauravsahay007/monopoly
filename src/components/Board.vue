<script setup lang="ts">
import { useGameStore } from '../store/gameStore';
import Tile from './Tile.vue';
import Dice from './Dice.vue';
import PropertyModal from './PropertyModal.vue';
import TradeModal from './TradeModal.vue';
import { ref } from 'vue';
import type { Tile as TileType } from '../types';

const store = useGameStore();
const selectedTile = ref<TileType | null>(null);
const showTrade = ref(false);

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
        <h1 class="logo">Chilling Guys<br>Monopoly! 🥶</h1>
        
        <div class="status-msg" v-if="store.gameState.lastActionLog.length">
           {{ store.gameState.lastActionLog[0] }}
        </div>
        

        
        <Dice />
        

        

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
}

.logo {
  font-family: 'Arial Black', sans-serif;
  font-size: 3rem;
  letter-spacing: 2px;
  background: linear-gradient(to right, #6366f1, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent; /* Fallback */
  margin-bottom: 2rem;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.2;
}

.status-msg {
  position: absolute;
  top: 10%;
  background: rgba(255,255,255,0.1);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  max-width: 80%;
  text-align: center;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.1);
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


</style>
