import { ApiError } from '@mediconnect/api-client';
import { applyServerErrors } from '../forms';
import { userMessage } from '../errors';

describe('userMessage', () => {
  it('uses the server message for known client errors', () => {
    expect(userMessage(new ApiError(422, { message: 'The code is invalid.', code: 'VALIDATION_FAILED', errors: {} }))).toBe('The code is invalid.');
  });

  it('hides server internals for 5xx and rate limits', () => {
    expect(userMessage(new ApiError(500, { message: 'SQLSTATE...', code: 'SERVER_ERROR' }))).toBe('Something went wrong on our side. Please try again.');
    expect(userMessage(new ApiError(429, { message: 'x', code: 'RATE_LIMITED' }))).toMatch(/Too many attempts/);
  });

  it('treats non-API errors as connectivity problems', () => {
    expect(userMessage(new TypeError('Network request failed'))).toMatch(/connection/);
  });
});

describe('applyServerErrors', () => {
  it('places mapped field errors on the form and returns no form message', () => {
    const setError = jest.fn();
    const error = new ApiError(422, { message: 'Validation failed', code: 'VALIDATION_FAILED', errors: { email: ['Taken.'] } });
    expect(applyServerErrors(error, setError, { email: 'contact' })).toBeNull();
    expect(setError).toHaveBeenCalledWith('contact', { type: 'server', message: 'Taken.' });
  });

  it('falls back to a form message when no field matches', () => {
    const setError = jest.fn();
    const error = new ApiError(422, { message: 'Invalid credentials.', code: 'INVALID_CREDENTIALS', errors: {} });
    expect(applyServerErrors(error, setError, {})).toBe('Invalid credentials.');
    expect(setError).not.toHaveBeenCalled();
  });
});
