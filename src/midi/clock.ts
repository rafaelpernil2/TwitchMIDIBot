import NanoTimer from 'nanotimer';
import { EVENT_EMITTER, EVENT } from '../configuration/constants';
import { JZZTypes } from '../custom-typing/jzz';
import { NanoTimerProperties } from '../custom-typing/nanotimer';
import { SharedVariable } from '../shared-variable/implementation';
import { currentChordMode, isChordInProgress } from './handler';
import { calculateClockTickTimeNs } from './utils';

// Shared variables
export const isSyncing = new SharedVariable(false);
// Clock variables
let timer = new NanoTimer();
let tick = 0;

/**
 * MIDI Clock: Sends ticks synced with tempo at 24ppq following MIDI spec
 * Formula: ((1_000_000_000 ns/s) * 60 seconds/minute / beats/minute(BPM) / 24ppq (pulses per quarter))
 * @param targetMIDIChannel Target MIDI channel
 * @param output VirtualMIDI device
 * @param clockTickTimeNs Clock time in nanoseconds
 */
export function startClock(targetMIDIChannel: number, output: ReturnType<JZZTypes['openMidiOut']>, tempo: number): void {
    const tickTime = `${calculateClockTickTimeNs(tempo)}n`;
    const sendTick = _sendTick(output);
    _resetClock(targetMIDIChannel, output);

    timer.setInterval(sendTick, '', tickTime);
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
export function initClockData() {
    timer.clearInterval();
    tick = 0;
}

/**
 * Stops the clock
 */
export function stopClock(): void {
    isSyncing.set(true);
    initClockData();
    timer = new NanoTimer();
}

/**
 * Resets the clock parameters and marks it as "syncing"
 * @param targetMIDIChannel Target MIDI channel for the virtual MIDI device
 * @param output VirtualMIDI device
 */
function _resetClock(targetMIDIChannel: number, output: ReturnType<JZZTypes['openMidiOut']>) {
    isSyncing.set(true);
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
    // We store in closure variables the event emitter and event for speed and consistency
    const emitter = EVENT_EMITTER;
    const event = EVENT.BAR_LOOP_CHANGE_EVENT;
    let isFirst = true;
    return () => {
        // Constant time operations to ensure time stability
        const isInProgress = isChordInProgress.get();
        const chordMode = currentChordMode.get();
        tick = (tick + 1) % 96; // 24ppq * 4 quarter notes
        // This way, the next condition always take the exact amout of time

        output.clock();
        // If is bar start and it's not executing blocking section
        if (tick === 1 && !isInProgress) {
            // Notify and send the current active mode
            emitter.emit(event, chordMode);
        }

        if (isFirst) {
            output.start();
            isFirst = false;
        }
    };
}
