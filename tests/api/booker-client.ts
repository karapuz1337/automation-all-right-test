import { request } from 'node:https';

export type Booking = {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: { checkin: string; checkout: string };
  additionalneeds: string;
};

type Reply = { status: number; media: string; body?: string };
type RequestOptions = { readBodyOn?: number; data?: object; token?: string };

const transportCodes = new Set([
  'ABORT_ERR', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH',
  'ENOTFOUND', 'ETIMEDOUT', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

export function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export function jsonBody(reply: Reply, operation: string): unknown {
  try {
    return JSON.parse(reply.body ?? '');
  } catch {
    throw new Error(`${operation} did not return valid JSON (HTTP ${reply.status}; ${reply.media})`);
  }
}

export class BookerClient {
  private readonly baseURL: string;

  constructor(baseURL: string | undefined) {
    if (!baseURL) throw new Error('API project baseURL is required');
    this.baseURL = baseURL;
  }

  async authenticate(password: string) {
    return await this.send('POST', '/auth', {
      readBodyOn: 200,
      data: { username: 'admin', password },
    });
  }

  async create(booking: Booking) {
    return await this.send('POST', '/booking', { readBodyOn: 200, data: booking });
  }

  async update(id: number, booking: Booking, token: string) {
    return await this.send('PUT', `/booking/${id}`, { readBodyOn: 200, data: booking, token });
  }

  async get(id: number, readBodyOn?: number) {
    return await this.send('GET', `/booking/${id}`, { readBodyOn });
  }

  async findByName(firstname: string, lastname: string) {
    const query = new URLSearchParams({ firstname, lastname });
    return await this.send('GET', '/booking', { readBodyOn: 200 }, query);
  }

  async remove(id: number, token: string) {
    return await this.send('DELETE', `/booking/${id}`, { token });
  }

  // Playwright request errors can include headers. Keep credentials out of test
  // output and use a single bounded HTTPS request with no redirects or retries.
  private send(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options: RequestOptions, query?: URLSearchParams,
  ): Promise<Reply> {
    const { readBodyOn, data, token } = options;
    // Bridge Node's HTTPS events to the async client methods.
    return new Promise((resolve, reject) => {
      const fail = (error: unknown) => {
        const code = field(error, 'code');
        const safeCode = typeof code === 'string' && transportCodes.has(code) ? code : 'unknown';
        reject(new Error(`${method} ${path} transport failure (${safeCode})`));
      };

      try {
        const payload = data === undefined ? undefined : JSON.stringify(data);
        const url = new URL(path, this.baseURL);
        if (query) url.search = query.toString();
        const req = request(url, {
          method,
          agent: false,
          signal: AbortSignal.timeout(6_000),
          headers: {
            Accept: 'application/json',
            ...(payload === undefined ? {} : {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }),
            ...(token === undefined ? {} : { Cookie: `token=${token}` }),
          },
        }, (response) => {
          const status = response.statusCode ?? 0;
          const contentType = response.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
          // Report a fixed category, never raw headers or an unexpected body.
          const media = contentType === 'application/json' || contentType === 'text/plain' || contentType === 'text/html'
            ? contentType
            : contentType ? 'other media type' : 'no Content-Type';
          response.on('error', fail);
          if (status !== readBodyOn) {
            resolve({ status, media });
            response.destroy();
            return;
          }

          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            body += chunk;
            if (body.length > 65_536) {
              reject(new Error(`${method} ${path} returned an oversized response`));
              response.destroy();
            }
          });
          response.on('end', () => resolve({ status, media, body }));
        });
        req.on('error', fail);
        req.end(payload);
      } catch (error) {
        fail(error);
      }
    });
  }
}
