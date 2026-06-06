import { Request, Response } from "express";
import type { DisputeStatus, TransactionStatus } from "@prisma/client";
import {
  addDisputeCaseNote,
  addDisputeEvidence,
  confirmProtectedTransactionCheckout,
  createProtectedTransactionCheckout,
  getTransactionDetail,
  issueBuyerRefund,
  listAdminDisputes,
  listTransactionsForActor,
  openTransactionDispute,
  releaseSellerPayout,
  reviewDispute,
  updateTransactionStatus
} from "./transactions.service.js";

export async function listTransactionsController(request: Request, response: Response) {
  const data = await listTransactionsForActor(request.authUser!);

  response.json({
    success: true,
    data
  });
}

export async function getTransactionController(request: Request, response: Response) {
  const data = await getTransactionDetail(
    String(response.locals.validated.params.id),
    request.authUser!
  );

  response.json({
    success: true,
    data
  });
}

export async function createTransactionCheckoutController(
  request: Request,
  response: Response
) {
  const data = await createProtectedTransactionCheckout({
    buyerId: request.authUser!.id,
    listingId: response.locals.validated.body.listingId,
    buyerNotes: response.locals.validated.body.buyerNotes
  });

  response.status(201).json({
    success: true,
    data
  });
}

export async function confirmTransactionCheckoutController(
  request: Request,
  response: Response
) {
  const data = await confirmProtectedTransactionCheckout(
    request.authUser!.id,
    response.locals.validated.body.sessionId
  );

  response.json({
    success: true,
    data
  });
}

export async function updateTransactionStatusController(
  request: Request,
  response: Response
) {
  const data = await updateTransactionStatus({
    transactionId: String(response.locals.validated.params.id),
    actor: request.authUser!,
    status: response.locals.validated.body.status as
      | "HANDOFF_SUBMITTED"
      | "BUYER_REVIEW"
      | "COMPLETED"
      | "CANCELLED",
    notes: response.locals.validated.body.notes
  });

  response.json({
    success: true,
    data
  });
}

export async function openDisputeController(request: Request, response: Response) {
  const data = await openTransactionDispute({
    transactionId: String(response.locals.validated.params.id),
    actor: request.authUser!,
    reason: response.locals.validated.body.reason,
    details: response.locals.validated.body.details
  });

  response.status(201).json({
    success: true,
    data
  });
}

export async function addDisputeEvidenceController(
  request: Request,
  response: Response
) {
  const data = await addDisputeEvidence({
    disputeId: String(response.locals.validated.params.id),
    actor: request.authUser!,
    fileUrl: response.locals.validated.body.fileUrl,
    note: response.locals.validated.body.note,
    visibility: response.locals.validated.body.visibility
  });

  response.status(201).json({
    success: true,
    data
  });
}

export async function addDisputeCaseNoteController(
  request: Request,
  response: Response
) {
  const data = await addDisputeCaseNote({
    disputeId: String(response.locals.validated.params.id),
    actor: request.authUser!,
    message: response.locals.validated.body.message,
    visibility: response.locals.validated.body.visibility
  });

  response.status(201).json({
    success: true,
    data
  });
}

export async function listAdminDisputesController(
  _request: Request,
  response: Response
) {
  const data = await listAdminDisputes(
    response.locals.validated.query.status as DisputeStatus | undefined
  );

  response.json({
    success: true,
    data
  });
}

export async function reviewDisputeController(request: Request, response: Response) {
  const data = await reviewDispute({
    disputeId: String(response.locals.validated.params.id),
    actor: request.authUser!,
    status: response.locals.validated.body.status as
      | "UNDER_REVIEW"
      | "RESOLVED_FOR_BUYER"
      | "RESOLVED_FOR_SELLER"
      | "CLOSED",
    resolutionNotes: response.locals.validated.body.resolutionNotes,
    adminInternalNotes: response.locals.validated.body.adminInternalNotes,
    priority: response.locals.validated.body.priority
  });

  response.json({
    success: true,
    data
  });
}

export async function releaseSellerPayoutController(request: Request, response: Response) {
  const data = await releaseSellerPayout({
    transactionId: String(response.locals.validated.params.id),
    actor: request.authUser!,
    notes: response.locals.validated.body.notes
  });

  response.json({
    success: true,
    data
  });
}

export async function issueBuyerRefundController(request: Request, response: Response) {
  const data = await issueBuyerRefund({
    transactionId: String(response.locals.validated.params.id),
    actor: request.authUser!,
    notes: response.locals.validated.body.notes
  });

  response.json({
    success: true,
    data
  });
}
