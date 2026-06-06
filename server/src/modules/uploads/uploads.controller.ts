import { Request, Response } from "express";
import { storeUpload } from "./uploads.service.js";

export async function uploadFileController(request: Request, response: Response) {
  const origin = `${request.protocol}://${request.get("host")}`;
  const result = await storeUpload(response.locals.validated.body, origin);

  response.status(201).json({
    success: true,
    data: {
      fileName: result.fileName,
      fileUrl: result.fileUrl,
      storageProvider: result.storageProvider
    }
  });
}
