import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GameState, Player, Tile, GameAction, TradeOffer } from '../types';
import boardDataWorld from '../data/board.json';
import boardDataIndia from '../data/board-india.json';
import boardDataBangalore from '../data/board-bangalore.json';
import treasureData from '../data/treasure.json';
import surpriseData from '../data/surprise.json';
import { broadcastState, sendAction } from '../multiplayer/peer';
import { playSound } from '../logic/sound';
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import { db } from '../firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

// Helper to safely parse board data casting to Tile[]
const initialBoard: Tile[] = JSON.parse(JSON.stringify(boardDataWorld));

export const useGameStore = defineStore('game', () => {
    // State
    const myId = ref<string | null>(null);
    const isHost = ref(false);
    const roomId = ref<string | null>(null);
    const user = ref<any>(null); // Authed user info

    const gameState = ref<GameState>({
        status: 'LOBBY',
        turnIndex: 0,
        players: [],
        board: initialBoard,
        dice: [0, 0],
        lastActionLog: [],
        settings: {
            startingCash: 1500,
            passGoAmount: 200,
            mapSelection: 'world'
        },
        currentRoomId: null,
        myId: null,
        consecutiveDoubles: 0,
        vacationPot: 0,
        currentTrade: null
    });

    const notifications = ref<{ id: number, message: string, type: 'info' | 'success' | 'error' }[]>([]);
    let nextNotifyId = 0;

    function notify(message: string, type: 'info' | 'success' | 'error' = 'info') {
        const id = nextNotifyId++;
        notifications.value.push({ id, message, type });
        setTimeout(() => {
            notifications.value = notifications.value.filter(n => n.id !== id);
        }, 4000);
    }

    // --- HOST ONLY LOGIC ---
    function addPlayer(player: Player) {
        if (!isHost.value) return;

        const existingIdx = gameState.value.players.findIndex(p => p.id === player.id);
        if (existingIdx === -1) {
            // New Player
            if (!player.avatar || player.avatar === '👤' || player.avatar.length < 5) {
                const avatar = createAvatar(lorelei, {
                    seed: player.name + player.id,
                    backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf', 'ffd5dc'],
                    radius: 50
                });
                player.avatar = avatar.toString();
            }

            // Ensure Unique Color
            const usedColors = gameState.value.players.map(p => p.color);
            if (usedColors.includes(player.color)) {
                const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
                const available = colors.filter(c => !usedColors.includes(c));
                if (available.length > 0) {
                    const randomColor = available[Math.floor(Math.random() * available.length)];
                    if (randomColor) player.color = randomColor;
                }
            }

            gameState.value.players.push(player);
            log(`Player ${player.name} joined`);
            broadcast();
        } else {
            // Update existing (re-join)
            console.log('🔄 Player rejoined, updating record:', player.name);
            gameState.value.players[existingIdx] = { ...gameState.value.players[existingIdx], ...player };
            broadcast();
        }
    }

    function startGame() {
        if (!isHost.value) return;

        // Load Selected Map
        const mapType = gameState.value.settings.mapSelection || 'world';
        let selectedBoard = boardDataWorld;
        if (mapType === 'india') selectedBoard = boardDataIndia;
        if (mapType === 'bangalore') selectedBoard = boardDataBangalore;

        gameState.value.board = JSON.parse(JSON.stringify(selectedBoard));

        // Set Pass GO amount based on map
        if (mapType === 'india' || mapType === 'bangalore') {
            gameState.value.settings.passGoAmount = 200000;
        } else {
            gameState.value.settings.passGoAmount = 200;
        }

        // Settings override for cash
        const startingCash = gameState.value.settings.startingCash;
        gameState.value.players.forEach(p => p.cash = startingCash);

        gameState.value.status = 'PLAYING';
        gameState.value.turnIndex = 0;
        log(`Game Started on ${mapType.toUpperCase()} Map`);
        broadcast();
    }

    function rollDice() {
        if (!isHost.value) return;
        const d1 = Math.ceil(Math.random() * 6);
        const d2 = Math.ceil(Math.random() * 6);
        gameState.value.dice = [d1, d2];
        playSound('roll');

        const player = gameState.value.players[gameState.value.turnIndex];
        if (!player) return;

        // JAIL LOGIC
        if (player.inJail) {
            if (d1 === d2) {
                log(`${player.name} rolled Doubles (${d1}-${d2})! Free from Jail!`);
                player.inJail = false;
                player.jailTurns = 0;
                movePlayer(player, d1 + d2);
                // Turn ends after movement from jail (simplified)
                gameState.value.dice = [0, 0];
                broadcast();
                return;
            } else {
                player.jailTurns++;
                log(`${player.name} failed double roll. Attempt ${player.jailTurns}/3.`);
                if (player.jailTurns >= 3) {
                    // Force fine
                    log(`${player.name} failed 3 times. Must pay $50.`);
                    player.inJail = false;
                    player.jailTurns = 0;
                    player.cash -= 50;
                    gameState.value.vacationPot += 50;
                    movePlayer(player, d1 + d2);
                } else {
                    nextTurn();
                    return;
                }
            }
        } else {
            // NORMAL LOGIC
            if (d1 === d2) {
                gameState.value.consecutiveDoubles++;
                if (gameState.value.consecutiveDoubles >= 3) {
                    log(`${player.name} rolled 3 doubles! Speeding to Jail!`);
                    sendToJail(player);
                    nextTurn();
                    return;
                }
                log(`${player.name} rolled Doubles! (${d1}-${d2})`);
            } else {
                gameState.value.consecutiveDoubles = 0;
            }

            const steps = d1 + d2;
            log(`${player.name} rolled ${steps} (${d1}+${d2})`);
            movePlayer(player, steps);
        }

        // If not doubles, or if we just broke out of jail (handled above), nextTurn logic
        if (d1 !== d2) {
            nextTurn();
        } else {
            broadcast();
        }
    }

    function movePlayer(player: Player, steps: number) {
        let newPos = player.position + steps;
        const boardLen = gameState.value.board.length;

        if (newPos >= boardLen) {
            newPos = newPos % boardLen;
            const salary = gameState.value.settings.passGoAmount || 200;
            player.cash += salary;
            log(`${player.name} passed GO! Collected $${salary}`);
            playSound('cash');
        }

        player.position = newPos;
        handleLanding(player);
    }

    function handleLanding(player: Player) {
        const tile = gameState.value.board[player.position];
        if (!tile) return;

        if (tile.type === 'PROPERTY' || tile.type === 'AIRPORT' || tile.type === 'UTILITY') {
            if (tile.owner && tile.owner !== player.id) {
                payRent(player, tile);
            }
        } else if (tile.type === 'TAX') {
            const tax = tile.amount || 200;
            player.cash -= tax;
            gameState.value.vacationPot += tax;
            log(`${player.name} paid Tax: $${tax}`);
            playSound('fail');
        } else if ((tile.type as string) === 'JAIL_VISIT' && tile.name.toLowerCase().includes('go to')) {
            sendToJail(player);
        } else if (tile.type === 'VACATION') {
            if (gameState.value.vacationPot > 0) {
                const pot = gameState.value.vacationPot;
                player.cash += pot;
                gameState.value.vacationPot = 0;
                log(`${player.name} won Vacation Pot: $${pot}`);
                playSound('cash');
            }
        } else if (tile.type === 'TREASURE') {
            pickCard(player, 'TREASURE');
        } else if (tile.type === 'SURPRISE') {
            pickCard(player, 'SURPRISE');
        }
    }

    function payRent(player: Player, tile: Tile) {
        if (!tile.owner) return;
        const owner = gameState.value.players.find(p => p.id === tile.owner);
        if (!owner || owner.bankrupt) return;

        let rent = 10;
        if (tile.type === 'PROPERTY') {
            // Safe access to rent array
            rent = tile.rent?.[tile.houseCount || 0] ?? 10;
        } else if (tile.type === 'AIRPORT') {
            // 25 * count
            const count = gameState.value.board.filter(b => b.type === 'AIRPORT' && b.owner === tile.owner).length;
            rent = 25 * Math.pow(2, count - 1);
        } else if (tile.type === 'UTILITY') {
            const count = gameState.value.board.filter(b => b.type === 'UTILITY' && b.owner === tile.owner).length;
            const roll = gameState.value.dice[0] + gameState.value.dice[1];
            rent = roll * (count === 2 ? 10 : 4);
        }

        player.cash -= rent;
        owner.cash += rent;
        player.lastCreditor = owner.id;
        log(`${player.name} paid $${rent} rent to ${owner.name}`);
        playSound('cash');
    }

    function sendToJail(player: Player) {
        const jailIdx = gameState.value.board.findIndex(t => t.type === 'PRISON') || 10;
        player.position = jailIdx;
        player.inJail = true;
        player.jailTurns = 0;
        log(`${player.name} went to Court/Jail!`);
        playSound('fail');
    }

    function nextTurn() {
        if (!isHost.value) return;
        let nextIdx = gameState.value.turnIndex;
        let attempts = 0;
        const total = gameState.value.players.length;
        do {
            nextIdx = (nextIdx + 1) % total;
            attempts++;
        } while (gameState.value.players[nextIdx]?.bankrupt && attempts < total);

        gameState.value.turnIndex = nextIdx;
        gameState.value.dice = [0, 0];
        gameState.value.consecutiveDoubles = 0;

        broadcast();
    }

    function buyProperty(playerId: string) {
        if (!isHost.value) return;
        const player = gameState.value.players.find(p => p.id === playerId);
        if (!player || player.bankrupt) return;
        const tile = gameState.value.board[player.position];

        if (tile && tile.price && !tile.owner && player.cash >= tile.price) {
            player.cash -= tile.price;
            tile.owner = player.id;
            log(`${player.name} bought ${tile.name} for $${tile.price}`);
            playSound('buy');
            broadcast();
        }
    }

    function declareBankruptcy(playerId: string) {
        if (!isHost.value) return;
        const player = gameState.value.players.find(p => p.id === playerId);
        if (!player) return;
        player.bankrupt = true;
        player.cash = 0;

        // Reset assets
        gameState.value.board.forEach(t => {
            if (t.owner === playerId) {
                t.owner = null;
                t.houseCount = 0;
            }
        });

        log(`${player.name} is Bankrupt!`);
        playSound('fail');
        nextTurn();
    }

    function payJailFine(playerId: string) {
        if (!isHost.value) return;
        const player = gameState.value.players.find(p => p.id === playerId);
        if (!player || !player.inJail) return;

        if (player.cash >= 50) {
            player.cash -= 50;
            gameState.value.vacationPot += 50;
            player.inJail = false;
            player.jailTurns = 0;
            log(`${player.name} paid Jail Fine.`);
            playSound('cash');
            broadcast();
        }
    }

    // Trade Logic
    function offerTrade(offer: TradeOffer) {
        if (!isHost.value) return;
        gameState.value.currentTrade = { ...offer, status: 'PENDING' };
        log(`Trade offered by ${gameState.value.players.find(p => p.id === offer.initiator)?.name}`);
        broadcast();
    }

    function acceptTrade(tradeId: string) {
        if (!isHost.value) return;
        const trade = gameState.value.currentTrade;
        if (!trade || trade.id !== tradeId) return;

        const p1 = gameState.value.players.find(p => p.id === trade.initiator);
        const p2 = gameState.value.players.find(p => p.id === trade.target);

        if (p1 && p2) {
            p1.cash -= trade.offerCash;
            p2.cash += trade.offerCash;
            p2.cash -= trade.requestCash;
            p1.cash += trade.requestCash;

            trade.offerProperties.forEach(id => {
                const t = gameState.value.board.find(x => x.id === id);
                if (t && t.owner === p1.id) t.owner = p2.id;
            });

            trade.requestProperties.forEach(id => {
                const t = gameState.value.board.find(x => x.id === id);
                if (t && t.owner === p2.id) t.owner = p1.id;
            });

            log('Trade completed!');
            playSound('cash');
        }
        gameState.value.currentTrade = null;
        broadcast();
    }

    function rejectTrade(tradeId: string) {
        if (!isHost.value) return;
        if (gameState.value.currentTrade?.id !== tradeId) return;

        gameState.value.currentTrade = null;
        log('Trade Rejected.');
        broadcast();
    }

    function cancelTrade(tradeId: string) {
        if (!isHost.value) return;
        if (gameState.value.currentTrade?.id !== tradeId) return;

        gameState.value.currentTrade = null;
        log('Trade Cancelled.');
        broadcast();
    }

    function pickCard(player: Player, type: 'TREASURE' | 'SURPRISE') {
        const deck = type === 'TREASURE' ? treasureData : surpriseData;
        const card = deck[Math.floor(Math.random() * deck.length)];

        if (!card) return; // Fix potential undefined

        log(`${player.name} drew ${type}: ${card.text}`);

        if (card.action === 'ADD_CASH') {
            player.cash += (card.value || 0);
        } else if (card.action === 'SUB_CASH') {
            player.cash -= (card.value || 0);
        } else if (card.action === 'GO_TO_JAIL') {
            sendToJail(player);
        } else if (card.action === 'MOVE_TO') {
            if (card.targetId !== undefined) {
                player.position = card.targetId;
                handleLanding(player);
            }
        }
    }

    function updateState(newState: GameState) {
        // CRITICAL: Preserve local identity fields
        const localMyId = myId.value;
        const localRoomId = roomId.value;

        gameState.value = {
            ...newState,
            myId: localMyId,
            currentRoomId: localRoomId
        };
    }

    function log(msg: string) {
        gameState.value.lastActionLog.unshift(msg);
        if (gameState.value.lastActionLog.length > 50) gameState.value.lastActionLog.pop();
    }

    async function broadcast() {
        broadcastState(gameState.value);
        if (isHost.value && roomId.value) {
            try {
                const saveId = user.value?.uid || roomId.value;
                await setDoc(doc(db, "games", saveId), {
                    state: JSON.parse(JSON.stringify(gameState.value)),
                    updatedAt: Date.now()
                });
            } catch (e) {
                console.warn("Cloud save failed", e);
            }
        }
    }

    async function loadGame(id: string) {
        if (!isHost.value) return false;
        try {
            const snap = await getDoc(doc(db, "games", id));
            if (snap.exists()) {
                gameState.value = snap.data().state;
                log("Game state restored from cloud");
                broadcast();
                return true;
            }
        } catch (e) { console.warn(e); }
        return false;
    }

    async function deleteOldGame(id: string) {
        try { await deleteDoc(doc(db, "games", id)); } catch (e) { }
    }

    // User Intent
    function requestAction(action: GameAction) {
        if (isHost.value) {
            processAction(action);
        } else {
            sendAction(action);
        }
    }

    function processAction(action: GameAction) {
        if (action.type === 'START_GAME') {
            startGame();
            return;
        }
        if (action.type === 'JOIN') {
            addPlayer(action.payload);
            return;
        }
        if (action.type === 'ROLL_DICE') {
            if (gameState.value.dice[0] === 0) rollDice();
            return;
        }
        if (action.type === 'BUY_PROPERTY') {
            buyProperty(action.from);
            return;
        }
        if (action.type === 'PAY_JAIL_FINE') {
            payJailFine(action.from);
            return;
        }
        if (action.type === 'END_TURN') {
            nextTurn();
            return;
        }
        if (action.type === 'OFFER_TRADE') {
            offerTrade(action.payload);
            return;
        }
        if (action.type === 'ACCEPT_TRADE') {
            acceptTrade(action.payload);
            return;
        }
        if (action.type === 'REJECT_TRADE') {
            rejectTrade(action.payload);
            return;
        }
        if (action.type === 'CANCEL_TRADE') {
            cancelTrade(action.payload);
            return;
        }
        if (action.type === 'BANKRUPTCY') {
            declareBankruptcy(action.from);
            return;
        }
    }

    function setIdentity(id: string, host: boolean) {
        myId.value = id;
        isHost.value = host;
        gameState.value.myId = id;
    }

    function setRoomId(id: string) {
        roomId.value = id;
        gameState.value.currentRoomId = id;
    }

    // Getters
    const currentPlayer = computed(() => {
        if (!gameState.value.players.length) return undefined;
        return gameState.value.players[gameState.value.turnIndex];
    });

    const me = computed(() => gameState.value.players.find(p => p.id === myId.value));

    const isMyTurn = computed(() => {
        const current = currentPlayer.value;
        return current && current.id === myId.value;
    });

    const properties = computed(() => {
        return gameState.value.board.filter(t => t.owner);
    });

    return {
        gameState,
        myId,
        isHost,
        roomId,
        user,
        notifications,
        notify,
        addPlayer,
        startGame,
        rollDice,
        movePlayer,
        nextTurn,
        setIdentity,
        setRoomId,
        updateState,
        loadGame,
        deleteOldGame,
        requestAction,
        processAction,
        buyProperty,
        payJailFine,
        declareBankruptcy,
        offerTrade,
        acceptTrade,
        rejectTrade,
        cancelTrade,
        // Getters
        currentPlayer,
        me,
        isMyTurn,
        properties
    };
});
