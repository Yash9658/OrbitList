const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export async function uploadProofFile(file: File) {
  const contentBase64 = await fileToBase64(file);

  const response = await sendUploadRequest({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    contentBase64
  });

  const payload = (await response.json()) as {
    success: boolean;
    message?: string;
    data?: {
      fileName: string;
      fileUrl: string;
    };
  };

  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? "Upload failed");
  }

  return payload.data;
}

async function sendUploadRequest(body: {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}) {
  const firstResponse = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!refreshResponse.ok) {
    return firstResponse;
  }

  return fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }

      const [, base64] = result.split(",");
      resolve(base64 ?? "");
    };

    reader.onerror = () => {
      reject(new Error("Unable to read file"));
    };

    reader.readAsDataURL(file);
  });
}
