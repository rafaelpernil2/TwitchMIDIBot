import { AccessToken, RefreshingAuthProvider } from '@twurple/auth';
import { promises as fs, existsSync } from 'fs';
import { CONFIG } from '../../configuration/constants.js';
/**
 * Generates an authentication provider for Twitch
 * @param client [clientId, clientSecret]
 * @param tokens [envAccessToken, envRefreshToken]
 * @param kind 'BOT' | 'BROADCASTER'
 * @returns
 */
export async function getAuthProvider(
    [clientId, clientSecret]: [clientId: string, clientSecret: string],
    [envAccessToken, envRefreshToken]: [envAccessToken: string, envRefreshToken: string],
    kind: 'BOT' | 'BROADCASTER'
): Promise<RefreshingAuthProvider> {
    // Load latest available tokens
    const [accessToken, refreshToken] = await _loadLatestTokens([envAccessToken, envRefreshToken], kind);

    const tokenData: AccessToken = { ...CONFIG.TOKENS_TEMPLATE, accessToken, refreshToken };
    const tokensPath = kind === 'BOT' ? CONFIG.BOT_TOKENS_PATH : CONFIG.BROADCASTER_TOKENS_PATH;

    const authProvider = new RefreshingAuthProvider({
        clientId,
        clientSecret
    });

    // Due to the way twurple.js defines onRefresh, its return value is considered "any" and ESLint throws an error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    authProvider.onRefresh(async (_: unknown, newTokenData: AccessToken) => await _writeTokens(newTokenData, tokensPath));

    // Initialization
    await _writeTokens(tokenData, tokensPath);
    await authProvider.addUserForToken(tokenData, ['chat']);

    return authProvider;
}

/**
 * Checks if there's new tokens saved in the token JSON file and returns them instead of the .env ones
 * @param envTokens Tokens from .env file
 * @param kind 'BOT' | 'BROADCASTER'
 * @returns [accessToken: string, refreshToken: string]
 */
async function _loadLatestTokens(
    [envAccessToken, envRefreshToken]: [envAccessToken: string, envRefreshToken: string],
    kind: 'BOT' | 'BROADCASTER'
): Promise<[accessToken: string, refreshToken: string]> {
    try {
        const tokensPath = kind === 'BOT' ? CONFIG.BOT_TOKENS_PATH : CONFIG.BROADCASTER_TOKENS_PATH;
        const { accessToken, refreshToken } = JSON.parse(await fs.readFile(tokensPath, { encoding: 'utf-8' })) as AccessToken;
        return [accessToken ?? envAccessToken, refreshToken ?? envRefreshToken];
    } catch (error) {
        return [envAccessToken, envRefreshToken];
    }
}

/**
 * Writes JSON file with tokens
 * @param envTokens Tokens from .env file
 * @param tokensPath Token file path
 * @returns void
 */
async function _writeTokens(tokenData: AccessToken, tokensPath: string): Promise<void> {
    if (!existsSync(CONFIG.CONFIG_FOLDER_PATH)) {
        await fs.mkdir(CONFIG.CONFIG_FOLDER_PATH);
    }

    return fs.writeFile(tokensPath, JSON.stringify(tokenData, null, 4), { encoding: 'utf-8' });
}
