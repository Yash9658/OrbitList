import { Request, Response } from "express";
import { listAuditLogs } from "./audit.service.js";

export async function listAuditLogsController(_request: Request, response: Response) {
  const data = await listAuditLogs(response.locals.validated.query.limit);

  response.json({
    success: true,
    data
  });
}
