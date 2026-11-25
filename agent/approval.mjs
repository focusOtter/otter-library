import { createServer } from 'node:http';
import { callbackUrl, CallbackValidationError } from './protocol.mjs';

export function createApprovalListener(transaction) {
  const local = new URL(callbackUrl);
  const { promise, resolve, reject } = Promise.withResolvers();
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  };
  const reply = (response, status, message) => response.writeHead(status, headers).end(
    '<!doctype html><title>Library approval</title><script>history.replaceState(null,"",location.pathname)</script><p>' + message + '</p>',
  );
  const server = createServer(async (request, response) => {
    const url = new URL(local.origin + request.url);
    if (request.method !== 'GET' || url.pathname !== local.pathname) return response.writeHead(404).end();
    try {
      const grant = await transaction.complete(url);
      reply(response, 200, 'Agent approved. Return to the terminal.');
      resolve(grant);
    } catch (error) {
      if (error instanceof CallbackValidationError) {
        reply(response, 400, 'This callback is not valid. Complete approval in the original browser tab.');
        return;
      }
      reply(response, 400, 'Approval did not complete. Restart the agent to try again.');
      reject(error);
    }
  });
  return { server, promise, reject };
}
