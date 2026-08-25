import type { AddressInfo } from "node:net";
import type { Express } from "express";

export interface TestServer {
  url: string;
  get: (path: string) => Promise<Response>;
  json: <T>(path: string) => Promise<T>;
  post: (path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  close: () => Promise<void>;
}

export const startServer = async (app: Express): Promise<TestServer> => {
  const server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  const get = (path: string) => fetch(`${url}${path}`);

  const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  return {
    url,
    get,
    post,
    json: async <T>(path: string): Promise<T> => {
      const response = await get(path);
      return (await response.json()) as T;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};
