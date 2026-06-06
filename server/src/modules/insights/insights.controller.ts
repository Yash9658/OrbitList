import { Request, Response } from "express";
import { getSellerInsights } from "./insights.service.js";

export async function getMySellerInsightsController(
  request: Request,
  response: Response
) {
  const data = await getSellerInsights(request.authUser!.id);

  response.json({
    success: true,
    data
  });
}

export async function getSellerInsightsController(
  _request: Request,
  response: Response
) {
  const data = await getSellerInsights(String(response.locals.validated.params.sellerId));

  response.json({
    success: true,
    data
  });
}
