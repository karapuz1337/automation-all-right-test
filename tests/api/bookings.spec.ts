import { randomUUID } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { expect, test } from '@playwright/test';

const demoUsername = 'admin';
const missingBookingId = -1; // Fixed read-only fixture outside the positive booking ID domain.
const timeoutMs = 6_000;
const safeTransportCodes = new Set([
  'ABORT_ERR', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH',
  'ENOTFOUND', 'ETIMEDOUT', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Booking = {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: { checkin: string; checkout: string };
  additionalneeds: string;
};
type Reply = { status: number; body?: string };

function transportCode(error: unknown): string {
  const code = field(error, 'code');
  return typeof code === 'string' && safeTransportCodes.has(code) ? code : 'unknown';
}

// Transport exception: Playwright runs the tests, but native request failures can log
// sensitive headers. Use bounded HTTPS with no redirects, session cookies or retries.
function send(
  baseURL: string,
  method: Method,
  path: string,
  bodyStatus: number | undefined,
  data?: object,
  cookie?: string,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const fail = (error: unknown) =>
      reject(new Error(`${method} ${path} transport failure (${transportCode(error)})`));
    try {
      const payload = data === undefined ? undefined : JSON.stringify(data);
      const req = httpsRequest(new URL(path, baseURL), {
        method,
        agent: false,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: 'application/json',
          ...(payload === undefined ? {} : {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          }),
          ...(cookie === undefined ? {} : { Cookie: cookie }),
        },
      }, (res) => {
        const status = res.statusCode ?? 0;
        res.on('error', fail);
        if (status !== bodyStatus) {
          resolve({ status });
          res.destroy();
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > 65_536) {
            reject(new Error(`${method} ${path} returned an oversized response`));
            res.destroy();
          }
        });
        res.on('end', () => resolve({ status, body }));
      });
      req.on('error', fail);
      req.end(payload);
    } catch (error) {
      fail(error);
    }
  });
}

function parseJson(reply: Reply, label: string): unknown {
  try {
    return JSON.parse(reply.body ?? '');
  } catch {
    throw new Error(`${label} did not return valid JSON`);
  }
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function expectBooking(value: unknown, expected: Booking): void {
  const dates = field(value, 'bookingdates');
  expect(dates !== null && typeof dates === 'object', 'bookingdates is an object').toBe(true);
  for (const [key, date] of Object.entries(expected.bookingdates)) {
    expect(field(dates, key) === date, `bookingdates.${key} matches`).toBe(true);
  }
  const { bookingdates, ...fields } = expected;
  for (const [key, expectedValue] of Object.entries(fields)) {
    expect(field(value, key) === expectedValue, `${key} matches`).toBe(true);
  }
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireBaseURL(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('API project baseURL is required');
  return baseURL;
}

test('AC-10 owns a booking through create, update, read and delete', async ({ baseURL }, testInfo) => {
  const url = requireBaseURL(baseURL);
  const submitted: Booking = {
    firstname: 'Synthetic',
    lastname: `QA-${randomUUID()}`,
    totalprice: 125,
    depositpaid: false,
    bookingdates: { checkin: '2031-06-01', checkout: '2031-06-03' },
    additionalneeds: 'None',
  };
  const updated: Booking = {
    ...submitted,
    totalprice: 155,
    depositpaid: true,
    bookingdates: { ...submitted.bookingdates, checkout: '2031-06-04' },
    additionalneeds: 'Breakfast',
  };
  const token = await test.step('Auth: 200 and a usable demo token', async () => {
    const reply = await send(url, 'POST', '/auth', 200, {
      username: demoUsername,
      password: 'password123',
    });
    expect(reply.status).toBe(200);
    const candidate = field(parseJson(reply, 'Auth'), 'token');
    const usable = isNonemptyString(candidate);
    expect(usable, 'usable demo token').toBe(true);
    if (!usable) throw new Error('Auth did not return a usable demo token');
    return candidate;
  });

  let ownedPath: string | undefined;
  let deleteAttempted = false;
  const remove = async (path: string) => {
    deleteAttempted = true;
    const reply = await send(url, 'DELETE', path, undefined, undefined, `token=${token}`).catch((error: unknown) => {
      testInfo.annotations.push({
        type: 'cleanup',
        description: 'DELETE transport failed; outcome unconfirmed. No retry of a potentially applied write.',
      });
      throw error;
    });
    if (reply.status !== 201) {
      testInfo.annotations.push({
        type: 'cleanup',
        description: `DELETE returned HTTP ${reply.status}, not 201; removal not confirmed. No retry.`,
      });
    }
    expect(reply.status).toBe(201);
  };

  try {
    await test.step('Create: 200, owned booking ID and submitted fields', async () => {
      const reply = await send(url, 'POST', '/booking', 200, submitted);
      expect(reply.status).toBe(200);
      const result = parseJson(reply, 'Create');
      const id = field(result, 'bookingid');
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
        throw new Error('Create did not return a positive safe-integer booking ID');
      }
      ownedPath = `/booking/${id}`;
      expectBooking(field(result, 'booking'), submitted);
    });
    const path = ownedPath;
    if (!path) throw new Error('No owned booking path was captured');
    await test.step('PUT: 200 and updated fields', async () => {
      const reply = await send(url, 'PUT', path, 200, updated, `token=${token}`);
      expect(reply.status).toBe(200);
      expectBooking(parseJson(reply, 'Update'), updated);
    });
    await test.step('Persistence GET: 200 and stored updates', async () => {
      const reply = await send(url, 'GET', path, 200);
      expect(reply.status).toBe(200);
      expectBooking(parseJson(reply, 'Persistence GET'), updated);
    });
    await test.step('DELETE: 201 for the owned booking', () => remove(path));
    await test.step('Absence GET: 404 for the deleted booking', async () => {
      const reply = await send(url, 'GET', path, undefined);
      expect(reply.status).toBe(404);
    });
  } catch (error) {
    if (!ownedPath) {
      testInfo.annotations.push({
        type: 'cleanup',
        description: 'Create did not yield an owned ID; outcome unconfirmed. No lookup, retry or cleanup attempted.',
      });
    } else if (!deleteAttempted) {
      const path = ownedPath;
      try {
        await test.step('Cleanup: DELETE only the owned booking', () => remove(path));
      } catch {
        // The step and annotation record the cleanup failure without replacing the primary error.
        console.warn('Cleanup did not confirm removal of the owned booking; no retry.');
      }
    }
    throw error;
  }
});

test('AC-11 rejects one incorrect demo password without issuing a token', async ({ baseURL }, testInfo) => {
  const reply = await send(requireBaseURL(baseURL), 'POST', '/auth', 200, {
    username: demoUsername,
    password: 'incorrect-demo-password',
  });
  expect(reply.status).toBe(200);
  const result = parseJson(reply, 'Auth rejection');
  expect(field(result, 'reason') === 'Bad credentials', 'bad-credentials marker').toBe(true);
  expect(isNonemptyString(field(result, 'token')), 'no usable token').toBe(false);
  testInfo.annotations.push({
    type: 'observation',
    description: 'HTTP 200, Bad credentials marker, no usable token.',
  });
});

test('AC-12 returns 404 for the read-only missing-ID fixture', async ({ baseURL }) => {
  const reply = await send(requireBaseURL(baseURL), 'GET', `/booking/${missingBookingId}`, 404);
  expect(reply.status).toBe(404);
  expect(reply.body === 'Not Found', '404 has the not-found marker rather than a booking payload').toBe(true);
});
