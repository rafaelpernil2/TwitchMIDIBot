import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { ParsedEnvObject } from '../../configuration/env/types.js';
import { onMessageHandlerClosure } from '../command/handler.js';
import { RequestSource } from '../command/types.js';
import { buildChunkedMessage } from '../../utils/generic.js';

/**
 * Creates and connects Twitch ChatClient with an AuthProvider and target channel
 * @param botAuthProvider Bot auth provider
 * @param env Environment variables
 * @returns Chat client
 */
export function connectChatClient(botAuthProvider: RefreshingAuthProvider, env: ParsedEnvObject) {
    const chatClient = new ChatClient({ authProvider: botAuthProvider, channels: [env.TARGET_CHANNEL] });
    chatClient.connect();

    return chatClient;
}

/**
 * Initializes Rewards mode
 * @param broadcasterAuthProvider Broadcaster auth provider
 * @param chatClient Chat client
 * @param env Environment variables
 */
export function initializeChatMode(broadcasterAuthProvider: RefreshingAuthProvider, chatClient: ChatClient, env: ParsedEnvObject): void {
    // Chat code

    // Due to the way twurple.js defines onMessage, its return value is considered "any" and ESLint throws an error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    chatClient.onMessage(onMessageHandlerClosure(broadcasterAuthProvider, chatClient, env, RequestSource.CHAT));
}

/**
 * Splits and says in as many messages as needed the full message, even if it exceeds the 500 character limit
 * @param chatClient Twitch Chat Client
 * @param channel Twitch Chat channel
 * @param messageData [leading, content, trailing] Data for the message
 * @param { silenceMessages } options Parameters for customizing the behaviour
 */
export function sayTwitchChatMessage(chatClient: ChatClient, channel: string, [leading = '', content = '', trailing = ''] = [], { silenceMessages } = { silenceMessages: false }) {
    // Do nothing if messages are muted
    if (silenceMessages) return;

    const messageList = buildChunkedMessage([leading, content, trailing]);
    for (const twitchMessage of messageList) {
        chatClient.say(channel, twitchMessage);
    }
}
