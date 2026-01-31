// Simple Web Audio API Synthesizer for Game Sounds
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

function playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

export const playSound = (type: 'roll' | 'buy' | 'cash' | 'fail' | 'win' | 'turn') => {
    switch (type) {
        case 'roll':
            // High pitched short beeps
            playTone(400, 'sine', 0.1);
            setTimeout(() => playTone(600, 'sine', 0.1), 100);
            break;
        case 'buy':
            // Coin sound
            playTone(1200, 'sine', 0.1);
            setTimeout(() => playTone(1600, 'sine', 0.3), 50);
            break;
        case 'cash':
            // Cha-chingish
            playTone(800, 'square', 0.1, 0.05);
            setTimeout(() => playTone(1200, 'square', 0.3, 0.05), 100);
            break;
        case 'fail':
            // Low buzz
            playTone(150, 'sawtooth', 0.4, 0.1);
            setTimeout(() => playTone(120, 'sawtooth', 0.4, 0.1), 300);
            break;
        case 'win':
            // Fanfare
            playTone(523.25, 'triangle', 0.2); // C
            setTimeout(() => playTone(659.25, 'triangle', 0.2), 200); // E
            setTimeout(() => playTone(783.99, 'triangle', 0.4), 400); // G
            break;
        case 'turn':
            // Soft notification
            playTone(440, 'sine', 0.3, 0.05);
            break;
    }
};
