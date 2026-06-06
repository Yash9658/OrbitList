import { Request, Response } from "express";
import Stripe from "stripe";
import { PaymentStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { getStripeClient } from "../../config/stripe.js";
import { ApiError } from "../../utils/api-error.js";
import {
  confirmCheckoutSession,
  confirmCheckoutSessionBySessionId,
  createFeaturedCheckoutSession,
  createSubscriptionCheckoutSession,
  getAdminPayments,
  getBillingHistory,
  getBillingSummary,
  listActivePlans,
  markCheckoutSessionFailed
} from "./billing.service.js";

export async function listPlansController(_request: Request, response: Response) {
  const data = await listActivePlans();

  response.json({
    success: true,
    data
  });
}

export async function billingSummaryController(request: Request, response: Response) {
  const data = await getBillingSummary(request.authUser!.id);

  response.json({
    success: true,
    data
  });
}

export async function billingHistoryController(request: Request, response: Response) {
  const data = await getBillingHistory(request.authUser!.id);

  response.json({
    success: true,
    data
  });
}

export async function createSubscriptionCheckoutController(
  request: Request,
  response: Response
) {
  const data = await createSubscriptionCheckoutSession(
    request.authUser!.id,
    response.locals.validated.body.planSlug
  );

  response.status(201).json({
    success: true,
    data
  });
}

export async function createFeaturedCheckoutController(
  request: Request,
  response: Response
) {
  const data = await createFeaturedCheckoutSession(
    request.authUser!.id,
    response.locals.validated.body.listingId
  );

  response.status(201).json({
    success: true,
    data
  });
}

export async function confirmCheckoutController(request: Request, response: Response) {
  const data = await confirmCheckoutSession(
    request.authUser!.id,
    response.locals.validated.body.sessionId
  );

  response.json({
    success: true,
    data
  });
}

export async function adminPaymentsController(request: Request, response: Response) {
  const data = await getAdminPayments(response.locals.validated.query.limit);

  response.json({
    success: true,
    data
  });
}

export async function stripeWebhookController(request: Request, response: Response) {
  const stripe = getStripeClient();

  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new ApiError(503, "Stripe webhooks are not configured");
  }

  const signature = request.headers["stripe-signature"];

  if (!signature || Array.isArray(signature)) {
    throw new ApiError(400, "Missing Stripe signature");
  }

  const rawBody = request.body;

  if (!Buffer.isBuffer(rawBody)) {
    throw new ApiError(400, "Stripe webhook requires raw request body");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error ? `Webhook signature verification failed: ${error.message}` : "Webhook verification failed"
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.id) {
        await confirmCheckoutSessionBySessionId(session.id);
      }

      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.id) {
        await markCheckoutSessionFailed(session.id, PaymentStatus.FAILED);
      }

      break;
    }
    default:
      break;
  }

  response.json({
    received: true
  });
}
