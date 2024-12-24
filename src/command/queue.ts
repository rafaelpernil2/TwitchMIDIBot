import { CHORD_PROGRESSIONS_KEY } from '../database/jsondb/types.js';
import { ALIASES_DB, CONFIG, ERROR_MSG, EVENT, EVENT_EMITTER, GLOBAL } from '../configuration/constants.js';
import { syncMode } from '../midi/clock.js';
import { Sync } from '../midi/types.js';
import { areRequestsOpen } from './guards.js';
import { Command } from './types.js';
import { ResponseStatus } from '../types/generic.js';
import { GenericQueue } from '../queue/generic-queue/implementation.js';
import { triggerChordList } from '../midi/handler.js';

export const favoriteIdMap = Object.fromEntries(Object.values(Command).map((key) => [key, -1])) as Record<Command, number>;
export let onBarLoopChange: () => Promise<void>;

let requestPlayingNow: { type: Command.sendloop; request: string } | null;

export const queueMap = {
    sendloop: new GenericQueue<Array<[timeSignature: [noteCount: number, noteValue: number], chordProgression: Array<[noteList: string[], timeSubDivision: number]>]>>()
} as const;

/**
 * Create a clock synched queue
 * @param targetMIDIChannel Target MIDI Channel
 * @param timeSignatureCC Time Signature MIDI CC
 * @param options { allowCustomTimeSignature, repetitionsPerLoop }
 * @returns
 */
export function createAutomaticClockSyncedQueue(
    targetMIDIChannel: number,
    timeSignatureCC: [numeratorCC: number, denominatorCC: number],
    { allowCustomTimeSignature, repetitionsPerLoop }: { allowCustomTimeSignature: boolean, repetitionsPerLoop: number }
): void {
    // Only set the function once
    if (onBarLoopChange != null) {
        return;
    }

    const onCommandTurn = (type: Command.sendloop) => async () => {
        const [turn] = queueMap[type].getCurrentTurn();

        const [chordProgression] = queueMap[type].getCurrent();

        // If request was removed from queue
        if (chordProgression == null) {
            // Forward loop to avoid getting stuck
            forwardQueue(type, repetitionsPerLoop)
            return false;
        }

        // If it is in queue and is your turn - Happy path
        const [currentTag] = queueMap[type].getTag(turn);
        _setRequestPlayingNow(type, currentTag ?? GLOBAL.EMPTY_MESSAGE);

        // Set next iteration
        nextIteration(type, turn);

        // Play loop
        await triggerChordList(chordProgression, targetMIDIChannel, { allowCustomTimeSignature }, timeSignatureCC, type, repetitionsPerLoop);
        return true;
    };

    onBarLoopChange = async () => {
        await onCommandTurn(Command.sendloop)();
    };
}

/**
 * Adds request to queue
 * @param tag Name to queue
 * @param value Value to queue
 * @param requesterUser Requester user
 * @param userRoles { isBroadcaster }
 * @param type Command.sendloop
 * @returns
 */
export function enqueue(
    tag: string,
    value: Array<[timeSignature: [noteCount: number, noteValue: number], chordProgression: Array<[noteList: string[], timeSubDivision: number]>]>,
    requesterUser: string,
    type: Command.sendloop
): number {
    const [turn] = queueMap[type].enqueue(tag, value, requesterUser);
    return turn;
}

/**
 * Moves to the next in queue
 * @param type Command.sendloop
 * @param repetitionsPerLoop Maximum allowed iterations
 */
export function forwardQueue(type: Command.sendloop, repetitionsPerLoop: number): void {
    const [currentTurn] = queueMap[type].getCurrentTurn();
    const [nextTurn] = queueMap[type].getNextTurn();

    // Do not forward queue if it's looping alone, requests are closed, queue is empty, or synchronization with repetition is active
    if (_mustRepeatRequest(type, currentTurn, nextTurn, repetitionsPerLoop)) {
        return;
    }

    queueMap[type].forward();
    removeFromQueue(type, currentTurn);

    // If there's no chord progression or loop next, let's clear requestPlayingNow
    if (_isCurrentLast(Command.sendloop)) {
        requestPlayingNow = null;
    }
}

/**
 * Returns the current request being played
 * @returns Request information
 */
export function getCurrentRequestPlaying(): { type: Command.sendloop; request: string } | null {
    return requestPlayingNow;
}

/**
 * Returns the current queue for chord progressions and loops
 * @returns Current queue
 */
export function getRequestQueue(): [type: Command.sendloop, request: string][] {
    return _processQueue(Command.sendloop);
}

/**
 * Removes petitions from a queue by type
 * @param type Command.sendloop
 */
export function clearQueue(type: Command.sendloop): void {
    queueMap[type].clear();
}

/**
 * Clears all queues
 */
export function clearAllQueues(): void {
    clearQueue(Command.sendloop);
    requestPlayingNow = null;
}

/**
 * Removes item from queue
 * @param type Command.sendloop
 * @param turn Turn in queue
 * @returns
 */
export function removeFromQueue(type: Command.sendloop, turn: number): void {
    // Remove from favorites if it matches
    if (favoriteIdMap[type] === turn) {
        unmarkFavorite(type);
    }
    queueMap[type].dequeue(turn);
}

/**
 * Removes last request by username
 * @param type Command.sendloop
 * @param username Requester username
 * @returns
 */
export function dequeueLastUserRequest(type: Command.sendloop, username: string): void {
    const [, status] = queueMap[type].dequeueLastUserRequest(username);
    if (status === ResponseStatus.Error) {
        throw new Error(ERROR_MSG.INVALID_WRONGREQUEST());
    }
}

/**
 * Marks item as favorite
 * @param type Command.sendloop
 * @param turn Turn in queue
 */
export function markAsFavorite(type: Command.sendloop, turn: number): void {
    favoriteIdMap[type] = turn;
}

/**
 * Marks item as favorite
 * @param type Command.sendloop
 */
export function unmarkFavorite(type: Command.sendloop): void {
    favoriteIdMap[type] = -1;
}

/**
 * Sets next iteration in request
 * @param type Command.sendloop
 * @param turn Turn in queue
 */
export function nextIteration(type: Command.sendloop, turn: number): void {
    queueMap[type].nextIteration(turn);
}

/**
 * Save a request into the list of aliases
 * @param type Command.sendloop
 * @param turn Turn in queue
 * @param alias Alias name
 */
export async function saveRequest(type: Command.sendloop, turn: number, alias: string): Promise<void> {
    const [requestData] = queueMap[type].getTag(turn);

    // If request does not exist
    if (requestData == null) {
        throw new Error(ERROR_MSG.CHORD_PROGRESSION_NOT_FOUND());
    }

    // If the request to save was already an saved alias, throw error
    const aliasAlreadyExists = ALIASES_DB.select(CHORD_PROGRESSIONS_KEY, requestData.toLowerCase()) != null;
    if (aliasAlreadyExists) {
        throw new Error(ERROR_MSG.CHORD_PROGRESSION_BAD_INSERTION());
    }

    const insertStatus = ALIASES_DB.insert(CHORD_PROGRESSIONS_KEY, alias.toLowerCase(), requestData);
    if (insertStatus === ResponseStatus.Error) {
        throw new Error(ERROR_MSG.CHORD_PROGRESSION_BAD_INSERTION());
    }
    await ALIASES_DB.commit();
}
/**
 * Checks if a request is still in queue
 * @param type Command.sendloop
 * @param turn Turn in queue
 * @returns If the queued request is not null
 */
function _isInQueue(type: Command.sendloop, turn: number): boolean {
    const [isInQueue] = queueMap[type].has(turn);
    return isInQueue;
}

/**
 * Checks if queue is empty
 * @param type Command.sendloop
 * @returns
 */
function _isCurrentLast(type: Command.sendloop): boolean {
    const [isEmpty] = queueMap[type].isCurrentLast();
    return isEmpty;
}

/**
 * Checks if the given request turn is the favorite one
 * @param type Command.sendloop
 * @param turn Turn in queue
 * @returns
 */
function _isFavoriteRequest(type: Command.sendloop, turn: number): boolean {
    return favoriteIdMap[type] === turn;
}

/**
 * Checks if the loop is within expected repetitions (4 times by default)
 * @param type Command.sendloop
 * @param turn Turn in queue
 * @param repetitionsPerLoop Maximum allowed iterations
 * @returns
 */
function _isWithinIterations(type: Command.sendloop, turn: number, repetitionsPerLoop: number): boolean {
    const [iteration] = queueMap[type].getIteration(turn);
    return iteration < repetitionsPerLoop;
}

/**
 * Checks if the queue needs to repeat the current request
 * @param type Queue type
 * @param currentTurn Current turn
 * @param nextTurn Current turn
 * @param repetitionsPerLoop Maximum allowed iterations
 * @returns If queue can progress
 */
function _mustRepeatRequest(type: Command.sendloop, currentTurn: number, nextTurn: number, repetitionsPerLoop: number): boolean {
    return (
        type === Command.sendloop && // Is a !sendloop request
        _isInQueue(type, currentTurn) && // Current !sendloop request still exists
        // eslint-disable-next-line prettier/prettier
        (
            syncMode.is(Sync.REPEAT) ||
            // eslint-disable-next-line prettier/prettier
            (
                syncMode.is(Sync.OFF) &&
                (
                    !_isInQueue(type, nextTurn) ||
                    !areRequestsOpen.get() ||
                    _isFavoriteRequest(type, currentTurn) ||
                    _isWithinIterations(type, currentTurn, repetitionsPerLoop)
                )
            )
        )
    );
}

/**
 * Sets the request playing now and emits an event
 * @param type Command type
 * @param request Request content
 */
async function _setRequestPlayingNow(type: Command.sendloop, request: string): Promise<void> {
    // If it keeps playing the same, do nothing
    if (request === GLOBAL.EMPTY_MESSAGE || (requestPlayingNow?.request === request && requestPlayingNow?.type === type)) {
        return;
    }
    requestPlayingNow = { request, type };
    EVENT_EMITTER.emit(EVENT.PLAYING_NOW, type, request);
    return Promise.resolve();
}

/**
 * Processes the queue for a particular command and returns a list of requests
 * @param type Command type
 * @returns List of requests
 */
function _processQueue(type: Command.sendloop): [type: Command.sendloop, request: string][] {
    const queue: Array<string | null> = [];
    const [tagEntries] = queueMap[type].tagEntries();
    const [currentTurn] = queueMap[type].getCurrentTurn();

    for (const [key, value] of tagEntries) {
        queue[Number(key)] = value;
    }

    return queue
        .slice(currentTurn)
        .filter((request) => request !== GLOBAL.EMPTY_MESSAGE)
        .map((request) => [type, request ?? GLOBAL.EMPTY_MESSAGE]);
}
