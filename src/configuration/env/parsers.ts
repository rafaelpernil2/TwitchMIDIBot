import { getBooleanByStringList } from '../../utils/generic.js';
import { EnvObject, ParsedEnvObject } from './types.js';

/**
 * Parse Env variables and convert types where needed
 * @param env EnvObject
 * @returns ParsedEnvVariables
 */
export function parseEnvVariables(env: EnvObject): ParsedEnvObject {
    const [
        REWARDS_MODE,
        VIP_REWARDS_MODE,
        SEND_UNAUTHORIZED_MESSAGE,
        SILENCE_MACRO_MESSAGES,
        ALLOW_CUSTOM_TIME_SIGNATURE
    ] = getBooleanByStringList(
        env.REWARDS_MODE,
        env.VIP_REWARDS_MODE,
        env.SEND_UNAUTHORIZED_MESSAGE,
        env.SILENCE_MACRO_MESSAGES,
        env.ALLOW_CUSTOM_TIME_SIGNATURE
    );
    const TARGET_MIDI_CHANNEL = Number(env.TARGET_MIDI_CHANNEL) - 1;

    const TIME_SIGNATURE_NUMERATOR_CC = Number(env.TIME_SIGNATURE_NUMERATOR_CC);
    const TIME_SIGNATURE_DENOMINATOR_CC = Number(env.TIME_SIGNATURE_DENOMINATOR_CC);

    return {
        ...env,
        TARGET_MIDI_CHANNEL,
        REWARDS_MODE,
        VIP_REWARDS_MODE,
        SEND_UNAUTHORIZED_MESSAGE,
        SILENCE_MACRO_MESSAGES,
        ALLOW_CUSTOM_TIME_SIGNATURE,
        TIME_SIGNATURE_NUMERATOR_CC,
        TIME_SIGNATURE_DENOMINATOR_CC
    };
}
