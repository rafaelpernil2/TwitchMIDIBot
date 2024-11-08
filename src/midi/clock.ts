import NanoTimer from 'nanotimer';
import { JZZTypes } from '../custom-typing/jzz.js';
import { NanoTimerProperties } from '../custom-typing/nanotimer.js';
import { SharedVariable } from '../shared-variable/implementation.js';
import { isChordInProgress } from './handler.js';
import { Sync } from './types.js';
import { onBarLoopChange } from '../command/queue.js';

// Shared variables
export const syncMode = new SharedVariable<Sync>(Sync.OFF);
export const clockPulses = new SharedVariable<number>(96); // 24ppq * 4 quarter notes
// Clock variables
let timer = new NanoTimer();
let tick = 0;

/**
 * MIDI Clock: Sends ticks synced with tempo at 24ppq following MIDI spec
 * Formula: ((1_000_000_000 ns/s) * 60 seconds/minute / beats/minute(BPM) / 24ppq (pulses per quarter))
 * @param targetMIDIChannel Target MIDI channel
 * @param output VirtualMIDI device
 * @param tempo Tempo in BPM
 * @param options { sync = false }: { sync: boolean }
 */
export function startClock(targetMIDIChannel: number, output: ReturnType<JZZTypes['openMidiOut']>, tempo: number, { sync } = { sync: true }): void {
    const tickTime = `${_calculateClockTickTimeNs(tempo)}n`;
    const sendTick = _sendTick(output);
    _resetClock(targetMIDIChannel, output, { sync });

    timer.setInterval(sendTick, '', tickTime);
}

/**
 * Stops the clock
 */
export function stopClock(): void {
    syncMode.set(Sync.FORWARD);
    initClockData();
    timer = new NanoTimer();
}

/**
 * Checks if the clock is active
 * @returns boolean
 */
export function isClockActive(): boolean {
    return (timer as NanoTimerProperties).intervalTime != null;
}

/**
 * Initializes clock data
 */
export function initClockData(): void {
    timer.clearInterval();
    tick = 0;
}

/**
 * Resets the clock parameters and marks it as "syncing"
 * @param targetMIDIChannel Target MIDI channel for the virtual MIDI device
 * @param output VirtualMIDI device
 * @param options { sync = false }: { sync: boolean }
 */
function _resetClock(targetMIDIChannel: number, output: ReturnType<JZZTypes['openMidiOut']>, { sync } = { sync: true }): void {
    if (sync) {
        syncMode.set(Sync.REPEAT);
    }
    initClockData();
    output.stop();
    output.allNotesOff(targetMIDIChannel);
}

/**
 * MIDI clock tick
 * @param output VirtualMIDI device
 * @returns
 */
function _sendTick(output: ReturnType<JZZTypes['openMidiOut']>): () => void {
    let isFirst = true;
    return () => {
        // Constant time operations to ensure time stability
        const isInProgress = isChordInProgress.get();
        const pulses = clockPulses.get(); // 24ppq * 4 quarter notes by default
        tick = (tick + 1) % pulses;
        // This way, the next condition always take the exact amout of time

        output.clock();
        // If is bar start and it's not executing blocking section
        if (tick === 1 && !isInProgress) {
            // Notify and send the current active mode
            onBarLoopChange?.();
        }

        if (isFirst) {
            output.start();
            isFirst = false;
        }
    };
}

/**
 * Calculates the tick interval for implementing a MIDI Clock at 24ppq (pulses per quarter) at a determined tempo
 * @param tempo Tempo to check against
 * @returns Tick interval in nanoseconds
 */
function _calculateClockTickTimeNs(tempo: number): number {
    // ns per second * (60/tempo) = time for each hit / 24ppq => MIDI Clock
    return Math.round(60_000_000_000 / (tempo * 24));
}
