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

// Helper to safely parse board data casting to Tile[]
const initialBoard: Tile[] = JSON.parse(JSON.stringify(boardDataWorld));

export const useGameStore = defineStore('game', () => {
    // State
    const myId = ref<string | null>(null);
    const isHost = ref(false);
    const roomId = ref<string | null>(null);

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

    // ... (Keep existing getters/actions) ...

    // --- HOST ONLY LOGIC ---
    function addPlayer(player: Player) {
        if (!isHost.value) return;
        if (!gameState.value.players.find(p => p.id === player.id)) {
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
                player.avatar = avatar.toDataUri();
            }

            gameState.value.players.push(player);
            log(`Player ${player.name} joined`);
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
            // Case 1: Doubles -> Escape immediately
            if (d1 === d2) {
                log(`${player.name} rolled Doubles (${d1}-${d2})! Free from Jail!`);
                player.inJail = false;
                player.jailTurns = 0;
                // Move immediately with this roll
                const steps = d1 + d2;
                movePlayer(player, steps);
                // Turn ends after movement (no extra turn for doubles in jail)
                gameState.value.dice = [0, 0];
                gameState.value.consecutiveDoubles = 0;
                broadcast();
                return;
            } else {
                // Case 2: Not doubles
                player.jailTurns++;
                log(`${player.name} failed double roll. Attempt ${player.jailTurns}/3.`);

                // Forced Exit after 3rd fail
                if (player.jailTurns >= 3) {
                    log(`${player.name} failed 3 times. Must pay $50.`);
                    if (player.cash >= 50) {
                        player.cash -= 50;
                        gameState.value.vacationPot += 50;
                        player.inJail = false;
                        player.jailTurns = 0;
                        playSound('fail');

                        log(`${player.name} paid fine and moves ${d1 + d2}.`);
                        movePlayer(player, d1 + d2);
                    } else {
                        // Debt Logic
                        player.cash -= 50;
                        gameState.value.vacationPot += 50;
                        player.inJail = false;
                        player.jailTurns = 0;
                        log(`${player.name} incurs debt ($50) to leave Jail.`);
                        movePlayer(player, d1 + d2);
                    }
                } else {
                    // Stay in jail, turn ends
                    nextTurn();
                    return;
                }
                gameState.value.consecutiveDoubles = 0;
                broadcast();
                return;
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
        movePlayer(player, steps);
        broadcast();
    }

    function movePlayer(player: Player, steps: number) {
        let newPos = player.position + steps;
        const boardLen = gameState.value.board.length;

        if (newPos >= boardLen) {
            newPos = newPos % boardLen;
            player.cash += gameState.value.settings.passGoAmount;
            log(`${player.name} passed GO! Collected $${gameState.value.settings.passGoAmount}`);
            playSound('cash');
        }

        player.position = newPos;
        handleLanding(player);
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
            log(`${player.name} paid $50 fine.`);
            playSound('cash');
        }
        broadcast();
    }

    function handleLanding(player: Player) {
        const tile = gameState.value.board[player.position];
        if (!tile) return;

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
            // Usually Jail Visit is ID 10. Go to Prison is ID 30 or similar.
            // Our board.json says ID 36 is "Go to prison". ID 12 is "In Prison".
            // WAIT. If it is "Go to prison", we send to jail.
            if (tile.name.toLowerCase().includes('go to')) {
                sendToJail(player);
                playSound('fail');
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
    }

    function payRent(player: Player, tile: Tile) {
        if (!tile.owner) return;
        const owner = gameState.value.players.find(p => p.id === tile.owner);
        if (!owner || owner.bankrupt) return;

        let rentAmount = 0;
        if (tile.type === 'PROPERTY') {
            const idx = tile.houseCount || 0;
            if (tile.rent) rentAmount = tile.rent[idx] ?? 10;
        } else {
            rentAmount = 25; // Base for others
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
        gameState.value = newState;
    }

    function log(msg: string) {
        gameState.value.lastActionLog.unshift(msg);
        if (gameState.value.lastActionLog.length > 50) gameState.value.lastActionLog.pop();
    }

    function broadcast() {
        broadcastState(gameState.value);
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

            log('Trade completed!');
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
        const current = gameState.value.players[gameState.value.turnIndex];
        const senderIsCurrent = current ? (current.id === action.from) : false;

        if (action.type === 'START_GAME') {
            startGame();
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
        requestAction,
        processAction
    };
});
