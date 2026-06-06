import { Request, Response } from "express";
import {
  getMyIdentityVerification,
  listPendingIdentityVerifications,
  reviewIdentityVerification,
  submitIdentityVerification
} from "./identity.service.js";

export async function getMyIdentityVerificationController(
  request: Request,
  response: Response
) {
  const data = await getMyIdentityVerification(request.authUser!.id);

  response.json({
    success: true,
    data
  });
}

export async function submitIdentityVerificationController(
  request: Request,
  response: Response
) {
  const data = await submitIdentityVerification({
    userId: request.authUser!.id,
    ...response.locals.validated.body
  });

  response.json({
    success: true,
    data
  });
}

export async function listPendingIdentityVerificationsController(
  _request: Request,
  response: Response
) {
  const data = await listPendingIdentityVerifications();

  response.json({
    success: true,
    data
  });
}

export async function reviewIdentityVerificationController(
  request: Request,
  response: Response
) {
  const data = await reviewIdentityVerification({
    verificationId: String(response.locals.validated.params.id),
    reviewerId: request.authUser!.id,
    reviewerRole: request.authUser!.role,
    status: response.locals.validated.body.status,
    rejectionReason: response.locals.validated.body.rejectionReason
  });

  response.json({
    success: true,
    data
  });
}
