import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { GameState, Player, Tile, GameAction, TradeOffer } from '../types';
import boardDataWorld from '../data/board.json';
import boardDataIndia from '../data/board-india.json';
import boardDataBangalore from '../data/board-bangalore.json';
import treasureData from '../data/treasure.json';
import surpriseData from '../data/surprise.json';
import { broadcastState, sendAction, clearGameData } from '../multiplayer/peer';
import { playSound } from '../logic/sound';
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
            passGoAmount: 300,
            mapSelection: 'world'
        },
        currentRoomId: null,
        myId: null,
        consecutiveDoubles: 0,
        vacationPot: 0,
        currentTrade: null,
        lastActivity: Date.now()
    });

    const currencySymbol = computed(() => {
        const map = gameState.value.settings.mapSelection;
        return (map === 'india' || map === 'bangalore') ? '₹' : '$';
    });

    function formatCurrency(amount: number) {
        const map = gameState.value.settings.mapSelection;
        if (map === 'india' || map === 'bangalore') {
            const abs = Math.abs(amount);
            const prefix = amount < 0 ? '-' : '';

            // Show more decimal places for large numbers to reflect small changes
            if (abs >= 10000000) return prefix + (abs / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 4 }) + 'Cr';
            if (abs >= 100000) return prefix + (abs / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + 'L';
            if (abs >= 1000) return prefix + (abs / 1000).toLocaleString('en-IN') + 'k';
            return amount.toString();
        }
        return amount.toLocaleString();
    }

    const notifications = ref<{ id: number, message: string, type: 'info' | 'success' | 'error' }[]>([]);
    let nextNotifyId = 0;

    function notify(message: string, type: 'info' | 'success' | 'error' = 'info') {
        const id = nextNotifyId++;
        if (type === 'error') playSoundWithSettings('fail');
        notifications.value.push({ id, message, type });
        setTimeout(() => {
            notifications.value = notifications.value.filter(n => n.id !== id);
        }, 4000);
    }

    // LOCAL sound mute preference (not synced - each player controls their own)
    const localSoundMuted = ref(false);

    // Load sound preference from localStorage immediately
    const initSoundPreference = () => {
        try {
            const saved = localStorage.getItem('monopoly_soundMuted');
            if (saved === 'true') {
                localSoundMuted.value = true;

            } else {

            }
        } catch (e) {
            console.warn('Failed to load sound preference', e);
        }
    };

    // Initialize immediately
    initSoundPreference();

    // Wrapper to trigger sound (updates state so peers play it too)
    function playSoundWithSettings(type: 'roll' | 'buy' | 'cash' | 'fail' | 'win' | 'turn' | 'bankrupt' | 'hotel' | 'fine' | 'tax' | 'deal' | 'house' | 'vacation' | 'negativeMoney') {
        // We set a random ID to ensure change detection even for same sound type
        gameState.value.lastSound = { type, id: Date.now() + Math.random() };
    }

    // Watch for sound events from state (Host or Peer)
    watch(() => gameState.value.lastSound, (newSound) => {
        if (newSound && newSound.type) {
            playSound(newSound.type as any, localSoundMuted.value);
        }
    });

    // Function to toggle sound mute (works for any player, not just host)
    function toggleSoundMute() {
        localSoundMuted.value = !localSoundMuted.value;

        // Save preference to localStorage for persistence
        try {
            localStorage.setItem('monopoly_soundMuted', String(localSoundMuted.value));
        } catch (e) {
            console.warn('Failed to save sound preference', e);
        }
    }

    // Track which players have negative cash (computed reactively)
    const playersWithNegativeCash = computed(() => {
        return gameState.value.players
            .filter(p => p.cash < 0)
            .map(p => p.id);
    });

    // Watch for new players going negative and play sound
    watch(playersWithNegativeCash, (newNegative, oldNegative = []) => {
        if (!isHost.value) return; // Only host triggers the sound event to avoid duplicates

        // Find players who just went negative (in new list but not in old list)
        const justWentNegative = newNegative.filter(id => !oldNegative.includes(id));

        if (justWentNegative.length > 0) {

            playSoundWithSettings('negativeMoney');
        }
    });


    // --- HOST ONLY LOGIC ---
    function addPlayer(player: Player) {

        if (!isHost.value) {
            console.warn('⚠️ addPlayer called but not host!');
            return;
        }

        // Duplicate Check Priority: 1. UID (Persistent), 2. Peer ID (Session)
        let existingIdx = -1;
        if (player.uid) {
            existingIdx = gameState.value.players.findIndex(p => p.uid === player.uid);
        }
        if (existingIdx === -1) {
            existingIdx = gameState.value.players.findIndex(p => p.id === player.id);
        }

        if (existingIdx === -1) {
            // NEW PLAYER
            // Duplicate Name - ALLOWED per user request
            // Logic removed to allow same names
            /*
            let originalName = player.name;
            let suffix = 2;
            while (gameState.value.players.some(p => p.name === player.name)) {
                player.name = `${originalName} (${suffix})`;
                suffix++;
            }
            */

            // Ensure Unique Color
            const usedColors = gameState.value.players.map(p => p.color);
            if (usedColors.includes(player.color)) {
                // Assign new random bright color
                const colors = ['#b84c4c', '#c87a3a', '#c4a24a', '#4f9a6a', '#4a6fb3', '#7a6fd6', '#b56db8', '#5fa7c6', '#7a4a2e', '#5fa7c6'];
                const available = colors.filter(c => !usedColors.includes(c));
                if (available.length > 0) {
                    const randomColor = available[Math.floor(Math.random() * available.length)];
                    if (randomColor) player.color = randomColor;
                } else {
                    player.color = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
                }
            }

            // No avatar generation - will use color or Google photo instead

            // OVERRIDE payload cash with Host's current settings to ensure fairness
            player.cash = gameState.value.settings.startingCash;

            gameState.value.players.push(player);

            log(`Player ${player.name} joined`);
            broadcast();
        } else {
            // REJOINING PLAYER
            const existing = gameState.value.players[existingIdx];
            if (existing) {

                // CRITICAL: Update the Peer ID so the player receives updates on new session
                existing.id = player.id;

                // Update identity but Preserve game state
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

    let inactivityTimer: any = null;

    function startGame() {
        if (!isHost.value) return;

        if (gameState.value.players.length < 2) {
            notify("Need at least 2 players to start!", "error");
            return;
        }

        // Load Selected Map
        const mapType = gameState.value.settings.mapSelection || 'world';
        let selectedBoard = boardDataWorld;
        if (mapType === 'india') selectedBoard = boardDataIndia;
        if (mapType === 'bangalore') selectedBoard = boardDataBangalore;

        gameState.value.board = JSON.parse(JSON.stringify(selectedBoard));

        // Set Pass GO amount based on map
        if (mapType === 'india' || mapType === 'bangalore') {
            gameState.value.settings.passGoAmount = 300000;
        } else {
            gameState.value.settings.passGoAmount = 300;
        }

        // CRITICAL FIX: Set all players' cash to match starting cash setting
        const startingCash = gameState.value.settings.startingCash || 1500;
        gameState.value.players.forEach(player => {
            player.cash = startingCash;
        });

        gameState.value.status = 'PLAYING';
        gameState.value.turnIndex = 0;
        gameState.value.lastActivity = Date.now();
        log(`Game Started on ${mapType.toUpperCase()} Map with ${formatCurrency(startingCash)} starting cash`);

        broadcast();
        startInactivityCheck();
    }

    function startInactivityCheck() {
        if (inactivityTimer) clearInterval(inactivityTimer);
        inactivityTimer = setInterval(() => {
            if (!isHost.value) return;
            const now = Date.now();
            const last = gameState.value.lastActivity || now;
            // 5 Minutes Timeout
            if (now - last > 5 * 60 * 1000) {
                closeGame("Game closed due to 5 minutes of inactivity.");
            }
        }, 60 * 1000); // Check every minute
    }

    function resetState() {
        const localId = myId.value;
        gameState.value = {
            status: 'LOBBY',
            turnIndex: 0,
            players: [],
            board: JSON.parse(JSON.stringify(boardDataWorld)),
            dice: [0, 0],
            lastActionLog: [],
            settings: {
                startingCash: 1500,
                passGoAmount: 300,
                mapSelection: 'world'
            },
            currentRoomId: null,
            myId: localId,
            consecutiveDoubles: 0,
            vacationPot: 0,
            currentTrade: null,
            lastActivity: Date.now()
        };
        roomId.value = null;
        isHost.value = false;
    }

    function closeGame(reason: string = "Game closed by host.") {
        if (!isHost.value) return;
        notify(reason, "error");
        log("🔴 " + reason);

        gameState.value.status = 'GAME_OVER';
        broadcast();

        setTimeout(() => {
            if (roomId.value) clearGameData(roomId.value);
            resetState();
            broadcast();
        }, 2500);
    }

    function rollDice() {
        if (!isHost.value) return;
        const d1 = Math.ceil(Math.random() * 6);
        const d2 = Math.ceil(Math.random() * 6);
        gameState.value.dice = [d1, d2];
        playSoundWithSettings('roll');

        const player = gameState.value.players[gameState.value.turnIndex];
        if (!player) return;

        // JAIL LOGIC - Should not be reached via UI
        if (player.inJail) return;

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
            log(`${player.name} passed GO! Collected ${formatCurrency(salary)}`);
            playSoundWithSettings('cash');
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
        // Adjusted Fine for India Map Scale
        const fine = (map === 'india' || map === 'bangalore') ? 500000 : 50;

        // Allow paying fine even if negative cash (Take Debt)
        player.cash -= fine;
        gameState.value.vacationPot += fine;
        player.inJail = false;
        player.jailTurns = 0;
        log(`${player.name} paid ${formatCurrency(fine)} fine.`);
        playSoundWithSettings('fine');

        // Auto-roll dice and move
        const d1 = Math.ceil(Math.random() * 6);
        const d2 = Math.ceil(Math.random() * 6);
        gameState.value.dice = [d1, d2];

        log(`${player.name} rolled ${d1 + d2} (${d1}+${d2})`);
        movePlayer(player, d1 + d2);

        // Turn ENDS (even if sent back to jail!)
        nextTurn();
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
                log(`${player.name} landed on Income Tax. (10% worth: ${formatCurrency(tenPercent)})`);
            }

            if (taxAmount > 0) {
                player.cash -= taxAmount;
                // Tax Destination: Bank (default) or Vacation Pot
                // "Optional custom rule... Tax money goes into Vacation"
                // We'll enable it for fun as it handles amounts nicely
                gameState.value.vacationPot += taxAmount;

                log(`${player.name} paid ${tile.name}: ${formatCurrency(taxAmount)} (Pot: ${formatCurrency(gameState.value.vacationPot)})`);
                playSoundWithSettings('tax');
            }
        } else if ((tile.type as string) === 'JAIL_VISIT' || tile.name.includes('rison')) {
            // "Go to prison" specific logic
            // Check if it's the "Go to Prison" corner or just "Jail Visit"
            if (tile.name.toLowerCase().includes('go to')) {
                sendToJail(player);
                playSoundWithSettings('fail');
                // SCENARIO 0: Turn ENDS immediately when sent to jail
                return true;
            } else {
                log(`${player.name} is just visiting Jail.`);
            }
        } else if (tile.type === 'VACATION') {
            log(`${player.name} is on Vacation.`);
            playSoundWithSettings('vacation');
            if (gameState.value.vacationPot > 0) {
                const amount = gameState.value.vacationPot;
                player.cash += amount;
                gameState.value.vacationPot = 0;
                log(`${player.name} won the Vacation Pot: ${formatCurrency(amount)}!`);
                playSoundWithSettings('cash');
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

        return player.inJail; // If player ended up in jail (e.g. via Card), turn ends
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

            // Scale for Indian maps (base currency ~1000x higher)
            if (isIndian) {
                rentAmount *= 1000;
            }
        } else if (tile.type === 'TAX') {
            // Taxes are usually one-time landing fees handled in landOnTile
            return;
        }

        player.lastCreditor = owner.id;
        player.cash -= rentAmount;
        owner.cash += rentAmount;
        log(`${player.name} paid ${formatCurrency(rentAmount)} rent to ${owner.name}`);
        playSoundWithSettings('tax');
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
            playSoundWithSettings('turn');
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
            log(`${player.name} bought ${tile.name} for ${formatCurrency(tile.price)}`);
            playSoundWithSettings('buy');
            broadcast();
        }
    }

    function upgradeProperty(playerId: string, tileIndex: number) {
        if (!isHost.value) return;
        const player = gameState.value.players.find(p => p.id === playerId);
        const tile = gameState.value.board[tileIndex];

        if (!player || !tile || tile.owner !== playerId || tile.type !== 'PROPERTY') return;

        // Check if player owns all properties in the group (monopoly)
        const groupProps = gameState.value.board.filter(t => t.type === 'PROPERTY' && t.group === tile.group);
        const ownsAll = groupProps.every(t => t.owner === playerId);

        if (!ownsAll) {
            notify("You must own all properties in this color group to build!", "error");
            return;
        }

        // Calculate build cost (50% of property price or use buildCost if defined)
        const cost = tile.buildCost || Math.floor((tile.price || 100) * 0.5);

        // Check current house count
        const currentHouses = tile.houseCount || 0;

        // Max is 5 (4 houses + 1 hotel)
        if (currentHouses >= 5) {
            notify("This property already has a hotel!", "error");
            return;
        }

        // Check if player has enough cash
        if (player.cash < cost) {
            notify(`Not enough cash! Building costs ${formatCurrency(cost)}`, "error");
            return;
        }

        // Even Build Rule: Can't build if this property would have 2+ more houses than others
        const otherPropsInGroup = groupProps.filter(t => t.id !== tile.id);
        const minHousesInGroup = Math.min(...otherPropsInGroup.map(t => t.houseCount || 0));

        if (currentHouses > minHousesInGroup) {
            notify("Even build rule: Build on other properties in this group first!", "error");
            return;
        }

        // All checks passed, build!
        player.cash -= cost;
        tile.houseCount = currentHouses + 1;

        if (tile.houseCount === 5) {
            log(`${player.name} built a HOTEL on ${tile.name}!`);
            playSoundWithSettings('hotel');
        } else {
            log(`${player.name} built house #${tile.houseCount} on ${tile.name}`);
            playSoundWithSettings('house');
        }

        broadcast();
    }

    function downgradeProperty(playerId: string, tileIndex: number) {
        if (!isHost.value) return;
        const player = gameState.value.players.find(p => p.id === playerId);
        const tile = gameState.value.board[tileIndex];

        if (!player || !tile || tile.owner !== playerId || tile.type !== 'PROPERTY') return;

        // Check current house count
        const currentHouses = tile.houseCount || 0;

        if (currentHouses === 0) {
            notify("No houses to sell!", "error");
            return;
        }

        // Calculate sell value (50% of build cost)
        const buildCost = tile.buildCost || Math.floor((tile.price || 100) * 0.5);
        const sellValue = Math.floor(buildCost * 0.5);

        // Check if player owns all properties in the group  
        const groupProps = gameState.value.board.filter(t => t.type === 'PROPERTY' && t.group === tile.group);
        // Even Sell Rule: Must sell from the property with the MOST houses first
        // If currentHouses is LESS than the max in the group, we can't sell this one yet
        const maxHousesAnywhere = Math.max(...groupProps.map(t => t.houseCount || 0));

        if (currentHouses < maxHousesAnywhere) {
            notify("Even sell rule: Sell from the most developed property in this group first!", "error");
            return;
        }

        // All checks passed, sell!
        player.cash += sellValue;
        tile.houseCount = currentHouses - 1;

        if (currentHouses === 5) {
            log(`${player.name} sold their HOTEL on ${tile.name} for ${formatCurrency(sellValue)}`);
        } else {
            log(`${player.name} sold a house from ${tile.name} for ${formatCurrency(sellValue)}`);
        }
        playSoundWithSettings('deal');

        broadcast();
    }

    function declareBankruptcy(playerId: string) {
        if (!isHost.value) return;
        const player = gameState.value.players.find(p => p.id === playerId);
        if (!player) return;
        player.bankrupt = true;
        player.cash = 0;
        resetAssetsToBank(playerId);
        log(`${player.name} is Bankrupt!`);
        playSoundWithSettings('fail');
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
            playSoundWithSettings('win');
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

    }

    function log(msg: string) {
        // Find $ followed by numbers and format them
        const formattedMsg = msg.replace(/\$(\d+)/g, (_, amount) => {
            return currencySymbol.value + formatCurrency(parseInt(amount));
        }).replace(/\$/g, currencySymbol.value);

        // Identify involved players mentioned in the message
        const involvedPlayers: string[] = [];
        gameState.value.players.forEach(p => {
            // Check if player name is in message (simple check)
            if (formattedMsg.includes(p.name)) {
                involvedPlayers.push(p.id);
            }
        });

        gameState.value.lastActionLog.unshift({
            message: formattedMsg,
            involvedPlayers
        });
        if (gameState.value.lastActionLog.length > 50) gameState.value.lastActionLog.pop();
    }

    async function broadcast() {
        broadcastState(gameState.value);
        if (isHost.value && roomId.value) {
            try {
                const stateSnapshot = JSON.parse(JSON.stringify(gameState.value));

                // ALWAYS save to roomId (for live client sync via onSnapshot)
                await setDoc(doc(db, "games", roomId.value), {
                    state: stateSnapshot,
                    updatedAt: Date.now(),
                    hostUid: user.value?.uid || null
                });

                // ALSO save to user UID if different (for persistent rejoin)
                if (user.value?.uid && user.value.uid !== roomId.value) {
                    await setDoc(doc(db, "games", user.value.uid), {
                        state: stateSnapshot,
                        updatedAt: Date.now(),
                        roomId: roomId.value
                    });
                }

                // Update user's last room for "Rejoin" feature
                if (user.value?.uid) {
                    await setDoc(doc(db, "users", user.value.uid), {
                        lastRoomId: roomId.value,
                        lastHostUid: user.value.uid,
                        lastAccessed: Date.now(),
                        wasHost: true
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
            // Ensure numbers to prevent string concatenation bugs
            const offerVal = Number(trade.offerCash);
            const requestVal = Number(trade.requestCash);

            p1.cash -= offerVal;
            p2.cash += offerVal;
            p2.cash -= requestVal;
            p1.cash += requestVal;

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
            playSoundWithSettings('deal');
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

        // Update Activity Timestamp
        gameState.value.lastActivity = Date.now();

        switch (action.type) {
            case 'START_GAME':
                startGame();
                return;
            case 'END_GAME':
                closeGame("Game closed by host.");
                return;
        }

        if (action.type === 'JOIN') {

            addPlayer(action.payload);

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

        // Allow building houses/hotels anytime (not just on your turn)
        if (action.type === 'UPGRADE_PROPERTY') {
            upgradeProperty(action.from, action.payload);
            return;
        }
        if (action.type === 'DOWNGRADE_PROPERTY') {
            downgradeProperty(action.from, action.payload);
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
                const p = gameState.value.players.find(pl => pl.id === action.from);
                if (p && p.cash < 0) {
                    notify("You are in DEBT! Sell properties or Declare Bankruptcy to proceed.", "error");
                    return;
                }
                nextTurn();
                break;
        }
    }

    function pickCard(player: Player, type: 'TREASURE' | 'SURPRISE') {
        const deck = type === 'TREASURE' ? treasureData : surpriseData;
        const card = deck[Math.floor(Math.random() * deck.length)];

        if (!card) return;


        const map = gameState.value.settings.mapSelection;
        const isScaled = (map === 'india' || map === 'bangalore');

        let val = card.value || 0;
        if (isScaled && val > 0 && val < 1000) {
            // Scale rewards for High Value Maps (e.g. 50 -> 500k)
            val = val * 10000;
        }

        log(`${player.name} drew ${type}: ${card.text}. Value: ${formatCurrency(val)}`);

        // Resolve Action
        if (card.action === 'ADD_CASH') {
            player.cash += val;
            playSoundWithSettings('cash');
        } else if (card.action === 'SUB_CASH') {
            player.cash -= val;
            gameState.value.vacationPot += val;
            playSoundWithSettings('fail');
        } else if (card.action === 'GO_TO_JAIL') {
            sendToJail(player);
            playSoundWithSettings('fail');
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
        upgradeProperty,
        downgradeProperty,
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
        formatCurrency,
        closeGame,
        resetState,
        toggleSoundMute,
        localSoundMuted
    };
});
