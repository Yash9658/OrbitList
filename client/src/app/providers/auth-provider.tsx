import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  loginRequest,
  logoutRequest,
  meRequest,
  signupRequest,
  updatePasswordRequest,
  updateProfileRequest,
  updateRoleRequest
} from "../../services/auth.service";
import { AuthUser, NotificationPreferences, UserRole } from "../../types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    fullName: string;
    username?: string;
    country?: string;
    role: UserRole;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateProfile: (input: {
    fullName: string;
    username?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    country?: string | null;
    role?: UserRole;
    notificationPreferences?: NotificationPreferences;
  }) => Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    nextPassword: string;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    void meRequest()
      .then((nextUser) => {
        setUser(nextUser);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsBootstrapping(false);
      });
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener("orbitlist:auth-expired", handleAuthExpired);

    return () => {
      window.removeEventListener("orbitlist:auth-expired", handleAuthExpired);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      async login(input) {
        const nextUser = await loginRequest(input);
        setUser(nextUser);
      },
      async signup(input) {
        const nextUser = await signupRequest(input);
        setUser(nextUser);
      },
      logout() {
        void logoutRequest().catch(() => undefined);
        setUser(null);
      },
      async refreshUser() {
        const nextUser = await meRequest();
        setUser(nextUser);
      },
      async updateRole(role) {
        const nextUser = await updateRoleRequest(role);
        setUser(nextUser);
      },
      async updateProfile(input) {
        const nextUser = await updateProfileRequest(input);
        setUser(nextUser);
      },
      async changePassword(input) {
        const result = await updatePasswordRequest(input);

        if (result.forceLogout) {
          setUser(null);
        }
      }
    }),
    [isBootstrapping, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
