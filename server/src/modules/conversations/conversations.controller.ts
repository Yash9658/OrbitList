import { Request, Response } from "express";
import {
  createConversation,
  getConversationById,
  listConversations,
  markConversationAsRead,
  sendMessage
} from "./conversations.service.js";

export async function listConversationsController(
  request: Request,
  response: Response
) {
  const data = await listConversations(request.authUser!.id);

  response.json({
    success: true,
    data
  });
}

export async function getConversationController(
  request: Request,
  response: Response
) {
  const data = await getConversationById(
    String(response.locals.validated.params.id),
    request.authUser!.id
  );

  response.json({
    success: true,
    data
  });
}

export async function createConversationController(
  request: Request,
  response: Response
) {
  const data = await createConversation(request.authUser!.id, response.locals.validated.body);

  response.status(201).json({
    success: true,
    data
  });
}

export async function sendMessageController(
  request: Request,
  response: Response
) {
  const data = await sendMessage(
    String(response.locals.validated.params.id),
    request.authUser!.id,
    response.locals.validated.body.messageText
  );

  response.json({
    success: true,
    data
  });
}

export async function markConversationReadController(
  request: Request,
  response: Response
) {
  const data = await markConversationAsRead(
    String(response.locals.validated.params.id),
    request.authUser!.id
  );

  response.json({
    success: true,
    data
  });
}
