import axios from 'axios';

const MAX_WAIT = 30_000;

/**
 * Helper to perform HTTP request with retries
 * Handles transient errors like 503 (Service Unavailable), 429 and network issues,
 * waiting longer each time (or as long as Retry-After asks)
 */
export async function withRetry<T>(fn: () => Promise<T>, retryDelay: number = 2000, retries: number = 4) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isRetryable = axios.isAxiosError(error) &&
                (error.response?.status === 503 ||
                    error.response?.status === 429 ||
                    error.code === 'ECONNRESET' ||
                    error.code === 'ETIMEDOUT');

            if (!isRetryable || attempt >= retries)
                throw error;

            const retryAfter = Number(error.response?.headers?.['retry-after']) * 1000;
            const wait = Math.min(retryAfter > 0 ? retryAfter : retryDelay * 2 ** attempt, MAX_WAIT);
            await new Promise(resolve => { setTimeout(resolve, wait) });
        }
    }
}
