import { CHORD_PROGRESSIONS_KEY } from '../database/jsondb/types.js';
import { ALIASES_DB, ERROR_MSG, EVENT, EVENT_EMITTER, GLOBAL } from '../configuration/constants.js';
import { syncMode } from '../midi/clock.js';
import { Sync } from '../midi/types.js';
import { areRequestsOpen } from './guards.js';
import { Command } from './types.js';
import { ResponseStatus } from '../types/generic.js';
import { GenericQueue } from '../queue/generic-queue/implementation.js';
import { triggerChordList } from '../midi/handler.js';

export const favoriteIdMap = Object.fromEntries(Object.values(Command).map((key) => [key, -1])) as Record<Command, number>;
export let onBarLoopChange: () => Promise<void>;

let requestPlayingNow: { type: Command.sendloop | Command.sendchord; request: string } | null;

export const queueMap = {
    sendchord: new GenericQueue<Array<[noteList: string[], timeSubDivision: number]>>(),
    sendloop: new GenericQueue<Array<[noteList: string[], timeSubDivision: number]>>()
} as const;

export function createAutomaticClockSyncedQueue(targetMIDIChannel: number): void {
    // Only set the function once
    if (onBarLoopChange != null) {
        return;
    }

    const onCommandTurn = (type: Command.sendloop | Command.sendchord) => async () => {
        const [turn] = queueMap[type].getCurrentTurn();

        const [chordProgression] = queueMap[type].getCurrent();

        // If request was removed from queue or is not collision free
        if (chordProgression == null || !_isCollisionFree(type)) {
            return false;
        }

        // If it is in queue and is your turn - Happy path
        const [currentTag] = queueMap[type].getTag(turn);
        _setRequestPlayingNow(type, currentTag ?? GLOBAL.EMPTY_MESSAGE);

        await triggerChordList(chordProgression, targetMIDIChannel, type);
        return true;
    };

    onBarLoopChange = async () => {
        const sendchordHasPlayed = await onCommandTurn(Command.sendchord)();
        // If sendchord has played, we have to wait until next tick for synchronization
        if (sendchordHasPlayed) return;
        // Otherwise, sendloop can be played
        await onCommandTurn(Command.sendloop)();
    };
}

/**
 * Adds request to queue
 * @param value
 * @param type
 * @returns
 */
export function queue(tag: string, value: Array<[noteList: string[], timeSubDivision: number]>, type: Command.sendloop | Command.sendchord): number {
    const [turn] = queueMap[type].enqueue(tag, value);
    return turn;
}

/**
 * Moves to the next in queue
 * @param type
 */
export function forwardQueue(type: Command.sendloop | Command.sendchord): void {
    const [currentTurn] = queueMap[type].getCurrentTurn();
    const [nextTurn] = queueMap[type].getNextTurn();

    // Do not forward queue if it's looping alone, requests are closed, queue is empty, or synchronization with repetition is active
    if (_mustRepeatRequest(type, currentTurn, nextTurn)) {
        return;
    }

    removeFromQueue(type, currentTurn);
    queueMap[type].forward();

    // If there's no chord progression or loop next, let's clear requestPlayingNow
    if (_isCurrentLast(Command.sendchord) && _isCurrentLast(Command.sendloop)) {
        requestPlayingNow = null;
    }
}

/**
 * Returns the current request being played
 * @returns Request information
 */
export function getCurrentRequestPlaying(): { type: Command.sendloop | Command.sendchord; request: string } | null {
    return requestPlayingNow;
}

/**
 * Returns the current queue for chord progressions and loops
 * @returns Current queue
 */
export function getRequestQueue(): [type: Command.sendloop | Command.sendchord, request: string][] {
    return [..._processQueue(Command.sendchord), ..._processQueue(Command.sendloop)];
}

/**
 * Removes petitions from a queue by type
 * @param type
 */
export function clearQueue(type: Command.sendloop | Command.sendchord): void {
    queueMap[type].clear();
}

/**
 * Clears all queues
 */
export function clearAllQueues(): void {
    clearQueue(Command.sendchord);
    clearQueue(Command.sendloop);
    requestPlayingNow = null;
}

/**
 * Removes item from queue
 * @param type
 * @param turn
 * @returns
 */
export function removeFromQueue(type: Command.sendloop | Command.sendchord, turn: number): void {
    queueMap[type].dequeue(turn);
}

/**
 * Marks item as favorite
 * @param type
 * @param turn
 */
export function markAsFavorite(type: Command.sendloop | Command.sendchord, turn: number): void {
    favoriteIdMap[type] = turn;
}

/**
 * Marks item as favorite
 * @param type
 */
export function unmarkFavorite(type: Command.sendloop | Command.sendchord): void {
    favoriteIdMap[type] = -1;
}

/**
 * Save a request into the list of aliases
 * @param type
 * @param turn
 * @param alias
 */
export async function saveRequest(type: Command.sendloop | Command.sendchord, turn: number, alias: string): Promise<void> {
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
 * @param type
 * @param turn
 * @returns If the queued request is not null
 */
function _isInQueue(type: Command.sendloop | Command.sendchord, turn: number): boolean {
    const [isInQueue] = queueMap[type].has(turn);
    return isInQueue;
}

/**
 * Checks if queue is empty
 * @param type
 * @returns
 */
function _isCurrentLast(type: Command.sendloop | Command.sendchord): boolean {
    const [isEmpty] = queueMap[type].isCurrentLast();
    return isEmpty;
}


/**
 * Checks if the given request turn is the favorite one
 * @param type
 * @param turn
 * @returns
 */
function _isFavoriteRequest(type: Command.sendloop | Command.sendchord, turn: number): boolean {
    return favoriteIdMap[type] === turn;
}

/**
 * Collision prevention algorithm that separates sendchord and sendloop queues
 * @param type Queue type
 * @returns If next petition can be started without collision
 */
function _isCollisionFree(type: Command.sendloop | Command.sendchord): boolean {
    // If it has "sendloop" type, it has to wait until "sendchord" queue is empty
    return type !== Command.sendloop || _isCurrentLast(Command.sendchord);
}

/**
 * Checks if the queue needs to repeat the current request
 * @param type Queue type
 * @param currentTurn Current turn
 * @param nextTurn Current turn
 * @returns If queue can progress
 */
function _mustRepeatRequest(type: Command.sendloop | Command.sendchord, currentTurn: number, nextTurn: number): boolean {
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
                    !_isCurrentLast(Command.sendchord) ||
                    _isFavoriteRequest(type, currentTurn)
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
async function _setRequestPlayingNow(type: Command.sendloop | Command.sendchord, request: string): Promise<void> {
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
function _processQueue(type: Command.sendloop | Command.sendchord): [type: Command.sendloop | Command.sendchord, request: string][] {
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
