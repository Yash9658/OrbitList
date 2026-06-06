import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { signAccessToken } from "../../utils/jwt.js";

type SelectedUser = {
  id: string;
  email: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  country: string | null;
  isVerified: boolean;
  prefInAppMessages: boolean;
  prefInAppMarketplace: boolean;
  prefInAppTransactions: boolean;
  prefInAppTrust: boolean;
  prefEmailMessages: boolean;
  prefEmailMarketplace: boolean;
  prefEmailTransactions: boolean;
  prefEmailTrust: boolean;
  prefEmailBilling: boolean;
  createdAt: Date;
};

const authUserSelect = {
  id: true,
  email: true,
  fullName: true,
  username: true,
  avatarUrl: true,
  bio: true,
  role: true,
  country: true,
  isVerified: true,
  prefInAppMessages: true,
  prefInAppMarketplace: true,
  prefInAppTransactions: true,
  prefInAppTrust: true,
  prefEmailMessages: true,
  prefEmailMarketplace: true,
  prefEmailTransactions: true,
  prefEmailTrust: true,
  prefEmailBilling: true,
  createdAt: true
} as const;

function sanitizeUser(user: SelectedUser) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    country: user.country,
    isVerified: user.isVerified,
    notificationPreferences: {
      inAppMessages: user.prefInAppMessages,
      inAppMarketplace: user.prefInAppMarketplace,
      inAppTransactions: user.prefInAppTransactions,
      inAppTrust: user.prefInAppTrust,
      emailMessages: user.prefEmailMessages,
      emailMarketplace: user.prefEmailMarketplace,
      emailTransactions: user.prefEmailTransactions,
      emailTrust: user.prefEmailTrust,
      emailBilling: user.prefEmailBilling
    },
    createdAt: user.createdAt
  };
}

function createAccessTokenForUser(user: SelectedUser) {
  return signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role
  });
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createRawRefreshToken() {
  return randomBytes(48).toString("base64url");
}

function getRefreshExpiryDate() {
  return new Date(Date.now() + env.REFRESH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function createRefreshSession(userId: string) {
  const token = createRawRefreshToken();

  await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: getRefreshExpiryDate()
    }
  });

  return token;
}

async function revokeRefreshSessionByToken(refreshToken: string | null) {
  if (!refreshToken) {
    return;
  }

  await prisma.refreshSession.updateMany({
    where: {
      tokenHash: hashRefreshToken(refreshToken),
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

async function revokeAllRefreshSessionsForUser(userId: string) {
  await prisma.refreshSession.updateMany({
    where: {
      userId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

async function createAuthSessionForUser(user: SelectedUser) {
  const [refreshToken] = await Promise.all([
    createRefreshSession(user.id)
  ]);

  return {
    user: sanitizeUser(user),
    accessToken: createAccessTokenForUser(user),
    refreshToken
  };
}

async function findActiveRefreshSession(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.refreshSession.findUnique({
    where: {
      tokenHash
    },
    include: {
      user: {
        select: authUserSelect
      }
    }
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    if (session && !session.revokedAt) {
      await prisma.refreshSession.update({
        where: {
          id: session.id
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    throw new ApiError(401, "Refresh session is invalid or expired");
  }

  return session;
}

export async function signup(input: {
  email: string;
  password: string;
  fullName: string;
  username?: string;
  country?: string;
  role: UserRole;
}) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: input.email },
        input.username ? { username: input.username } : undefined
      ].filter(Boolean) as { email?: string; username?: string }[]
    },
    select: {
      id: true,
      email: true,
      username: true
    }
  });

  if (existingUser) {
    if (existingUser.email === input.email) {
      throw new ApiError(409, "An account with this email already exists");
    }

    throw new ApiError(409, "That username is already taken");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      username: input.username ?? null,
      country: input.country ?? null,
      role: input.role
    },
    select: authUserSelect
  });

  return createAuthSessionForUser(user);
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email
    },
    select: {
      passwordHash: true,
      ...authUserSelect
    }
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValidPassword) {
    throw new ApiError(401, "Invalid email or password");
  }

  return createAuthSessionForUser(user);
}

export async function refreshAuthSession(refreshToken: string) {
  const session = await findActiveRefreshSession(refreshToken);

  await prisma.refreshSession.update({
    where: {
      id: session.id
    },
    data: {
      revokedAt: new Date()
    }
  });

  const nextRefreshToken = await createRefreshSession(session.user.id);

  return {
    user: sanitizeUser(session.user),
    accessToken: createAccessTokenForUser(session.user),
    refreshToken: nextRefreshToken
  };
}

export async function logout(refreshToken: string | null) {
  await revokeRefreshSessionByToken(refreshToken);

  return {
    success: true
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: authUserSelect
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return sanitizeUser(user);
}

export async function updateCurrentUserRole(userId: string, role: UserRole) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: authUserSelect
  });

  return {
    user: sanitizeUser(user),
    accessToken: createAccessTokenForUser(user)
  };
}

export async function updateCurrentUserProfile(
  userId: string,
  input: {
    fullName?: string;
    username?: string | null;
    country?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    role?: UserRole;
    notificationPreferences?: {
      inAppMessages: boolean;
      inAppMarketplace: boolean;
      inAppTransactions: boolean;
      inAppTrust: boolean;
      emailMessages: boolean;
      emailMarketplace: boolean;
      emailTransactions: boolean;
      emailTrust: boolean;
      emailBilling: boolean;
    };
  }
) {
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      username: true
    }
  });

  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  const normalizedUsername = input.username?.trim() || null;

  if (normalizedUsername && normalizedUsername !== existingUser.username) {
    const userWithSameUsername = await prisma.user.findUnique({
      where: {
        username: normalizedUsername
      },
      select: {
        id: true
      }
    });

    if (userWithSameUsername) {
      throw new ApiError(409, "That username is already taken");
    }
  }

  const user = await prisma.user.update({
    where: {
      id: userId
    },
    data: {
      fullName: input.fullName,
      username: normalizedUsername,
      country: input.country ?? null,
      bio: input.bio ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role: input.role,
      prefInAppMessages: input.notificationPreferences?.inAppMessages,
      prefInAppMarketplace: input.notificationPreferences?.inAppMarketplace,
      prefInAppTransactions: input.notificationPreferences?.inAppTransactions,
      prefInAppTrust: input.notificationPreferences?.inAppTrust,
      prefEmailMessages: input.notificationPreferences?.emailMessages,
      prefEmailMarketplace: input.notificationPreferences?.emailMarketplace,
      prefEmailTransactions: input.notificationPreferences?.emailTransactions,
      prefEmailTrust: input.notificationPreferences?.emailTrust,
      prefEmailBilling: input.notificationPreferences?.emailBilling
    },
    select: authUserSelect
  });

  return {
    user: sanitizeUser(user),
    accessToken: createAccessTokenForUser(user)
  };
}

export async function updateCurrentUserPassword(
  userId: string,
  input: {
    currentPassword: string;
    nextPassword: string;
  }
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      passwordHash: true
    }
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    input.currentPassword,
    user.passwordHash
  );

  if (!isCurrentPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  if (input.currentPassword === input.nextPassword) {
    throw new ApiError(400, "New password must be different from the current password");
  }

  const passwordHash = await bcrypt.hash(input.nextPassword, 10);

  await prisma.user.update({
    where: {
      id: userId
    },
    data: {
      passwordHash
    }
  });

  await revokeAllRefreshSessionsForUser(userId);

  return {
    success: true,
    forceLogout: true
  };
}
