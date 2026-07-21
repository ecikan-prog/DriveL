import { Express, Request, Response } from "express";

export function registerOperatorUi(app: Express) {
  app.get("/operator/login", (_req: Request, res: Response) => {
    return res.status(200).send("Operator Portal");
  });
}
