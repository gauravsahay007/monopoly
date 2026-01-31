<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGameStore } from '../store/gameStore';

const store = useGameStore();

const dice1 = computed(() => store.gameState.dice[0]);
const dice2 = computed(() => store.gameState.dice[1]);
const canRoll = computed(() => store.isMyTurn && dice1.value === 0);

const isRolling = ref(false);
const isIndian = computed(() => store.gameState.settings.mapSelection === 'india' || store.gameState.settings.mapSelection === 'bangalore');

function roll() {
  isRolling.value = true;
  // Simulate roll time 
  setTimeout(() => {
      store.requestAction({ type: 'ROLL_DICE', payload: {}, from: store.myId! });
  }, 1000); // 1s roll
  
  setTimeout(() => { isRolling.value = false; }, 1500); 
}

function endTurn() {
  store.requestAction({ type: 'END_TURN', payload: {}, from: store.myId! });
}

// Check Buy Capability
const tileToBuy = computed(() => {
   // Cannot buy while in jail
   if (store.me?.inJail) return null;
   if (!store.isMyTurn || dice1.value === 0) return null;
   const tile = store.gameState.board[store.me?.position || 0];
   if (!tile) return null;
   
   const purchasable = (tile.type === 'PROPERTY' || tile.type === 'AIRPORT' || tile.type === 'UTILITY') 
          && !tile.owner 
          && (store.me?.cash || 0) >= tile.price;
   
   return purchasable ? tile : null;
});


function buy() {
   store.requestAction({ type: 'BUY_PROPERTY', payload: {}, from: store.myId! });
}

function payFine() {
   store.requestAction({ type: 'PAY_JAIL_FINE', payload: {}, from: store.myId! });
}

const jailFine = computed(() => isIndian.value ? 50000 : 50);
</script>

<template>
  <div class="dice-container">
    <div class="dice-wrapper">
        <div class="die" :class="[`face-${dice1}`, { rolling: isRolling }]">
            <template v-if="dice1 === 1"><span class="pip center"></span></template>
            <template v-else-if="dice1 === 2"><span class="pip tl"></span><span class="pip br"></span></template>
            <template v-else-if="dice1 === 3"><span class="pip tl"></span><span class="pip center"></span><span class="pip br"></span></template>
            <template v-else-if="dice1 === 4"><span class="pip tl"></span><span class="pip tr"></span><span class="pip bl"></span><span class="pip br"></span></template>
            <template v-else-if="dice1 === 5"><span class="pip tl"></span><span class="pip tr"></span><span class="pip center"></span><span class="pip bl"></span><span class="pip br"></span></template>
            <template v-else-if="dice1 === 6"><span class="pip tl"></span><span class="pip tr"></span><span class="pip ml"></span><span class="pip mr"></span><span class="pip bl"></span><span class="pip br"></span></template>
            <template v-else><span class="question">?</span></template>
        </div>
        
        <div class="die" :class="[`face-${dice2}`, { rolling: isRolling }]" style="animation-duration: 0.8s">
            <template v-if="dice2 === 1"><span class="pip center"></span></template>
            <template v-else-if="dice2 === 2"><span class="pip tl"></span><span class="pip br"></span></template>
            <template v-else-if="dice2 === 3"><span class="pip tl"></span><span class="pip center"></span><span class="pip br"></span></template>
            <template v-else-if="dice2 === 4"><span class="pip tl"></span><span class="pip tr"></span><span class="pip bl"></span><span class="pip br"></span></template>
            <template v-else-if="dice2 === 5"><span class="pip tl"></span><span class="pip tr"></span><span class="pip center"></span><span class="pip bl"></span><span class="pip br"></span></template>
            <template v-else-if="dice2 === 6"><span class="pip tl"></span><span class="pip tr"></span><span class="pip ml"></span><span class="pip mr"></span><span class="pip bl"></span><span class="pip br"></span></template>
            <template v-else><span class="question">?</span></template>
        </div>
     </div>

    <div class="actions" v-if="store.isMyTurn">
      <div v-if="store.me?.inJail" class="jail-actions">
          <h3>You are in Jail!</h3>
          <div class="jail-opt">
              <button @click="roll" class="btn-roll" :disabled="isRolling">
                  🎲 Roll for Doubles
              </button>
              <button @click="payFine" class="btn-warning" :disabled="isRolling || (store.me?.cash || 0) < jailFine">
                  Pay {{ store.currencySymbol }}{{ store.formatCurrency(jailFine) }}
              </button>
          </div>
          <p class="jail-hint">Attempt {{ store.me.jailTurns }}/3 - Roll doubles to escape or pay fine</p>
      </div>
      
      <div v-else class="turn-controls">
          <button v-if="canRoll" @click="roll" class="btn-roll" :disabled="isRolling">
              🎲 Roll Dice
          </button>
          
          <div v-if="!canRoll" class="post-roll-actions">
             <button v-if="tileToBuy" @click="buy" class="btn-buy">
                 🛒 Buy for {{ store.currencySymbol }}{{ store.formatCurrency(tileToBuy.price) }}
             </button>
             <button @click="endTurn" class="btn-end">
                 End Turn
             </button>
          </div>
      </div>
    </div>
    <div v-else class="waiting">
      Waiting for {{ store.currentPlayer?.name }}...
    </div>
  </div>
</template>

<style scoped>
.dice-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.dice-wrapper {
  display: flex;
  gap: 20px;
  perspective: 800px;
}

.die {
  width: 70px;
  height: 70px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 20px rgba(0,0,0,0.4), inset 0 -4px 4px rgba(0,0,0,0.1);
  position: relative;
  transform-style: preserve-3d;
}

.die.rolling {
    animation: roll3d 0.6s linear infinite;
}

@keyframes roll3d {
    0% { transform: rotateX(0) rotateY(0) rotateZ(0); }
    100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(180deg); }
}

.pip {
    background: #000;
    border-radius: 50%;
    position: absolute;
    width: 14px; height: 14px;
    box-shadow: inset 0 2px 3px rgba(255,255,255,0.4);
}
/* Recalculate pip positions for bigger dice */
.center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
.tl { top: 10px; left: 10px; }
.tr { top: 10px; right: 10px; }
.bl { bottom: 10px; left: 10px; }
.br { bottom: 10px; right: 10px; }
.ml { top: 50%; left: 10px; transform: translateY(-50%); }
.mr { top: 50%; right: 10px; transform: translateY(-50%); }

.question {
    display: flex; justify-content: center; align-items: center; 
    height: 100%; font-size: 2.5rem; color: #ccc; font-weight: 800;
}

/* Actions */
.actions {
    display: flex;
    justify-content: center;
    width: 100%;
}

.turn-controls {
    display: flex;
    gap: 15px;
}

.post-roll-actions {
    display: flex;
    gap: 15px;
}

/* Specific Buttons from Screenshot */
.btn-roll {
    background: #3b82f6;
    color: white;
    font-size: 1.1rem;
    padding: 12px 30px;
    border-radius: 8px;
    font-weight: 600;
    box-shadow: 0 4px 0 #2563eb;
    transition: transform 0.1s;
}
.btn-roll:active { transform: translateY(4px); box-shadow: none; }

.btn-buy {
    background: #8b5cf6;
    color: white;
    font-size: 1.1rem;
    padding: 12px 30px;
    border-radius: 8px;
    font-weight: 600;
    box-shadow: 0 4px 0 #7c3aed;
    transition: transform 0.1s;
}
.btn-buy:active { transform: translateY(4px); box-shadow: none; }

.btn-end {
    background: transparent;
    border: 2px solid #ef4444;
    color: #ef4444;
    padding: 12px 20px;
    font-weight: bold;
    border-radius: 8px;
    transition: all 0.2s;
}
.btn-end:hover { background: #ef4444; color: white; }

/* Waiting Badge */
.waiting {
    color: #94a3b8;
    background: rgba(255,255,255,0.05);
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 0.9rem;
    border: 1px solid rgba(255,255,255,0.1);
}

.jail-opt { display: flex; gap: 10px; }
.jail-hint { 
    color: #94a3b8; 
    font-size: 0.85rem; 
    margin-top: 0.5rem; 
    text-align: center; 
}
.btn-warning { background: #f59e0b; color: #fff; padding: 10px 20px; font-weight: bold; border-radius: 6px; }

/* Mobile Responsive */
@media (max-width: 768px) {
  .dice-container {
    padding: 1rem;
  }
  
  .dice-display {
    gap: 0.8rem;
  }
  
  .die {
    width: 60px;
    height: 60px;
    font-size: 2rem;
  }
  
  .turn-controls button,
  .jail-actions button {
    padding: 0.6rem 1.2rem;
    font-size: 0.85rem;
  }
  
  .jail-hint {
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .dice-container {
    padding: 0.8rem;
  }
  
  .dice-display {
    gap: 0.6rem;
  }
  
  .die {
    width: 50px;
    height: 50px;
    font-size: 1.8rem;
  }
  
  .turn-controls button,
  .jail-actions button {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
  }
  
  .jail-opt {
    flex-direction: column;
    gap: 8px;
  }
  
  .jail-hint {
    font-size: 0.7rem;
  }
}


</style>
