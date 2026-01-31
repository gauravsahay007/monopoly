import Peer, { type DataConnection } from 'peerjs';
import { useGameStore } from '../store/gameStore';

let peer: Peer | null = null;
let connections = new Map<string, DataConnection>(); // Host: Map of peerId -> connection
let hostConnection: DataConnection | null = null; // Client connection to host

export function initPeer(id?: string, onOpen?: (id: string) => void, onError?: (err: any) => void) {
    if (peer) {
        peer.destroy();
        connections.forEach(c => c.close());
        connections.clear();
    }
    console.log("Initializing Peer with ID:", id || "Auto-generated");
    peer = id ? new Peer(id) : new Peer();

    peer.on('open', (id) => {
        console.log('My Peer ID is: ' + id);
        if (onOpen) onOpen(id);
    });

    peer.on('connection', (conn) => {
        handleIncomingConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (onError) onError(err);
    });
}

function handleIncomingConnection(conn: DataConnection) {
    const store = useGameStore();

    conn.on('open', () => {
        console.log('Connected to: ', conn.peer);
        // Replace existing connection if same peer reconnects
        if (connections.has(conn.peer)) {
            connections.get(conn.peer)?.close();
        }
        connections.set(conn.peer, conn);

        if (store.isHost) {
            // Send current state immediately as a plain object
            conn.send({
                type: 'STATE_UPDATE',
                payload: JSON.parse(JSON.stringify(store.gameState))
            });
        }
    });

    conn.on('data', (data: any) => {
        if (store.isHost) {
            if (data.type === 'ACTION') {
                console.log('🎮 Host received action:', data.payload.type, 'from:', data.payload.from);
                store.processAction(data.payload);
            }
        } else {
            if (data.type === 'STATE_UPDATE') {
                store.updateState(data.payload);
            }
        }
    });

    conn.on('close', () => {
        connections.delete(conn.peer);
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
    // Stringify once to strip Vue proxies and send a clean object
    const payload = JSON.parse(JSON.stringify(state));
    connections.forEach((conn) => {
        if (conn.open) {
            conn.send({ type: 'STATE_UPDATE', payload });
        }
    });
}

export function sendAction(action: any) {
    if (hostConnection && hostConnection.open) {
        hostConnection.send({
            type: 'ACTION',
            payload: JSON.parse(JSON.stringify(action))
        });
    } else {
        console.warn("Not connected to host");
    }
}
