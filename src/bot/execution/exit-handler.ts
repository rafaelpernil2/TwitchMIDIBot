import { RefreshingAuthProvider } from '@twurple/auth';
import { writeFileSync, rmSync, existsSync } from 'fs';
import { CONFIG, ERROR_MSG, GLOBAL } from '../../configuration/constants.js';
import { ParsedEnvObject } from '../../configuration/env/types.js';
import { stopAllMidi } from '../../midi/handler.js';
import { toggleRewardsStatus } from '../../twitch/rewards/handler.js';

/**
 * Obtains an execution lock to indicate that the program is open
 * @returns
 */
export function acquireLock(): void {
    // Check if another instance is running.
    // If so, the stored API port will no longer link with the original instance
    if (existsSync(CONFIG.DOT_LOCK)) {
        throw new Error(ERROR_MSG.INSTANCE_ALREADY_RUNNING());
    }

    return writeFileSync(CONFIG.DOT_LOCK, GLOBAL.EMPTY_MESSAGE);
}

/**
 * Deletes the execution lock to indicate that the program has exited
 * @returns
 */
export function releaseLock(): void {
    return rmSync(CONFIG.DOT_LOCK, { force: true });
}

/**
 * Attaches a callback before initialization to exit process signals
 * @param broadcasterAuthProvider Broadcaster auth provider
 * @param env Environment variables
 */
export function attachExitCallbacksBeforeInit(): void {
    // Initialize
    process.removeAllListeners('exit');
    process.removeAllListeners('SIGHUP');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');

    process.on('exit', _onExitProcessBeforeInit());
    process.on('SIGHUP', _onExitProcessBeforeInit());
    process.on('SIGINT', _onExitProcessBeforeInit());
    process.on('uncaughtException', (error) => {
        console.log(error);
        console.log(ERROR_MSG.INIT());
        _onExitProcessBeforeInit()();
    });
}

/**
 * Attaches a callback after initialization to exit process signals
 * @param broadcasterAuthProvider Broadcaster auth provider
 * @param env Environment variables
 */
export function attachExitCallbacksAfterInit(broadcasterAuthProvider: RefreshingAuthProvider, env: ParsedEnvObject): void {
    // Initialize
    process.removeAllListeners('exit');
    process.removeAllListeners('SIGHUP');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');

    process.on('exit', _onExitProcessAfterInit(broadcasterAuthProvider, env));
    process.on('SIGHUP', _onExitProcessAfterInit(broadcasterAuthProvider, env));
    process.on('SIGINT', _onExitProcessAfterInit(broadcasterAuthProvider, env));
    process.on('uncaughtException', _onExitProcessAfterInit(broadcasterAuthProvider, env));
}

/**
 * Disables all rewards (if enabled) and exits. It is used for sudden closes of this application
 * @param broadcasterAuthProvider Broadcaster auth provider
 * @param env Environment variables
 */
function _onExitProcessBeforeInit(): () => void {
    // Before initialization only check lock
    return () => {
        releaseLock();
        process.exit();
    };
}

/**
 * Disables all rewards (if enabled) and exits. It is used for sudden closes of this application
 * @param broadcasterAuthProvider Broadcaster auth provider
 * @param env Environment variables
 */
function _onExitProcessAfterInit(broadcasterAuthProvider: RefreshingAuthProvider, env: ParsedEnvObject): () => Promise<void> {
    // After initialization check everything
    return async () => {
        try {
            stopAllMidi(env.TARGET_MIDI_CHANNEL);
        } catch {
            // Do nothing
        }
        if (env.REWARDS_MODE) {
            await toggleRewardsStatus(broadcasterAuthProvider, env.TARGET_CHANNEL, { isEnabled: false });
        }
        releaseLock();
        process.exit();
    };
}
