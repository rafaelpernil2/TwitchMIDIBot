import { ERROR_MSG } from '../constants.js';

/**
 * Validates TARGET_MIDI_CHANNEL to make sure the MIDI channel is valid
 * @param value
 * @returns If it's valid
 */
export function TARGET_MIDI_CHANNEL(value: string): boolean {
    _validateMIDIChannel(value, 'TARGET_MIDI_CHANNEL');
    return true;
}

/**
 * Validates TIME_SIGNATURE_NUMERATOR_CC to make sure the MIDI CC is valid
 * @param value
 * @returns If it's valid
 */
export function TIME_SIGNATURE_NUMERATOR_CC(value: string): boolean {
    _validateMIDIValue(value, 'TIME_SIGNATURE_NUMERATOR_CC');
    return true;
}

/**
 * Validates TIME_SIGNATURE_DENOMINATOR_CC to make sure the MIDI CC is valid
 * @param value
 * @returns If it's valid
 */
export function TIME_SIGNATURE_DENOMINATOR_CC(value: string): boolean {
    _validateMIDIValue(value, 'TIME_SIGNATURE_DENOMINATOR_CC');
    return true;
}

/**
 * Validates REWARDS_MODE to make sure the boolean is valid
 * @param value
 * @returns If it's valid
 */
export function REWARDS_MODE(value: string): boolean {
    _validateBoolean(value, 'REWARDS_MODE');
    return true;
}

/**
 * Validates VIP_REWARDS_MODE to make sure the boolean is valid
 * @param value
 * @returns If it's valid
 */
export function VIP_REWARDS_MODE(value: string): boolean {
    _validateBoolean(value, 'VIP_REWARDS_MODE');
    return true;
}

/**
 * Validates SEND_UNAUTHORIZED_MESSAGE to make sure the boolean is valid
 * @param value
 * @returns If it's valid
 */
export function SEND_UNAUTHORIZED_MESSAGE(value: string): boolean {
    _validateBoolean(value, 'SEND_UNAUTHORIZED_MESSAGE');
    return true;
}

/**
 * Validates SILENCE_MACRO_MESSAGES to make sure the boolean is valid
 * @param value
 * @returns If it's valid
 */
export function SILENCE_MACRO_MESSAGES(value: string): boolean {
    _validateBoolean(value, 'SILENCE_MACRO_MESSAGES');
    return true;
}

/**
 * Validates ALLOW_CUSTOM_TIME_SIGNATURE to make sure the boolean is valid
 * @param value
 * @returns If it's valid
 */
export function ALLOW_CUSTOM_TIME_SIGNATURE(value: string): boolean {
    _validateBoolean(value, 'ALLOW_CUSTOM_TIME_SIGNATURE');
    return true;
}

/**
 * Validates REPETITIONS_PER_LOOP to make sure the value is valid
 * @param value
 * @returns If it's valid
 */
export function REPETITIONS_PER_LOOP(value: string): boolean {
    _validateLoopRepetitions(value, 'REPETITIONS_PER_LOOP');
    return true;
}

/**
 * Validates a boolean value that must be true or false
 * Throws an error if the value is invalid
 * @param message Possible MIDI channel
 * @returns
 */
function _validateBoolean(message: string | number, variable: string): void {
    if (message !== 'true' && message !== 'false') {
        throw new Error(ERROR_MSG.BAD_BOOLEAN(variable, String(message)));
    }
}

/**
 * Validates a MIDI channel value that must be between 1 and 16 (inclusive)
 * Throws an error if the value is invalid
 * @param message Possible MIDI channel
 * @returns
 */
function _validateMIDIChannel(message: string | number, variable: string): void {
    const parsedMessage = Number(message);
    if (isNaN(parsedMessage) || parsedMessage < 1 || parsedMessage > 16) {
        throw new Error(ERROR_MSG.BAD_MIDI_CHANNEL(variable, String(message)));
    }
}

/**
 * Validates a MIDI value that must be between 0 and 127 (inclusive)
 * Throws an error if the value is invalid
 * @param message Possible MIDI channel
 * @returns
 */
function _validateMIDIValue(message: string | number, variable: string): void {
    const parsedMessage = Number(message);
    if (isNaN(parsedMessage) || parsedMessage < 0 || parsedMessage > 127) {
        throw new Error(ERROR_MSG.BAD_MIDI_VALUE(variable, String(message)));
    }
}

/**
 * Validates a number that must be at least 1 and less than 32
 * Throws an error if the value is invalid
 * @param message Possible loop iterations
 * @returns
 */
function _validateLoopRepetitions(message: string | number, variable: string): void {
    const parsedMessage = Number(message);
    if (isNaN(parsedMessage) || parsedMessage < 1 || parsedMessage > 32) {
        throw new Error(ERROR_MSG.BAD_LOOP_REPETITIONS(variable, String(message)));
    }
}
