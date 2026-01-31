# Monopoly Game - Debugging Connection Issues

## Issue: "Waiting for host to start..." for Some Users

### Summary
**There are NO restrictions in the code limiting access to only 2 Google IDs.** The game supports unlimited players. The issue is likely related to peer-to-peer connection problems.

---

## How the System Works

### 1. **Room Creation (Host)**
- When someone clicks "Create Private Game", they become the **HOST**
- The host's Google UID (or peer ID) becomes the **Room Code**
- The host can see all connected players in the lobby
- **Only the host can click "START GAME"**

### 2. **Joining a Room (Guest)**
- Guests enter the room code and click "Join"
- They connect to the host via PeerJS (peer-to-peer connection)
- They send a JOIN action to the host
- They see "Waiting for host to start..." until the host clicks START GAME

### 3. **The Connection Flow**
```
Guest → Connects to Host via PeerJS
Guest → Sends JOIN action with player info
Host → Receives JOIN action
Host → Adds player to game state
Host → Broadcasts updated state to all connected guests
Guest → Receives state update and sees themselves in player list
```

---

## Common Issues & Solutions

### Issue 1: Peer Connection Failure
**Symptoms:** Guest sees "Waiting for host to start..." but host doesn't see them in the player list

**Causes:**
- Firewall blocking WebRTC connections
- Network restrictions (corporate networks, VPNs)
- PeerJS server issues
- Browser compatibility issues

**Solutions:**
1. Both host and guest should check browser console for errors
2. Try disabling VPN/proxy
3. Use a different network (mobile hotspot)
4. Try a different browser (Chrome/Firefox recommended)

### Issue 2: Host Not Starting the Game
**Symptoms:** Everyone is connected but game doesn't start

**Solution:**
- The **HOST must click the "START GAME" button** in the lobby
- Only the host can start the game
- Make sure the host sees all players before starting

### Issue 3: Room Code Mismatch
**Symptoms:** Guest can't connect at all

**Solution:**
- Verify the room code is correct (case-sensitive)
- Use the "Copy Link" button instead of manually typing the code
- Make sure the host created the room before guests try to join

---

## Debugging Steps

### For the Host:
1. **Open browser console** (F12 or Cmd+Option+I)
2. **Create a room** and note your Room Code
3. **Watch for these logs:**
   - `My Peer ID is: [your-uid]`
   - `Connected to: [guest-peer-id]` (when a guest joins)
   - `🎮 Host received action: JOIN from: [guest-id]`
   - `👥 Processing JOIN action for: [guest-name]`
   - `✨ Player added successfully: [guest-name]`
4. **Check the player list** - you should see all connected players
5. **Click "START GAME"** when everyone is ready

### For Guests:
1. **Open browser console** (F12 or Cmd+Option+I)
2. **Enter room code and join**
3. **Watch for these logs:**
   - `My Peer ID is: [your-peer-id]`
   - `Connected to Host`
   - `📥 Client received state update. Players: [number]`
4. **You should see yourself in the player list**
5. **Wait for host to start** - you'll see "Waiting for host to start..."

---

## Enhanced Logging

I've added detailed logging to help debug connection issues:

### In `peer.ts`:
- `🎮 Host received action: [type] from: [player-id]` - Host received an action
- `📥 Client received state update. Players: [count]` - Guest received state update

### In `gameStore.ts`:
- `🔧 addPlayer called. isHost: [true/false] Player: [name]` - Player addition started
- `👥 Processing JOIN action for: [name] ID: [id]` - JOIN action being processed
- `✨ Player added successfully: [name] Total players: [count]` - Player added
- `⚠️ Player already exists: [id]` - Duplicate player attempt
- `✅ Current players in game: [names]` - List of all players

---

## Testing Checklist

### Test 1: Single Browser (Different Tabs)
1. Open Tab 1 → Sign in → Create game → Note room code
2. Open Tab 2 → Sign in with different Google account → Join with room code
3. Tab 1 should show both players
4. Tab 1 clicks "START GAME"
5. Both tabs should enter the game

### Test 2: Different Browsers
1. Chrome → Sign in → Create game
2. Firefox → Sign in → Join game
3. Verify connection in both consoles
4. Start game from Chrome

### Test 3: Different Devices
1. Computer → Create game
2. Phone → Join game
3. Verify connection
4. Start from computer

---

## Network Requirements

### Required Ports:
- **WebRTC**: UDP ports 3478, 19302-19309
- **HTTPS**: TCP port 443 (for PeerJS signaling)

### Firewall Rules:
- Allow outbound connections to `peerjs.com`
- Allow WebRTC/STUN/TURN traffic
- Allow peer-to-peer UDP connections

---

## Still Having Issues?

### Check These:
1. **Browser Console Errors** - Look for red errors in console
2. **Network Tab** - Check if WebSocket connections are failing
3. **PeerJS Status** - Visit https://peerjs.com to check if service is up
4. **Firebase Status** - Check Firebase console for any quota/permission issues

### Collect This Information:
- Browser and version (both host and guest)
- Network type (WiFi, mobile, corporate)
- Console logs from both host and guest
- Exact error messages
- Room code being used

---

## Quick Fix: Use the Link Instead of Code

Instead of manually entering the room code:
1. Host clicks "🔗 Copy Link" button
2. Host shares the link via chat/email
3. Guest clicks the link
4. Guest is automatically taken to the join screen with code pre-filled

This eliminates typos and ensures correct room code!
