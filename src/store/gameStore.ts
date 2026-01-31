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

    const currencySymbol = computed(() => {
        const map = gameState.value.settings.mapSelection;
        return (map === 'india' || map === 'bangalore') ? '₹' : '$';
    });

    function formatCurrency(amount: number) {
        const map = gameState.value.settings.mapSelection;
        if (map === 'india' || map === 'bangalore') {
            if (amount >= 10000000) return (amount / 10000000).toLocaleString('en-IN') + 'Cr';
            if (amount >= 100000) return (amount / 100000).toLocaleString('en-IN') + 'L';
            if (amount >= 1000) return (amount / 1000).toLocaleString('en-IN') + 'k';
            return amount.toString();
        }
        return amount.toLocaleString();
    }

    const notifications = ref<{ id: number, message: string, type: 'info' | 'success' | 'error' }[]>([]);
    let nextNotifyId = 0;

    function notify(message: string, type: 'info' | 'success' | 'error' = 'info') {
        const id = nextNotifyId++;
        if (type === 'error') playSound('fail');
        notifications.value.push({ id, message, type });
        setTimeout(() => {
            notifications.value = notifications.value.filter(n => n.id !== id);
        }, 4000);
    }

    // --- HOST ONLY LOGIC ---
    function addPlayer(player: Player) {
        console.log('🔧 addPlayer called. isHost:', isHost.value, 'Player:', player.name);
        if (!isHost.value) {
            console.warn('⚠️ addPlayer called but not host!');
            return;
        }
        const existingIdx = gameState.value.players.findIndex(p => p.id === player.id);
        if (existingIdx === -1) {
            // Handle Duplicate Names
            let originalName = player.name;
            let suffix = 2;
            while (gameState.value.players.some(p => p.name === player.name)) {
                player.name = `${originalName} (${suffix})`;
                suffix++;
            }

            // Ensure Unique Color
            const usedColors = gameState.value.players.map(p => p.color);
            if (usedColors.includes(player.color)) {
                // Assign new random bright color
                const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
                const available = colors.filter(c => !usedColors.includes(c));
                if (available.length > 0) {
                    const randomColor = available[Math.floor(Math.random() * available.length)];
                    if (randomColor) player.color = randomColor;
                } else {
                    // Fallback random
                    player.color = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
                }
            }

            // Generate Avatar if missing or default
            if (!player.avatar || player.avatar === '👤' || player.avatar.length < 5) {
                const avatar = createAvatar(lorelei, {
                    seed: player.name + player.id,
                    backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf', 'ffd5dc'],
                    radius: 50
                });
                player.avatar = avatar.toString();
            }

            // OVERRIDE payload cash with Host's current settings to ensure fairness
            player.cash = gameState.value.settings.startingCash;

            gameState.value.players.push(player);
            console.log('✨ Player added successfully:', player.name, 'Total players:', gameState.value.players.length);
            log(`Player ${player.name} joined`);
            broadcast();
        } else {
            // Update existing player (re-join)
            const existing = gameState.value.players[existingIdx];
            if (existing) {
                console.log('🔄 Player rejoined. Preserving state for:', player.name);
                // CRITICAL: specific merge to avoid overwriting game progress with lobby defaults
                gameState.value.players[existingIdx] = {
                    ...existing,
                    name: player.name,
                    avatar: player.avatar,
                    isHost: existing.isHost || player.isHost
                };
                broadcast();
            }
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

        // CRITICAL FIX: Set all players' cash to match starting cash setting
        const startingCash = gameState.value.settings.startingCash || 1500;
        gameState.value.players.forEach(player => {
            player.cash = startingCash;
        });

        gameState.value.status = 'PLAYING';
        gameState.value.turnIndex = 0;
        log(`Game Started on ${mapType.toUpperCase()} Map with ${formatCurrency(startingCash)} starting cash`);

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

        // JAIL LOGIC - Turn ends after ANY jail interaction
        if (player.inJail) {
            const isDouble = d1 === d2;

            if (isDouble) {
                // SCENARIO 1A: Double rolled - immediate release
                log(`${player.name} rolled Doubles (${d1}-${d2})! Free from Jail!`);
                player.inJail = false;
                player.jailTurns = 0;
                gameState.value.consecutiveDoubles = 0;

                // Move and resolve landing
                const steps = d1 + d2;
                const sentToJail = movePlayer(player, steps);

                // Turn ENDS immediately (no extra roll for doubles in jail)
                if (sentToJail) {
                    // If landed on Go to Prison or drew jail card
                    nextTurn();
                    broadcast();
                    return;
                }
                nextTurn();
                broadcast();
                return;
            } else {
                // SCENARIO 1B: Not a double
                player.jailTurns++;
                log(`${player.name} failed double roll. Attempt ${player.jailTurns}/3.`);

                // SCENARIO 2: Forced exit on 3rd failed attempt
                if (player.jailTurns >= 3) {
                    const map = gameState.value.settings.mapSelection;
                    const fine = (map === 'india' || map === 'bangalore') ? 50000 : 50;

                    log(`${player.name} failed 3 times. Must pay $${fine}.`);
                    player.cash -= fine;
                    gameState.value.vacationPot += fine;
                    player.inJail = false;
                    player.jailTurns = 0;
                    playSound('cash');

                    log(`${player.name} paid fine and moves ${d1 + d2}.`);
                    const sentToJail = movePlayer(player, d1 + d2);

                    // Turn ENDS after forced exit
                    if (sentToJail) {
                        // If landed on Go to Prison
                        nextTurn();
                        broadcast();
                        return;
                    }
                    nextTurn();
                    broadcast();
                    return;
                } else {
                    // Stay in jail - NO MOVEMENT
                    log(`${player.name} remains in jail.`);
                    gameState.value.consecutiveDoubles = 0;

                    // Turn ENDS automatically
                    nextTurn();
                    broadcast();
                    return;
                }
            }
        }

        // NORMAL LOGIC (Not in Jail)
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
        const sentToJail = movePlayer(player, steps);

        // If sent to jail by landing, turn ends immediately
        if (sentToJail) {
            nextTurn();
        }
        broadcast();
    }

    function movePlayer(player: Player, steps: number): boolean {
        let newPos = player.position + steps;
        const boardLen = gameState.value.board.length;

        if (newPos >= boardLen) {
            newPos = newPos % boardLen;
            const salary = gameState.value.settings.passGoAmount;
            player.cash += salary;
            log(`${player.name} passed GO! Collected $${salary}`);
            playSound('cash');
        }

        player.position = newPos;
        const shouldEndTurn = handleLanding(player);
        return shouldEndTurn; // Returns true if landing sends to jail
    }

    function payJailFine(playerId: string) {
        if (!isHost.value) return;
        const player = gameState.value.players.find(p => p.id === playerId);
        if (!player || !player.inJail) return;

        const map = gameState.value.settings.mapSelection;
        const fine = (map === 'india' || map === 'bangalore') ? 50000 : 50;

        // SCENARIO 3: Pay fine
        if (player.cash >= fine) {
            player.cash -= fine;
            gameState.value.vacationPot += fine;
            player.inJail = false;
            player.jailTurns = 0;
            log(`${player.name} paid $${fine} fine.`);
            playSound('cash');

            // Auto-roll dice and move
            const d1 = Math.ceil(Math.random() * 6);
            const d2 = Math.ceil(Math.random() * 6);
            gameState.value.dice = [d1, d2];

            log(`${player.name} rolled ${d1 + d2} (${d1}+${d2})`);
            movePlayer(player, d1 + d2);

            // Turn ENDS (even if sent back to jail!)
            nextTurn();
        } else {
            log(`${player.name} cannot afford the fine!`);
        }
        broadcast();
    }

    function handleLanding(player: Player): boolean {
        const tile = gameState.value.board[player.position];
        if (!tile) return false;

        // Log landing only if meaningful or distinct
        if (tile.type !== 'START') {
            // log(`${player.name} landed on ${tile.name}`);
        }

        if (tile.type === 'PROPERTY' || tile.type === 'AIRPORT' || tile.type === 'UTILITY') {
            log(`${player.name} landed on ${tile.name}`);
            if (tile.owner && tile.owner !== player.id) {
                payRent(player, tile);
            }
        } else if (tile.type === 'TAX') {
            let taxAmount = tile.amount || 0;

            // Income Tax: 10% or 200 Rule check
            if (tile.name === 'Income Tax') {
                // Calculate 10% of total worth
                const propertiesVal = gameState.value.board
                    .filter(t => t.owner === player.id)
                    .reduce((sum, t) => sum + (t.price || 0) + (t.houseCount || 0) * 50, 0);
                const totalWorth = player.cash + propertiesVal;
                const tenPercent = Math.floor(totalWorth * 0.1);

                // We log the 10% value for fun
                log(`${player.name} landed on Income Tax. (10% worth: $${tenPercent})`);
            }

            if (taxAmount > 0) {
                player.cash -= taxAmount;
                // Tax Destination: Bank (default) or Vacation Pot
                // "Optional custom rule... Tax money goes into Vacation"
                // We'll enable it for fun as it handles amounts nicely
                gameState.value.vacationPot += taxAmount;

                log(`${player.name} paid ${tile.name}: $${taxAmount} (Pot: $${gameState.value.vacationPot})`);
                playSound('fail');
            }
        } else if ((tile.type as string) === 'JAIL_VISIT' || tile.name.includes('rison')) {
            // "Go to prison" specific logic
            // Check if it's the "Go to Prison" corner or just "Jail Visit"
            if (tile.name.toLowerCase().includes('go to')) {
                sendToJail(player);
                playSound('fail');
                // SCENARIO 0: Turn ENDS immediately when sent to jail
                return true;
            } else {
                log(`${player.name} is just visiting Jail.`);
            }
        } else if (tile.type === 'VACATION') {
            log(`${player.name} is on Vacation.`);
            if (gameState.value.vacationPot > 0) {
                const amount = gameState.value.vacationPot;
                player.cash += amount;
                gameState.value.vacationPot = 0;
                log(`${player.name} won the Vacation Pot: $${amount}!`);
                playSound('cash');
            }
        } else if (tile.type === 'TREASURE') {
            log(`${player.name} landed on Treasure.`);
            pickCard(player, 'TREASURE');
        } else if (tile.type === 'SURPRISE') {
            log(`${player.name} landed on Surprise.`);
            pickCard(player, 'SURPRISE');
        } else if (tile.type === 'START') {
            log(`${player.name} landed on Start.`);
        }

        return false; // Normal landing, turn continues
    }

    function payRent(player: Player, tile: Tile) {
        if (!tile.owner) return;
        const owner = gameState.value.players.find(p => p.id === tile.owner);
        if (!owner || owner.bankrupt) return;

        let rentAmount = 0;
        const map = gameState.value.settings.mapSelection;
        const isIndian = (map === 'india' || map === 'bangalore');

        if (tile.type === 'PROPERTY') {
            const idx = tile.houseCount || 0;
            if (tile.rent) rentAmount = tile.rent[idx] ?? 10;
        } else if (tile.type === 'AIRPORT') {
            const ownerAirports = gameState.value.board.filter(t => t.type === 'AIRPORT' && t.owner === owner.id).length;
            // Base rent from tile data or default
            const baseRent = isIndian ? 100000 : 25;
            // Rent = base × 2^(n-1) where n is number owned
            rentAmount = baseRent * Math.pow(2, ownerAirports - 1);
        } else if (tile.type === 'UTILITY') {
            const ownerUtils = gameState.value.board.filter(t => t.type === 'UTILITY' && t.owner === owner.id).length;
            const diceSum = gameState.value.dice[0] + gameState.value.dice[1];
            // Standard Monopoly rules adjusted for 3 utilities:
            // 1 utility = dice × 4
            // 2 utilities = dice × 10  
            // 3 utilities = dice × 20 (all utilities monopoly bonus)
            let multiplier = 4;
            if (ownerUtils === 2) multiplier = 10;
            if (ownerUtils >= 3) multiplier = 20;
            rentAmount = diceSum * multiplier;
        } else if (tile.type === 'TAX') {
            // Taxes are usually one-time landing fees handled in landOnTile
            return;
        }

        player.lastCreditor = owner.id;
        player.cash -= rentAmount;
        owner.cash += rentAmount;
        log(`${player.name} paid $${rentAmount} rent to ${owner.name}`);
        playSound('cash');
    }

    function sendToJail(player: Player) {
        const jailIdx = gameState.value.board.findIndex(t => t.type === 'PRISON') || 10;
        player.position = jailIdx;
        player.inJail = true;
        player.jailTurns = 0;
        log(`${player.name} went to Court/Jail!`);
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

        const nextP = gameState.value.players[nextIdx];
        if (nextP) {
            log(`Now it's ${nextP.name}'s turn`);
            playSound('turn');
        }
        broadcast();
    }

    function buyProperty(playerId: string) {
        if (!isHost.value) return;
        const player = gameState.value.players.find(p => p.id === playerId);
        if (!player || player.bankrupt) return;
        const tile = gameState.value.board[player.position];

        // Allow buying any tile with a price that's not owned
        if (tile && tile.price !== undefined && tile.price > 0 && !tile.owner && player.cash >= tile.price) {
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
        resetAssetsToBank(playerId);
        log(`${player.name} is Bankrupt!`);
        playSound('fail');
        checkWinner();
        nextTurn();
    }

    function resetAssetsToBank(playerId: string) {
        gameState.value.board.forEach(t => {
            if (t.owner === playerId) {
                t.owner = null;
                t.houseCount = 0;
            }
        });
    }

    function checkWinner() {
        const active = gameState.value.players.filter(p => !p.bankrupt);
        if (active.length === 1 && gameState.value.players.length > 1) {
            gameState.value.winner = active[0];
            gameState.value.status = 'GAME_OVER';
            if (active[0]) log(`${active[0].name} Wins!`);
            playSound('win');
            broadcast();
        }
    }

    function updateState(newState: GameState) {
        // CRITICAL: Preserve local identity fields to avoid being overwritten by host
        const localMyId = myId.value;
        const localRoomId = roomId.value;

        gameState.value = {
            ...newState,
            myId: localMyId,
            currentRoomId: localRoomId
        };
        console.log('🔄 State updated from host. My ID:', localMyId, 'Players:', newState.players.length);
    }

    function log(msg: string) {
        // Find $ followed by numbers and format them
        const formattedMsg = msg.replace(/\$(\d+)/g, (_, amount) => {
            return currencySymbol.value + formatCurrency(parseInt(amount));
        }).replace(/\$/g, currencySymbol.value);

        gameState.value.lastActionLog.unshift(formattedMsg);
        if (gameState.value.lastActionLog.length > 50) gameState.value.lastActionLog.pop();
    }

    async function broadcast() {
        broadcastState(gameState.value);
        if (isHost.value && roomId.value) {
            try {
                // Use UID as permanent storage key if available
                const saveId = user.value?.uid || roomId.value;
                await setDoc(doc(db, "games", saveId), {
                    state: JSON.parse(JSON.stringify(gameState.value)),
                    updatedAt: Date.now()
                });

                // Also update user's last room for "Rejoin" feature
                if (user.value?.uid) {
                    await setDoc(doc(db, "users", user.value.uid), {
                        lastRoomId: roomId.value,
                        lastAccessed: Date.now()
                    }, { merge: true });
                }
            } catch (e) {
                // Silently handle permission errors to avoid blocking local gameplay
                console.warn("Cloud save paused: Firestore permissions might be restricted.", e);
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
        } catch (e) {
            console.warn("Load failed (permissions or network)", e);
        }
        return false;
    }

    async function deleteOldGame(id: string) {
        try {
            await deleteDoc(doc(db, "rooms", id));
            return true;
        } catch (e) {
            console.warn("Failed to delete game record:", e);
            return false;
        }
    }

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

            log(`Trade completed between ${p1.name} and ${p2.name}!`);
            notify(`🤝 Trade completed: ${p1.name} ↔️ ${p2.name}`, 'success');
            playSound('cash');
        }
        gameState.value.currentTrade = null;
        broadcast();
    }

    function rejectTrade(tradeId: string) {
        if (!isHost.value) return;
        const trade = gameState.value.currentTrade;
        if (!trade || trade.id !== tradeId) return;

        log(`Trade Rejected.`);
        gameState.value.currentTrade = null;
        broadcast();
    }

    function cancelTrade(tradeId: string) {
        if (!isHost.value) return;
        const trade = gameState.value.currentTrade;
        if (!trade || trade.id !== tradeId) return;

        log(`Trade Cancelled by initiator.`);
        gameState.value.currentTrade = null;
        broadcast();
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
        if (!action || !action.type) return;

        const current = gameState.value.players[gameState.value.turnIndex];
        const senderIsCurrent = current ? (current.id === action.from) : false;

        switch (action.type) {
            case 'START_GAME':
                startGame();
                return;
        }

        if (action.type === 'JOIN') {
            console.log('👥 Processing JOIN action for:', action.payload.name, 'ID:', action.payload.id);
            addPlayer(action.payload);
            console.log('✅ Current players in game:', gameState.value.players.map(p => p.name).join(', '));
            return;
        }

        if (action.type === 'BANKRUPTCY') {
            if (senderIsCurrent) {
                declareBankruptcy(action.from);
            }
            return;
        }

        // Trade Actions
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

        if (!senderIsCurrent) return;

        switch (action.type) {
            case 'ROLL_DICE':
                if (gameState.value.dice[0] === 0) rollDice();
                break;
            case 'BUY_PROPERTY':
                buyProperty(action.from);
                break;
            case 'PAY_JAIL_FINE':
                payJailFine(action.from);
                break;
            case 'END_TURN':
                nextTurn();
                break;
        }
    }

    function pickCard(player: Player, type: 'TREASURE' | 'SURPRISE') {
        const deck = type === 'TREASURE' ? treasureData : surpriseData;
        const card = deck[Math.floor(Math.random() * deck.length)];

        if (!card) return;

        log(`${player.name} drew ${type}: ${card.text}`);

        // Resolve Action
        if (card.action === 'ADD_CASH') {
            player.cash += card.value || 0;
            playSound('cash');
        } else if (card.action === 'SUB_CASH') {
            player.cash -= card.value || 0;
            playSound('fail');
        } else if (card.action === 'GO_TO_JAIL') {
            sendToJail(player);
            playSound('fail');
        } else if (card.action === 'MOVE_TO') {
            // handle direct jump
            player.position = (card.targetId !== undefined) ? card.targetId : 0;
            handleLanding(player);
        }
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

    // Actions
    function setIdentity(id: string, host: boolean) {
        myId.value = id;
        isHost.value = host;
        gameState.value.myId = id;
    }

    function setRoomId(id: string) {
        roomId.value = id;
        gameState.value.currentRoomId = id;
    }

    return {
        gameState,
        myId,
        isHost,
        roomId,
        user,
        currentPlayer,
        me,
        isMyTurn,
        properties,
        addPlayer,
        startGame,
        rollDice,
        movePlayer,
        nextTurn,
        buyProperty,
        declareBankruptcy,
        payJailFine,
        setIdentity,
        setRoomId,
        updateState,
        loadGame,
        deleteOldGame,
        requestAction,
        processAction,
        notify,
        notifications,
        currencySymbol,
        formatCurrency
    };
});
