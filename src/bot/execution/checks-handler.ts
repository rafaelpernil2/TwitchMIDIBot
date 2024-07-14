import { CONFIG, GLOBAL } from '../../configuration/constants.js';
import { httpsRequestPromise } from '../../utils/promise.js';

import { promises as fs } from 'fs';
import http from 'http';

/**
 * Checks if there are updates available on GitHub
 */
export async function checkUpdates(): Promise<[localVersion: string, remoteVersion: string]> {
    try {
        // Read package.json
        const { version: localVersion } = JSON.parse(await fs.readFile(CONFIG.PACKAGE_JSON_PATH, { encoding: 'utf-8' })) as { version: string };
        // Read GitHub's master package.json
        const options: http.RequestOptions = {
            hostname: CONFIG.GITHUB_CONTENT_BASE_URL,
            path: CONFIG.REMOTE_PACKAGE_JSON_PATH,
            port: 443,
            method: 'GET'
        };
        const { version: remoteVersion } = (await httpsRequestPromise(options))?.body as { version: string };
        // Return old and new version
        return [localVersion, remoteVersion];
    } catch {
        // If any read error occurs, return same empty message as local and remote version
        return [GLOBAL.EMPTY_MESSAGE, GLOBAL.EMPTY_MESSAGE];
    }
}
