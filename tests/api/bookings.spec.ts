import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { BookerClient, field, jsonBody, type Booking } from './booker-client';

function expectStatus(response: { status: number; media: string }, expected: number, operation: string) {
  const { status, media } = response;
  const category = status === 429 ? 'rate limited'
    : status >= 500 ? 'service error'
      : status >= 300 && status < 400 ? 'redirect'
        : 'response';
  expect(status, `${operation}: ${category} (${media})`).toBe(expected);
}

function isUsableToken(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function expectBooking(actual: unknown, expected: Booking) {
  // Compare fields without dumping a raw server payload on failure.
  const dates = field(actual, 'bookingdates');
  expect(field(dates, 'checkin') === expected.bookingdates.checkin, 'Check-in date matches').toBe(true);
  expect(field(dates, 'checkout') === expected.bookingdates.checkout, 'Checkout date matches').toBe(true);

  for (const [name, value] of Object.entries(expected)) {
    if (name !== 'bookingdates') {
      expect(field(actual, name) === value, `${name} matches`).toBe(true);
    }
  }
}

function ownedBookingId(result: unknown): number {
  const id = field(result, 'bookingid');
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Create did not return a positive safe-integer booking ID');
  }
  return id;
}

/* eslint-disable playwright/no-conditional-in-test -- Fall back to cleanup only for a known ID not yet deleted. */
// eslint-disable-next-line playwright/expect-expect -- The steps assert status through expectStatus and compare booking fields.
test('AC-10 owns a booking through create, update, read and delete', async ({ baseURL }, testInfo) => {
  const booker = new BookerClient(baseURL);
  const booking: Booking = {
    firstname: 'Synthetic',
    lastname: `QA-${randomUUID()}`,
    totalprice: 125,
    depositpaid: false,
    bookingdates: { checkin: '2031-06-01', checkout: '2031-06-03' },
    additionalneeds: 'None',
  };
  const updated: Booking = {
    ...booking,
    totalprice: 155,
    depositpaid: true,
    bookingdates: { ...booking.bookingdates, checkout: '2031-06-04' },
    additionalneeds: 'Breakfast',
  };

  const token = await test.step('Authenticate as the demo user', async () => {
    const response = await booker.authenticate('password123');
    expectStatus(response, 200, 'POST /auth');

    const token = field(jsonBody(response, 'Auth'), 'token');
    if (!isUsableToken(token)) throw new Error('Auth did not return a usable demo token');
    return token;
  });

  let createdId: number | undefined;
  let deleteAttempted = false;
  const noteCleanup = (description: string) => {
    testInfo.annotations.push({ type: 'cleanup', description });
  };
  const deleteBooking = async (id: number) => {
    deleteAttempted = true; // Do not retry a DELETE that may already have taken effect.
    let response;
    try {
      response = await booker.remove(id, token);
    } catch (error) {
      noteCleanup('DELETE transport failed; removal was not confirmed. No retry.');
      throw error;
    }
    if (response.status !== 201) {
      noteCleanup(`DELETE returned HTTP ${response.status}, not 201; removal was not confirmed. No retry.`);
    }
    expectStatus(response, 201, 'DELETE booking');
  };

  try {
    const id = await test.step('Create a booking and check the submitted details', async () => {
      const response = await booker.create(booking);
      expectStatus(response, 200, 'POST /booking');

      const result = jsonBody(response, 'Create');
      createdId = ownedBookingId(result);
      expectBooking(field(result, 'booking'), booking);
      return createdId;
    });

    await test.step('Update the booking', async () => {
      const response = await booker.update(id, updated, token);
      expectStatus(response, 200, 'PUT booking');
      expectBooking(jsonBody(response, 'Update'), updated);
    });

    await test.step('Read the booking and check the saved changes', async () => {
      const response = await booker.get(id, 200);
      expectStatus(response, 200, 'GET updated booking');
      expectBooking(jsonBody(response, 'Get'), updated);
    });

    await test.step('Delete the booking', async () => {
      await deleteBooking(id);
    });

    await test.step('Check that the deleted booking returns 404', async () => {
      const response = await booker.get(id);
      expectStatus(response, 404, 'GET deleted booking');
    });
  } catch (error) {
    const id = createdId;
    if (id === undefined) {
      noteCleanup('Create did not yield an owned ID; outcome unconfirmed. No lookup, retry or cleanup attempted.');
    } else if (!deleteAttempted) {
      try {
        await test.step('Clean up the booking created by this test', async () => {
          await deleteBooking(id);
        });
      } catch {
        // The failed step and annotation record cleanup without masking the original error.
      }
    }
    throw error;
  }
});
/* eslint-enable playwright/no-conditional-in-test */

test('AC-11 rejects one incorrect demo password without issuing a token', async ({ baseURL }, testInfo) => {
  const booker = new BookerClient(baseURL);

  const response = await booker.authenticate('incorrect-demo-password');
  expectStatus(response, 200, 'POST /auth with incorrect credentials');

  const result = jsonBody(response, 'Auth rejection');
  expect(field(result, 'reason') === 'Bad credentials', 'Bad credentials marker').toBe(true);
  expect(isUsableToken(field(result, 'token')), 'No usable token').toBe(false);
  testInfo.annotations.push({
    type: 'observation',
    description: 'HTTP 200, Bad credentials marker, no usable token.',
  });
});

test('AC-12 returns 404 for the read-only missing-ID fixture', async ({ baseURL }) => {
  const booker = new BookerClient(baseURL);

  const response = await booker.get(-1, 404); // Outside the positive booking ID range.
  expectStatus(response, 404, 'GET missing booking');
  expect(response.body === 'Not Found', 'Not-found marker').toBe(true);
});

test('AC-13 returns an empty list for a booking search with no matching name', async ({ baseURL }) => {
  const booker = new BookerClient(baseURL);

  const response = await booker.findByName('Synthetic', `NoMatch-${randomUUID()}`);
  expectStatus(response, 200, 'GET /booking with name filters');

  const matches = jsonBody(response, 'Booking search');
  expect(Array.isArray(matches) ? matches.length : 'not an array', 'Number of matching bookings').toBe(0);
});
