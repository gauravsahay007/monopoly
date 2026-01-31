<script setup lang="ts">

import type { Tile, Player } from '../types';

const props = defineProps<{
    tile: Tile | null;
    owner?: Player;
}>();

const emit = defineEmits(['close']);

function getRent(index: number) {
    if (!props.tile || !props.tile.rent) return 0;
    return props.tile.rent[index] || 0;
}
</script>

<template>
  <div v-if="tile" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card">
        <div class="header" :class="`bg-${tile.group}`">
            <h2>{{ tile.name }}</h2>
            <img 
               v-if="tile.country" 
               :src="`https://flagcdn.com/48x36/${tile.country}.png`" 
               class="flag-icon"
            />
        </div>
        
        <div class="body">
            <div v-if="tile.type === 'PROPERTY'">
                <div class="rent-row">
                    <span>Rent</span>
                    <span>${{ getRent(0) }}</span>
                </div>
                <div class="rent-row">
                    <span>With 1 House</span>
                    <span>${{ getRent(1) }}</span>
                </div>
                <div class="rent-row">
                    <span>With 2 Houses</span>
                    <span>${{ getRent(2) }}</span>
                </div>
                <div class="rent-row">
                    <span>With 3 Houses</span>
                    <span>${{ getRent(3) }}</span>
                </div>
                <div class="rent-row">
                    <span>With 4 Houses</span>
                    <span>${{ getRent(4) }}</span>
                </div>
                <div class="rent-row">
                    <span>With HOTEL</span>
                    <span>${{ getRent(5) }}</span>
                </div>
                
                <hr>
                
                <div class="info-row">
                    <span>Mortgage Value</span>
                    <span>${{ Math.floor(tile.price / 2) }}</span>
                </div>
                <div class="info-row">
                    <span>House Cost</span>
                    <span>${{ tile.buildCost || 50 }}</span>
                </div> <!-- buildCost missing in logic, default 50 -->
            </div>
            
            <div v-else class="simple-info">
                <p>{{ tile.type }}</p>
                <p v-if="tile.price">Price: ${{ tile.price }}</p>
                <p v-if="tile.amount">Tax: ${{ tile.amount }}</p>
            </div>
            
            <div v-if="tile.owner" class="owner-section">
                <span>Owner: {{ owner?.name || 'Unknown' }}</span>
            </div>
        </div>
        
        <button class="close-btn" @click="emit('close')">Close</button>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
    position: fixed;
    top: 0; 
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
}

.modal-card {
    background: #1f2937;
    border-radius: 12px;
    width: 300px;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
    border: 1px solid #374151;
    color: white;
}

.header {
    padding: 1rem;
    text-align: center;
    background: #374151;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}

.header h2 {
    margin: 0;
    font-size: 1.5rem;
    text-shadow: 0 2px 2px rgba(0,0,0,0.5);
}

.body {
    padding: 1rem;
}

.rent-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    font-size: 0.9rem;
}

.info-row {
    display: flex;
    justify-content: space-between;
    font-weight: bold;
    margin-top: 5px;
    color: #9ca3af;
}

.owner-section {
    margin-top: 1rem;
    padding: 0.5rem;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
    text-align: center;
    font-weight: bold;
}

.close-btn {
    width: 100%;
    padding: 1rem;
    background: transparent;
    border: none;
    border-top: 1px solid #374151;
    color: white;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
}

.close-btn:hover {
    background: rgba(255,255,255,0.05);
}

/* Colors - Matching Tile.vue */
.bg-brown { background-color: #78350f; }
.bg-light-blue { background-color: #38bdf8; color: #111; text-shadow: none !important;}
.bg-pink { background-color: #db2777; }
.bg-green-light { background-color: #4ade80; color: #111; text-shadow: none !important;} 
.bg-orange { background-color: #f97316; }
.bg-red { background-color: #ef4444; }
.bg-yellow { background-color: #eab308; color: #111; text-shadow: none !important;}
.bg-green { background-color: #16a34a; }
.bg-blue { background-color: #2563eb; }
.bg-airport { background-color: #475569; }
.bg-utility { background-color: #4b5563; }

</style>
