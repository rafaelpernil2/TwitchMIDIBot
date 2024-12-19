import { ERROR_MSG } from '../../configuration/constants.js';
import { ResponseStatus, Result } from '../../types/generic.js';
import { Queue, QueueNode } from '../interface.js';

export class GenericQueue<T> implements Queue<T> {
    private _queueMap: Map<number, QueueNode<T>>;
    private _currentTurn: number;
    private _lastQueuedTurn: number;
    private _lastValidTurn: number;

    constructor() {
        // Initialize variables
        this._queueMap = new Map();
        this._currentTurn = 0;
        this._lastQueuedTurn = -1;
        this._lastValidTurn = -1;
    }

    /**
     * Check if the given turn is the current turn
     * @param turn Turn in queue
     * @returns
     */
    isMyTurn(turn: number): Result<boolean> {
        return [turn === this._currentTurn, ResponseStatus.Ok];
    }

    /**
     * Returns all the elements in the queue
     * @returns
     */
    tagEntries(): Result<[turn: number, tag: string, requesterUser: string][]> {
        const tagEntries: Array<[turn: number, tag: string, requesterUser: string]> = [];
        for (const [turn, { tag, requesterUser }] of this._queueMap.entries()) {
            tagEntries.push([turn, tag, requesterUser]);
        }
        return [tagEntries, ResponseStatus.Ok];
    }

    /**
     * Checks if the queue has a given turn
     * @param turn Turn in queue
     * @returns
     */
    has(turn: number): Result<boolean> {
        return [this._queueMap.has(turn), ResponseStatus.Ok];
    }

    /**
     * Retrieves current element in queue
     * @returns
     */
    getCurrentTag(): Result<string | null> {
        const current = this._queueMap.get(this._currentTurn);
        if (current == null) {
            return [null, ResponseStatus.Error];
        }
        return [current.tag, ResponseStatus.Ok];
    }

    /**
     * Retrieves request name given a turn in queue
     * @param turn Turn in queue
     * @returns
     */
    getTag(turn: number): Result<string | null> {
        const current = this._queueMap.get(turn);
        if (current == null) {
            return [null, ResponseStatus.Error];
        }
        return [current.tag, ResponseStatus.Ok];
    }

    /**
     * Retrieves request value given a turn in queue
     * @param turn Turn in queue
     * @returns
     */
    get(turn: number): Result<T | null> {
        const current = this._queueMap.get(turn);
        if (current == null) {
            return [null, ResponseStatus.Error];
        }
        return [current.value, ResponseStatus.Ok];
    }

    /**
     * Checks if current request is the last one
     * @returns
     */
    isCurrentLast(): Result<boolean> {
        const currentNode = this._queueMap.get(this._currentTurn);
        // Initial case where currentTurn is empty
        if (currentNode == null && this._queueMap.size === 0) {
            return [true, ResponseStatus.Error];
        }

        const nextNode = this._queueMap.get(currentNode?.nextTurn ?? -1);
        return [nextNode == null, ResponseStatus.Ok];
    }

    /**
     * Add element to queue
     * @param tag Name of request
     * @param value Value of request
     * @param requesterUser Requester user
     * @param userRoles { isBroadcaster }
     * @returns
     */
    enqueue(tag: string, value: T, requesterUser: string): Result<number> {
        // Throw error on duplicate requests
        const [lastNode] = this._getLastInQueue();
        if (tag === lastNode?.tag) {
            throw new Error(ERROR_MSG.DUPLICATE_REQUEST());
        }

        // Get turns
        const previousTurn = this._lastValidTurn;
        const insertTurn = this._getNewTurn();
        const nextTurn = insertTurn + 1;

        this._queueMap.set(insertTurn, {
            tag,
            value,
            requesterUser,
            timestamp: new Date(),
            previousTurn,
            nextTurn
        });
        this._lastValidTurn = insertTurn;

        return [insertTurn, ResponseStatus.Ok];
    }

    /**
     * Removes item from queue
     * @param turn Turn to be removed
     * @returns
     */
    dequeue(turn: number): Result<null> {
        // If out of bounds
        if (turn < 0 || turn > this._lastQueuedTurn) {
            return [null, ResponseStatus.Error];
        }

        // Obtain node data
        const selectedNode = this._queueMap.get(turn);
        if (selectedNode == null) {
            return [null, ResponseStatus.Error];
        }
        const { previousTurn, nextTurn } = selectedNode;
        // Delete node
        const deleteOk = this._queueMap.delete(turn);
        const status = deleteOk ? ResponseStatus.Ok : ResponseStatus.Error;

        // If turn is 0, no need to move index in previous node
        if (previousTurn !== -1) {
            // Re-link previous node
            const previousNode = this._queueMap.get(previousTurn);
            // This should not happen
            if (previousNode == null) {
                return [null, ResponseStatus.Error];
            }
            // Apply deleted node nextTurn to previous node
            this._queueMap.set(previousTurn, { ...previousNode, nextTurn });
        }

        // Re-link next node if exists
        if (nextTurn !== this._lastQueuedTurn + 1) {
            const nextNode = this._queueMap.get(nextTurn);
            // This should not happen
            if (nextNode == null) {
                return [null, ResponseStatus.Error];
            }
            // Apply deleted node previousTurn to next node
            this._queueMap.set(nextTurn, { ...nextNode, previousTurn });
        } else {
            // If it's last, move last valid turn to previous turn
            this._lastValidTurn = previousTurn;
        }

        return [null, status];
    }

    /**
     * Removes last item by requester
     * @param username Requester username
     * @returns
     */
    dequeueLastUserRequest(username: string): Result<null> {
        const queueEntries = this._queueMap.entries();
        const lastUserEntry = [...queueEntries].findLast(([, { requesterUser }]) => username === requesterUser);

        if (lastUserEntry == null) {
            return [null, ResponseStatus.Error]
        }

        const [turn] = lastUserEntry;

        return this.dequeue(turn);
    }

    /**
     * Retrieves current turn data
     * @returns
     */
    getCurrent(): Result<T | null> {
        const current = this._queueMap.get(this._currentTurn);
        if (current == null) {
            return [null, ResponseStatus.Error];
        }
        return [current.value, ResponseStatus.Ok];
    }

    /**
     * Forwards the queue moving to the next turn
     * @returns
     */
    forward(): Result<null> {
        this._currentTurn = this.getNextTurn()[0];
        return [null, ResponseStatus.Ok];
    }

    /**
     * Empties the queue
     * @returns
     */
    clear(): Result<null> {
        this._queueMap = new Map();
        return [null, ResponseStatus.Ok];
    }

    /**
     * Obtains next turn from queue
     * @returns
     */
    getNextTurn(): Result<number> {
        const currentItem = this._queueMap.get(this._currentTurn);
        if (currentItem == null) {
            // If current turn does not exist, get first from queueMap keys.
            // If queueMap is empty, move to lastQueuedTurn + 1 so that new requests keep working
            return [this._queueMap.keys().next().value ?? this._lastQueuedTurn + 1, ResponseStatus.Ok];
        }
        // Otherwise, get next turn
        return [currentItem.nextTurn, ResponseStatus.Ok];
    }

    /**
     * Retrieves current turn in queue
     * @returns
     */
    getCurrentTurn(): Result<number> {
        return [this._currentTurn, ResponseStatus.Ok];
    }

    /**
     * Checks if queue is empty
     * @returns
     */
    isEmpty(): Result<boolean> {
        return [this._queueMap.size === 0, ResponseStatus.Ok];
    }

    // PRIVATE METHODS

    /**
     * Get next turn
     * @returns
     */
    _getNewTurn(): number {
        this._lastQueuedTurn++;
        return this._lastQueuedTurn;
    }

    /**
     * Get last item in queue
     * @returns
     */
    _getLastInQueue(): Result<QueueNode<T> | null> {
        const queueNode = this._queueMap.get(this._lastQueuedTurn);

        if (queueNode == null) {
            return [null, ResponseStatus.Error];
        }

        return [queueNode, ResponseStatus.Ok];
    }
}
