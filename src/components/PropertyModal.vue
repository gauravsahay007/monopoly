<script setup lang="ts">

import type { Tile, Player } from '../types';

const props = defineProps<{
    tile: Tile | null;
    owner?: Player;
}>();

const emit = defineEmits(['close']);

import { useGameStore } from '../store/gameStore';
const store = useGameStore();

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
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(getRent(0)) }}</span>
                </div>
                <div class="rent-row">
                    <span>With 1 House</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(getRent(1)) }}</span>
                </div>
                <div class="rent-row">
                    <span>With 2 Houses</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(getRent(2)) }}</span>
                </div>
                <div class="rent-row">
                    <span>With 3 Houses</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(getRent(3)) }}</span>
                </div>
                <div class="rent-row">
                    <span>With 4 Houses</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(getRent(4)) }}</span>
                </div>
                <div class="rent-row">
                    <span>With HOTEL</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(getRent(5)) }}</span>
                </div>
                
                <hr>
                
                <div class="info-row">
                    <span>Mortgage Value</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(Math.floor(tile.price / 2)) }}</span>
                </div>
                <div class="info-row">
                    <span>House Cost</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(tile.buildCost || 50) }}</span>
                </div> <!-- buildCost missing in logic, default 50 -->
            </div>
            
            <!-- Airport Rules -->
            <div v-else-if="tile.type === 'AIRPORT'" class="rules-info">
                <h3>✈️ Airport Rent Rules</h3>
                <div class="rent-row">
                    <span>1 Airport Owned</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(100000) }}</span>
                </div>
                <div class="rent-row">
                    <span>2 Airports Owned</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(200000) }} (2×)</span>
                </div>
                <div class="rent-row">
                    <span>3 Airports Owned</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(400000) }} (4×)</span>
                </div>
                <div class="rent-row">
                    <span>4 Airports Owned</span>
                    <span>{{ store.currencySymbol }}{{ store.formatCurrency(800000) }} (8×)</span>
                </div>
                <p class="rule-note">💡 Rent doubles for each additional airport owned!</p>
                <p v-if="tile.price">Price: {{ store.currencySymbol }}{{ store.formatCurrency(tile.price) }}</p>
            </div>
            
            <!-- Utility Rules -->
            <div v-else-if="tile.type === 'UTILITY'" class="rules-info">
                <h3>⚡ Utility Rent Rules</h3>
                <div class="info-row">
                    <span>1 Utility Owned</span>
                    <span>Dice × 4</span>
                </div>
                <div class="info-row">
                    <span>2 Utilities Owned</span>
                    <span>Dice × 10</span>
                </div>
                <div class="info-row">
                    <span>3 Utilities Owned</span>
                    <span>Dice × 20</span>
                </div>
                <p class="rule-note">💡 Rent = Your dice roll × multiplier</p>
                <p class="rule-note">Example: Roll 7 with 1 utility = {{ store.currencySymbol }}28 rent</p>
                <p class="rule-note">Example: Roll 7 with 2 utilities = {{ store.currencySymbol }}70 rent</p>
                <p class="rule-note">Example: Roll 7 with 3 utilities = {{ store.currencySymbol }}140 rent (Monopoly!)</p>
                <p v-if="tile.price">Price: {{ store.currencySymbol }}{{ store.formatCurrency(tile.price) }}</p>
            </div>
            
            <!-- Prison/Jail Rules -->
            <div v-else-if="tile.type === 'PRISON' || tile.name.toLowerCase().includes('jail')" class="rules-info">
                <h3>🚔 Prison/Jail Rules</h3>
                <p><strong>Just Visiting:</strong> No penalty if just landing here</p>
                <p><strong>Sent to Jail:</strong> When sent here by:</p>
                <ul>
                    <li>"Go to Prison" tile</li>
                    <li>Card instruction</li>
                    <li>Rolling 3 doubles in a row</li>
                </ul>
                <p><strong>To Get Out:</strong></p>
                <ul>
                    <li>🎲 Roll doubles (free release)</li>
                    <li>💰 Pay fine: {{ store.currencySymbol }}{{ store.formatCurrency(50000) }}</li>
                    <li>📄 Use "Get Out of Jail Free" card</li>
                    <li>⏰ After 3 failed rolls (forced fine)</li>
                </ul>
            </div>
            
            <!-- Vacation/Free Parking Rules -->
            <div v-else-if="tile.type === 'VACATION'" class="rules-info">
                <h3>🏖️ Vacation (Free Parking) Rules</h3>
                <p><strong>Collect the Pot!</strong></p>
                <p>All tax money and fines are collected here.</p>
                <p>When you land on this space, you win the entire pot!</p>
                <p class="rule-note">💰 Current pot grows from taxes and penalties</p>
            </div>
            
            <!-- Tax Rules -->
            <div v-else-if="tile.type === 'TAX'" class="rules-info">
                <h3>💸 Tax Rules</h3>
                <p v-if="tile.name === 'Income Tax'">
                    <strong>Income Tax:</strong><br>
                    Pay {{ store.currencySymbol }}{{ store.formatCurrency(tile.amount || 0) }}
                </p>
                <p v-else-if="tile.name === 'Luxury Tax'">
                    <strong>Luxury Tax:</strong><br>
                    Pay {{ store.currencySymbol }}{{ store.formatCurrency(tile.amount || 0) }}
                </p>
                <p class="rule-note">💡 All taxes go to the Vacation pot!</p>
            </div>
            
            <!-- Other tiles -->
            <div v-else class="simple-info">
                <p>{{ tile.type }}</p>
                <p v-if="tile.price">Price: {{ store.currencySymbol }}{{ store.formatCurrency(tile.price) }}</p>
                <p v-if="tile.amount">Amount: {{ store.currencySymbol }}{{ store.formatCurrency(tile.amount) }}</p>
            </div>
            
            
            <!-- Owner and Building Section -->
            <div v-if="tile.owner" class="owner-section">
                <span>Owner: {{ owner?.name || 'Unknown' }}</span>
                
                <!-- Building Status -->
                <div v-if="tile.type === 'PROPERTY' && tile.houseCount !== undefined && tile.houseCount > 0" class="building-status">
                    <span v-if="tile.houseCount < 5">🏠 {{ tile.houseCount }} House{{ tile.houseCount > 1 ? 's' : '' }}</span>
                    <span v-else>🏨 HOTEL</span>
                </div>
                
                <!-- Build Button (only for properties you own) -->
                <button 
                    v-if="tile.type === 'PROPERTY' && tile.owner === store.myId && (tile.houseCount || 0) < 5"
                    class="build-btn"
                    @click="store.requestAction({ type: 'UPGRADE_PROPERTY', payload: tile.id, from: store.myId! })">
                    <span v-if="!tile.houseCount || tile.houseCount < 4">🏠 Build House</span>
                    <span v-else-if="tile.houseCount === 4">🏨 Build Hotel</span>
                    <span class="build-cost">({{ store.currencySymbol }}{{ store.formatCurrency(tile.buildCost || Math.floor(tile.price * 0.5)) }})</span>
                </button>
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

.rules-info {
    color: #e2e8f0;
}

.rules-info h3 {
    margin: 0.5rem 0;
    font-size: 1.1rem;
    color: #fbbf24;
}

.rules-info p {
    margin: 0.5rem 0;
    line-height: 1.5;
}

.rules-info ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    line-height: 1.7;
}

.rules-info li {
    margin: 0.3rem 0;
}

.rule-note {
    background: rgba(251, 191, 36, 0.1);
    border-left: 3px solid #fbbf24;
    padding: 0.5rem;
    margin: 0.5rem 0;
    border-radius: 4px;
    font-size: 0.85rem;
    color: #fcd34d;
}

.building-status {
    margin-top: 0.75rem;
    padding: 0.5rem;
    background: rgba(16, 185, 129, 0.1);
    border-left: 3px solid #10b981;
    border-radius: 4px;
    font-weight: bold;
    color: #6ee7b7;
    font-size: 0.95rem;
}

.build-btn {
    width: 100%;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.build-btn:hover {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.build-btn:active {
    transform: translateY(0);
}

.build-cost {
    opacity: 0.9;
    font-size: 0.85rem;
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
.bg-dark-blue { background-color: #1e3a8a; }
.bg-airport { background-color: #475569; }
.bg-utility { background-color: #4b5563; }

/* Mobile Responsive */
@media (max-width: 768px) {
  .modal-content {
    max-width: 90vw;
    max-height: 80vh;
    padding: 1.2rem;
  }
  
  .modal-header h2 {
    font-size: 1.3rem;
  }
  
  .modal-body {
    font-size: 0.85rem;
  }
  
  .rent-row, .info-row {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .modal-content {
    max-width: 95vw;
    max-height: 85vh;
    padding: 1rem;
  }
  
  .modal-header h2 {
    font-size: 1.1rem;
  }
  
  .modal-body {
    font-size: 0.75rem;
  }
  
  .rent-row, .info-row {
    font-size: 0.7rem;
  }
  
  .close-btn {
    padding: 0.8rem;
    font-size: 0.9rem;
  }
}


</style>
