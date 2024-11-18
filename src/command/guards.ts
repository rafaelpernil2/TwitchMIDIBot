import { isTimestampExpired } from '../utils/generic.js';
import { CONFIG, ERROR_MSG, PERMISSIONS_DB, SAFE_COMMANDS } from '../configuration/constants.js';
import { ParsedEnvObject } from '../configuration/env/types.js';
import { PermissionsTable, PERMISSIONS_MAP } from '../database/jsondb/types.js';
import { SharedVariable } from '../shared-variable/implementation.js';
import { RequestSource, TwitchParams, UserRoles } from '../twitch/command/types.js';
import { Command } from './types.js';

export const areRequestsOpen = new SharedVariable(false);
export const requestTimeout = new SharedVariable<number>(CONFIG.DEFAULT_REQUEST_TIMEOUT);


const lastRequestTimestampByUserMap = new Map<string, Date>();

/**
 * Checks that the user has enough permissions to execute the command matching permissions.json
 * Throws an error if it does not have enough permissions
 * @param command Request Command
 * @param twitch Twitch Params
 * @param source Request source
 * @param env Environment variables
 * @returns
 */
export function checkCommandAccess(command: Command, { userRoles, user }: TwitchParams, source: RequestSource, env: ParsedEnvObject): void {
    const { blacklist, whitelist, requirements } = _getPermissionsTable(command);

    // Full access: If it is broadcaster, access is allowed
    if (userRoles.isBroadcaster) {
        return;
    }

    _checkBlacklist(blacklist, user);
    _checkWhitelist(whitelist, user);
    _checkRequirements(source, requirements, userRoles, whitelist);

    // If it is not a safe command, check requests open and source (reward/chat)
    if (!SAFE_COMMANDS[command]) {
        // Check if requests are open
        _checkRequestsOpen(userRoles);

        // Restricted access: Active and chat requests
        _checkRequestSource(source, env, userRoles);
    }
}


/**
 * Checks that the user request timeout has expired
 * Throws an error if it does not
 * @param commandList Request Command list
 * @param twitch Twitch Params
 * @param { isMacroMessage } options Checks if it's macro request
 * @returns
 */
export function checkTimeout(commandList: Array<[command: Command | null, args: string, delay: number]>, { user, userRoles }: TwitchParams, { isMacroMessage }: { isMacroMessage: boolean }): void {
    // If it's macro message, provide no command to check
    const [[command]] = isMacroMessage ? [[null]] : commandList;

    // If it is broadcaster, is mod, command is safe or timeout has expired, continue
    if (userRoles.isBroadcaster || userRoles.isMod || command != null && SAFE_COMMANDS[command] || _hasLastRequestByUserExpired(user)) {
        return;
    }

    // If timeout has not expired, throw error
    throw new Error(ERROR_MSG.TIMEOUT_REQUEST());
}

/**
 * Sets last request timeout for user
 * @param user Username
 * @param now Time now
 */
export function setTimeoutToRequest(user: string, now: Date): void {
    lastRequestTimestampByUserMap.set(user, now);
}

/**
 * Deletes last request timeout by user
 * @param user Username
 */
export function removeRequestTimeoutByUser(user: string): void {
    lastRequestTimestampByUserMap.delete(user);
}

/**
 * Checks if the requests are open
 * @param userRoles Roles of user
 * @returns
 */
function _checkRequestsOpen(userRoles: UserRoles): void {
    if (!areRequestsOpen.get() && !userRoles.isMod) {
        throw new Error(ERROR_MSG.BOT_PAUSED_DISCONNECTED());
    }
}

/**
 * Checks the roles of the user to decide whether allow the request or deny it
 * @param source Request source
 * @param requirements Role requirements
 * @param userRoles Roles of user
 * @param whitelist Whitelist
 * @returns
 */
function _checkRequirements(source: RequestSource, requirements: Array<keyof UserRoles>, userRoles: UserRoles, whitelist: string[]): void {
    // If no data, that means everyone is allowed
    // If whitelist is active, do not check requirements. A whitelist implies full access for those users in the list
    // Also, we can't obtain user info from rewards, so they are trusted
    if (requirements == null || requirements.length === 0 || source === RequestSource.REWARD || whitelist.length > 0) {
        return;
    }
    const isValid = requirements.some((requirement) => userRoles[requirement]);
    if (!isValid) {
        throw new Error(ERROR_MSG.BAD_PERMISSIONS());
    }
}

/**
 * Checks if the user is not in the blacklist
 * Otherwise it throws an error
 * @param blacklist Blacklist
 * @param user Twitch username
 * @returns
 */
function _checkBlacklist(blacklist: string[], user: string): void {
    // If no data, that means everyone is allowed
    if (blacklist == null || blacklist.length === 0) {
        return;
    }
    const isInBlacklist = blacklist.indexOf(user) !== -1;
    if (isInBlacklist) {
        throw new Error(ERROR_MSG.BAD_PERMISSIONS());
    }
}

/**
 * Checks if there is a whitelist and if the user is there
 * Otherwise it throws an error
 * @param whitelist Whitelist
 * @param user Twitch username
 * @returns
 */
function _checkWhitelist(whitelist: string[], user: string): void {
    // If no data, that means everyone is allowed
    if (whitelist == null || whitelist.length === 0) {
        return;
    }
    const isInWhitelist = whitelist.indexOf(user) !== -1;
    if (!isInWhitelist) {
        throw new Error(ERROR_MSG.BAD_PERMISSIONS());
    }
}

/**
 * Checks rewardsMode/vipRewardsMode to assess if a command can be executed from the current source
 * @param source Request source
 * @param env Environment variables
 * @param userRoles { isMod, isVip } Twitch user roles
 * @returns
 */
function _checkRequestSource(source: RequestSource, { REWARDS_MODE, VIP_REWARDS_MODE }: ParsedEnvObject, { isMod, isVip }: UserRoles): void {
    if (source === RequestSource.CHAT && REWARDS_MODE && !isMod && (!isVip || !VIP_REWARDS_MODE)) {
        throw new Error(ERROR_MSG.BAD_PERMISSIONS());
    }
}

/**
 * Loads the permissions table
 * @param command Request command
 * @returns Table with permissions
 */
function _getPermissionsTable(command: Command): PermissionsTable {
    const permissionTable = PERMISSIONS_DB.select(PERMISSIONS_MAP, command);
    if (permissionTable == null) {
        throw new Error(ERROR_MSG.BAD_PERMISSIONS());
    }
    return permissionTable;
}


/**
 * Has last request expired checking with timeout
 * @param requesterUser
 * @returns
 */
function _hasLastRequestByUserExpired(requesterUser: string): boolean {
    const lastTimestampByUser = lastRequestTimestampByUserMap.get(requesterUser);

    // If there is no last request, it has expired and another can be requested
    if (lastTimestampByUser == null) {
        return true;
    }

    return isTimestampExpired(lastTimestampByUser, new Date(), requestTimeout.get());
}