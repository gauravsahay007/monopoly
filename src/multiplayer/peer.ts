import Peer, { type DataConnection } from 'peerjs';
import { useGameStore } from '../store/gameStore';

let peer: Peer | null = null;
let connections: DataConnection[] = []; // Host keeps track of clients
let hostConnection: DataConnection | null = null; // Client connection to host

export function initPeer(onOpen: (id: string) => void) {
    peer = new Peer(); // Auto-generate ID

    peer.on('open', (id) => {
        console.log('My Peer ID is: ' + id);
        onOpen(id);
    });

    peer.on('connection', (conn) => {
        // I am being connected to (I am likely Host)
        handleIncomingConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
    });
}

function handleIncomingConnection(conn: DataConnection) {
    const store = useGameStore();

    conn.on('open', () => {
        console.log('Connected to: ', conn.peer);
        connections.push(conn);

        // If I am host, send current state immediately
        if (store.isHost) {
            conn.send({ type: 'STATE_UPDATE', payload: store.gameState });
        }
    });

    conn.on('data', (data: any) => {
        // Received data
        if (store.isHost) {
            // Expecting Action
            if (data.type === 'ACTION') {
                store.processAction(data.payload);
            }
        } else {
            // Expecting State Update
            if (data.type === 'STATE_UPDATE') {
                store.updateState(data.payload);
            }
        }
    });

    conn.on('close', () => {
        connections = connections.filter(c => c !== conn);
    });
}

export function connectToHost(hostId: string, onConnected?: () => void) {
    if (!peer) return;
    const conn = peer.connect(hostId);
    hostConnection = conn;

    conn.on('open', () => {
        console.log('Connected to Host');
        if (onConnected) onConnected();
    });

    conn.on('data', (data: any) => {
        const store = useGameStore();
        if (data.type === 'STATE_UPDATE') {
            store.updateState(data.payload);
        }
    });
}

export function broadcastState(state: any) {
    // Only Host calls this
    connections.forEach(conn => {
        if (conn.open) {
            conn.send({ type: 'STATE_UPDATE', payload: state });
        }
    });
}

export function sendAction(action: any) {
    // Only Client calls this
    if (hostConnection && hostConnection.open) {
        hostConnection.send({ type: 'ACTION', payload: action });
    } else {
        console.warn("Not connected to host");
    }
}
