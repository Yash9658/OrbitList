import { Request, Response } from "express";
import {
  listMyVerifications as listMyVerificationsRecords,
  listPendingVerifications as listPendingVerificationsRecords,
  reviewVerificationRequest as reviewVerificationRequestRecord,
  submitVerificationRequest as submitVerificationRequestRecord
} from "./verifications.service.js";

export async function listMyVerificationsController(
  request: Request,
  response: Response
) {
  const data = await listMyVerificationsRecords(request.authUser!.id);

  response.json({
    success: true,
    ...data
  });
}

export async function submitVerificationRequestController(
  request: Request,
  response: Response
) {
  const data = await submitVerificationRequestRecord(request.authUser!, response.locals.validated.body);

  response.status(201).json({
    success: true,
    data
  });
}

export async function listPendingVerificationsController(
  _request: Request,
  response: Response
) {
  const data = await listPendingVerificationsRecords();

  response.json({
    success: true,
    ...data
  });
}

export async function reviewVerificationRequestController(
  request: Request,
  response: Response
) {
  const data = await reviewVerificationRequestRecord(
    String(response.locals.validated.params.id),
    request.authUser!,
    response.locals.validated.body
  );

  response.json({
    success: true,
    data
  });
}
