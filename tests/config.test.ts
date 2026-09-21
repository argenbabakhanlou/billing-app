import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      billingApiBaseUrl: 'https://billing.eng-test.wayflyer.com/v2',
      dailyChargeCapCents: 1_000_000,
      simulationStart: '2022-01-01',
      simulationEnd: '2022-02-01',
    });
  });

  it('reads overrides from the environment', () => {
    const config = loadConfig({
      PORT: '8080',
      BILLING_API_BASE_URL: 'http://localhost:9000/v2/',
      DAILY_CHARGE_CAP: '500.50',
      SIM_START: '2022-01-10',
      SIM_END: '2022-01-10',
    });

    expect(config).toEqual({
      port: 8080,
      billingApiBaseUrl: 'http://localhost:9000/v2',
      dailyChargeCapCents: 50_050,
      simulationStart: '2022-01-10',
      simulationEnd: '2022-01-10',
    });
  });

  it.each([
    [{ PORT: 'abc' }, /PORT/],
    [{ PORT: '70000' }, /PORT/],
    [{ BILLING_API_BASE_URL: 'not a url' }, /BILLING_API_BASE_URL/],
    [{ DAILY_CHARGE_CAP: '10000' }, /DAILY_CHARGE_CAP/],
    [{ SIM_START: '2022-02-30' }, /SIM_START/],
    [{ SIM_START: '2022-02-02', SIM_END: '2022-02-01' }, /on or before/],
  ])('rejects %j', (env, message) => {
    expect(() => loadConfig(env)).toThrow(message);
  });
});
