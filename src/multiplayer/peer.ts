import { db } from '../firebase';
import { doc, onSnapshot, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { useGameStore } from '../store/gameStore';

// Subscription Cleanups
let unsubscribeState: (() => void) | null = null;
let unsubscribeActions: (() => void) | null = null; // For Host

export function initPeer(id: string | undefined, onOpen: (id: string) => void, onError?: (err: any) => void) {
    console.log("Initializing Firebase Sync...");
    // Fix unused variable warning
    if (onError) { }

    // Just pass back the ID. Firebase handles the connection.
    if (id) {
        onOpen(id);
    } else {
        // Fallback for anonymous? Prefer Auth.
        onOpen("anon_" + Math.random().toString(36).substr(2, 9));
    }
}

// Called by CLIENT to join a game
export function connectToHost(roomId: string, onConnected?: () => void, onError?: (msg: string) => void) {
    // detach old listeners
    if (unsubscribeState) unsubscribeState();

    console.log(`Connecting to Game: ${roomId}`);

    const gameRef = doc(db, "games", roomId);

    unsubscribeState = onSnapshot(gameRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const store = useGameStore();
            // Using a timestamp check or versioning could help, but for now strict replace is fine
            if (data.state) {
                store.updateState(data.state);
            }
            // Fire connected callback on first successful read
            if (onConnected) {
                onConnected();
            }
        } else {
            console.warn("Game document does not exist!");
            if (onError) onError("Game room not found");
        }
    }, (err) => {
        console.error("Firebase Read Error:", err);
        if (onError) onError(err.message);
    });
}

// Called by HOST to start listening for actions
export function initializeHost(roomId: string) {
    if (unsubscribeActions) unsubscribeActions();

    console.log(`Host listening for actions in: ${roomId}`);
    const actionsRef = collection(db, "games", roomId, "actions");

    // Listen for new actions
    unsubscribeActions = onSnapshot(actionsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const actionData = change.doc.data();
                const store = useGameStore(); // Always get fresh store

                console.log("🎮 Action Received:", actionData.type);
                store.processAction(actionData as any);

                // Delete action after processing to prevent duplicate handling on restart
                try {
                    await deleteDoc(change.doc.ref);
                } catch (e) { console.warn("Failed to cleanup action", e); }
            }
        });
    });
}

export function broadcastState(state: any) {
    const store = useGameStore();
    const roomId = store.roomId;
    if (!store.isHost || !roomId) return; // Only Host writes state

    // Write state to Firestore
    const gameRef = doc(db, "games", roomId);

    // Strip proxies
    const payload = JSON.parse(JSON.stringify(state));

    setDoc(gameRef, {
        state: payload,
        updatedAt: Date.now()
    }, { merge: true }).catch(err => {
        console.error("State Sync Error:", err);
    });
}

export function sendAction(action: any) {
    const store = useGameStore();
    const roomId = store.roomId;
    if (!roomId) return;

    const actionsRef = collection(db, "games", roomId, "actions");
    const payload = JSON.parse(JSON.stringify(action));

    addDoc(actionsRef, {
        ...payload,
        timestamp: Date.now()
    }).catch(err => {
        console.error("Send Action Error:", err);
    });
}
