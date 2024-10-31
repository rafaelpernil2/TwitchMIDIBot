import chalk from 'chalk';
import { CONFIG, ERROR_MSG } from '../../configuration/constants.js';
import { ParsedEnvObject } from '../../configuration/env/types.js';
import { checkUpdates } from './checks-handler.js';
import i18n from '../../i18n/loader.js';
import { askUserInput } from '../../utils/promise.js';
import { getTextByBoolean } from '../../utils/generic.js';

/**
 * Shows welcome messages in the terminal
 */
export function showInitWelcomeMessages(): void {
    console.log(chalk.grey(i18n.t('INIT_WELCOME')));
}

/**
 * Shows initialization messages in the terminal
 * @param env Environment variables
 */
export function showInitReadyMessages(env: ParsedEnvObject): void {
    // Initial message
    console.log(chalk.yellow(i18n.t('INIT_READY')));
    console.log(chalk.green(i18n.t('INIT_USE_MIDION_1')), chalk.greenBright('!midion'), chalk.green(i18n.t('INIT_USE_MIDION_2')));
    console.log(chalk.green(i18n.t('INIT_EXPLORE_MIDIHELP_1')), chalk.greenBright('!midihelp'), chalk.green(i18n.t('INIT_EXPLORE_MIDIHELP_2')));
    console.log(chalk.green(i18n.t('INIT_USE_MIDIOFF')), chalk.greenBright('!midioff'));

    // Flags
    console.log(chalk.gray(i18n.t('INIT_CURRENT_FLAGS')));
    console.log(chalk.magenta(i18n.t('INIT_REWARDS_CHANNELPOINTS_MODE')), chalk.magentaBright(getTextByBoolean(env.REWARDS_MODE)));
    console.log(chalk.magenta(i18n.t('INIT_VIP_REWARDS_CHANNELPOINTS_MODE')), chalk.magentaBright(getTextByBoolean(env.VIP_REWARDS_MODE)));
    console.log(chalk.magenta(i18n.t('INIT_SEND_UNAUTHORIZED_MESSAGE_FLAG')), chalk.magentaBright(getTextByBoolean(env.SEND_UNAUTHORIZED_MESSAGE)));

    // Support message
    console.log(chalk.blueBright(i18n.t('INIT_SEPARATOR')));
    console.log(chalk.cyan(i18n.t('INIT_SPONSOR_1')));
    console.log(chalk.cyan(i18n.t('INIT_SPONSOR_2')));
    console.log(chalk.cyanBright(CONFIG.SPONSOR_PAYPAL_LINK));
    console.log(chalk.cyan(i18n.t('INIT_SPONSOR_THANKS')));
    console.log(chalk.blueBright(i18n.t('INIT_SEPARATOR')));
}

/**
 * Shows initialization error messages in the terminal
 * @param error Error message
 */
export function showInitErrorMessages(error: unknown): void {
    console.log(chalk.red(String(error)));
    askUserInput(ERROR_MSG.INIT());
}

/**
 * Checks for updates on GitHub and shows a message if there's a difference between local and remote version
 */
export async function showUpdateMessages(): Promise<void> {
    const [localVersion, remoteVersion] = await checkUpdates();
    if (localVersion !== remoteVersion) {
        console.log(chalk.bgBlue.bold(`${i18n.t('INIT_UPDATE_1')}${remoteVersion}${i18n.t('INIT_UPDATE_2')}${localVersion}.`));
        console.log(chalk.bgBlue.bold(`${i18n.t('INIT_UPDATE_3')} ${CONFIG.REPOSITORY_LINK}\n`));
    }
}
