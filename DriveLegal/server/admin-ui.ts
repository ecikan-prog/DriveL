import { Express } from "express";

export function registerAdminUi(app: Express) {

  app.get("/admin", (_req, res) => {
    res.redirect("/admin/login");
  });

  app.get("/admin/login", (_req, res) => {
    res.send("<h1>Drive Legal Admin Login</h1>");
  });

  app.get("/admin/dashboard", (_req, res) => {
    res.send("<h1>Drive Legal Dashboard</h1>");
  });

}
