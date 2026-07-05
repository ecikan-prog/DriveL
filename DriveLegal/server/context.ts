import { Request, Response } from "express";

/**
 * tRPC context (server-side)
 * Shared across all API routers
 */
export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}) {
  const authHeader = req.headers.authorization;

  return {
    req,
    res,
    authHeader,

    // Future auth support (JWT / session)
    user: null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;