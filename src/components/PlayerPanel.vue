<script setup lang="ts">
import { useGameStore } from '../store/gameStore';
import TradeModal from './TradeModal.vue';
import { ref, computed } from 'vue';

const store = useGameStore();
const showCreateTrade = ref(false); 
const showTradeDetails = ref(false);
const showBankruptConfirm = ref(false);

function getOwnedProperties(playerId: string) {
  return store.gameState.board.filter(t => t.owner === playerId);
}

function confirmBankruptcy() {
    store.requestAction({ type: 'BANKRUPTCY', payload: {}, from: store.myId! });
    showBankruptConfirm.value = false;
}

function closeRoom() {
    if (confirm("Are you sure you want to CLOSE the room? This will delete all game data.")) {
        store.requestAction({ type: 'END_GAME', payload: {}, from: store.myId! });
    }
}

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


function getUserPhoto(p: any) {
    if (p.avatar && p.avatar.startsWith('http')) return p.avatar;
    if (store.user && store.user.uid === p.uid && store.user.photoURL) return store.user.photoURL;
    return null;
}

function getInitials(name: string) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
             <img v-if="getUserPhoto(p)" :src="getUserPhoto(p)" class="avatar-img" />
             <span v-else class="avatar-initials">{{ getInitials(p.name) }}</span>
          </div>
          <div class="p-info">
             <div class="p-name">
                 {{ p.name }} 
                 <span v-if="p.isHost" class="crown">👑</span>
                 <span v-if="p.inJail" class="jail-icon">🔒</span>
             </div>
             <div class="p-cash" v-if="!p.bankrupt" :class="{ 'debt': p.cash < 0 }">
                 {{ store.currencySymbol }}{{ store.formatCurrency(p.cash) }}
             </div>
             <div class="p-bankrupt" v-else>BANKRUPT</div>
           </div>
        </div>
    </div>
    
    <!-- Sound Settings (available to all players) -->
    <div class="sound-settings">
        <button 
            class="btn-sound-toggle" 
            @click="store.toggleSoundMute()"
            :class="{ muted: store.localSoundMuted }"
        >
            <span class="sound-icon">{{ store.localSoundMuted ? '🔇' : '🔊' }}</span>
            <span class="sound-label">{{ store.localSoundMuted ? 'Sounds Muted' : 'Sounds On' }}</span>
        </button>
    </div>
    
    <!-- Actions Row -->
    <div class="action-row" v-if="store.me">
        <button class="btn-vote" @click="votekick">👤× Kick</button>
        
        <!-- Bankruptcy Logic -->
        <div v-if="!store.me.bankrupt" class="bankrupt-wrapper">
            <button v-if="!showBankruptConfirm" class="btn-bankrupt" @click="showBankruptConfirm = true">
               🚩 Bankrupt
            </button>
            <div v-else class="confirm-box">
               <button class="btn-confirm-bankrupt" @click="confirmBankruptcy">⚠️ CONFIRM</button>
               <button class="btn-cancel-bankrupt" @click="showBankruptConfirm = false">✖</button>
            </div>
        </div>

        <button v-if="store.isHost" class="btn-close-room" @click="closeRoom">🚫 End Game</button>
    </div>

    <!-- Trades Section -->
    <div class="trades-section">
        <div class="section-header">
            <span>Trades</span>
            <button class="btn-create" @click="showCreateTrade = true" :disabled="!!store.gameState.currentTrade">
               ➕ Create
            </button>
        </div>
        
        <div class="trade-list-empty" v-if="!store.gameState.currentTrade">
            No active trades
        </div>
        
        <div v-else class="active-trade-card clickable" @click="showTradeDetails = true">
            <div class="trade-row">
                 <div class="t-avatar" :style="{ backgroundColor: getPlayer(store.gameState.currentTrade.initiator)?.color }">
                     <span class="avatar-initials-small">{{ getInitials(getPlayer(store.gameState.currentTrade.initiator)?.name || '') }}</span>
                 </div>
                 <div class="exchange-icon">⇄</div>
                 <div class="t-avatar" :style="{ backgroundColor: getPlayer(store.gameState.currentTrade.target)?.color }">
                    <span class="avatar-initials-small">{{ getInitials(getPlayer(store.gameState.currentTrade.target)?.name || '') }}</span>
                 </div>
            </div>
            
            <div class="trade-details-text">
                Tap to view details
            </div>

            <!-- Inline Actions Bar (Quick Actions) -->
            <div class="trade-actions-bar" @click.stop>
                 <template v-if="store.gameState.currentTrade && store.myId === store.gameState.currentTrade.target">
                    <button class="btn-mini-success" @click="store.requestAction({ type: 'ACCEPT_TRADE', payload: store.gameState.currentTrade.id, from: store.myId })">✔ Accept</button>
                    <button class="btn-mini-danger" @click="store.requestAction({ type: 'REJECT_TRADE', payload: store.gameState.currentTrade.id, from: store.myId })">✖ Reject</button>
                 </template>
                 <template v-else-if="store.gameState.currentTrade && store.myId === store.gameState.currentTrade.initiator">
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
    
    <!-- Modals -->
    <TradeModal v-if="showCreateTrade" @close="showCreateTrade = false" />
    
    <TradeModal 
        v-if="showTradeDetails && store.gameState.currentTrade" 
        :viewTrade="store.gameState.currentTrade"
        @close="showTradeDetails = false" 
    />
  </div>
</template>

<style scoped>
.panel {
  width: 360px;
  background: #1a1b26; 
  border-left: 1px solid #2e3040;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: #a9aeb8;
  font-family: 'Barlow', sans-serif;
  height: 100vh;
  overflow-y: auto; /* Fix scroll */
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
    position: relative;
    overflow: hidden;
}

.avatar-initials {
    font-size: 0.9rem;
    font-weight: 700;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.avatar-initials-small {
    font-size: 0.7rem;
    font-weight: 700;
    color: white;
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
.p-cash.debt {
    color: #ef4444;
}

.p-bankrupt {
    color: #ef4444;
    font-size: 0.7rem;
    font-weight: bold;
}

.crown { color: gold; font-size: 0.8rem; }

/* Sound Settings */
.sound-settings {
    background: rgba(255,255,255,0.02);
    border-radius: 8px;
    padding: 10px;
    margin: 0 -5px;
}

.btn-sound-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid rgba(122, 162, 247, 0.3);
    background: linear-gradient(135deg, rgba(122, 162, 247, 0.1), rgba(122, 162, 247, 0.05));
    color: #7aa2f7;
    transition: all 0.2s;
}

.btn-sound-toggle:hover {
    background: linear-gradient(135deg, rgba(122, 162, 247, 0.2), rgba(122, 162, 247, 0.1));
    border-color: rgba(122, 162, 247, 0.5);
    transform: translateY(-1px);
}

.btn-sound-toggle.muted {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
}

.btn-sound-toggle.muted:hover {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1));
    border-color: rgba(239, 68, 68, 0.5);
}

.sound-icon {
    font-size: 1.2rem;
}

.sound-label {
    font-size: 0.8rem;
}

/* Buttons */
.action-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    height: 40px; 
}

.btn-vote, .btn-bankrupt, .btn-close-room {
    flex: 1;
    padding: 8px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.2s;
    height: 100%;
}

.btn-vote {
    background: rgba(255,255,255,0.05);
    color: #7aa2f7;
    border: 1px solid rgba(122, 162, 247, 0.2);
}

.bankrupt-wrapper {
    flex: 1;
}

.btn-bankrupt {
    background: linear-gradient(90deg, #ef4444, #dc2626);
    color: white;
    width: 100%;
}

.confirm-box {
    display: flex;
    gap: 5px;
    height: 100%;
    width: 100%;
}

.btn-confirm-bankrupt {
    flex: 1;
    background: #ef4444;
    color: white;
    font-weight: bold;
    border: 2px solid white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.7rem;
    padding: 0 5px;
}

.btn-cancel-bankrupt {
    width: 30px;
    background: #2e3040;
    color: white;
    border: 1px solid #565f89;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
}

.btn-close-room {
    background: #4b5563;
    color: white;
    border: 1px solid #374151;
}
.btn-close-room:hover { background: #374151; }

/* Trades Section */
.trades-section {
    background: #24283b;
    border-radius: 12px;
    padding: 2px;
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
    overflow: hidden;
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

.avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

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

.empty-props {
    width: 100%;
    text-align: center;
    padding-top: 20px;
    font-size: 0.8rem;
    color: #414868;
}

.prop-color-dot.brown { background-color: #92400e; }
.prop-color-dot.light-blue { background-color: #0ea5e9; }
.prop-color-dot.pink { background-color: #d946ef; }
.prop-color-dot.orange { background-color: #f97316; }
.prop-color-dot.red { background-color: #dc2626; }
.prop-color-dot.yellow { background-color: #eab308; }
.prop-color-dot.green { background-color: #16a34a; }
.prop-color-dot.blue { background-color: #2563eb; }
.prop-color-dot.utility { background-color: #94a3b8; }

/* Mobile Responsive */
@media (max-width: 960px) {
  .panel {
    width: 100%;
    height: auto;
    max-height: 40vh;
    border-left: none;
    border-top: 2px solid #334155;
    overflow-y: auto;
  }
}
</style>
