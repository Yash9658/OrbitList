import { Request, Response } from "express";
import {
  createReport,
  listAdminReports,
  listMyReports,
  reviewReport
} from "./reports.service.js";

export async function createReportController(request: Request, response: Response) {
  const data = await createReport({
    reporterId: request.authUser!.id,
    listingId: response.locals.validated.body.listingId,
    reportedUserId: response.locals.validated.body.reportedUserId,
    reason: response.locals.validated.body.reason,
    details: response.locals.validated.body.details
  });

  response.status(201).json({
    success: true,
    data
  });
}

export async function listMyReportsController(request: Request, response: Response) {
  const data = await listMyReports(request.authUser!.id);

  response.json({
    success: true,
    data
  });
}

export async function listAdminReportsController(_request: Request, response: Response) {
  const data = await listAdminReports(response.locals.validated.query.status);

  response.json({
    success: true,
    data
  });
}

export async function reviewReportController(request: Request, response: Response) {
  const data = await reviewReport({
    reportId: String(response.locals.validated.params.id),
    reviewerId: request.authUser!.id,
    status: response.locals.validated.body.status,
    resolutionNotes: response.locals.validated.body.resolutionNotes,
    listingAction: response.locals.validated.body.listingAction
  });

  response.json({
    success: true,
    data
  });
}
