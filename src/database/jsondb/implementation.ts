import { CustomObject, ResponseStatus } from '../../types/generic.js';
import { Database } from '../interface.js';
import { promises as fs, readFileSync } from 'fs';

export class JSONDatabase<T extends CustomObject<T>> implements Database<T> {
    private _filePath: string;
    private _fileName: string;
    private _db: T | undefined;
    private _dbCommit: T | undefined;

    /**
     * Given the file DB path, the contents are loaded into this.db
     * @param filePath File DB path
     * @param options { ignoreFileNotFound }
     */
    constructor(filePath: string, { ignoreFileNotFound = false } = {}) {
        this._filePath = filePath;
        this._fileName = this._filePath.slice(this._filePath.lastIndexOf('/') + 1);
        try {
            this.syncFetchDB();
        } catch (error) {
            if (error instanceof Error && (error.message.startsWith('ENOENT') || error.message === 'Unexpected end of JSON input') && ignoreFileNotFound) {
                this._db = {} as T;
                this._dbCommit = {} as T;
                return;
            }
            throw error;
        }
    }

    /**
     * Retrieves the full DB data
     */
    get value(): T | undefined {
        return this._db;
    }
    /**
     * Sets a DB
     * @param newDB
     */
    set value(newDB: T | undefined) {
        this._db = newDB;
    }

    /**
     * Retrieves the file name
     * @returns File name
     */
    get fileName(): string {
        return this._fileName;
    }

    /**
     * Retrieves all data from path
     * @param path Path in DB
     * @returns Data in path
     */
    selectAll<P extends keyof T>(path: P): T[P] | undefined {
        if (this._db == null) {
            return;
        }
        return this._db[path];
    }

    /**
     * Retrieves value from path and key
     * @param path Path in DB
     * @param key Key in DB
     * @returns Data in path
     */
    select<P extends keyof T, S extends keyof T[P]>(path: P, key: S): T[P][S] | undefined {
        if (this._db == null) {
            return;
        }
        return this._db[path]?.[key];
    }

    /**
     * Inserts data in DB[path][key] and throws an error if the same key exists
     * @param path Path in DB
     * @param key Key in DB
     * @param value New value to save
     * @returns ResponseStatus: Ok or Error
     */
    insert<P extends keyof T, S extends keyof T[P]>(path: P, key: S, value: T[P][S]): ResponseStatus {
        if (this._dbCommit == null || this._dbCommit[path][key] != null) {
            return ResponseStatus.Error;
        }
        this._dbCommit[path][key] = value;
        return ResponseStatus.Ok;
    }

    /**
     * Overrides data in DB[path] with a new value
     * @param path Path in DB
     * @param value New value to save
     * @returns ResponseStatus: Ok or Error
     */
    upsert<P extends keyof T>(path: P, value: T[P]): ResponseStatus {
        if (this._dbCommit == null) {
            return ResponseStatus.Error;
        }
        this._dbCommit[path] = { ...this._dbCommit[path], ...value };
        return ResponseStatus.Ok;
    }

    /**
     * Removes data in DB[path][key]
     * @param path Path in DB
     * @param key Key in path
     * @returns ResponseStatus: Ok or Error
     */
    delete<P extends keyof T>(path: P, key: keyof T[P]): ResponseStatus {
        if (this._dbCommit == null || this._dbCommit?.[path]?.[key] == null) {
            return ResponseStatus.Error;
        }
        delete this._dbCommit?.[path]?.[key];
        return ResponseStatus.Ok;
    }

    /**
     * Saves changes into the persistent DB
     * @returns Promise of ResponseStatus: Ok or Error
     */
    async commit(): Promise<ResponseStatus> {
        try {
            await fs.writeFile(this._filePath, JSON.stringify(this._dbCommit, null, 4), { encoding: 'utf-8' });
            await this.fetchDB();
            return ResponseStatus.Ok;
        } catch {
            return ResponseStatus.Error;
        }
    }

    /**
     * Clears commit data
     * @returns ResponseStatus: Ok or Error
     */
    rollback(): ResponseStatus {
        this._dbCommit = JSON.parse(JSON.stringify(this._db)) as T;
        return ResponseStatus.Ok;
    }

    /**
     * Fetches data from persistent DB asynchronously
     */
    async fetchDB(): Promise<void> {
        this._db = JSON.parse(await fs.readFile(this._filePath, { encoding: 'utf-8' })) as T;
        this._dbCommit = JSON.parse(JSON.stringify(this._db)) as T;
    }

    /**
     * Fetches data from persistent DB synchronously
     */
    syncFetchDB(): void {
        this._db = JSON.parse(readFileSync(this._filePath, { encoding: 'utf-8' })) as T;
        this._dbCommit = JSON.parse(JSON.stringify(this._db)) as T;
    }
}
