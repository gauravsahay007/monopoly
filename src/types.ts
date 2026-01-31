export type TileType = 'START' | 'PROPERTY' | 'AIRPORT' | 'UTILITY' | 'TAX' | 'TREASURE' | 'SURPRISE' | 'PRISON' | 'VACATION' | 'JAIL_VISIT';

export interface Tile {
    id: number;
    type: TileType;
    name: string;
    price: number;
    rent: number[];
    group: string;
    buildCost?: number;
    owner?: string | null; // Player ID
    houseCount?: number; // 0-5 (5=hotel)
    mortgaged?: boolean;
    amount?: number; // For Tax
    country?: string;
}

export interface Player {
    id: string; // Peer ID
    name: string;
    cash: number;
    position: number;
    color: string;
    inJail: boolean;
    jailTurns: number;
    isHost: boolean;
    avatar: string; // emoji or url
    bankrupt?: boolean;
    lastCreditor?: string | null; // Player ID who they owe
    uid?: string; // Google User ID for persistence
}

export interface GameState {
    status: 'LOBBY' | 'SETUP' | 'PLAYING' | 'GAME_OVER';
    turnIndex: number;
    players: Player[];
    board: Tile[];
    dice: [number, number];
    lastActionLog: string[];
    settings: GameSettings;
    currentRoomId: string | null;
    myId: string | null;
    winner?: Player | null;
    consecutiveDoubles: number;
    vacationPot: number;
    currentTrade?: TradeOffer | null;
    lastActivity?: number; // Timestamp for inactivity timeout
}

export interface TradeOffer {
    id: string; // Unique ID for the trade
    initiator: string; // Player ID
    target: string; // Player ID
    offerCash: number;
    offerProperties: number[]; // Tile IDs
    requestCash: number;
    requestProperties: number[]; // Tile IDs
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface GameSettings {
    startingCash: number;
    passGoAmount: number;
    doubleRentOnSet?: boolean;
    vacationCash?: boolean;
    auction?: boolean;
    prisonNoRent?: boolean;
    mortgage?: boolean;
    evenBuild?: boolean;
    randomizeOrder?: boolean;
    mapSelection?: string; // 'world', 'india', 'bangalore'
}

export interface GameAction {
    type: string;
    payload: any;
    from: string;
}
