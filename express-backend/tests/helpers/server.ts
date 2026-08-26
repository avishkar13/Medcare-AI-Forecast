import type { AddressInfo } from "node:net";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";
import { fallbackUserId } from "../../src/lib/actor.js";

const generateToken = (userId: string) => {
  const secret = (env as any).JWT_SECRET || "super_secret_jwt_key_for_development_purposes_only";
  return jwt.sign({ sub: userId }, secret, { expiresIn: "1d" });
};

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

  const systemUserId = await fallbackUserId();
  const defaultToken = generateToken(systemUserId);

  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input instanceof Request ? input.url : "";
    if (target.startsWith(url)) {
      const headers = new Headers(init?.headers);
      if (!headers.has("authorization")) {
        headers.set("authorization", `Bearer ${defaultToken}`);
      }
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };

  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(`${url}${path}`, {
      headers: { authorization: `Bearer ${defaultToken}`, ...headers },
    });

  const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${url}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${defaultToken}`,
        ...headers,
      },
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
        global.fetch = originalFetch;
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};
