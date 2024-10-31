import readline from 'readline';
import http from 'http';
import EventEmitter from 'events';
import { httpsRequestPromise, setTimeoutPromise } from '../../utils/promise.js';
import { promises as fs } from 'fs';
import { EnvObject } from '../env/types.js';
import { getBooleanByString, isNullish } from '../../utils/generic.js';
import { CONFIG } from '../constants.js';
import chalk from 'chalk';
import i18n from '../../i18n/loader.js';
import * as VALIDATORS from '../env/validators.js';

const localHTTPServerEmitter = new EventEmitter(); // I use Node.js events for notifying when the beat start is ready
const NEW_CODE = 'newCode';

/**
 * Setup process taking place when some environment variable is not loaded
 * @param currentVariables
 * @returns
 */
export async function setupConfiguration(currentVariables: EnvObject): Promise<EnvObject> {
    // TwitchMIDI logo
    console.log(chalk.yellow(CONFIG.TWITCH_MIDI_ASCII));
    // Initial text
    console.log(chalk.yellow(i18n.t('SETUP_1')));
    // Arbitrary delay for usability
    await setTimeoutPromise(5_000_000_000);
    // This executes when there is not a valid .env file
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Clone current values first and validate them. If invalid, the value is set to null
    const targetEnv = validateEnv(JSON.parse(JSON.stringify(currentVariables)) as EnvObject);
    let {
        CLIENT_ID,
        CLIENT_SECRET,
        BOT_ACCESS_TOKEN,
        BOT_REFRESH_TOKEN,
        BROADCASTER_ACCESS_TOKEN,
        BROADCASTER_REFRESH_TOKEN,
        TARGET_CHANNEL,
        TARGET_MIDI_NAME,
        TARGET_MIDI_CHANNEL,
        REWARDS_MODE,
        VIP_REWARDS_MODE,
        SEND_UNAUTHORIZED_MESSAGE,
        SILENCE_MACRO_MESSAGES
    } = targetEnv;

    // STEP 1
    if (isStep1Invalid(targetEnv)) {
        console.log(chalk.greenBright(i18n.t('SETUP_STEP_1')));
        console.log(
            chalk.magentaBright(i18n.t('SETUP_STEP_1_TEXT')) +
                chalk.bgMagentaBright(CONFIG.TWITCH_CONSOLE_APPS_URL) +
                chalk.magentaBright(i18n.t('SETUP_STEP_1_AFTER_LINK')) +
                chalk.bgMagentaBright(CONFIG.REDIRECT_URI) +
                chalk.magentaBright(i18n.t('SETUP_STEP_1_AFTER_REDIRECT_LINK'))
        );

        CLIENT_ID = await _makeQuestion(rl, i18n.t('SETUP_STEP_1_CLIENT_ID_QUESTION'), CLIENT_ID);
        CLIENT_SECRET = await _makeQuestion(rl, i18n.t('SETUP_STEP_1_CLIENT_SECRET_QUESTION'), CLIENT_SECRET);
    }

    // STEP 2
    if (isStep2Invalid(targetEnv)) {
        console.log(chalk.greenBright(i18n.t('SETUP_STEP_2')));
        console.log(chalk.magentaBright(i18n.t('SETUP_STEP_2_TEXT')));
        // This server awaits the response from the URL
        const server = _createAuthServer(CONFIG.LOCAL_SERVER_HOST, CONFIG.LOCAL_SERVER_PORT);
        const authUrl = _createAuthURL(CLIENT_ID);
        console.log(chalk.magentaBright(i18n.t('SETUP_STEP_2_LINK')) + chalk.bgMagentaBright(authUrl));

        // Wait until user clicks and authorizes
        const BROADCASTER_CODE = await _getAuthCode();

        const { access_token, refresh_token } = await _requestTokenByCode(CLIENT_ID, CLIENT_SECRET, BROADCASTER_CODE);
        BROADCASTER_ACCESS_TOKEN = access_token;
        BROADCASTER_REFRESH_TOKEN = refresh_token;

        const isBotDifferent = getBooleanByString((await _makeQuestion(rl, i18n.t('SETUP_STEP_2_BOT_QUESTION'))) || 'Y');
        BOT_ACCESS_TOKEN = BROADCASTER_ACCESS_TOKEN;
        BOT_REFRESH_TOKEN = BROADCASTER_REFRESH_TOKEN;
        if (isBotDifferent) {
            console.log(chalk.greenBright(i18n.t('SETUP_STEP_2_BOT_TEXT_1')));
            console.log(chalk.magentaBright(i18n.t('SETUP_STEP_2_BOT_TEXT_2')) + chalk.bgMagentaBright(authUrl));
            // Wait until user clicks and authorizes
            const BOT_CODE = await _getAuthCode();
            const { access_token, refresh_token } = await _requestTokenByCode(CLIENT_ID, CLIENT_SECRET, BOT_CODE);

            BOT_ACCESS_TOKEN = access_token;
            BOT_REFRESH_TOKEN = refresh_token;
        }
        server.close();
        // Delete current token JSONs
        await deleteTokenJSONs();
    }

    // STEP 3
    if (isStep3Invalid(targetEnv)) {
        console.log(chalk.greenBright(i18n.t('SETUP_STEP_3')));
        console.log(chalk.magentaBright(i18n.t('SETUP_STEP_3_TEXT')));
        TARGET_CHANNEL = ((await _makeQuestion(rl, i18n.t('SETUP_STEP_3_TARGET_CHANNEL_QUESTION'), TARGET_CHANNEL)) || '').toLowerCase();

        const sendUnauthorizedMessage = (await _makeQuestion(rl, i18n.t('SETUP_STEP_3_UNAUTHORIZED_MESSAGE_QUESTION'), SEND_UNAUTHORIZED_MESSAGE)) || 'N';
        SEND_UNAUTHORIZED_MESSAGE = String(getBooleanByString(sendUnauthorizedMessage));

        const rewardsModeFlag = (await _makeQuestion(rl, i18n.t('SETUP_STEP_3_REWARDS_MODE_QUESTION'), REWARDS_MODE)) || 'Y';
        REWARDS_MODE = String(getBooleanByString(rewardsModeFlag));

        const vipRewardsModeFlag = (await _makeQuestion(rl, i18n.t('SETUP_STEP_3_VIP_REWARDS_MODE_QUESTION'), VIP_REWARDS_MODE)) || 'Y';
        VIP_REWARDS_MODE = String(getBooleanByString(vipRewardsModeFlag));

        const silenceMacroMessages = (await _makeQuestion(rl, i18n.t('SETUP_STEP_3_SILENCE_MACRO_MESSAGES_QUESTION'), SILENCE_MACRO_MESSAGES)) || 'Y';
        SILENCE_MACRO_MESSAGES = String(getBooleanByString(silenceMacroMessages));
    }

    // STEP 4
    if (isStep4Invalid(targetEnv)) {
        console.log(chalk.greenBright(i18n.t('SETUP_STEP_4')));
        console.log(chalk.magentaBright(i18n.t('SETUP_STEP_4_TEXT')));
        TARGET_MIDI_NAME = (await _makeQuestion(rl, i18n.t('SETUP_STEP_4_TARGET_MIDI_NAME_QUESTION'), TARGET_MIDI_NAME)) || 'loopMIDI Port';
        TARGET_MIDI_CHANNEL = (await _makeQuestion(rl, i18n.t('SETUP_STEP_4_TARGET_MIDI_CHANNEL_QUESTION'), TARGET_MIDI_CHANNEL)) || '1';
    }

    // Delete the original file first
    try {
        await fs.unlink(CONFIG.DOT_ENV_PATH);
    } catch {
        // Do nothing if file didn't exist
    }
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'CLIENT_ID=' + CLIENT_ID + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'CLIENT_SECRET=' + CLIENT_SECRET + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'BOT_ACCESS_TOKEN=' + BOT_ACCESS_TOKEN + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'BOT_REFRESH_TOKEN=' + BOT_REFRESH_TOKEN + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'BROADCASTER_ACCESS_TOKEN=' + BROADCASTER_ACCESS_TOKEN + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'BROADCASTER_REFRESH_TOKEN=' + BROADCASTER_REFRESH_TOKEN + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'TARGET_CHANNEL=' + TARGET_CHANNEL + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'TARGET_MIDI_NAME=' + TARGET_MIDI_NAME + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'TARGET_MIDI_CHANNEL=' + TARGET_MIDI_CHANNEL + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'REWARDS_MODE=' + REWARDS_MODE + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'VIP_REWARDS_MODE=' + VIP_REWARDS_MODE + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'SEND_UNAUTHORIZED_MESSAGE=' + SEND_UNAUTHORIZED_MESSAGE + '\n');
    await fs.appendFile(CONFIG.DOT_ENV_PATH, 'SILENCE_MACRO_MESSAGES=' + SILENCE_MACRO_MESSAGES + '\n');

    rl.close();
    console.log(chalk.greenBright(i18n.t('SETUP_STEP_END')));
    console.log(chalk.magentaBright(i18n.t('SETUP_STEP_END_READY')));
    console.log(
        chalk.yellowBright(`
    ***** ${i18n.t('SETUP_STEP_END_CREDITS')} ${CONFIG.OP_SIGNATURE} ***** 
    `)
    );

    return {
        CLIENT_ID,
        CLIENT_SECRET,
        BOT_ACCESS_TOKEN,
        BOT_REFRESH_TOKEN,
        BROADCASTER_ACCESS_TOKEN,
        BROADCASTER_REFRESH_TOKEN,
        TARGET_CHANNEL,
        TARGET_MIDI_NAME,
        TARGET_MIDI_CHANNEL,
        REWARDS_MODE,
        VIP_REWARDS_MODE,
        SEND_UNAUTHORIZED_MESSAGE,
        SILENCE_MACRO_MESSAGES
    };
}

// Step validations

/**
 * Validates current environment variables and replaces bad values with null to be reconfigured later
 * @param env Environment variables
 * @returns New Environment Variables object with replaces
 */
function validateEnv(env: EnvObject): EnvObject {
    const validatedEntries = Object.entries(env).map(([key, value]) => {
        try {
            VALIDATORS?.[key as keyof typeof VALIDATORS]?.(value);
            return [key, value];
        } catch {
            // If it throws an error, it means it is invalid
            return [key, null];
        }
    });
    return Object.fromEntries(validatedEntries) as EnvObject;
}

/**
 * Checks if the step 1 from the setup is invalid or not configurated
 * @param env Environment variables object
 * @returns If it is invalid or not configurated
 */
function isStep1Invalid({ CLIENT_ID, CLIENT_SECRET }: EnvObject): boolean {
    return isNullish(CLIENT_ID) || isNullish(CLIENT_SECRET);
}

/**
 * Checks if the step 2 from the setup is invalid or not configurated
 * @param env Environment variables object
 * @returns If it is invalid or not configurated
 */
function isStep2Invalid({ BROADCASTER_ACCESS_TOKEN, BROADCASTER_REFRESH_TOKEN, BOT_ACCESS_TOKEN, BOT_REFRESH_TOKEN }: EnvObject): boolean {
    return isNullish(BROADCASTER_ACCESS_TOKEN) || isNullish(BROADCASTER_REFRESH_TOKEN) || isNullish(BOT_ACCESS_TOKEN) || isNullish(BOT_REFRESH_TOKEN);
}

/**
 * Checks if the step 3 from the setup is invalid or not configurated
 * @param env Environment variables object
 * @returns If it is invalid or not configurated
 */
function isStep3Invalid({ REWARDS_MODE, VIP_REWARDS_MODE, TARGET_CHANNEL, SEND_UNAUTHORIZED_MESSAGE, SILENCE_MACRO_MESSAGES }: EnvObject): boolean {
    return isNullish(REWARDS_MODE) || isNullish(VIP_REWARDS_MODE) || isNullish(TARGET_CHANNEL) || isNullish(SEND_UNAUTHORIZED_MESSAGE) || isNullish(SILENCE_MACRO_MESSAGES);
}

/**
 * Checks if the step 4 from the setup is invalid or not configurated
 * @param env Environment variables object
 * @returns If it is invalid or not configurated
 */
function isStep4Invalid({ TARGET_MIDI_NAME, TARGET_MIDI_CHANNEL }: EnvObject): boolean {
    return isNullish(TARGET_MIDI_NAME) || isNullish(TARGET_MIDI_CHANNEL);
}

/**
 * Removes current token files to avoid collisions with new authentication data from setup
 */
async function deleteTokenJSONs() {
    try {
        await fs.unlink(CONFIG.BOT_TOKENS_PATH);
        await fs.unlink(CONFIG.BROADCASTER_TOKENS_PATH);
    } catch {
        // Do nothing if file didn't exist
    }
}

/**
 * Makes a question for the user
 * @param rl ReadLine interface
 * @param question Question to make
 * @param preConfiguredValue Value already stored to check first
 * @returns Response from question
 */
function _makeQuestion(rl: readline.Interface, question: string, preConfiguredValue?: unknown): Promise<string> {
    if (!isNullish(preConfiguredValue)) {
        return Promise.resolve(String(preConfiguredValue));
    }
    return new Promise<string>((resolve) => {
        rl.question(question, (answer) => resolve(answer));
    });
}

/**
 * Promisifies an event listener waiting for an authorization code
 * @returns Authorization code
 */
async function _getAuthCode(): Promise<string> {
    return new Promise((resolve) => {
        const listener = (code: string) => {
            resolve(code);
            localHTTPServerEmitter.removeListener(NEW_CODE, listener);
        };
        localHTTPServerEmitter.on(NEW_CODE, listener);
    });
}

/**
 * Creates a local HTTP server to listen to Twitch authorization redirect
 * @param host Host
 * @param port Port
 * @returns An HTTP server
 */
function _createAuthServer(host: string, port: number): http.Server {
    const requestListener: http.RequestListener = function (req, res) {
        const code = new URLSearchParams(req.url).get('/?code');
        if (code == null) {
            res.writeHead(300);
            res.end(i18n.t('AUTH_SERVER_OK'));
            return;
        }
        localHTTPServerEmitter.emit(NEW_CODE, code);
        res.writeHead(200);
        res.end(i18n.t('AUTH_SERVER_OK'));
    };
    const server = http.createServer(requestListener);
    server.listen(port, host);
    return server;
}

/**
 * Builds a Twitch Authorization URL for using the bot
 * @param client_id Twitch bot Client ID
 * @returns Authorization URL
 */
function _createAuthURL(client_id: string): string {
    // Obtains the scopes from the template file
    const scope = CONFIG.TOKENS_TEMPLATE.scope.reduce((acc, curr) => acc + '+' + curr);
    const authParams = new URLSearchParams({
        response_type: 'code',
        client_id,
        redirect_uri: CONFIG.REDIRECT_URI,
        scope,
        state: 'frontend'
    });
    return CONFIG.TWITCH_BASE_AUTH_URL + 'authorize?' + decodeURIComponent(authParams.toString());
}

/**
 * Requests a set of tokens from Twitch with a given request code
 * @param client_id Twitch bot Client ID
 * @param client_secret Twitch bot Client Secret
 * @param code Request code
 * @returns Access token and refresh token
 */
async function _requestTokenByCode(client_id: string, client_secret: string, code: string): Promise<{ access_token: string; refresh_token: string }> {
    const tokenParams = new URLSearchParams({
        client_id,
        client_secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: CONFIG.REDIRECT_URI
    });
    const tokenURL = new URL(CONFIG.TWITCH_BASE_AUTH_URL + 'token?' + tokenParams.toString());
    const options: http.RequestOptions = {
        hostname: tokenURL.hostname,
        path: tokenURL.pathname + tokenURL.search,
        port: 443,
        method: 'POST'
    };
    const response = await httpsRequestPromise(options).catch((error) => console.log(error));
    return response?.body as { access_token: string; refresh_token: string };
}
