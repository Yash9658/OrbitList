import assert from "node:assert/strict";
import net from "node:net";
import request from "supertest";
import type { Express } from "express";
import { prisma } from "../src/config/prisma.js";

export const seedCredentials = {
  admin: {
    email: "admin@orbitlist.dev",
    password: "Orbitlist123!"
  },
  seller: {
    email: "seller@orbitlist.dev",
    password: "Orbitlist123!"
  },
  buyer: {
    email: "buyer@orbitlist.dev",
    password: "Orbitlist123!"
  }
} as const;

export const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5S8AAAAASUVORK5CYII=";

export async function canReachDatabase() {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port: 5433
    });

    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function loginAs(
  app: Express,
  credentials: { email: string; password: string }
) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send(credentials);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.email, credentials.email);

  return agent;
}

export async function getUserIdByEmail(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email
    },
    select: {
      id: true
    }
  });

  return user.id;
}

export async function getListingBySlug(slug: string) {
  return prisma.listing.findUniqueOrThrow({
    where: {
      slug
    },
    select: {
      id: true,
      slug: true,
      title: true,
      sellerId: true,
      isFeatured: true
    }
  });
}

export async function ensureIdentityVerificationStatus(
  email: string,
  status: "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED",
  reviewedByEmail = seedCredentials.admin.email
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email
    },
    select: {
      id: true
    }
  });

  const reviewer =
    status === "APPROVED" || status === "REJECTED"
      ? await prisma.user.findUnique({
          where: {
            email: reviewedByEmail
          },
          select: {
            id: true
          }
        })
      : null;

  if (status === "NOT_STARTED") {
    await prisma.identityVerification.deleteMany({
      where: {
        userId: user.id
      }
    });

    return;
  }

  await prisma.identityVerification.upsert({
    where: {
      userId: user.id
    },
    update: {
      status,
      legalName: "Orbitlist Test User",
      dateOfBirth: new Date("1997-04-17"),
      country: "India",
      documentType: "Passport",
      documentNumberLast4: "1234",
      addressLine1: "42 Test Street",
      city: "Pune",
      postalCode: "411001",
      documentUrl: "https://example.com/test-document.pdf",
      notes: "Automated test identity packet",
      rejectionReason: status === "REJECTED" ? "Needs clearer document image" : null,
      reviewedAt: status === "PENDING" ? null : new Date(),
      reviewedById: status === "PENDING" ? null : reviewer?.id ?? null
    },
    create: {
      userId: user.id,
      status,
      legalName: "Orbitlist Test User",
      dateOfBirth: new Date("1997-04-17"),
      country: "India",
      documentType: "Passport",
      documentNumberLast4: "1234",
      addressLine1: "42 Test Street",
      city: "Pune",
      postalCode: "411001",
      documentUrl: "https://example.com/test-document.pdf",
      notes: "Automated test identity packet",
      rejectionReason: status === "REJECTED" ? "Needs clearer document image" : null,
      reviewedAt: status === "PENDING" ? null : new Date(),
      reviewedById: status === "PENDING" ? null : reviewer?.id ?? null
    }
  });
}
