import { CONFIG, ERROR_MSG, GLOBAL } from '../configuration/constants.js';
import i18n from '../i18n/loader.js';

/**
 * Convert a string to a boolean
 * @param value
 * @returns
 */
export function getBooleanByString(value: string): boolean {
    return value.toLowerCase() === 'true' || value.toUpperCase() === 'Y';
}

/**
 * Convert a list of strings to booleans
 * @param valueList
 * @returns
 */
export function getBooleanByStringList(...valueList: string[]): boolean[] {
    return valueList.map(getBooleanByString);
}

/**
 * Convert a boolean to a Yes or No with internationalization
 * @param value
 * @returns
 */
export function getTextByBoolean(value: boolean): string {
    return value ? i18n.t('YES') : i18n.t('NO');
}

/**
 * Checks if a string is a valid JSON
 * @param str
 * @returns
 */
export function isJsonString(str: string): boolean {
    try {
        JSON.parse(str);
    } catch {
        return false;
    }
    return true;
}

/**
 * Removes duplicates in array
 * @param list
 * @returns
 */
export function removeDuplicates<T>(list: T[]): T[] {
    return [...new Set(list)];
}

/**
 * Builds a set of valid short messages given the 500 characters limitation on Twitch
 * @param messageData [leading, content, trailing] Text always appended before content, The content itself, Text appended always after the content
 * @param limit Character limitation, 500 by default
 */
export function buildChunkedMessage([leading = '', content = '', trailing = ''] = [], limit = CONFIG.MAX_TWITCH_MESSAGE_LENGTH): string[] {
    // Simple case
    if (leading.length === 0 && trailing.length === 0 && content.length < limit) {
        return [content];
    }

    const [leadingLength, trailingLength] = [leading.length, trailing.length];

    if (leadingLength > limit || trailingLength > limit) {
        throw new Error(ERROR_MSG.INVALID_AFFIXES());
    }

    const [first, ...restOfChunks] = _splitMessage(content, limit - leadingLength - trailingLength - GLOBAL.ETC.length * 2).map((chunk) => chunk.trim());

    if (restOfChunks.length === 0) {
        return [[leading, first, trailing].join(GLOBAL.EMPTY_MESSAGE)];
    }

    const splittedContent = [first + GLOBAL.ETC, ...restOfChunks.slice(0, -1).map((chunk) => GLOBAL.ETC + chunk + GLOBAL.ETC), GLOBAL.ETC + restOfChunks[restOfChunks.length - 1]];
    return splittedContent.map((contentChunk) => [leading, contentChunk, trailing].join(GLOBAL.EMPTY_MESSAGE));
}

/**
 * Checks if a value is null, undefined or empty string.
 * It differs from !!value because 0 is a valid value
 * @param value A value to check
 */
export function isNullish(value: unknown): boolean {
    return value == null || value === GLOBAL.EMPTY_MESSAGE;
}

/**
 * Checks if a given timestamp is past a past timestamp + timeout in seconds
 * @param srcTimestamp Source timestamp
 * @param dstTimestamp Destination timestamp
 * @param timeout Timeout in seconds
 * @returns If timestamp is expired
 */
export function isTimestampExpired(srcTimestamp: Date, dstTimestamp: Date, timeout: number) {
    const maxValidDate = srcTimestamp.getTime() + timeout * 1000;

    return dstTimestamp.getTime() > maxValidDate;
}

/**
 * Splits a message in fixed size chunks
 * Except for the last one, which can be smaller
 * @param message Full message
 * @param blockSize Size of each chunk
 * @returns Splitted message
 */
function _splitMessage(message: string, blockSize: number): string[] {
    const messageLength = message.length;
    const [blockChunkCount, extraChunkLength] = [Math.floor(messageLength / blockSize), messageLength % blockSize];

    const splittedMessage = [];
    // Process chunks with full blockSize length
    for (let index = 0; index < blockChunkCount; index++) {
        splittedMessage.push(message.substring(index * blockSize, (index + 1) * blockSize));
    }
    // Add all what's left in the last chunk
    if (extraChunkLength > 0) {
        splittedMessage.push(message.substring(blockChunkCount * blockSize, blockChunkCount * blockSize + extraChunkLength));
    }

    return splittedMessage;
}
