import { isTimestampExpired } from '../../utils/generic.js';
import { ERROR_MSG } from '../../configuration/constants.js';
import { ResponseStatus, Result } from '../../types/generic.js';
import { Queue, QueueNode } from '../interface.js';
import { requestTimeout } from '../../command/queue.js';

export class GenericQueue<T> implements Queue<T> {
    private _queueMap: Map<number, QueueNode<T>>;
    private _lastQueuePositionByUserMap: Map<string, number>;
    private _currentTurn: number;
    private _lastQueuedTurn: number;
    private _lastValidTurn: number;

    constructor() {
        // Initialize variables
        this._queueMap = new Map();
        this._lastQueuePositionByUserMap = new Map();
        this._currentTurn = 0;
        this._lastQueuedTurn = -1;
        this._lastValidTurn = -1;
    }

    isMyTurn(turn: number): Result<boolean> {
        return [turn === this._currentTurn, ResponseStatus.Ok];
    }
    tagEntries(): Result<[turn: number, tag: string, requesterUser: string][]> {
        const tagEntries: Array<[turn: number, tag: string, requesterUser: string]> = [];
        for (const [turn, { tag, requesterUser }] of this._queueMap.entries()) {
            tagEntries.push([turn, tag, requesterUser]);
        }
        return [tagEntries, ResponseStatus.Ok];
    }
    has(turn: number): Result<boolean> {
        return [this._queueMap.has(turn), ResponseStatus.Ok];
    }
    getCurrentTag(): Result<string | null> {
        const current = this._queueMap.get(this._currentTurn);
        if (current == null) {
            return [null, ResponseStatus.Error];
        }
        return [current.tag, ResponseStatus.Ok];
    }
    getTag(turn: number): Result<string | null> {
        const current = this._queueMap.get(turn);
        if (current == null) {
            return [null, ResponseStatus.Error];
        }
        return [current.tag, ResponseStatus.Ok];
    }
    get(turn: number): Result<T | null> {
        const current = this._queueMap.get(turn);
        if (current == null) {
            return [null, ResponseStatus.Error];
        }
        return [current.value, ResponseStatus.Ok];
    }

    isCurrentLast(): Result<boolean> {
        const currentNode = this._queueMap.get(this._currentTurn);
        // Initial case where currentTurn is empty
        if (currentNode == null && this._queueMap.size === 0) {
            return [true, ResponseStatus.Error];
        }

        const nextNode = this._queueMap.get(currentNode?.nextTurn ?? -1);
        return [nextNode == null, ResponseStatus.Ok];
    }

    enqueue(tag: string, value: T, requesterUser: string, { isBroadcaster }: { isBroadcaster: boolean }): Result<number> {
        // Throw error on duplicate requests
        const [lastNode] = this._getLastInQueue();
        if (tag === lastNode?.tag) {
            throw new Error(ERROR_MSG.DUPLICATE_REQUEST());
        }

        // Check if it is not broadcaster, last request has expired and can be requested (timeout logic)
        if (!isBroadcaster && !this._hasLastRequestByUserExpired(requesterUser)) {
            throw new Error(ERROR_MSG.TIMEOUT_REQUEST(requestTimeout.get()));
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

        if (!isBroadcaster) {
            this._lastQueuePositionByUserMap.set(requesterUser, insertTurn);
        }

        return [insertTurn, ResponseStatus.Ok];
    }
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
        const { previousTurn, nextTurn, requesterUser } = selectedNode;
        // Delete node
        const deleteOk = this._queueMap.delete(turn);
        const status = deleteOk ? ResponseStatus.Ok : ResponseStatus.Error;

        // Delete last position by user for the given user
        this._lastQueuePositionByUserMap.delete(requesterUser);

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
    getCurrent(): Result<T | null> {
        const current = this._queueMap.get(this._currentTurn);
        if (current == null) {
            return [null, ResponseStatus.Error];
        }
        return [current.value, ResponseStatus.Ok];
    }
    forward(): Result<null> {
        this._currentTurn = this.getNextTurn()[0];
        return [null, ResponseStatus.Ok];
    }
    clear(): Result<null> {
        this._queueMap = new Map();
        return [null, ResponseStatus.Ok];
    }
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
    getCurrentTurn(): Result<number> {
        return [this._currentTurn, ResponseStatus.Ok];
    }
    isEmpty(): Result<boolean> {
        return [this._queueMap.size === 0, ResponseStatus.Ok];
    }
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

    /**
     * Get last request by user
     * @param requesterUser
     * @returns
     */
    _getLastRequestByUser(requesterUser: string): QueueNode<T> | null {
        // Check last request by user timestamp
        const lastPosition = this._lastQueuePositionByUserMap.get(requesterUser);
        if (lastPosition == null) {
            return null;
        }

        const lastRequest = this._queueMap.get(lastPosition);

        if (lastRequest == null) {
            return null;
        }

        return lastRequest;
    }

    /**
     * Has last request expired checking with timeout
     * @param requesterUser
     * @returns
     */
    _hasLastRequestByUserExpired(requesterUser: string): boolean {
        const lastRequestByUser = this._getLastRequestByUser(requesterUser);

        // If there is no last request, it has expired and another can be requested
        if (lastRequestByUser == null) {
            return true;
        }

        return isTimestampExpired(lastRequestByUser.timestamp, new Date(), requestTimeout.get());
    }
}
