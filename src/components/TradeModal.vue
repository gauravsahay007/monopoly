<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGameStore } from '../store/gameStore';
import type { TradeOffer } from '../types';

const store = useGameStore();

const props = defineProps<{
    targetPlayerId?: string;
    viewTrade?: TradeOffer;
}>();

const emit = defineEmits(['close']);

// Steps: 0 = Select Player, 1 = Configure Trade
const currentStep = ref((props.targetPlayerId || props.viewTrade) ? 1 : 0);

// Selection States
const selectedTarget = ref(props.targetPlayerId || '');
const myCashOffer = ref(0);
const targetCashRequest = ref(0);
const mySelectedProps = ref<number[]>([]);
const targetSelectedProps = ref<number[]>([]);

// Initialize from viewTrade if present
const isViewMode = computed(() => !!props.viewTrade);

watch(() => props.viewTrade, (t) => {
    if (t) initializeFromTrade(t);
}, { immediate: true });

function initializeFromTrade(t: TradeOffer) {
    const amInitiator = t.initiator === store.myId;
    if (amInitiator) {
        selectedTarget.value = t.target;
        myCashOffer.value = t.offerCash;
        mySelectedProps.value = [...t.offerProperties];
        targetCashRequest.value = t.requestCash;
        targetSelectedProps.value = [...t.requestProperties];
    } else {
        // I am Target - Viewpoint Inverted for UI (My Side = What I Give)
        selectedTarget.value = t.initiator;
        myCashOffer.value = t.requestCash; // What I give
        mySelectedProps.value = [...t.requestProperties];
        targetCashRequest.value = t.offerCash; // What they give
        targetSelectedProps.value = [...t.offerProperties];
    }
    currentStep.value = 1;
}

// Getters
const me = computed(() => store.me);
const targets = computed(() => store.gameState.players.filter(p => p.id !== store.myId && !p.bankrupt));

const myProperties = computed(() => store.gameState.board.filter(t => t.owner === store.myId));
const targetProperties = computed(() => {
    if (!selectedTarget.value) return [];
    return store.gameState.board.filter(t => t.owner === selectedTarget.value);
});

// Toggle Logic
function toggleMyProp(id: number) {
    if (isViewMode.value) return; // Readonly
    if (mySelectedProps.value.includes(id)) {
        mySelectedProps.value = mySelectedProps.value.filter(x => x !== id);
    } else {
        mySelectedProps.value.push(id);
    }
}

function toggleTargetProp(id: number) {
    if (isViewMode.value) return; // Readonly
    if (targetSelectedProps.value.includes(id)) {
        targetSelectedProps.value = targetSelectedProps.value.filter(x => x !== id);
    } else {
        targetSelectedProps.value.push(id);
    }
}

function selectTarget(id: string) {
    if (isViewMode.value) return;
    selectedTarget.value = id;
    currentStep.value = 1;
}

// Currency Helpers
function multiplyOffer(factor: number) {
    if (isViewMode.value) return;
    myCashOffer.value = (myCashOffer.value || 0) * factor;
}

function multiplyRequest(factor: number) {
    if (isViewMode.value) return;
    targetCashRequest.value = (targetCashRequest.value || 0) * factor;
}

// Validation
const isValid = computed(() => {
    if (!selectedTarget.value) return false;

    const hasOffer = myCashOffer.value > 0 || mySelectedProps.value.length > 0;
    const hasRequest = targetCashRequest.value > 0 || targetSelectedProps.value.length > 0;
    return hasOffer || hasRequest;
});

function sendOffer() {
    if (!isValid.value || !store.myId) return;
    
    const offer: TradeOffer = {
        id: Math.random().toString(36).substring(7),
        initiator: store.myId,
        target: selectedTarget.value,
        offerCash: myCashOffer.value,
        offerProperties: [...mySelectedProps.value],
        requestCash: targetCashRequest.value,
        requestProperties: [...targetSelectedProps.value],
        status: 'PENDING'
    };
    
    store.requestAction({ type: 'OFFER_TRADE', payload: offer, from: store.myId });
    emit('close');
}

function acceptTrade() {
    if (!props.viewTrade || !store.myId) return;
    store.requestAction({ type: 'ACCEPT_TRADE', payload: props.viewTrade.id, from: store.myId });
    emit('close');
}

function rejectTrade() {
    if (!props.viewTrade || !store.myId) return;
    store.requestAction({ type: 'REJECT_TRADE', payload: props.viewTrade.id, from: store.myId });
    emit('close');
}

function cancelTrade() {
    if (!props.viewTrade || !store.myId) return;
    store.requestAction({ type: 'CANCEL_TRADE', payload: props.viewTrade.id, from: store.myId });
    emit('close');
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
     
     <!-- STEP 0: Select Player -->
     <div v-if="currentStep === 0" class="mini-modal">
         <div class="modal-header">
             <h2>Create a trade</h2>
             <button class="close-btn" @click="$emit('close')">×</button>
         </div>
         <p class="subtitle">Select a player to trade with:</p>
         
         <div class="player-stack">
             <button 
                v-for="t in targets" 
                :key="t.id" 
                class="target-btn" 
                :style="{ borderLeft: `4px solid ${t.color}` }"
                @click="selectTarget(t.id)"
             >
                <div class="avatar-container" :style="{ backgroundColor: t.color, display: 'flex', justifyContent: 'center', alignItems: 'center' }">
                     <img v-if="t.avatar?.startsWith('http')" :src="t.avatar" class="avatar-img" />
                     <span v-else style="color: white; font-weight: bold;">{{ t.name.charAt(0).toUpperCase() }}</span>
                </div>
                <span class="t-name">{{ t.name }}</span>
             </button>
             
             <div v-if="targets.length === 0" class="no-targets">
                 No other players available.
             </div>
         </div>
     </div>

     <!-- STEP 1: Configure / View -->
     <div v-else class="trade-modal">
        <div class="modal-header">
             <h2>{{ isViewMode ? 'Trade Details' : '🤝 Make a Deal' }}</h2>
             <button class="close-btn" @click="$emit('close')">×</button>
         </div>
        
        <div class="trade-grid">
            <!-- MY SIDE -->
            <div class="side" v-if="me">
                <h3>{{ me.name }} (You)</h3>
                <div class="cash-box">
                    <label>Cash: {{ store.currencySymbol }}{{ store.formatCurrency(me.cash) }}</label>
                    <input type="number" v-model.number="myCashOffer" :max="me.cash" min="0" placeholder="Offer Cash" :disabled="isViewMode">
                    <div class="helpers" v-if="!isViewMode">
                        <button @click="multiplyOffer(1000)">K</button>
                        <button @click="multiplyOffer(100000)">L</button>
                        <button @click="multiplyOffer(10000000)">Cr</button>
                    </div>
                </div>
                <div class="prop-list">
                    <div 
                       v-for="prop in myProperties" 
                       :key="prop.id"
                       class="prop-item"
                       :class="{ selected: mySelectedProps.includes(prop.id) }"
                       @click="toggleMyProp(prop.id)"
                    >
                        <div class="swatch" :class="prop.group"></div>
                        <span>{{ prop.name }} <small class="prop-val">({{ store.currencySymbol }}{{ store.formatCurrency(prop.price || 0) }})</small></span>
                    </div>
                </div>
            </div>
            
            <!-- TARGET SIDE -->
            <div class="side">
                <h3>Target</h3>
                
                <div class="cash-box">
                   <input type="number" v-model.number="targetCashRequest" min="0" placeholder="Request Cash" :disabled="isViewMode">
                   <div class="helpers" v-if="!isViewMode">
                        <button @click="multiplyRequest(1000)">K</button>
                        <button @click="multiplyRequest(100000)">L</button>
                        <button @click="multiplyRequest(10000000)">Cr</button>
                    </div>
                </div>
                <div class="prop-list">
                    <div 
                       v-for="prop in targetProperties" 
                       :key="prop.id"
                       class="prop-item"
                       :class="{ selected: targetSelectedProps.includes(prop.id) }"
                       @click="toggleTargetProp(prop.id)"
                    >
                        <div class="swatch" :class="prop.group"></div>
                        <span>{{ prop.name }} <small class="prop-val">({{ store.currencySymbol }}{{ store.formatCurrency(prop.price || 0) }})</small></span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="actions">
            <template v-if="isViewMode">
                <!-- VIEW MODE ACTIONS -->
                <template v-if="store.myId === viewTrade?.target">
                    <button class="btn-confirm success" @click="acceptTrade">✔ Accept Deal</button>
                    <button class="btn-cancel danger" @click="rejectTrade">✖ Reject</button>
                </template>
                <template v-else-if="store.myId === viewTrade?.initiator">
                    <button class="btn-cancel warning" @click="cancelTrade">🚫 Cancel Offer</button>
                    <button class="btn-cancel" @click="$emit('close')">Close</button>
                </template>
                <template v-else>
                    <div class="status-badge">Waiting...</div>
                </template>
            </template>
            <template v-else>
                <!-- CREATE MODE ACTIONS -->
                <button class="btn-cancel" @click="currentStep = 0">Back</button>
                <button class="btn-confirm" @click="sendOffer" :disabled="!isValid">Propose Deal</button>
            </template>
        </div>
     </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.85); /* Darker backdrop */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
}

.mini-modal {
    background: #0f1014;
    padding: 1.5rem;
    border-radius: 16px;
    width: 350px;
    max-width: 90vw;
    color: white;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    border: 1px solid #2e3040;
}

.trade-modal {
    background: #0f1014;
    padding: 2rem;
    border-radius: 16px;
    width: 800px;
    max-width: 95vw;
    color: white;
    border: 1px solid #2e3040;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.close-btn {
    background: #2e3040;
    width: 30px; height: 30px;
    border-radius: 50%;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
}

.subtitle {
    color: #94a3b8;
    margin-bottom: 1.5rem;
    text-align: center;
}

.player-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.target-btn {
    background: #2e3040;
    color: white;
    padding: 12px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s;
}
.target-btn:hover {
    background: #3b4261;
    transform: translateX(5px);
}

.avatar-container {
    width: 32px; height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
}

.avatar-img, .avatar-svg {
    width: 100%; height: 100%;
    object-fit: cover;
}
.avatar-svg :deep(svg) {
    width: 100%; height: 100%;
}

.t-name { font-weight: 600; }
.emoji { font-size: 1.5rem; line-height: 1.2; }

.no-targets {
    text-align: center;
    color: #565f89;
    padding: 20px;
}

/* Configure Styles */
.trade-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin: 2rem 0;
}
.side {
    background: #1a1b26;
    padding: 1rem;
    border-radius: 12px;
    min-height: 300px;
    border: 1px solid #2e3040;
}
.prop-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 1rem;
    max-height: 200px;
    overflow-y: auto;
}
.prop-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid transparent;
}
.prop-item.selected {
    border-color: #7aa2f7;
    background: rgba(122, 162, 247, 0.1);
}
.prop-val {
    color: #94a3b8;
    margin-left: 5px;
}
.swatch {
    width: 12px; height: 12px;
    border-radius: 2px;
}
/* Colors */
.swatch.brown { background-color: #92400e; }
.swatch.light-blue { background-color: #0ea5e9; }
.swatch.pink { background-color: #d946ef; }
.swatch.orange { background-color: #f97316; }
.swatch.red { background-color: #dc2626; }
.swatch.yellow { background-color: #eab308; }
.swatch.green { background-color: #16a34a; }
.swatch.blue { background-color: #2563eb; }
.swatch.utility { background-color: #94a3b8; }
.swatch.top-secret { background-color: #a3a3a3; }
.swatch.airport { background-color: #6366f1; }
.swatch.special { background-color: white; border: 1px solid #aaa; }
.swatch.dark-blue { background-color: #1e3a8a; }

input {
    width: 100%;
    padding: 10px;
    margin-top: 5px;
    background: #0f1014;
    border: 1px solid #2e3040;
    color: white;
    border-radius: 8px;
    font-size: 1rem;
}
input:disabled { opacity: 0.5; cursor: not-allowed; }

.helpers {
    display: flex;
    gap: 5px;
    margin-top: 5px;
}
.helpers button {
    background: #2e3040;
    border: 1px solid #475569;
    color: #cbd5e1;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
}
.helpers button:hover {
    background: #3b4261;
    color: white;
}

.actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
}
.btn-cancel { background: transparent; border: 1px solid #565f89; color: #a9aeb8; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
.btn-confirm { background: #7aa2f7; color: #1a1b26; font-weight: 800; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-confirm.success { background: #10b981; color: white; }
.btn-cancel.danger { border-color: #ef4444; color: #ef4444; }
.btn-cancel.warning { border-color: #f59e0b; color: #f59e0b; }
</style>
