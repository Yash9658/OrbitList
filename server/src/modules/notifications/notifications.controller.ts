import { Request, Response } from "express";
import {
  listNotifications as listNotificationsRecords,
  markAllNotificationsAsRead as markAllNotificationsAsReadRecords,
  markNotificationAsRead as markNotificationAsReadRecord
} from "./notifications.service.js";

export async function listNotificationsController(
  request: Request,
  response: Response
) {
  const data = await listNotificationsRecords(request.authUser!.id);

  response.json({
    success: true,
    ...data
  });
}

export async function markNotificationAsReadController(
  request: Request,
  response: Response
) {
  const data = await markNotificationAsReadRecord(
    String(response.locals.validated.params.id),
    request.authUser!.id
  );

  response.json({
    success: true,
    data
  });
}

export async function markAllNotificationsAsReadController(
  request: Request,
  response: Response
) {
  const data = await markAllNotificationsAsReadRecords(request.authUser!.id);

  response.json({
    success: true,
    ...data
  });
}
