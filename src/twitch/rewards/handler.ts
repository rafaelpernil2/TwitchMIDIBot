import { ChatClient } from '@twurple/chat';
import { PubSubClient, PubSubRedemptionMessage } from '@twurple/pubsub';
import { getCommandList } from '../../command/utils.js';
import { REWARDS_DB, ERROR_MSG, CONFIG, GLOBAL } from '../../configuration/constants.js';
import { ParsedEnvObject } from '../../configuration/env/types.js';
import { REWARD_TITLE_COMMAND } from '../../database/jsondb/types.js';
import { onMessageHandlerClosure } from '../command/handler.js';
import { RequestSource, MessageHandler } from '../command/types.js';
import { ApiClient, HelixCustomRewardRedemptionTargetStatus, HelixUser } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { getCommand } from '../../command/utils.js';

let broadcasterId: HelixUser['id'];
let apiClient: ApiClient;

let areRewardsOn = false;

/**
 * Initializes Rewards mode
 * @param broadcasterAuthProvider Broadcaster auth provider
 * @param chatClient Chat client
 * @param env Environment variables
 */
export async function initializeRewardsMode(broadcasterAuthProvider: RefreshingAuthProvider, chatClient: ChatClient, env: ParsedEnvObject): Promise<void> {
    // If rewards mode is not enabled, exit
    if (!env.REWARDS_MODE) return;

    // First, let's disable the rewards
    await toggleRewardsStatus(broadcasterAuthProvider, env.TARGET_CHANNEL, { isEnabled: false });

    // Now let's add an onRedemption listener for the rewards
    const pubSubClient = new PubSubClient({ authProvider: broadcasterAuthProvider });
    const broadcasterUserId = await getBroadcasterId(broadcasterAuthProvider, env.TARGET_CHANNEL);

    pubSubClient.onRedemption(broadcasterUserId, async ({ id: redemptionId, rewardId, rewardTitle, message: args, userName }: PubSubRedemptionMessage) => {
        // Look up the command
        const [command] = REWARDS_DB.select(REWARD_TITLE_COMMAND, rewardTitle) ?? [];

        // For rewards that are not part of this plugin
        if (!command) return;

        const [, commandList] = getCommandList(command);

        // Invalid configuration
        if (commandList.length === 0) {
            console.log(ERROR_MSG.INVALID_REWARD());
            return;
        }

        const callCommand = onMessageHandlerClosure(broadcasterAuthProvider, chatClient, env, RequestSource.REWARD);
        await _callCommandByRedeemption(callCommand, broadcasterAuthProvider, { env, args, command }, { redemptionId, userName, rewardId });
    });
}

/**
 * Calls a command and manages the status of the redemption depending on the output
 * @param callCommand MessageHandler
 * @param authProvider Broadcaster authentication provider
 * @param { env, args, command } commandData Environment variables and command data
 * @param { redemptionId, rewardId, userName } rewardData Reward redemption data
 */
async function _callCommandByRedeemption(
    callCommand: MessageHandler,
    authProvider: RefreshingAuthProvider,
    { env, args, command }: { env: ParsedEnvObject; args: string; command: string },
    { redemptionId, rewardId, userName }: { redemptionId: string; rewardId: string; userName: string }
): Promise<void> {
    try {
        // In case the method does not end or error in X seconds, it is considered fulfilled
        // For example, !sendloop request do not resolve until another request comes along
        setTimeout(() => updateRedeemIdStatus(authProvider, env.TARGET_CHANNEL, { rewardId, redemptionId, status: 'FULFILLED' }), CONFIG.FULFILL_TIMEOUT_MS);
        // Execute command and mark as fulfilled once finished
        await callCommand(`${GLOBAL.POUND}${env.TARGET_CHANNEL}`, userName, `${command} ${args}`);
        await updateRedeemIdStatus(authProvider, env.TARGET_CHANNEL, { rewardId, redemptionId, status: 'FULFILLED' });
    } catch {
        // Cancel redemption if any error occurs
        await updateRedeemIdStatus(authProvider, env.TARGET_CHANNEL, { rewardId, redemptionId, status: 'CANCELED' });
    }
}

/**
 * Creates a set of rewards with the content provided in rewards file
 * @param authProvider Authentication Provider
 * @param username Broadcaster username
 */
export async function createRewards(authProvider: RefreshingAuthProvider, username: string): Promise<void> {
    const apiClient = getApiClient(authProvider);
    const userId = await getBroadcasterId(authProvider, username);

    const rewardEntries = Object.entries(REWARDS_DB.selectAll(REWARD_TITLE_COMMAND) ?? {});
    const createPromiseMap = rewardEntries.map(([title, [command, cost]]) => {
        const [parsedCommand] = getCommand(command);
        const userInputRequired = parsedCommand != null; // Single commands require user input while macros do not

        return apiClient.channelPoints.createCustomReward(userId, { title, cost, userInputRequired, autoFulfill: false });
    });
    try {
        await Promise.allSettled(createPromiseMap);
    } catch {
        // Implement if needed
    }
}

/**
 * Enables/disables the rewards created by this tool
 * @param authProvider Authentication provider
 * @param username Broadcaster username
 * @param { isEnabled } optionData Boolean to activate/deactivate rewards
 */
export async function toggleRewardsStatus(authProvider: RefreshingAuthProvider, username: string, { isEnabled }: { isEnabled: boolean }): Promise<void> {
    const apiClient = getApiClient(authProvider);
    const userId = await getBroadcasterId(authProvider, username);
    const allRewards = await apiClient.channelPoints.getCustomRewards(userId, true);

    // Only treat our rewards
    const validRewards = isEnabled ? allRewards.filter(({ title }) => REWARDS_DB.select(REWARD_TITLE_COMMAND, title) != null) : allRewards;
    const updatePromiseMap = validRewards.map((reward) => {
        const [command = '', cost] = REWARDS_DB.select(REWARD_TITLE_COMMAND, reward.title) ?? [];

        // Re-check if it is a macro command
        const [parsedCommand] = getCommand(command);
        const userInputRequired = parsedCommand != null; // Single commands require user input while macros do not

        return apiClient.channelPoints.updateCustomReward(userId, reward.id, { ...reward, userInputRequired, isEnabled, cost });
    });
    try {
        await Promise.all(updatePromiseMap);
    } catch {
        // Implement if needed
    }
    areRewardsOn = isEnabled;
}

/**
 * Updates the status of a reward redemption
 * @param authProvider Authentication provider
 * @param username Broadcaster username
 * @param { rewardId, redemptionId, status } redemptionData Information about the redemption and new status
 */
export async function updateRedeemIdStatus(
    authProvider: RefreshingAuthProvider,
    username: string,
    { rewardId, redemptionId, status }: { rewardId: string; redemptionId: string; status: HelixCustomRewardRedemptionTargetStatus }
): Promise<void> {
    const apiClient = getApiClient(authProvider);
    const userId = await getBroadcasterId(authProvider, username);
    try {
        await apiClient.channelPoints.updateRedemptionStatusByIds(userId, rewardId, [redemptionId], status);
    } catch {
        // Implement if needed
    }
}

/**
 * Creates or returns the created ApiClient to interact with TwitchAPI
 * @param authProvider Authentication provider
 * @returns ApiClient
 */
export function getApiClient(authProvider: RefreshingAuthProvider): ApiClient {
    if (apiClient != null) {
        return apiClient;
    }

    apiClient = new ApiClient({ authProvider });
    return apiClient;
}

/**
 * Calls TwitchAPI and returns the broadcaster user id
 * @param authProvider Twurple AuthProvider
 * @param username Broadcaster username
 * @returns Broadcaster user id
 */
export async function getBroadcasterId(authProvider: RefreshingAuthProvider, username: string): Promise<string> {
    if (broadcasterId != null) {
        return broadcasterId;
    }

    const apiClient = getApiClient(authProvider);
    const broadcaster = await apiClient.users.getUserByName(username);
    if (broadcaster == null) {
        throw new Error(ERROR_MSG.BROADCASTER_USER_NOT_FOUND());
    }
    broadcasterId = broadcaster.id;
    return broadcasterId;
}

/**
 * Reloads the rewards from the rewards file
 * @param authProvider Authentication provider
 * @param targetChannel Broadcaster username
 */
export async function reloadRewards(authProvider: RefreshingAuthProvider, targetChannel: string): Promise<void> {
    // Check if rewards were enabled before
    const wereRewardsOn = areRewardsOn;
    // First deactivate all
    await toggleRewardsStatus(authProvider, targetChannel, { isEnabled: false });
    // Then update the rewards
    await REWARDS_DB.fetchDB();
    // If the reward is new, create it!
    await createRewards(authProvider, targetChannel);
    // Now re-enable only if rewards were enabled before, otherwise, disable them again
    await toggleRewardsStatus(authProvider, targetChannel, { isEnabled: wereRewardsOn });
}
