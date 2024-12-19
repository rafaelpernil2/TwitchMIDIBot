import { CustomObject, Result } from '../types/generic.js';

export interface Queue<T extends CustomObject<T>> {
    /**
     * Adds item to queue
     * @param tag Tag or alias for the item
     * @param value Value of the item
     */
    enqueue(tag: string, value: T, requesterUser: string, { isBroadcaster }: { isBroadcaster: boolean }): Result<number>;
    /**
     * Removes item from queue
     * @param turn Position in queue
     */
    dequeue(turn: number): Result<null>;
    /**
     * Removes last item by requester
     * @param username Requester username
     * @returns
     */
    dequeueLastUserRequest(username: string): Result<null>;
    /**
     * Returns the current item in queue
     */
    getCurrent(): Result<T | null>;
    /**
     * Returns the current item in queue
     */
    getCurrentTag(): Result<string | null>;
    /**
     * Move to next item in queue
     */
    forward(): Result<null>;
    /**
     * Clear all items in queue and reset position
     */
    clear(): Result<null>;
    /**
     * Get next turn in queue
     */
    getNextTurn(): Result<number>;
    /**
     * Get current turn in queue
     */
    getCurrentTurn(): Result<number>;
    /**
     * Is current request the last one in the queue?
     */
    isCurrentLast(): Result<boolean>;
    /**
     * Is queue empty
     */
    isEmpty(): Result<boolean>;
    /**
     * Is my turn?
     * @param turn Position in queue
     */
    isMyTurn(turn: number): Result<boolean>;
    /**
     * Checks if it has a particular element in queue
     * @param turn Position in queue
     */
    has(turn: number): Result<boolean>;
    /**
     * Get an item from queue given a turn
     * @param turn Position in queue
     */
    get(turn: number): Result<T | null>;
    /**
     * Get an item from queue given a turn
     * @param turn Position in queue
     */
    getTag(turn: number): Result<string | null>;
    /**
     * Returns the tag from all items in queue in entries format
     */
    tagEntries(): Result<Array<[turn: number, tag: string, requesterUser: string]>>;
}

export type QueueNode<T> = {
    tag: string;
    value: T;
    requesterUser: string;
    timestamp: Date;
    previousTurn: number;
    nextTurn: number;
};
