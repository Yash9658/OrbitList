import { Request, Response } from "express";
import {
  createPayoutOnboardingLink,
  getMyPayoutAccount
} from "./payouts.service.js";

export async function getMyPayoutAccountController(
  request: Request,
  response: Response
) {
  const data = await getMyPayoutAccount(request.authUser!.id);

  response.json({
    success: true,
    data
  });
}

export async function createPayoutOnboardingLinkController(
  request: Request,
  response: Response
) {
  const data = await createPayoutOnboardingLink({
    userId: request.authUser!.id,
    mode: response.locals.validated.body.mode
  });

  response.status(201).json({
    success: true,
    data
  });
}
