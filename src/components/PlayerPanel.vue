<script setup lang="ts">
import { useGameStore } from '../store/gameStore';
import TradeModal from './TradeModal.vue';
import { ref, computed } from 'vue';

const store = useGameStore();
const showTrade = ref(false);
const showTradeDetails = ref(false);
const confirmBankrupt = ref(false);

function getOwnedProperties(playerId: string) {
  return store.gameState.board.filter(t => t.owner === playerId);
}

function declareBankruptcy() {
    if (!confirmBankrupt.value) {
        confirmBankrupt.value = true;
        store.notify("Tap again to CONFIRM bankruptcy!", "error");
        setTimeout(() => confirmBankrupt.value = false, 3000);
        return;
    }
    store.requestAction({ type: 'BANKRUPTCY', payload: {}, from: store.myId! });
    confirmBankrupt.value = false;
}

// Placeholder for Votekick
function votekick() {
    store.notify("Votekick functionality coming soon!", "info");
}

const myProps = computed(() => {
    if (!store.me) return [];
    return getOwnedProperties(store.me.id);
});

function getPlayer(id: string) {
    return store.gameState.players.find(p => p.id === id);
}
</script>

<template>
  <div class="panel">
    <!-- Players List -->
    <div class="section-title">
        <span class="pulse"></span> 
        Players
    </div>
    
    <div class="player-list">
        <div 
          v-for="p in store.gameState.players" 
          :key="p.id" 
          class="player-row"
          :class="{ active: store.currentPlayer?.id === p.id }"
        >
          <div class="p-avatar" :style="{ backgroundColor: p.color }">
             <img v-if="p.avatar?.startsWith('data:')" :src="p.avatar" class="avatar-img" />
             <div v-else-if="p.avatar?.includes('<svg')" v-html="p.avatar" class="avatar-svg"></div>
             <span v-else class="emoji">{{ p.avatar || '👤' }}</span>
          </div>
          <div class="p-info">
             <div class="p-name">
                 {{ p.name }} 
                 <span v-if="p.isHost" class="crown">👑</span>
                 <span v-if="p.inJail" class="jail-icon">🔒</span>
             </div>
             <div class="p-cash" v-if="!p.bankrupt">{{ store.currencySymbol }}{{ store.formatCurrency(p.cash) }}</div>
             <div class="p-bankrupt" v-else>BANKRUPT</div>
           </div>
        </div>
    </div>
    
    <!-- Actions Row -->
    <div class="action-row" v-if="store.me">
        <button class="btn-vote" @click="votekick">👤× Votekick</button>
        <button v-if="!store.me.bankrupt" class="btn-bankrupt" @click="declareBankruptcy">
           {{ confirmBankrupt ? '⚠️ CONFIRM!' : '🚩 Bankrupt' }}
        </button>
    </div>

    <!-- Trades Section -->
    <div class="trades-section">
        <div class="section-header">
            <span>Trades</span>
            <button class="btn-create" @click="showTrade = true" :disabled="store.me?.inJail || !store.isMyTurn || !!store.gameState.currentTrade">
               ➕ Create
            </button>
        </div>
        
        <div class="trade-list-empty" v-if="!store.gameState.currentTrade">
            No active trades
        </div>
        
        <div v-else class="active-trade-card clickable" @click="showTradeDetails = true">
            <div class="trade-row">
                 <div class="t-avatar" :style="{ backgroundColor: getPlayer(store.gameState.currentTrade.initiator)?.color }">
                     <img v-if="getPlayer(store.gameState.currentTrade.initiator)?.avatar?.startsWith('data:')" :src="getPlayer(store.gameState.currentTrade.initiator)?.avatar" class="avatar-img" />
                     <div v-else-if="getPlayer(store.gameState.currentTrade.initiator)?.avatar?.includes('<svg')" v-html="getPlayer(store.gameState.currentTrade.initiator)?.avatar" class="avatar-svg"></div>
                     <span v-else>{{ getPlayer(store.gameState.currentTrade.initiator)?.avatar || '👤' }}</span>
                 </div>
                 <div class="exchange-icon">⇄</div>
                 <div class="t-avatar" :style="{ backgroundColor: getPlayer(store.gameState.currentTrade.target)?.color }">
                     <img v-if="getPlayer(store.gameState.currentTrade.target)?.avatar?.startsWith('data:')" :src="getPlayer(store.gameState.currentTrade.target)?.avatar" class="avatar-img" />
                     <div v-else-if="getPlayer(store.gameState.currentTrade.target)?.avatar?.includes('<svg')" v-html="getPlayer(store.gameState.currentTrade.target)?.avatar" class="avatar-svg"></div>
                     <span v-else>{{ getPlayer(store.gameState.currentTrade.target)?.avatar || '👤' }}</span>
                 </div>
            </div>
            
            <div class="trade-details-text">
                Tap to view details
            </div>

            <!-- Actions (Stop Propagation to prevent open detail if clicking action) -->
            <div class="trade-actions-bar" v-if="store.myId" @click.stop>
                 <!-- I am Target -->
                 <template v-if="store.myId === store.gameState.currentTrade.target">
                    <button class="btn-mini-success" @click="store.requestAction({ type: 'ACCEPT_TRADE', payload: store.gameState.currentTrade.id, from: store.myId })">✔ Accept</button>
                    <button class="btn-mini-danger" @click="store.requestAction({ type: 'REJECT_TRADE', payload: store.gameState.currentTrade.id, from: store.myId })">✖ Reject</button>
                 </template>
                 
                 <!-- I am Initiator -->
                 <template v-else-if="store.myId === store.gameState.currentTrade.initiator">
                    <button class="btn-mini-warn" @click="store.requestAction({ type: 'CANCEL_TRADE', payload: store.gameState.currentTrade.id, from: store.myId })">🚫 Cancel</button>
                 </template>
                 
                 <div v-else class="pending-badge">Pending Response...</div>
            </div>
        </div>
    </div>

    <!-- My Properties -->
    <div class="my-props-section" v-if="store.me">
        <div class="section-header-simple">
            My properties ({{ myProps.length }})
        </div>
        <div class="my-props-list">
             <div v-for="prop in myProps" :key="prop.id" class="prop-item">
                 <div class="prop-color-dot" :class="prop.group"></div>
                 <span class="prop-name">{{ prop.name }}</span>
             </div>
             <div v-if="myProps.length === 0" class="empty-props">
                 No properties owned yet.
             </div>
        </div>
    </div>
    
    <TradeModal v-if="showTrade" @close="showTrade = false" />
    
    <!-- Trade Details Popup -->
    <div v-if="showTradeDetails && store.gameState.currentTrade" class="modal-overlay" @click.self="showTradeDetails = false">
        <div class="modal-content">
            <h3>Trade Details</h3>
            <div class="trade-split">
                <div class="side">
                    <h4>{{ getPlayer(store.gameState.currentTrade.initiator)?.name }} Gives:</h4>
                    <div class="cash" v-if="store.gameState.currentTrade.offerCash > 0">💵 {{ store.currencySymbol }}{{ store.formatCurrency(store.gameState.currentTrade.offerCash) }}</div>
                    <div v-for="pid in store.gameState.currentTrade.offerProperties" :key="pid">
                         🏠 {{ store.gameState.board.find(t => t.id === pid)?.name }}
                    </div>
                </div>
                <div class="divider">⇄</div>
                <div class="side">
                    <h4>{{ getPlayer(store.gameState.currentTrade.target)?.name }} Gives:</h4>
                    <div class="cash" v-if="store.gameState.currentTrade.requestCash > 0">💵 {{ store.currencySymbol }}{{ store.formatCurrency(store.gameState.currentTrade.requestCash) }}</div>
                    <div v-for="pid in store.gameState.currentTrade.requestProperties" :key="pid">
                         🏠 {{ store.gameState.board.find(t => t.id === pid)?.name }}
                    </div>
                </div>
            </div>
            <button class="btn-close" @click="showTradeDetails = false">Close</button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  width: 300px;
  background: #1a1b26; /* Dark purple/gray */
  border-left: 1px solid #2e3040;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: #a9aeb8;
  font-family: 'Barlow', sans-serif;
  height: 100vh;
}

.section-title {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    color: #565f89;
    display: flex;
    align-items: center;
    gap: 8px;
}

.pulse {
    width: 6px; height: 16px;
    background: #ec4899;
    border-radius: 4px;
}

.player-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.player-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 12px;
    background: transparent;
    transition: background 0.2s;
}

.player-row.active {
    background: rgba(255,255,255,0.05);
}

.p-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.2rem;
    border: 2px solid rgba(255,255,255,0.1);
}

.p-info {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.p-name {
    color: #c0caf5;
    font-weight: 600;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 5px;
}

.p-cash {
    color: #fff;
    font-weight: 700;
}

.p-bankrupt {
    color: #ef4444;
    font-size: 0.7rem;
    font-weight: bold;
}

.crown { color: gold; font-size: 0.8rem; }

/* Buttons */
.action-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
}

.btn-vote, .btn-bankrupt {
    flex: 1;
    padding: 8px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.2s;
}

.btn-vote {
    background: rgba(255,255,255,0.05); /* Dark layout button */
    color: #7aa2f7;
    border: 1px solid rgba(122, 162, 247, 0.2);
}

.btn-bankrupt {
    background: linear-gradient(90deg, #ef4444, #dc2626);
    color: white;
}

/* Trades Section */
.trades-section {
    background: #24283b;
    border-radius: 12px;
    padding: 2px; /* Border look if needed */
    overflow: hidden;
}

.section-header {
    background: #2f334d;
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    color: #c0caf5;
    border-radius: 10px 10px 0 0;
}

.btn-create {
    background: #7aa2f7;
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
}
.btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

.trade-list-empty {
    padding: 20px;
    text-align: center;
    font-size: 0.8rem;
    color: #565f89;
}

.active-trade-indicator {
    padding: 15px;
    text-align: center;
    color: #7aa2f7;
    font-size: 0.9rem;
    animation: flash 2s infinite;
}

@keyframes flash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* My Properties List */
.my-props-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
}

.prop-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,0.05);
    padding: 6px 10px;
    border-radius: 6px;
}

.prop-color-dot {
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.3);
}

.prop-name {
    font-size: 0.85rem;
    color: #e2e8f0;
}

.active-trade-card.clickable {
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}
.active-trade-card.clickable:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border-color: #bb9af7;
}

/* Modal Overlay */
.modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.7);
    display: flex; justify-content: center; align-items: center;
    z-index: 2000;
    backdrop-filter: blur(4px);
}

.modal-content {
    background: #1e293b;
    padding: 2rem;
    border-radius: 12px;
    width: 90%; max-width: 500px;
    border: 1px solid #7aa2f7;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    color: white;
    text-align: center;
}

.trade-split {
    display: flex;
    justify-content: space-between;
    margin: 20px 0;
    text-align: left;
}
.side { flex: 1; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; }
.side h4 { border-bottom: 1px solid #555; margin-bottom: 5px; padding-bottom: 5px; color: #7aa2f7; }
.divider { display: flex; align-items: center; padding: 0 10px; font-size: 1.5rem; color: #aaa; }
.btn-close {
    margin-top: 20px;
    padding: 10px 20px;
    background: #475569;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
}
.btn-close:hover { background: #64748b; }

/* My Properties */
.my-props-section {
    background: #24283b;
    border-radius: 12px;
    padding: 15px;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.section-header-simple {
    color: #9aa5ce;
    font-size: 0.9rem;
    margin-bottom: 10px;
    text-align: center;
}

.my-props-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-content: flex-start;
}

.mini-prop {
    width: 20px; 
    height: 20px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.1);
}

.empty-props {
    width: 100%;
    text-align: center;
    padding-top: 20px;
    font-size: 0.8rem;
    color: #414868;
}

/* Prop Colors */
.brown { background-color: #92400e; }
.light-blue { background-color: #0ea5e9; }
.pink { background-color: #d946ef; }
.orange { background-color: #f97316; }
.red { background-color: #dc2626; }
.yellow { background-color: #eab308; }
.green { background-color: #16a34a; }
.blue { background-color: #2563eb; }
.utility { background-color: #94a3b8; }

/* Styles for Trade Card */
.active-trade-card {
    background: #0f1014;
    border: 1px solid #7aa2f7;
    border-radius: 8px;
    padding: 10px;
    margin-top: 10px;
}

.trade-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.t-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; justify-content: center; align-items: center;
    border: 1px solid rgba(255,255,255,0.2);
}

.exchange-icon {
    font-size: 1.2rem;
    color: #7aa2f7;
}

.trade-details-text {
    text-align: center;
    font-size: 0.8rem;
    color: #c0caf5;
    margin-bottom: 10px;
    line-height: 1.3;
}
.trade-details-text strong { color: white; }

.trade-actions-bar {
    display: flex;
    gap: 5px;
    justify-content: center;
}

.btn-mini-success {
    background: #10b981;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
    cursor: pointer;
}
.btn-mini-danger {
    background: #ef4444;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
    cursor: pointer;
}
.btn-mini-warn {
    background: #f59e0b;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
    cursor: pointer;
}
.pending-badge {
    font-size: 0.7rem;
    color: #565f89;
    font-style: italic;
}

.avatar-img, .avatar-svg {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    overflow: hidden;
}
.avatar-svg :deep(svg) {
    width: 100%;
    height: 100%;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .panel {
    width: 100%;
    max-height: 40vh;
    position: relative;
    border-left: none;
    border-top: 2px solid #334155;
    overflow-y: auto;
  }
  
  .section-title {
    font-size: 0.9rem;
  }
  
  .player-row {
    padding: 0.6rem;
  }
  
  .p-avatar {
    width: 35px;
    height: 35px;
  }
  
  .p-name {
    font-size: 0.85rem;
  }
  
  .p-cash {
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .panel {
    max-height: 35vh;
    font-size: 0.8rem;
  }
  
  .section-title {
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
  }
  
  .player-row {
    padding: 0.5rem;
  }
  
  .p-avatar {
    width: 30px;
    height: 30px;
  }
  
  .p-name {
    font-size: 0.75rem;
  }
  
  .p-cash {
    font-size: 0.7rem;
  }
  
  .action-row button {
    padding: 0.4rem 0.8rem;
    font-size: 0.75rem;
  }
}

</style>
