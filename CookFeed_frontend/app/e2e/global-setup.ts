/* Runs once before the browser tests: asks the API to put the development database back to the seed, so a cart
   filled or an order placed in an earlier run, or by hand, never changes what a spec sees. The API offers the reset
   only in Development. */
import { FullConfig, request } from '@playwright/test';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL;
  const api = await request.newContext({ baseURL });
  const response = await api.post('/api/dev/reset');
  await api.dispose();
  if (!response.ok()) {
    throw new Error(
      `Could not reset the database before the tests: POST ${baseURL}/api/dev/reset answered ${response.status()}. ` +
        'Is the API running in Development, and is it the current build?',
    );
  }
}
