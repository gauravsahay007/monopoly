import Peer, { type DataConnection } from 'peerjs';
import { useGameStore } from '../store/gameStore';

let peer: Peer | null = null;
let connections = new Map<string, DataConnection>(); // Host keeps track of clients: PeerID -> Connection
let hostConnection: DataConnection | null = null; // Client connection to host

export function initPeer(id: string | undefined, onOpen: (id: string) => void, onError?: (err: any) => void) {
    if (peer) {
        peer.destroy();
        connections.forEach(c => c.close());
        connections.clear();
    }
    console.log("Initializing Peer with ID:", id || "Auto-generated");

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

    peer = id ? new Peer(id, config) : new Peer(config);

    peer.on('open', (id) => {
        console.log('My Peer ID is: ' + id);
        onOpen(id);
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

        // Remove existing connection from same peer if it exists
        if (connections.has(conn.peer)) {
            connections.get(conn.peer)?.close();
        }
        connections.set(conn.peer, conn);

        // If I am host, send current state immediately
        if (store.isHost) {
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

export function connectToHost(hostId: string, onConnected?: () => void, onError?: (msg: string) => void) {
    if (!peer) {
        if (onError) onError("Peer not initialized");
        return;
    }

    console.log(`Attempting to connect to Host: ${hostId}`);
    const conn = peer.connect(hostId, { reliable: true });
    hostConnection = conn;

    // Connection Timeout (PeerJS sometimes hangs silently if host is offline)
    const timeout = setTimeout(() => {
        if (!conn.open) {
            console.warn("Connection attempt timed out");
            conn.close();
            if (onError) onError("Connection timed out. Host may be offline or Room ID is invalid.");
        }
    }, 5000);

    conn.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ Connected to Host!');
        if (onConnected) onConnected();
    });

    conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error("Connection Error:", err);
        if (onError) onError("Connection Error: " + err);
    });

    conn.on('data', (data: any) => {
        const store = useGameStore();
        if (data.type === 'STATE_UPDATE') {
            store.updateState(data.payload);
        }
    });

    conn.on('close', () => {
        console.log("Connection closed.");
    });

    // Listen for global peer errors related to this connection (e.g. peer-unavailable)
    const errHandler = (err: any) => {
        if (err.type === 'peer-unavailable' && err.message.includes(hostId)) {
            clearTimeout(timeout);
            if (onError) onError(`Room "${hostId}" not found. Host is offline.`);
            peer?.off('error', errHandler); // Cleanup
        }
    };
    peer.on('error', errHandler);
}

export function broadcastState(state: any) {
    // Only Host calls this
    // CRITICAL: Strip proxies
    const payload = JSON.parse(JSON.stringify(state));

    connections.forEach((conn) => {
        if (conn.open) {
            conn.send({ type: 'STATE_UPDATE', payload });
        }
    });
}

export function sendAction(action: any) {
    // Only Client calls this
    if (hostConnection && hostConnection.open) {
        // Strip proxies
        hostConnection.send({ type: 'ACTION', payload: JSON.parse(JSON.stringify(action)) });
    } else {
        console.warn("Not connected to host");
    }
}
