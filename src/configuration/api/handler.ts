import http from 'http';
import { ALIASES_DB, REWARDS_DB, PERMISSIONS_DB, GLOBAL, CONFIG } from '../constants.js';
import i18n from '../../i18n/loader.js';
import { promises as fs } from 'fs';
import { RefreshingAuthProvider } from '@twurple/auth';
import { clearQueue, favoriteIdMap, markAsFavorite, queueMap, removeFromQueue, saveRequest, unmarkFavorite } from '../../command/queue.js';
import { Command } from '../../command/types.js';
import { reloadRewards } from '../../twitch/rewards/handler.js';
import { ParsedEnvObject } from '../env/types.js';
import { checkMIDIConnection, getMIDIVolume, getTempo, setMIDIVolume, triggerClock } from '../../midi/handler.js';

/**
 * Creates an HTTP server that implements Configuration API
 */

/**
 * Creates an HTTP server that implements Configuration API
 * @param authProvider Authentication provider
 * @param env Environment variables
 */
export function initiateConfigAPI(authProvider: RefreshingAuthProvider, env: ParsedEnvObject): void {
    // Create server
    const server = http.createServer(_onRequest(authProvider, env.TARGET_CHANNEL, env.TARGET_MIDI_CHANNEL));
    // Listen from server
    server.listen(() => {
        const address = server.address();
        const port = address != null && typeof address !== 'string' ? address.port : -1;
        if (port === -1) {
            return;
        }
        // Write reserved port into file to be able to interact with the API
        fs.writeFile(CONFIG.DOT_API_PORT, String(port));
    });
}

/**
 * Exposes a REST API via /refreshConfig with a "file" as query param to refresh
 * config files on demand
 * @param authProvider Authentication provider
 * @param targetChannel Target channel
 * @returns A request listener for a HTTP server
 */
function _onRequest(authProvider: RefreshingAuthProvider, targetChannel: string, targetMIDIChannel: number): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
    // Map of file name with the correspondent DB
    const configFileMap = {
        aliases: ALIASES_DB,
        rewards: REWARDS_DB,
        permissions: PERMISSIONS_DB
    } as const;

    return async (req, res) => {
        const url = new URL(req.url ?? '', `http://${req.headers.host ?? ''}`);

        switch (url.pathname) {
            // RefreshConfig API
            case '/refreshConfig': {
                // Obtain name of file to refresh
                const queryFile = (url.searchParams.get('file') ?? GLOBAL.EMPTY_MESSAGE) as keyof typeof configFileMap;

                switch (req.method) {
                    case 'POST': {
                        // Validate request
                        if (configFileMap[queryFile] == null) return _buildResponse(res, 400, i18n.t('API_ERROR_FILE'));

                        // If it is a reward, reload them, otherwise, refresh the file
                        if (queryFile === 'rewards') {
                            await reloadRewards(authProvider, targetChannel);
                        } else {
                            await configFileMap[queryFile].fetchDB();
                        }

                        // Happy path, all OK! :)
                        return _buildResponse(res, 200, `${i18n.t('API_OK_1')} "${queryFile}" ${i18n.t('API_OK_2')}`);
                    }
                    default:
                        return _buildResponse(res, 405);
                }
            }
            case '/queue': {
                // Obtain name of command to check
                const commandName = url.searchParams.get('command') as Command.sendloop | Command.sendchord | null;
                const turn = url.searchParams.get('turn');

                switch (req.method) {
                    case 'GET': {
                        // Obtain queue details
                        const sendChordEntries = [...queueMap.sendchord.tagEntries()[0]];
                        const sendchord: Record<number, { requesterUser: string, tag: string }> = {};
                        for (const [turn, tag, requesterUser] of sendChordEntries) {
                            sendchord[turn] = { requesterUser, tag };
                        }

                        const sendLoopEntries = [...queueMap.sendloop.tagEntries()[0]];
                        const sendloop: Record<number, { requesterUser: string, tag: string }> = {};
                        for (const [turn, tag, requesterUser] of sendLoopEntries) {
                            sendloop[turn] = { requesterUser, tag };
                        }

                        const total = { sendloop, sendchord };
                        const queueData = commandName != null ? { [commandName]: total[commandName] } : total;
                        const jsonData = JSON.stringify(queueData);

                        // Happy path, all OK! :)
                        res.setHeader('Content-Type', 'application/json');
                        return _buildResponse(res, 200, jsonData);
                    }
                    case 'DELETE': {
                        // Validate request
                        if (commandName == null || (turn != null && isNaN(Number(turn)))) return _buildResponse(res, 400, i18n.t('API_BAD_DATA'));

                        if (turn != null) {
                            removeFromQueue(commandName, Number(turn));
                        } else {
                            clearQueue(commandName);
                        }

                        // Happy path, all OK! :)
                        return _buildResponse(res, 200, i18n.t('API_OK'));
                    }
                    default:
                        return _buildResponse(res, 405);
                }
            }

            case '/favorite': {
                // Obtain name of command to check
                const commandName = url.searchParams.get('command') as Command.sendloop | Command.sendchord | null;
                const turn = url.searchParams.get('turn');

                switch (req.method) {
                    case 'GET': {
                        // Obtain favoriteIdMap details
                        const favoriteData = commandName != null ? { [commandName]: favoriteIdMap[commandName] } : favoriteIdMap;
                        const jsonData = JSON.stringify(favoriteData);

                        // Happy path, all OK! :)
                        res.setHeader('Content-Type', 'application/json');
                        return _buildResponse(res, 200, jsonData);
                    }
                    case 'PUT': {
                        // Validate request
                        if (commandName == null || turn == null) return _buildResponse(res, 400, i18n.t('API_BAD_DATA'));

                        markAsFavorite(commandName, Number(turn));

                        // Happy path, all OK! :)
                        return _buildResponse(res, 200, i18n.t('API_OK'));
                    }
                    case 'DELETE': {
                        // Validate request
                        if (commandName == null) return _buildResponse(res, 400, i18n.t('API_BAD_DATA'));

                        unmarkFavorite(commandName);

                        // Happy path, all OK! :)
                        return _buildResponse(res, 200, i18n.t('API_OK'));
                    }
                    default:
                        return _buildResponse(res, 405);
                }
            }

            case '/saveRequest': {
                // Obtain name of command to check
                const commandName = url.searchParams.get('command') as Command.sendloop | Command.sendchord | null;
                const turn = url.searchParams.get('turn');
                const alias = url.searchParams.get('alias');

                switch (req.method) {
                    case 'POST': {
                        // Validate request
                        if (commandName == null || turn == null || alias == null) return _buildResponse(res, 400, i18n.t('API_BAD_DATA'));

                        try {
                            await saveRequest(commandName, Number(turn), alias);
                        } catch (error) {
                            return _buildResponse(res, 400, error instanceof Error ? error.message : i18n.t('API_GENERIC_ERROR'));
                        }

                        // Happy path, all OK! :)
                        return _buildResponse(res, 200, i18n.t('API_OK'));
                    }
                    default:
                        return _buildResponse(res, 405);
                }
            }

            case '/tempo': {
                // Obtain name of command to check
                const tempo = url.searchParams.get('tempo');

                switch (req.method) {
                    case 'GET': {
                        // Obtain tempo
                        const jsonData = JSON.stringify({ tempo: getTempo() });

                        // Happy path, all OK! :)
                        res.setHeader('Content-Type', 'application/json');
                        return _buildResponse(res, 200, jsonData);
                    }
                    case 'PUT': {
                        // Validate request
                        const newTempo = Number(tempo);
                        if (tempo == null || isNaN(newTempo)) {
                            return _buildResponse(res, 400, i18n.t('API_BAD_DATA'));
                        }

                        try {
                            triggerClock(targetMIDIChannel, newTempo)
                        } catch (error) {
                            return _buildResponse(res, 400, i18n.t('API_BAD_DATA') + " " + error);
                        }
                        
                        // Happy path, all OK! :)
                        return _buildResponse(res, 200, i18n.t('API_OK'));
                    }
                    default:
                        return _buildResponse(res, 405);
                }
            }


            case '/volume': {
                // Obtain name of command to check
                const volume = url.searchParams.get('volume');

                switch (req.method) {
                    case 'GET': {
                        // Obtain midi volume
                        const jsonData = JSON.stringify({ volume: getMIDIVolume() });

                        // Happy path, all OK! :)
                        res.setHeader('Content-Type', 'application/json');
                        return _buildResponse(res, 200, jsonData);
                    }
                    case 'PUT': {
                        // Validate request
                        const newVolume = parseInt(volume ?? "");
                        try {
                            setMIDIVolume(newVolume);
                        } catch (error) {
                            return _buildResponse(res, 400, i18n.t('API_BAD_DATA') + " " + error);
                        }
                        // Happy path, all OK! :)
                        return _buildResponse(res, 200, i18n.t('API_OK'));
                    }
                    default:
                        return _buildResponse(res, 405);
                }
            }

            case '/isActive': {
                switch (req.method) {
                    case 'GET': {
                        let isActive = false;
                        try {
                            checkMIDIConnection()
                            isActive = true;
                        } catch {
                            isActive = false;
                        }

                        const jsonData = JSON.stringify({ isActive });

                        // Happy path, all OK! :)
                        res.setHeader('Content-Type', 'application/json');
                        return _buildResponse(res, 200, jsonData);
                    }
                    default:
                        return _buildResponse(res, 405);
                }
            }

            default:
                return _buildResponse(res, 400, i18n.t('API_ERROR_NOT_A_METHOD'));
        }
    };
}

/**
 * Builds a response for an http server response
 * @param res Server response
 * @param code HTTP code
 * @param message Message to return
 */
function _buildResponse(res: http.ServerResponse, code: number, message?: string): void {
    // Writes HTTP code
    res.writeHead(code);
    // Returns message
    res.end(message);
}
