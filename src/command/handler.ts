import { ALIASES_DB, COMMAND_DESCRIPTIONS, CONFIG, ERROR_MSG, EVENT, EVENT_EMITTER, GLOBAL, PERMISSIONS_DB, REWARDS_DB, TOGGLE_MIDI_VALUES } from '../configuration/constants.js';
import { enqueue, getCurrentRequestPlaying, getRequestQueue, createAutomaticClockSyncedQueue, clearAllQueues, requestTimeout } from './queue.js';
import { isValidCommand, deAliasCommand, splitCommandArguments } from './utils.js';
import { CommandParams } from '../twitch/command/types.js';
import { removeDuplicates } from '../utils/generic.js';
import {
    checkMIDIConnection,
    connectMIDI,
    disconnectMIDI,
    triggerCCCommandList,
    stopAllMidi,
    triggerClock,
    triggerNoteList,
    setMIDIVolume,
    autoStartClock
} from '../midi/handler.js';
import { CCCommand, Command } from './types.js';
import harmonics from 'harmonics';
const { inlineChord } = harmonics;
import { CC_COMMANDS_KEY, CC_CONTROLLERS_KEY, CHORD_PROGRESSIONS_KEY, PERMISSIONS_MAP, PermissionsTable } from '../database/jsondb/types.js';
import { ChatClient } from '@twurple/chat';
import { areRequestsOpen } from './guards.js';
import i18n from '../i18n/loader.js';
import { createRewards, toggleRewardsStatus, reloadRewards } from '../twitch/rewards/handler.js';
import { sayTwitchChatMessage } from '../twitch/chat/handler.js';
import { ResponseStatus } from '../types/generic.js';

/**
 * Shows all available commands and explains how to use them
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function midihelp(...[message, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    const [commandToTest] = splitCommandArguments(message);
    if (isValidCommand(commandToTest)) {
        sayTwitchChatMessage(chatClient, channel, [`${i18n.t('MIDIHELP_VALID')} !${commandToTest}: `, COMMAND_DESCRIPTIONS[deAliasCommand(commandToTest)]()], { silenceMessages });
    } else {
        sayTwitchChatMessage(chatClient, channel, [i18n.t('MIDIHELP_INVALID') + ' ', Object.values(Command).join(GLOBAL.COMMA_JOIN)], { silenceMessages });
    }
}

/**
 * Initializes MIDI connectivity and allows the bot to work
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export async function midion(...[, { targetMIDIName, targetMIDIChannel, isRewardsMode }, { chatClient, authProvider, channel, targetChannel }]: CommandParams): Promise<void> {
    try {
        await connectMIDI(targetMIDIName, targetMIDIChannel);
        if (isRewardsMode) {
            sayTwitchChatMessage(chatClient, channel, [, i18n.t('MIDION_REWARDS')]);
            await createRewards(authProvider, targetChannel);
            await toggleRewardsStatus(authProvider, targetChannel, { isEnabled: true });
        }
        EVENT_EMITTER.removeAllListeners(EVENT.PLAYING_NOW);
        EVENT_EMITTER.on(EVENT.PLAYING_NOW, _onPlayingNowChange(chatClient, channel));
        areRequestsOpen.set(true);
        console.log(i18n.t('MIDION_LOG_ENABLED'));
    } catch {
        const error = new Error(ERROR_MSG.MIDI_CONNECTION_ERROR());
        console.log(String(error));
        throw error;
    }
    sayTwitchChatMessage(chatClient, channel, [, `${i18n.t('MIDION_ENABLED')} ${CONFIG.OP_SIGNATURE}`]);
}

/**
 * Disables MIDI connectivity and stops all MIDI
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export async function midioff(...[, { targetMIDIChannel, isRewardsMode }, { chatClient, authProvider, channel, targetChannel }]: CommandParams): Promise<void> {
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('MIDIOFF_INIT')]);
    try {
        await disconnectMIDI(targetMIDIChannel);
        if (isRewardsMode) {
            sayTwitchChatMessage(chatClient, channel, [, i18n.t('MIDIOFF_REWARDS')]);
            await toggleRewardsStatus(authProvider, targetChannel, { isEnabled: false });
        }
        EVENT_EMITTER.removeAllListeners(EVENT.PLAYING_NOW);
        areRequestsOpen.set(false);
        console.log(i18n.t('MIDIOFF_LOG_DISABLED'));
    } catch {
        const error = new Error(ERROR_MSG.MIDI_DISCONNECTION_ERROR());
        console.log(String(error));
        throw error;
    }
    sayTwitchChatMessage(chatClient, channel, [, `${i18n.t('MIDIOFF_DISABLED')} ${CONFIG.OP_SIGNATURE}`]);
}

/**
 * Pauses TwitchMIDI to stop users from requesting
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function midipause(...[, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    areRequestsOpen.set(false);
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('MIDIPAUSE')], { silenceMessages });
}

/**
 * Resumes TwitchMIDI to allow users to request again
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function midiresume(...[, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    areRequestsOpen.set(true);
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('MIDIRESUME')], { silenceMessages });
}
/**
 * Saves a chord progresion with an alias to be used later
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export async function addchord(...[message, { silenceMessages, allowCustomTimeSignature }, { chatClient, channel }]: CommandParams): Promise<void> {
    _checkMessageNotEmpty(message);
    const [alias, ...chordProgressionTokens] = message.split(GLOBAL.SLASH_SEPARATOR).map((str) => str.trim());

    // If the alias contains brackets, the requests is in wrong order
    if (alias.indexOf(GLOBAL.OPEN_SQUARE_BRACKETS) !== -1) {
        throw new Error(ERROR_MSG.CHORD_PROGRESSION_BAD_INSERTION());
    }

    const chordProgression = chordProgressionTokens.join(GLOBAL.SLASH_SEPARATOR);

    // Validate chord progression
    _parseChordProgressionList(chordProgression, { allowCustomTimeSignature });

    const insertStatus = ALIASES_DB.insert(CHORD_PROGRESSIONS_KEY, alias.toLowerCase(), chordProgression);
    if (insertStatus === ResponseStatus.Error) {
        throw new Error(ERROR_MSG.CHORD_PROGRESSION_BAD_INSERTION());
    }
    await ALIASES_DB.commit();
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('ADDCHORD')], { silenceMessages });
}

/**
 * Removes a chord progression saved with an alias
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export async function removechord(...[message, { silenceMessages }, { chatClient, channel }]: CommandParams): Promise<void> {
    _checkMessageNotEmpty(message);
    const parsedAlias = message.toLowerCase();
    const status = ALIASES_DB.delete(CHORD_PROGRESSIONS_KEY, parsedAlias);
    if (status === ResponseStatus.Error) {
        throw new Error(ERROR_MSG.CHORD_PROGRESSION_NOT_FOUND());
    }
    await ALIASES_DB.commit();
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('REMOVECHORD')], { silenceMessages });
}

/**
 * Obtains the list of chord progressions saved and returns it
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function chordlist(...[message, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    // Case with alias to lookup
    const aliasToLookup = message.toLowerCase();
    const chordProgression = ALIASES_DB.select(CHORD_PROGRESSIONS_KEY, message);
    if (aliasToLookup !== GLOBAL.EMPTY_MESSAGE && chordProgression != null) {
        sayTwitchChatMessage(chatClient, channel, [, `🎵${aliasToLookup}🎵:🎼${chordProgression}🎼`], { silenceMessages });
        return;
    }
    // Default case showing all
    const chordProgressionList = Object.entries(ALIASES_DB.value?.chordProgressions ?? {});
    if (chordProgressionList.length === 0) return;
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('CHORDLIST_DEFAULT')], { silenceMessages });
    for (const [alias, chordProgression] of chordProgressionList) {
        sayTwitchChatMessage(chatClient, channel, [`🎵${alias}🎵:🎼`, chordProgression, '🎼'], { silenceMessages });
    }
}

/**
 * Sends a set of MIDI notes separated by spaces or a melody separated by commas
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export async function sendnote(...[message, { targetMIDIChannel, silenceMessages }, { chatClient, channel }]: CommandParams): Promise<void> {
    _checkMessageNotEmpty(message);
    checkMIDIConnection();
    const requestList = message.split(GLOBAL.COMMA_SEPARATOR).map((request) => _getNoteList(request));
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('SENDNOTE')], { silenceMessages });
    for (const request of requestList) {
        await triggerNoteList(request, targetMIDIChannel);
    }
}

/**
 * Parses and sends a chord progression with chords separated by space or with an alias
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function sendchord(
    ...[message, { targetMIDIChannel, silenceMessages, allowCustomTimeSignature, timeSignatureCC }, { chatClient, channel, user, userRoles }]: CommandParams
): void {
    _checkMessageNotEmpty(message);
    checkMIDIConnection();
    // Lookup previously saved chord progressions
    const data = _getChordProgression(message, { allowCustomTimeSignature });
    enqueue(message, data, user, userRoles, Command.sendchord);
    autoStartClock(targetMIDIChannel);
    createAutomaticClockSyncedQueue(targetMIDIChannel, timeSignatureCC, { allowCustomTimeSignature });
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('SENDCHORD')], { silenceMessages });
}

/**
 * Parses and sends a chord progression as a loop with chords separated by space or with an alias
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function sendloop(
    ...[message, { targetMIDIChannel, silenceMessages, allowCustomTimeSignature, timeSignatureCC }, { chatClient, channel, user, userRoles }]: CommandParams
): void {
    _checkMessageNotEmpty(message);
    checkMIDIConnection();
    // Queue chord progression petition
    const data = _getChordProgression(message, { allowCustomTimeSignature });
    enqueue(message, data, user, userRoles, Command.sendloop);
    autoStartClock(targetMIDIChannel);
    createAutomaticClockSyncedQueue(targetMIDIChannel, timeSignatureCC, { allowCustomTimeSignature });
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('SENDLOOP')], { silenceMessages });
}

/**
 * Sends a particular CC Message, a list of CC messages separated by comma or a set of commands using an alias
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function sendcc(...[message, { targetMIDIChannel, silenceMessages }, { chatClient, channel }]: CommandParams): void {
    _checkMessageNotEmpty(message);
    checkMIDIConnection();
    const ccCommandList = _getCCCommandList(message);

    triggerCCCommandList(ccCommandList, targetMIDIChannel);

    const controllerList = removeDuplicates(ccCommandList.map(([controller]) => controller)).join(GLOBAL.COMMA_JOIN);
    sayTwitchChatMessage(chatClient, channel, [, `${i18n.t('SENDCC_1')}${controllerList}${i18n.t('SENDCC_2')}`], { silenceMessages });
}

/**
 * Shows the current chord progression or loop request being played
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function midicurrentrequest(...[, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    const currentRequestPlaying = getCurrentRequestPlaying();
    if (currentRequestPlaying == null) {
        sayTwitchChatMessage(chatClient, channel, [, i18n.t('MIDICURRENTREQUEST_NOTHING')], { silenceMessages });
        return;
    }
    sayTwitchChatMessage(chatClient, channel, _buildPlayingNowMessage(currentRequestPlaying.type, currentRequestPlaying.request), { silenceMessages });
}

/**
 * Shows the current chord progression or loop request queue
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function midirequestqueue(...[, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    const requestList = getRequestQueue()
        .map(([type, request]) => `!${type} "${request}"`)
        .join(GLOBAL.COMMA_JOIN);
    sayTwitchChatMessage(chatClient, channel, [i18n.t('MIDIREQUESTQUEUE_OK') + ': ', requestList.length === 0 ? i18n.t('MIDIREQUESTQUEUE_EMPTY') : requestList], {
        silenceMessages
    });
}

/**
 * Obtains the list of Control Change (CC) actions saved and returns it
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function cclist(...[, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    const commands = Object.keys(ALIASES_DB.value?.ccCommands ?? {});
    if (commands.length === 0) return;
    sayTwitchChatMessage(chatClient, channel, [i18n.t('CCLIST') + ': ', commands.join(GLOBAL.COMMA_JOIN)], { silenceMessages });
}

/**
 * Sets the MIDI velocity (volume) for the chord progression/loop/note
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function midivolume(...[message, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    const value = parseInt(splitCommandArguments(message)[0]);
    // Convert to range 0-127
    setMIDIVolume(value);
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('MIDIVOLUME') + ' ' + String(value) + '%'], { silenceMessages });
    if (value === 69) {
        sayTwitchChatMessage(chatClient, channel, [, i18n.t('EASTEREGG_69')], { silenceMessages });
    }
}

/**
 * Stops the MIDI loop on the next beat
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function stoploop(...[, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    clearAllQueues();
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('STOPLOOP')], { silenceMessages });
}

/**
 * Stops sound, MIDI clock and MIDI loop
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function fullstopmidi(...[, { targetMIDIChannel, silenceMessages }, { chatClient, channel }]: CommandParams): void {
    stopAllMidi(targetMIDIChannel);
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('FULLSTOPMIDI')], { silenceMessages });
}

/**
 * Sets a partitular tempo and starts playing
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function settempo(...[message, { targetMIDIChannel, silenceMessages }, { chatClient, channel }]: CommandParams): void {
    const newTempo = Number(splitCommandArguments(message)[0]);
    // Generates a MIDI clock
    triggerClock(targetMIDIChannel, newTempo);

    sayTwitchChatMessage(chatClient, channel, [, i18n.t('SETTEMPO') + ' ' + String(newTempo)], { silenceMessages });
    if (Math.floor(newTempo) === 69) {
        sayTwitchChatMessage(chatClient, channel, [, i18n.t('EASTEREGG_69')], { silenceMessages });
    }
}

/**
 * Syncrhonizes the MIDI clock and the beat. Useful when the instruments are out-of-sync
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function syncmidi(...[, { targetMIDIChannel, silenceMessages }, { chatClient, channel }]: CommandParams): void {
    triggerClock(targetMIDIChannel);
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('SYNCMIDI')], { silenceMessages });
}

/**
 * Fetches data from the alias and rewards database, refreshing the copy in memory
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export async function fetchdb(...[, { silenceMessages, isRewardsMode }, { chatClient, channel, authProvider, targetChannel }]: CommandParams): Promise<void> {
    await ALIASES_DB.fetchDB();
    await REWARDS_DB.fetchDB();
    await PERMISSIONS_DB.fetchDB();
    if (isRewardsMode) {
        await reloadRewards(authProvider, targetChannel);
    }
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('FETCHDB')], { silenceMessages });
}

/**
 * Bans a user from using TwitchMIDI
 * @param commandParams [message, // Command arguments
 *         common: { silenceMessages }, // Configuration parameters
 *         twitch: { chatClient, channel } // Twitch chat and user data
 *         ]
 */
export async function midibanuser(...[message, { silenceMessages }, { chatClient, channel }]: CommandParams): Promise<void> {
    const [userToBanRaw, ...rest] = splitCommandArguments(message);

    if (userToBanRaw == null || rest.length > 0) {
        throw new Error(ERROR_MSG.INVALID_BAN_USER());
    }

    const userToBan = userToBanRaw.toLowerCase();
    const currentPermissionMap = PERMISSIONS_DB.selectAll(PERMISSIONS_MAP);

    if (currentPermissionMap == null) {
        throw new Error(ERROR_MSG.RUNTIME_PERMISSIONS());
    }

    // Ban access to all commands
    const targetPermissionMap = {} as Record<Command, PermissionsTable>;
    const commandList = Object.values(Command);
    for (const command of commandList) {
        // If command permissions do not exist, skip (this should not happen)
        const permissions = currentPermissionMap[command];
        if (permissions == null) continue;

        const commandPermissions = {
            ...permissions,
            blacklist: removeDuplicates([...permissions.blacklist, userToBan])
        };

        targetPermissionMap[command] = commandPermissions;
    }
    PERMISSIONS_DB.upsert(PERMISSIONS_MAP, { ...currentPermissionMap, ...targetPermissionMap });

    await PERMISSIONS_DB.commit();

    sayTwitchChatMessage(chatClient, channel, [userToBan + '\t', i18n.t('MIDIBANUSER_OK')], { silenceMessages });
}

/**
 * Unbans a previously banned user from using TwitchMIDI
 * @param commandParams [message, // Command arguments
 *         common: { silenceMessages }, // Configuration parameters
 *         twitch: { chatClient, channel } // Twitch chat and user data
 *         ]
 */
export async function midiunbanuser(...[message, { silenceMessages }, { chatClient, channel }]: CommandParams): Promise<void> {
    const [userToUnbanRaw, ...rest] = splitCommandArguments(message);

    if (userToUnbanRaw == null || rest.length > 0) {
        throw new Error(ERROR_MSG.INVALID_UNBAN_USER());
    }

    const userToUnban = userToUnbanRaw.toLowerCase();
    const currentPermissionMap = PERMISSIONS_DB.selectAll(PERMISSIONS_MAP);

    if (currentPermissionMap == null) {
        throw new Error(ERROR_MSG.RUNTIME_PERMISSIONS());
    }

    // Unban access to all commands
    const targetPermissionMap = {} as Record<Command, PermissionsTable>;
    const commandList = Object.values(Command);
    for (const command of commandList) {
        // If command permissions do not exist, skip (this should not happen)
        const permissions = currentPermissionMap[command];
        if (permissions == null) continue;

        const commandPermissions = {
            ...permissions,
            blacklist: permissions.blacklist.filter((user) => user !== userToUnban)
        };

        targetPermissionMap[command] = commandPermissions;
    }
    PERMISSIONS_DB.upsert(PERMISSIONS_MAP, { ...currentPermissionMap, ...targetPermissionMap });

    await PERMISSIONS_DB.commit();

    sayTwitchChatMessage(chatClient, channel, [userToUnban + '\t', i18n.t('MIDIUNBANUSER_OK')], { silenceMessages });
}

/**
 * Sets the timeout between requests per users in seconds
 * @param commandParams [message, // Command arguments
 *         common: { targetMIDIName, targetMIDIChannel }, // Configuration parameters
 *         twitch: { chatClient, channel, user, userRoles } // Twitch chat and user data
 *         ]
 */
export function miditimeout(...[message, { silenceMessages }, { chatClient, channel }]: CommandParams): void {
    const newTimeout = Number(splitCommandArguments(message)[0]);
    if (isNaN(newTimeout) || newTimeout < CONFIG.MIN_TIMEOUT || newTimeout > CONFIG.MAX_TIMEOUT) {
        throw new Error(ERROR_MSG.INVALID_TIMEOUT());
    }
    requestTimeout.set(newTimeout);
    sayTwitchChatMessage(chatClient, channel, [, i18n.t('MIDITIMEOUT_1') + ' ' + String(newTimeout) + i18n.t('MIDITIMEOUT_2')], { silenceMessages });
}

/**
 * PRIVATE METHODS
 *
 */

/**
 * Processes a list of notes
 * @param message
 * @returns
 */
function _getNoteList(message: string): Array<[note: string, timeSubDivision: number]> {
    const noteList = splitCommandArguments(message);
    return noteList.map(_parseNote);
}

/**
 * Looks up a chord progression/loop or returns the original message if not found
 * @param message Command arguments (alias or chord progression)
 * @param options { allowCustomTimeSignature }: { allowCustomTimeSignature: boolean }
 * @returns Chord progression
 */
function _getChordProgression(
    message: string,
    { allowCustomTimeSignature }: { allowCustomTimeSignature: boolean }
): Array<[timeSignature: [noteCount: number, noteValue: number], chordProgression: Array<[noteList: string[], timeSubDivision: number]>]> {
    const aliasToLookup = message.toLowerCase();
    const chordProgression = ALIASES_DB.select(CHORD_PROGRESSIONS_KEY, aliasToLookup) ?? message;
    // Check everything is okay
    return _parseChordProgressionList(chordProgression, { allowCustomTimeSignature });
}

/**
 * Retrieves a set of CC commands saved for an alias or splits the one sent
 * @param message Alias or CC commands
 * @return List of parsed CC Commands
 */
function _getCCCommandList(message: string): CCCommand[] {
    const aliasToLookup = message.toLowerCase();
    const ccCommandList = ALIASES_DB.select(CC_COMMANDS_KEY, aliasToLookup) ?? message.split(GLOBAL.COMMA_SEPARATOR);
    if (ccCommandList.length < 1) {
        throw new Error(ERROR_MSG.BAD_MIDI_MESSAGE());
    }

    const rawCCCommandList = ccCommandList.map(_parseCCCommand);
    return _parseCCCommandList(rawCCCommandList);
}

/**
 * Splits a token into content and time part between parenthesis
 * @param message
 * @returns
 */
function _splitTokenTime(message: string): [token: string, timeDivision: number] {
    const [token, openParenthesisContent = GLOBAL.EMPTY_MESSAGE] = message.split(GLOBAL.OPEN_PARENTHESIS_SEPARATOR);
    const [timeDivision] = openParenthesisContent.split(GLOBAL.CLOSE_PARENTHESIS_SEPARATOR);
    return [token, Number(timeDivision)];
}

/**
 * Parses a note that may or may not contain a MIDI octave at the end
 * @param note Note to parse
 * @returns Valid MIDI note
 */
function _parseNote(note: string): [note: string, timeSubDivision: number] {
    const [preparedNote, timeSubDivision] = _splitTokenTime(note);

    // Prepare and check timeSubDivision
    // Since it is a melody, notes should last a quarter note by default
    const parsedTimeDivision = timeSubDivision === 0 ? 1 : timeSubDivision;

    // If it is a rest, do not parse note
    if (preparedNote.toLowerCase() === GLOBAL.MUSIC_REST_TOKEN) {
        return [GLOBAL.MUSIC_REST_TOKEN, parsedTimeDivision];
    }

    // Prepare and check note
    const lastChar = preparedNote.charAt(preparedNote.length - 1);
    const octave = isNaN(Number(lastChar)) ? CONFIG.DEFAULT_OCTAVE : '';
    const parsedNote = preparedNote + octave;

    if (!_isValidAndBounded(parsedNote, 1)) {
        throw new Error(ERROR_MSG.BAD_MIDI_NOTE());
    }

    // Return
    return [parsedNote, parsedTimeDivision];
}

/**
 * Parses a chord and converts it to "harmonics" module syntax
 * @param chord Chord to parse
 * @returns Parsed chord
 */
function _parseChord(chord: string): string {
    const [parsedChord] = _splitTokenTime(chord);
    if (parsedChord.length === 0) return '';

    // If only a note is provided, it will be transformed into a major chord (e.g CM, EbM...)
    if (_isValidAndBounded(parsedChord, 0)) return parsedChord + 'M';

    // If "min" is used to represent a minor chord, it will be converted to harmonics syntax "m"
    if (parsedChord.includes('min')) {
        const [pre, post] = parsedChord.split('min');
        return pre + 'm' + post;
    }

    // If a 9, 7, 6, 5 or 4 chord is provided but without "th", it will be converted to harmonics syntax "th"
    if (['9', '7', '6', '5', '4'].includes(parsedChord.slice(-1)) && _isValidAndBounded(parsedChord, 1)) return parsedChord + 'th';

    // If a 13 or 11 chord is provided but without "th", it will be converted to harmonics syntax "th"
    if (['13', '11'].includes(parsedChord.slice(-2)) && _isValidAndBounded(parsedChord, 2)) return parsedChord + 'th';

    // Default
    return parsedChord;
}

/**
 * Checks if chord notation contains a valid note + an expected amount of extra characters
 * @param chord Chord to check
 * @param extraChars Amount of extra characters
 * @returns If chord is bounded
 */
function _isValidAndBounded(chord: string, extraChars: number): boolean {
    const maxLength = 2 + extraChars;
    return chord.length === maxLength - 1 || (chord.length === maxLength && (chord.includes('b') || chord.includes('#')));
}

/**
 * Validates a chord progression string with time signature
 * @param chordProgression Chord progression separated by spaces
 * @param options { allowCustomTimeSignature }: { allowCustomTimeSignature: boolean }
 * @return List of notes to play with their respective release times
 */
function _parseChordProgressionList(
    chordProgression: string,
    { allowCustomTimeSignature }: { allowCustomTimeSignature: boolean }
): Array<[timeSignature: [noteCount: number, noteValue: number], chordProgression: Array<[noteList: string[], timeSubDivision: number]>]> {
    const timeSignedRequestList = chordProgression
        .trim()
        .split(GLOBAL.OPEN_SQUARE_BRACKETS)
        .filter((value) => value !== GLOBAL.EMPTY_MESSAGE)
        .map((value) => value.trim());

    return timeSignedRequestList.map((chordProgression) => _parseChordProgression(chordProgression, { allowCustomTimeSignature }));
}

/**
 * Validates a chord progression string
 * @param chordProgression Chord progression separated by spaces
 * @param options { allowCustomTimeSignature }: { allowCustomTimeSignature: boolean }
 * @return List of notes to play with their respective release times
 */
function _parseChordProgression(
    chordProgression: string,
    { allowCustomTimeSignature }: { allowCustomTimeSignature: boolean }
): [timeSignature: [noteCount: number, noteValue: number], chordProgression: Array<[noteList: string[], timeSubDivision: number]>] {
    const [firstToken, ...restOfTokens] = splitCommandArguments(chordProgression);
    const chordProgressionList = restOfTokens;

    let finalTimeSignature: [noteCount: number, noteValue: number] = [CONFIG.DEFAULT_NOTE_COUNT, CONFIG.DEFAULT_NOTE_VALUE]; // Set default time signature
    // Check if time signature is provided in request
    if (firstToken.endsWith(GLOBAL.CLOSE_SQUARE_BRACKETS)) {
        const timeSignatureRaw = firstToken.slice(0, -1); // Remove brackets

        const [noteCount, noteValue, ...rest] = timeSignatureRaw.split(GLOBAL.SLASH_SEPARATOR).map((str) => parseInt(str.trim()));

        if (
            allowCustomTimeSignature &&
            (isNaN(noteCount) ||
                isNaN(noteValue) ||
                rest.length ||
                CONFIG.VALID_MEASURE.every((validMeasure) => noteValue !== validMeasure) ||
                noteCount > noteValue * CONFIG.MAX_MEASURE_MULTIPLIER)
        ) {
            throw new Error(ERROR_MSG.INVALID_TIMESIGNATURE());
        }
        finalTimeSignature = allowCustomTimeSignature ? [noteCount, noteValue] : finalTimeSignature;
    } else {
        // It does not have a time signature, so the first token is valid
        chordProgressionList.unshift(firstToken);
    }

    // If no chord progression
    if (!restOfTokens.length) {
        throw new Error(ERROR_MSG.INVALID_CHORD(`""`));
    }

    return [
        finalTimeSignature,
        chordProgressionList.map((chord) => {
            try {
                const [chordPart, timeSubDivision] = _splitTokenTime(chord);
                // If it is a rest, do not parse chord
                if (chordPart.toLowerCase() === GLOBAL.MUSIC_REST_TOKEN) return [[GLOBAL.MUSIC_REST_TOKEN], timeSubDivision];

                return [inlineChord(_parseChord(chordPart)), timeSubDivision];
            } catch {
                throw new Error(ERROR_MSG.INVALID_CHORD(chord));
            }
        })
    ];
}

/**
 * Validates a control change message and parses it into a tuple with [controller, value, time]
 * If the validation fails, it throws an error
 * @param ccCommand CC command to parse
 * @returns Parsed command
 */
function _parseCCCommand(ccCommand: string): [controller: number, value: number, time: number] {
    const [rawController, rawValue] = ccCommand.toLowerCase().trim().split(GLOBAL.SPACE_SEPARATOR);
    // If rawValue is null, the command is invalid
    if (rawValue == null) {
        throw new Error(ERROR_MSG.BAD_CC_MESSAGE());
    }

    // Controller
    const parsedController = ALIASES_DB.select(CC_CONTROLLERS_KEY, rawController) ?? rawController.replace(GLOBAL.CC_CONTROLLER, '');
    const controller = _parseMIDIValue(parsedController);

    // Value and Time
    const [ccValue, time] = _splitTokenTime(rawValue);
    const parsedValue = TOGGLE_MIDI_VALUES[ccValue] ?? ccValue; // Parse toggle values (on/off)
    const value = _parseMIDIValue(parsedValue);

    return [controller, value, time];
}

/**
 * Parses a list of CC commands adding the missing delays for non-sweep commands
 * @param rawCCCommandList List of CC commands
 * @return List of processed CC commands
 */
function _parseCCCommandList(rawCCCommandList: CCCommand[]): CCCommand[] {
    let lastDelay = 0;
    return rawCCCommandList.map((command) => {
        const [controller, value, time] = command;
        lastDelay = lastDelay < time ? time : lastDelay;
        return [controller, value, lastDelay];
    });
}

/**
 * Validates a MIDI message value (0-127)
 * Throws an error if the value is invalid
 * @param midiValue Possible MIDI value
 * @returns
 */
function _parseMIDIValue(midiValue: string | number): number {
    const parsedValue = Number(midiValue);
    if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 127) {
        throw new Error(ERROR_MSG.BAD_MIDI_MESSAGE() + ': ' + String(midiValue));
    }
    return parsedValue;
}

/**
 * A closure that informs of the current loop or chord progression playing via Twitch chat
 * @param chatClient Twitch ChatClient
 * @param channel Twitch Channel
 * @returns An event handler
 */
function _onPlayingNowChange(chatClient: ChatClient, channel: string): (type: Command, request: string) => void {
    return (type, request) => sayTwitchChatMessage(chatClient, channel, _buildPlayingNowMessage(type, request), { silenceMessages: false });
}

/**
 * Creates a message to show the request being played right now
 * @param type
 * @param request
 * @returns A message splitted in leading and content parts
 */
function _buildPlayingNowMessage(type: Command, request: string): [leading: string, content: string] {
    return [`${i18n.t('MIDICURRENTREQUEST_OK')} !${type} `, `"${request}"`];
}

/**
 * Checks if the message provided as command arguments is empty and throws an error in that case
 * @param message Command arguments
 */
function _checkMessageNotEmpty(message: string): void {
    if (message === GLOBAL.EMPTY_MESSAGE) {
        throw new Error(ERROR_MSG.COMMAND_MESSAGE_EMPTY());
    }
}
