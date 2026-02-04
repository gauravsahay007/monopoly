// Simple Web Audio API Synthesizer & MP3 Player for Game Sounds

import bankruptUrl from '../data/bankrupt.mp3';
import convertToHotelUrl from '../data/convertToHotel.mp3';
import payFineUrl from '../data/payFine.mp3';
import payTaxUrl from '../data/payTax.mp3';
import buyPropertyUrl from '../data/buyProperty.mp3';
import dealUrl from '../data/deal.mp3';
import buildHouseUrl from '../data/buildhouse.mp3';
import vacationUrl from '../data/vacation.mp3';
import negativeMoneyUrl from '../data/negativeMoney.mp3';

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const mp3Sounds: Record<string, string> = {
    bankrupt: bankruptUrl,
    hotel: convertToHotelUrl,
    fine: payFineUrl,
    tax: payTaxUrl,
    buy: buyPropertyUrl,
    deal: dealUrl,
    house: buildHouseUrl,
    vacation: vacationUrl,
    negativeMoney: negativeMoneyUrl
};

// Improved audio queue system - ensures sounds play one by one
interface QueuedSound {
    type: string;
    isMuted: boolean;
}

let soundQueue: QueuedSound[] = [];
let isProcessing = false;

async function processQueue() {
    // If already processing or queue is empty, exit
    if (isProcessing || soundQueue.length === 0) return;

    isProcessing = true;

    while (soundQueue.length > 0) {
        const sound = soundQueue.shift()!;

        try {
            await playSoundActual(sound.type, sound.isMuted);
        } catch (e) {
            console.error('Error playing sound:', e);
        }

        // Small gap between sounds for clarity
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    isProcessing = false;
}

async function playSoundActual(type: string, isMuted: boolean): Promise<void> {
    if (isMuted) return;

    // Resume audio context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    // Try MP3 First (if defined)
    if (mp3Sounds[type]) {
        try {
            await new Promise<void>((resolve, reject) => {
                const audio = new Audio(mp3Sounds[type]);
                audio.volume = 1.0;

                const timeout = setTimeout(() => {
                    console.warn(`   ⏰ Audio timeout for ${type}`);
                    reject('timeout');
                }, 4000);

                audio.addEventListener('ended', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                audio.addEventListener('error', (e) => {
                    clearTimeout(timeout);
                    console.error(`   ❌ Audio error for ${type}:`, e);
                    reject(e);
                });

                audio.addEventListener('canplaythrough', () => {
                    audio.play().catch(e => {
                        clearTimeout(timeout);
                        reject(e);
                    });
                }, { once: true });

                audio.load();
            });
            return; // Success, exit
        } catch (e) {
            console.warn(`   ⚠️ MP3 failed for ${type}, using fallback tone.`);
            // Fall through to synthesized sound
        }
    }

    // Fallback: Synthesized Tones
    await playSynthesizedSound(type);
}

function playSynthesizedSound(type: string): Promise<void> {
    return new Promise<void>((resolve) => {
        let maxDuration = 0;

        switch (type) {
            case 'roll':
                playTone(400, 'sine', 0.1);
                setTimeout(() => playTone(600, 'sine', 0.1), 100);
                maxDuration = 200;
                break;
            case 'cash':
            case 'win':
                playTone(800, 'square', 0.1, 0.05);
                setTimeout(() => playTone(1200, 'square', 0.3, 0.05), 100);
                maxDuration = 400;
                break;
            case 'fail':
            case 'bankrupt':
            case 'negativeMoney':
                playTone(150, 'sawtooth', 0.4, 0.1);
                setTimeout(() => playTone(120, 'sawtooth', 0.4, 0.1), 300);
                maxDuration = 700;
                break;
            case 'turn':
                playTone(440, 'sine', 0.3, 0.05);
                maxDuration = 300;
                break;
            case 'house':
            case 'hotel':
                playTone(200, 'square', 0.1, 0.08);
                setTimeout(() => playTone(300, 'square', 0.15, 0.08), 240);
                maxDuration = 600;
                break;
            case 'vacation':
                playTone(523.25, 'sine', 0.3, 0.05);
                setTimeout(() => playTone(659.25, 'sine', 0.4, 0.05), 150);
                maxDuration = 700;
                break;
            case 'fine':
            case 'tax':
            case 'buy':
            case 'deal':
                // Spending money / Action sound
                playTone(300, 'triangle', 0.2);
                setTimeout(() => playTone(200, 'triangle', 0.2), 150);
                maxDuration = 400;
                break;
            default:
                // Generic blip for unknown
                playTone(440, 'sine', 0.1);
                maxDuration = 200;
        }

        setTimeout(() => resolve(), maxDuration);
    });
}

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

export const playSound = (
    type: 'roll' | 'buy' | 'cash' | 'fail' | 'win' | 'turn' | 'bankrupt' | 'hotel' | 'fine' | 'tax' | 'deal' | 'house' | 'vacation' | 'negativeMoney',
    isMuted: boolean = false
) => {


    // Add to queue
    soundQueue.push({ type, isMuted });

    // Start processing if not already - use setTimeout to ensure async context
    if (!isProcessing) {
        setTimeout(() => processQueue(), 0);
    }
};

