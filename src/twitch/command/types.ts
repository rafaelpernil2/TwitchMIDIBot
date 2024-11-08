import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient, ChatMessage } from '@twurple/chat';

/**
 * Origin of TwitchMIDI request
 */
export enum RequestSource {
    CHAT,
    REWARD
}

/**
 * Function type for all TwitchMIDI request handling
 */
export type CommandHandlerType = (...commandParams: CommandParams) => unknown;

/**
 * Twitch message handler type
 */
export type MessageHandler = (channel: string, user: string, message: string, msg?: ChatMessage) => Promise<void> | void;

/**
 * Twitch user roles for a given broadcaster
 */
export type UserRoles = {
    /**
     * Whether the user is the broadcaster.
     */
    isBroadcaster: boolean;
    /**
     * Whether the user is subscribed to the channel.
     */
    isSubscriber: boolean;
    /**
     * Whether the user is a Founder of the channel.
     */
    isFounder: boolean;
    /**
     * Whether the user is a moderator of the channel.
     */
    isMod: boolean;
    /**
     * Whether the user is a VIP in the channel.
     */
    isVip: boolean;
};

/**
 * Parameters for a TwitchMIDI request
 */
export type CommandParams = [
    // Message
    message: string,
    // Common params
    common: CommandConfigParams,
    // Twitch params
    twitch: TwitchParams
];

/**
 * Options and configuration parameters
 */
export interface CommandConfigParams {
    targetMIDIName: string;
    targetMIDIChannel: number;
    isRewardsMode: boolean;
    silenceMessages: boolean;
    allowCustomTimeSignature: boolean;
    timeSignatureCC: [numeratorCC: number, denominatorCC: number]
}

/**
 * Twitch related parameters
 */
export interface TwitchParams {
    chatClient: ChatClient;
    authProvider: RefreshingAuthProvider;
    channel: string;
    user: string;
    targetChannel: string;
    userRoles: UserRoles;
}
