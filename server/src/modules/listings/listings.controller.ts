import { Request, Response } from "express";
import {
  createListing as createListingRecord,
  getManagedListingById,
  getListingBySlug as getListingBySlugRecord,
  getListingOptions,
  listListings as listListingsRecords,
  listListingsForModeration,
  listMyListings as listMyListingsRecords,
  reviewListingForModeration,
  updateListing as updateListingRecord,
  updateListingStatus as updateListingStatusRecord
} from "./listings.service.js";
import { UserRole } from "@prisma/client";

export async function getListings(request: Request, response: Response) {
  const result = await listListingsRecords(response.locals.validated.query);

  response.json({
    success: true,
    ...result
  });
}

export async function getListingBySlug(request: Request, response: Response) {
  const data = await getListingBySlugRecord(
    String(response.locals.validated.params.slug)
  );

  response.json({
    success: true,
    data
  });
}

export async function getManagedListing(request: Request, response: Response) {
  const data = await getManagedListingById(
    String(response.locals.validated.params.id),
    {
      userId: request.authUser!.id,
      isAdmin: request.authUser!.role === UserRole.ADMIN
    }
  );

  response.json({
    success: true,
    data
  });
}

export async function createListing(request: Request, response: Response) {
  const data = await createListingRecord(
    request.authUser!.id,
    response.locals.validated.body
  );

  response.status(201).json({
    success: true,
    data
  });
}

export async function updateListing(request: Request, response: Response) {
  const data = await updateListingRecord(
    String(response.locals.validated.params.id),
    response.locals.validated.body,
    {
      userId: request.authUser!.id,
      isAdmin: request.authUser!.role === UserRole.ADMIN
    }
  );

  response.json({
    success: true,
    data
  });
}

export async function updateListingStatus(request: Request, response: Response) {
  const data = await updateListingStatusRecord(
    String(response.locals.validated.params.id),
    response.locals.validated.body.status,
    {
      userId: request.authUser!.id,
      isAdmin: request.authUser!.role === UserRole.ADMIN
    }
  );

  response.json({
    success: true,
    data
  });
}

export async function listListingOptions(
  _request: Request,
  response: Response
) {
  const data = await getListingOptions();

  response.json({
    success: true,
    data
  });
}

export async function listMyListings(request: Request, response: Response) {
  const data = await listMyListingsRecords(
    request.authUser!.id,
    response.locals.validated?.query?.status
  );

  response.json({
    success: true,
    ...data
  });
}

export async function listModerationQueue(
  _request: Request,
  response: Response
) {
  const data = await listListingsForModeration();

  response.json({
    success: true,
    ...data
  });
}

export async function reviewListing(
  request: Request,
  response: Response
) {
  const data = await reviewListingForModeration({
    listingId: String(response.locals.validated.params.id),
    reviewerId: request.authUser!.id,
    status: response.locals.validated.body.status,
    notes: response.locals.validated.body.notes
  });

  response.json({
    success: true,
    data
  });
}
