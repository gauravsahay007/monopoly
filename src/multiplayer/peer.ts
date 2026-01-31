import Peer, { type DataConnection } from 'peerjs';
import { useGameStore } from '../store/gameStore';

let peer: Peer | null = null;
let connections: DataConnection[] = []; // Host keeps track of clients
let hostConnection: DataConnection | null = null; // Client connection to host

export function initPeer(id: string | undefined, onOpen: (id: string) => void, onError?: (err: any) => void) {
    if (peer) {
        peer.destroy();
        // Close invalid connections if re-initializing
        connections.forEach(c => c.close());
        connections = [];
    }

    console.log("Initializing Peer with ID:", id || "Auto-generated");

    // Robust Config for Netlify/Production
    const config = {
        secure: true,
        config: {
            iceServers: [
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
            ]
        }
    };

    // Use ID if provided, otherwise auto-generate
    peer = id ? new Peer(id, config) : new Peer(config);

    peer.on('open', (peerId) => {
        console.log('My Peer ID is: ' + peerId);
        onOpen(peerId);
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
        connections.push(conn);

        // If I am host, send current state immediately
        if (store.isHost) {
            // Strip proxies to avoid serialization issues
            const payload = JSON.parse(JSON.stringify(store.gameState));
            conn.send({ type: 'STATE_UPDATE', payload });
        }
    });

    conn.on('data', (data: any) => {
        if (store.isHost) {
            if (data.type === 'ACTION') {
                store.processAction(data.payload);
            }
        } else {
            if (data.type === 'STATE_UPDATE') {
                store.updateState(data.payload);
            }
        }
    });

    conn.on('close', () => {
        connections = connections.filter(c => c !== conn);
    });
}

export function connectToHost(hostId: string, onConnected?: () => void, onError?: (msg: string) => void) {
    if (!peer) {
        if (onError) onError("Peer not initialized");
        return;
    }

    console.log(`Attempting to connect to Host: ${hostId}`);
    const conn = peer.connect(hostId, { reliable: true });
    hostConnection = conn;

    // Timeout handling
    const timeout = setTimeout(() => {
        if (!conn.open) {
            console.warn("Connection attempt timed out");
            conn.close();
            if (onError) onError("Connection timed out. Host may be offline.");
        }
    }, 5000);

    conn.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ Connected to Host!');
        if (onConnected) onConnected();
    });

    // Critical: Listen for data from host
    conn.on('data', (data: any) => {
        const store = useGameStore();
        if (data.type === 'STATE_UPDATE') {
            store.updateState(data.payload);
        }
    });

    conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error("Connection Error:", err);
        if (onError) onError("Connection Error: " + err);
    });

    conn.on('close', () => {
        console.log("Connection closed.");
    });
}

export function broadcastState(state: any) {
    // Only Host calls this
    const payload = JSON.parse(JSON.stringify(state)); // Strip proxies
    connections.forEach(conn => {
        if (conn.open) {
            conn.send({ type: 'STATE_UPDATE', payload });
        }
    });
}

export function sendAction(action: any) {
    // Only Client calls this
    if (hostConnection && hostConnection.open) {
        const payload = JSON.parse(JSON.stringify(action)); // Strip proxies
        hostConnection.send({ type: 'ACTION', payload });
    } else {
        console.warn("Not connected to host");
    }
}
