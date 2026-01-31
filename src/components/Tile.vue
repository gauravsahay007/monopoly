<script setup lang="ts">
import { computed } from 'vue';
import type { Tile, Player } from '../types';

const props = defineProps<{
  tile: Tile;
  players: Player[];
}>();

const colorClass = computed(() => {
  if (!props.tile.group) return '';
  return `bg-${props.tile.group}`;
});

function getPricePrefix() {
  if (props.tile.type === 'PROPERTY') return '$';
  if (props.tile.type === 'AIRPORT') return '$';
  if (props.tile.type === 'UTILITY') return '$';
  return '';
}

function getIcon() {
    switch (props.tile.type) {
        case 'AIRPORT': return '✈️';
        case 'UTILITY': return props.tile.name.includes('Electric') ? '💡' : (props.tile.name.includes('Water') ? '🚰' : '🔥');
        case 'TREASURE': return '💎';
        case 'SURPRISE': return '⚡';
        case 'TAX': return '💰';
        case 'JAIL_VISIT': return '⛓️';
        case 'PRISON': return '🔒';
        case 'VACATION': return '🏖️';
        case 'START': return '🏁';
        default: return '';
    }
}



import { useGameStore } from '../store/gameStore';
const store = useGameStore();

const ownerColor = computed(() => {
    if (!props.tile.owner) return null;
    const p = store.gameState.players.find(x => x.id === props.tile.owner);
    return p ? p.color : null;
});

const ownerName = computed(() => {
    if (!props.tile.owner) return null;
    const p = store.gameState.players.find(x => x.id === props.tile.owner);
    return p ? p.name : 'Unknown'; 
});

</script>

<template>
  <div 
    class="tile-card" 
    :class="[tile.type.toLowerCase(), tile.group]"
    :style="ownerColor ? { borderColor: ownerColor, backgroundColor: ownerColor, borderWidth: '4px' } : {}"
  >
    <!-- Color Bar -->
    <div v-if="tile.type === 'PROPERTY'" class="color-bar" :class="colorClass">
        <img 
           v-if="tile.country" 
           :src="`https://flagcdn.com/48x36/${tile.country}.png`" 
           class="flag-icon"
           alt="flag"
        />
    </div>
    
    <div class="content">
      <div v-if="tile.type !== 'PROPERTY'" class="icon-large">{{ getIcon() }}</div>
      
      <div class="name" :class="{ small: tile.name.length > 10 }">{{ tile.name }}</div>
      
      <div v-if="tile.price && tile.type !== 'START' && tile.type !== 'TAX'" class="price">
        {{ getPricePrefix() }}{{ tile.price }}
      </div>
      <div v-if="tile.amount" class="price">Pay ${{ tile.amount }}</div>
      
      <!-- Owner Indicator -->
      <div v-if="tile.owner" class="owner-pill" :style="{ backgroundColor: ownerColor || '#333' }">
         {{ ownerName }}
      </div>
      
      <!-- Avatars -->
      <div class="avatars">
        <div 
          v-for="p in players" 
          :key="p.id" 
          class="avatar-pip"
          :style="{ backgroundColor: p.color, width: '24px', height: '24px', border: '3px solid white', zIndex: 50 }"
          :title="p.name"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile-card {
  position: relative;
  background: white; /* Default */
  border: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  font-size: 0.65rem;
  text-align: center;
  overflow: hidden;
  user-select: none;
  transition: transform 0.2s, background-color 0.3s;
}

.tile-card:hover {
    z-index: 10;
    transform: scale(1.05);
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

/* Dark Theme Tiles */
.tile-card {
    background: #1f2937; /* Dark slate */
    color: #f3f4f6;
    border-color: #374151;
}

/* Color Bar */
.color-bar {
  height: 22px;
  width: 100%;
  border-bottom: 1px solid #374151;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.flag-icon {
    height: 18px; /* Bigger Flag */
    border-radius: 2px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center; /* Center content vertically */
  align-items: center;
  padding: 2px;
  gap: 2px;
}

.name {
  font-weight: 700;
  line-height: 1.1;
  padding: 0 2px;
}
.name.small { font-size: 0.55rem; }

.price {
  font-size: 0.6rem;
  color: #9ca3af;
  margin-top: 2px;
}

.icon-large {
    font-size: 1.6rem; /* Bigger formatting */
    margin-bottom: 2px;
}

.avatars {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px; /* Gap for bigger avatars */
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  pointer-events: none;
}

.avatar-pip {
  border-radius: 50%;
  box-shadow: 0 4px 6px rgba(0,0,0,0.8);
}

.owner-pill {
    font-size: 0.55rem;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 4px;
    text-transform: uppercase;
    font-weight: bold;
    max-width: 90%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}


/* Colors */
.bg-brown { background-color: #78350f; }
.bg-light-blue { background-color: #38bdf8; }
.bg-pink { background-color: #db2777; }
.bg-green-light { background-color: #4ade80; } 
.bg-orange { background-color: #f97316; }
.bg-red { background-color: #ef4444; }
.bg-yellow { background-color: #eab308; }
.bg-green { background-color: #16a34a; }
.bg-blue { background-color: #2563eb; }

.bg-airport { background-color: #475569; }
.bg-utility { background-color: #4b5563; }
</style>
