import NanoTimer from 'nanotimer';
import https from 'https';
import http from 'http';
import { isJsonString } from './generic.js';
import readline from 'readline';
import i18n from '../i18n/loader.js';
import { GLOBAL } from '../configuration/constants.js';

/**
 * Creates a promise that resolves in a determined amount of nanoseconds
 * @param timeout Timeout in nanoseconds
 * @returns
 */
export async function setTimeoutPromise(timeout: number): Promise<void> {
    // No timeout
    if (timeout === 0) {
        return;
    }

    const timer = new NanoTimer();
    return new Promise((resolve) => {
        timer.setTimeout(resolve, '', String(timeout) + 'n');
    });
}

/**
 * Conversion of https.request to Promise
 * @param options https.RequestOptions
 * @returns A promise with statusCode, headers and body
 */
export async function httpsRequestPromise<T>(options: https.RequestOptions): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: T | string }> {
    return new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: T | string }>((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += String(chunk)));
            res.on('error', reject);
            res.on('end', () => {
                const { statusCode, headers } = res;
                if (statusCode != null && statusCode >= 200 && statusCode <= 299) {
                    resolve({ statusCode, headers, body: isJsonString(body) ? (JSON.parse(body) as T) : body });
                } else {
                    reject(new Error(i18n.t('ERROR_REQUEST_FAILED') + String(statusCode) + ', body: ' + body));
                }
            });
        });
        req.on('error', (error) => reject(error));
        req.end();
    });
}

/**
 * Asks for user input
 * @param question Question
 * @param timeout Timeout for closing input in ms
 * @param defaultAnswer Answer returned on timeout
 * @returns
 */
export function askUserInput(question: string, timeout = 0, defaultAnswer: string = GLOBAL.EMPTY_MESSAGE): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
        if (timeout !== 0) {
            setTimeout(() => {
                rl.close();
                resolve(defaultAnswer);
            }, timeout);
        }
    });
}
