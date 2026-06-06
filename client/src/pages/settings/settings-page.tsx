import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/auth-provider";
import {
  getMyIdentityVerification,
  submitIdentityVerificationRequest
} from "../../services/identity.service";
import {
  createPayoutOnboardingLinkRequest,
  getMyPayoutAccount
} from "../../services/payout.service";
import { uploadProofFile } from "../../services/upload.service";
import { NotificationPreferences, UserRole } from "../../types/auth";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ApiRequestError } from "../../lib/api-client";
import { cn } from "../../lib/utils";

const fieldClass = "flex flex-col gap-2 text-sm font-semibold text-muted-foreground";
const fieldFullClass = `${fieldClass} md:col-span-2`;
const inputClass =
  "min-h-11 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
const textareaClass = `${inputClass} min-h-28 resize-y`;
const panelHeaderClass =
  "flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-start md:justify-between";
const eyebrowClass = "text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground";
const statusTextClass = "rounded-2xl border border-border bg-muted/35 p-4 text-sm leading-7 text-muted-foreground";
const successClass = "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700";
const errorClass = "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700";
const formClass = "space-y-5 p-5 md:p-6";

type ProfileFormState = {
  fullName: string;
  username: string;
  avatarUrl: string;
  bio: string;
  country: string;
  role: UserRole;
};

type PasswordFormState = {
  currentPassword: string;
  nextPassword: string;
};

type IdentityFormState = {
  legalName: string;
  dateOfBirth: string;
  country: string;
  documentType: string;
  documentNumberLast4: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  documentUrl: string;
  notes: string;
};

type IdentityFieldErrors = Partial<Record<keyof IdentityFormState, string>>;

type SettingsSection = "profile" | "notifications" | "identity" | "payouts" | "security";

function createNotificationPreferencesState(
  user: ReturnType<typeof useAuth>["user"]
): NotificationPreferences {
  return (
    user?.notificationPreferences ?? {
      inAppMessages: true,
      inAppMarketplace: true,
      inAppTransactions: true,
      inAppTrust: true,
      emailMessages: true,
      emailMarketplace: true,
      emailTransactions: true,
      emailTrust: true,
      emailBilling: true
    }
  );
}

function createProfileState(user: ReturnType<typeof useAuth>["user"]): ProfileFormState {
  return {
    fullName: user?.fullName ?? "",
    username: user?.username ?? "",
    avatarUrl: user?.avatarUrl ?? "",
    bio: user?.bio ?? "",
    country: user?.country ?? "",
    role: user?.role ?? "BUYER"
  };
}

function createIdentityState(data?: Partial<IdentityFormState> | null): IdentityFormState {
  return {
    legalName: data?.legalName ?? "",
    dateOfBirth: data?.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : "",
    country: data?.country ?? "",
    documentType: data?.documentType ?? "",
    documentNumberLast4: data?.documentNumberLast4 ?? "",
    addressLine1: data?.addressLine1 ?? "",
    city: data?.city ?? "",
    postalCode: data?.postalCode ?? "",
    documentUrl: data?.documentUrl ?? "",
    notes: data?.notes ?? ""
  };
}

function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isFutureDateInput(value: string) {
  if (!value) {
    return false;
  }

  const selected = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selected > today;
}

function isValidProofUrl(value: string) {
  if (!value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateIdentityForm(form: IdentityFormState): IdentityFieldErrors {
  const errors: IdentityFieldErrors = {};

  if (form.legalName.trim().length < 3) {
    errors.legalName = "Enter your legal name with at least 3 characters.";
  }

  if (!form.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else if (isFutureDateInput(form.dateOfBirth)) {
    errors.dateOfBirth = "Date of birth cannot be in the future.";
  }

  if (form.country.trim().length < 2) {
    errors.country = "Country is required.";
  }

  if (!form.documentType) {
    errors.documentType = "Select the document you are uploading.";
  }

  if (!/^\d{4}$/.test(form.documentNumberLast4.trim())) {
    errors.documentNumberLast4 = "Enter exactly the last 4 digits of the document number.";
  }

  if (form.addressLine1.trim().length < 4) {
    errors.addressLine1 = "Address line is required.";
  }

  if (form.city.trim().length < 2) {
    errors.city = "City is required.";
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,19}$/.test(form.postalCode.trim())) {
    errors.postalCode = "Enter a valid postal code.";
  }

  if (!isValidProofUrl(form.documentUrl)) {
    errors.documentUrl = "Upload a document proof file or enter a valid proof URL.";
  }

  if (form.notes.length > 1500) {
    errors.notes = "Notes must be 1500 characters or less.";
  }

  return errors;
}

function mapIdentityApiErrors(error: unknown): IdentityFieldErrors {
  if (!(error instanceof ApiRequestError) || !Array.isArray(error.issues)) {
    return {};
  }

  const fieldErrors: IdentityFieldErrors = {};

  for (const issue of error.issues) {
    if (
      typeof issue !== "object" ||
      issue === null ||
      !("path" in issue) ||
      !("message" in issue)
    ) {
      continue;
    }

    const path = String(issue.path).replace(/^body\./, "");
    const message = String(issue.message);

    if (path in createIdentityState()) {
      fieldErrors[path as keyof IdentityFormState] = message;
    }
  }

  return fieldErrors;
}

function getIdentityStatusCopy(status: string) {
  switch (status) {
    case "APPROVED":
      return {
        tone: "Approved",
        message: "You are marked as ready for protected money-movement workflows."
      };
    case "PENDING":
      return {
        tone: "Pending review",
        message: "Your identity packet is in the admin queue right now."
      };
    case "REJECTED":
      return {
        tone: "Needs update",
        message: "Update the details below and resubmit the packet."
      };
    case "NOT_STARTED":
    default:
      return {
        tone: "Not started",
        message: "Complete this section before you can use protected transfer flows."
      };
  }
}

function getPayoutStatusCopy(status: string) {
  switch (status) {
    case "ACTIVE":
      return {
        tone: "Active",
        message: "Stripe payout onboarding is active and ready for real transfer releases."
      };
    case "ACTION_REQUIRED":
      return {
        tone: "Action required",
        message: "Stripe still needs more information before seller payouts can be released."
      };
    case "RESTRICTED":
      return {
        tone: "Restricted",
        message: "Stripe flagged past-due payout requirements. Re-open onboarding to fix them."
      };
    case "PENDING":
      return {
        tone: "In progress",
        message: "Stripe onboarding has started, but the payout account is not fully ready yet."
      };
    case "NOT_CONNECTED":
    default:
      return {
        tone: "Not connected",
        message: "Connect Stripe before real seller transfers can be released from protected deals."
      };
  }
}

export function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  const queryClient = useQueryClient();
  const canSell =
    user?.role === "SELLER" || user?.role === "BOTH" || user?.role === "ADMIN";
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => createProfileState(user));
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    () => createNotificationPreferencesState(user)
  );
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: "",
    nextPassword: ""
  });
  const [identityForm, setIdentityForm] = useState<IdentityFormState>(() => createIdentityState());
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesSuccess, setPreferencesSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityFieldErrors, setIdentityFieldErrors] = useState<IdentityFieldErrors>({});
  const [identitySuccess, setIdentitySuccess] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  const identityQuery = useQuery({
    queryKey: ["my-identity-verification"],
    queryFn: getMyIdentityVerification,
    enabled: Boolean(user)
  });
  const payoutQuery = useQuery({
    queryKey: ["my-payout-account"],
    queryFn: getMyPayoutAccount,
    enabled: canSell
  });

  const identityMutation = useMutation({
    mutationFn: submitIdentityVerificationRequest,
    onSuccess: async () => {
      setIdentitySuccess("Identity packet submitted for admin review.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-identity-verification"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["seller-insights", "me"] })
      ]);
    }
  });
  const payoutMutation = useMutation({
    mutationFn: createPayoutOnboardingLinkRequest,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-payout-account"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["seller-insights", "me"] })
      ]);
      window.location.href = result.url;
    }
  });

  useEffect(() => {
    setProfileForm(createProfileState(user));
    setNotificationPreferences(createNotificationPreferencesState(user));
  }, [user]);

  useEffect(() => {
    if (identityQuery.data) {
      setIdentityForm(
        createIdentityState({
          legalName: identityQuery.data.legalName ?? undefined,
          dateOfBirth: identityQuery.data.dateOfBirth ?? undefined,
          country: identityQuery.data.country ?? undefined,
          documentType: identityQuery.data.documentType ?? undefined,
          documentNumberLast4: identityQuery.data.documentNumberLast4 ?? undefined,
          addressLine1: identityQuery.data.addressLine1 ?? undefined,
          city: identityQuery.data.city ?? undefined,
          postalCode: identityQuery.data.postalCode ?? undefined,
          documentUrl: identityQuery.data.documentUrl ?? undefined,
          notes: identityQuery.data.notes ?? undefined
        })
      );
    }
  }, [identityQuery.data]);

  const identityStatus = identityQuery.data?.status ?? "NOT_STARTED";
  const identityStatusCopy = getIdentityStatusCopy(identityStatus);
  const payoutStatus = payoutQuery.data?.status ?? "NOT_CONNECTED";
  const payoutStatusCopy = getPayoutStatusCopy(payoutStatus);

  const onboardingChecks = useMemo(
    () => [
      {
        label: "Full identity",
        complete: Boolean(profileForm.fullName.trim() && profileForm.username.trim())
      },
      {
        label: "Seller intro",
        complete: profileForm.bio.trim().length >= 40
      },
      {
        label: "Avatar",
        complete: Boolean(profileForm.avatarUrl.trim())
      },
      {
        label: "Country signal",
        complete: Boolean(profileForm.country.trim())
      },
      {
        label: "Seller-capable role",
        complete: profileForm.role === "SELLER" || profileForm.role === "BOTH"
      },
      {
        label: "Protected-deal KYC",
        complete: identityStatus === "APPROVED"
      },
      {
        label: "Stripe payout account",
        complete: payoutQuery.data?.payoutsReady ?? false
      }
    ],
    [identityStatus, payoutQuery.data?.payoutsReady, profileForm]
  );

  const completedChecks = onboardingChecks.filter((check) => check.complete).length;
  const readinessPercent = Math.round((completedChecks / onboardingChecks.length) * 100);
  const nextReadinessStep = onboardingChecks.find((check) => !check.complete);
  const settingsSections: Array<{
    id: SettingsSection;
    label: string;
    description: string;
    visible: boolean;
  }> = [
    {
      id: "profile",
      label: "Profile",
      description: "Public seller details",
      visible: true
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Feed and email alerts",
      visible: true
    },
    {
      id: "identity",
      label: "Identity",
      description: "KYC packet",
      visible: true
    },
    {
      id: "payouts",
      label: "Payouts",
      description: "Stripe account",
      visible: canSell
    },
    {
      id: "security",
      label: "Security",
      description: "Password access",
      visible: true
    }
  ];
  const inAppPreferences: Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
  }> = [
    {
      key: "inAppMessages",
      label: "Messages",
      description: "Inbox replies and buyer conversations"
    },
    {
      key: "inAppMarketplace",
      label: "Marketplace",
      description: "Listing reviews, saves, and asset activity"
    },
    {
      key: "inAppTransactions",
      label: "Deals",
      description: "Protected deal, payout, and refund events"
    },
    {
      key: "inAppTrust",
      label: "Trust",
      description: "Verification, moderation, and report updates"
    }
  ];
  const emailPreferences: Array<{
    key: keyof NotificationPreferences;
    label: string;
    description: string;
  }> = [
    {
      key: "emailMessages",
      label: "Message emails",
      description: "Conversation activity sent to your inbox"
    },
    {
      key: "emailMarketplace",
      label: "Listing emails",
      description: "Approvals, rejections, and marketplace events"
    },
    {
      key: "emailTransactions",
      label: "Deal emails",
      description: "Protected deal and payout confirmations"
    },
    {
      key: "emailTrust",
      label: "Trust emails",
      description: "KYC, moderation, dispute, and report notices"
    },
    {
      key: "emailBilling",
      label: "Billing emails",
      description: "Receipts, subscriptions, and payment history"
    }
  ];

  function updateProfileField<Key extends keyof ProfileFormState>(
    key: Key,
    value: ProfileFormState[Key]
  ) {
    setProfileForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updatePasswordField<Key extends keyof PasswordFormState>(
    key: Key,
    value: PasswordFormState[Key]
  ) {
    setPasswordForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateIdentityField<Key extends keyof IdentityFormState>(
    key: Key,
    value: IdentityFormState[Key]
  ) {
    setIdentityForm((current) => ({
      ...current,
      [key]: value
    }));
    setIdentityFieldErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = {
        ...current
      };
      delete next[key];
      return next;
    });
  }

  function updateNotificationPreference<Key extends keyof NotificationPreferences>(
    key: Key,
    value: NotificationPreferences[Key]
  ) {
    setNotificationPreferences((current) => ({
      ...current,
      [key]: value
    }));
  }

  function buildProfilePayload() {
    return {
      fullName: profileForm.fullName.trim(),
      username: profileForm.username.trim() || null,
      avatarUrl: profileForm.avatarUrl.trim() || null,
      bio: profileForm.bio.trim() || null,
      country: profileForm.country.trim() || null,
      role: user?.role === "ADMIN" ? undefined : profileForm.role,
      notificationPreferences
    };
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploadingAvatar(true);
    setProfileError(null);

    try {
      const result = await uploadProofFile(file);
      updateProfileField("avatarUrl", result.fileUrl);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Avatar upload failed");
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function handleIdentityDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploadingDocument(true);
    setIdentityError(null);
    setIdentityFieldErrors((current) => {
      const next = { ...current };
      delete next.documentUrl;
      return next;
    });

    try {
      const allowedTypes = new Set([
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "application/pdf"
      ]);

      if (!allowedTypes.has(file.type)) {
        throw new Error("Upload a PNG, JPEG, WEBP, or PDF document.");
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Document proof must be 5 MB or smaller.");
      }

      const result = await uploadProofFile(file);
      updateIdentityField("documentUrl", result.fileUrl);
      setIdentitySuccess("Document proof uploaded. Submit the identity packet when ready.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Document upload failed";
      setIdentityFieldErrors((current) => ({
        ...current,
        documentUrl: message
      }));
      setIdentityError(message);
    } finally {
      setIsUploadingDocument(false);
      event.target.value = "";
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      await updateProfile(buildProfilePayload());
      setProfileSuccess("Profile and onboarding details saved.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Profile update failed");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePreferencesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingPreferences(true);
    setPreferencesError(null);
    setPreferencesSuccess(null);

    try {
      await updateProfile(buildProfilePayload());
      setPreferencesSuccess("Notification preferences saved.");
    } catch (error) {
      setPreferencesError(
        error instanceof Error ? error.message : "Notification preferences update failed"
      );
    } finally {
      setIsSavingPreferences(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      if (passwordForm.currentPassword.length < 8) {
        throw new Error("Current password must be at least 8 characters.");
      }

      if (passwordForm.nextPassword.length < 8) {
        throw new Error("New password must be at least 8 characters.");
      }

      if (passwordForm.currentPassword === passwordForm.nextPassword) {
        throw new Error("New password must be different from the current password.");
      }

      await changePassword(passwordForm);
      setPasswordForm({
        currentPassword: "",
        nextPassword: ""
      });
      setPasswordSuccess("Password updated successfully.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Password update failed");
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleIdentitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdentityError(null);
    setIdentitySuccess(null);
    setIdentityFieldErrors({});

    const validationErrors = validateIdentityForm(identityForm);

    if (Object.keys(validationErrors).length > 0) {
      setIdentityFieldErrors(validationErrors);
      setIdentityError("Fix the highlighted identity fields before submitting.");
      return;
    }

    try {
      await identityMutation.mutateAsync({
        legalName: identityForm.legalName.trim(),
        dateOfBirth: identityForm.dateOfBirth,
        country: identityForm.country.trim(),
        documentType: identityForm.documentType.trim(),
        documentNumberLast4: identityForm.documentNumberLast4.trim(),
        addressLine1: identityForm.addressLine1.trim(),
        city: identityForm.city.trim(),
        postalCode: identityForm.postalCode.trim(),
        documentUrl: identityForm.documentUrl.trim(),
        notes: identityForm.notes.trim() || null
      });
    } catch (error) {
      const apiFieldErrors = mapIdentityApiErrors(error);

      if (Object.keys(apiFieldErrors).length > 0) {
        setIdentityFieldErrors(apiFieldErrors);
      }

      setIdentityError(error instanceof Error ? error.message : "Identity submission failed");
    }
  }

  function getIdentityInputClass(field: keyof IdentityFormState) {
    return cn(
      inputClass,
      identityFieldErrors[field] ? "border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-red-200" : null
    );
  }

  function renderIdentityFieldError(field: keyof IdentityFormState) {
    const message = identityFieldErrors[field];

    if (!message) {
      return null;
    }

    return <span className="text-xs font-semibold text-red-600">{message}</span>;
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-3">
          <h1 className="text-4xl font-bold tracking-[-0.04em] text-foreground md:text-5xl">
            Settings
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Manage your public profile, notifications, identity checks, payouts, and security.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <Badge variant="secondary">{readinessPercent}% ready</Badge>
          <Badge variant="outline">KYC: {identityStatusCopy.tone}</Badge>
          {canSell ? <Badge variant="outline">Payouts: {payoutStatusCopy.tone}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {settingsSections
          .filter((section) => section.visible)
          .map((section) => (
            <button
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition",
                activeSection === section.id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              )}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              <span className="block text-sm font-bold">{section.label}</span>
              <span
                className={cn(
                  "mt-1 block text-xs",
                  activeSection === section.id
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}
              >
                {section.description}
              </span>
            </button>
          ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className={activeSection === "profile" ? undefined : "hidden"}>
            <form className={formClass} onSubmit={handleProfileSubmit}>
              <div className={panelHeaderClass}>
              <div>
                <span className={eyebrowClass}>Public profile</span>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Profile details</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Keep your visible account information accurate for buyers and sellers.
              </p>
            </div>

            <div className="grid gap-5 rounded-3xl border border-border bg-muted/25 p-4 sm:grid-cols-[96px_1fr] sm:items-center">
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-card text-3xl font-bold">
                {profileForm.avatarUrl ? (
                  <img
                    alt={profileForm.fullName || "Seller avatar"}
                    className="h-full w-full object-cover"
                    src={profileForm.avatarUrl}
                  />
                ) : (
                  <span>{(profileForm.fullName || user?.email || "O").slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className="space-y-3">
                <label
                  className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}
                  htmlFor="avatar-upload"
                >
                  {isUploadingAvatar ? "Uploading..." : "Upload avatar"}
                </label>
                <input
                  accept="image/*"
                  className="hidden"
                  id="avatar-upload"
                  onChange={handleAvatarUpload}
                  type="file"
                />
                <p className="text-sm leading-6 text-muted-foreground">
                  Use a clear headshot or brand mark.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldClass}>
                <span>Full name</span>
                <input
                  className={inputClass}
                  onChange={(event) => updateProfileField("fullName", event.target.value)}
                  value={profileForm.fullName}
                />
              </label>

              <label className={fieldClass}>
                <span>Username</span>
                <input
                  className={inputClass}
                  onChange={(event) => updateProfileField("username", event.target.value)}
                  value={profileForm.username}
                />
              </label>

              <label className={fieldClass}>
                <span>Country</span>
                <input
                  className={inputClass}
                  onChange={(event) => updateProfileField("country", event.target.value)}
                  value={profileForm.country}
                />
              </label>

              {user?.role === "ADMIN" ? (
                <label className={fieldClass}>
                  <span>Marketplace role</span>
                  <input className={inputClass} disabled value="ADMIN" />
                </label>
              ) : (
                <label className={fieldClass}>
                  <span>Marketplace role</span>
                  <select
                    className={inputClass}
                    onChange={(event) =>
                      updateProfileField("role", event.target.value as ProfileFormState["role"])
                    }
                    value={profileForm.role}
                  >
                    <option value="BUYER">Buyer</option>
                    <option value="SELLER">Seller</option>
                    <option value="BOTH">Both</option>
                  </select>
                </label>
              )}

              <label className={fieldFullClass}>
                <span>Avatar URL</span>
                <input
                  className={inputClass}
                  onChange={(event) => updateProfileField("avatarUrl", event.target.value)}
                  value={profileForm.avatarUrl}
                />
              </label>

              <label className={fieldFullClass}>
                <span>Seller bio</span>
                <textarea
                  className={textareaClass}
                  onChange={(event) => updateProfileField("bio", event.target.value)}
                  placeholder="Tell buyers what kind of creator or operator you are, what platforms you know best, and how you support handover."
                  rows={6}
                  value={profileForm.bio}
                />
              </label>
            </div>

            {profileError ? <p className={errorClass}>{profileError}</p> : null}
            {profileSuccess ? <p className={successClass}>{profileSuccess}</p> : null}

            <div className="flex justify-end">
              <Button disabled={isSavingProfile || isUploadingAvatar} type="submit">
                {isSavingProfile ? "Saving..." : "Save profile"}
              </Button>
            </div>
            </form>
          </Card>

          <Card className={activeSection === "notifications" ? undefined : "hidden"}>
            <form className={formClass} onSubmit={handlePreferencesSubmit}>
            <div className={panelHeaderClass}>
              <div>
                <span className={eyebrowClass}>Preferences</span>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Notifications</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Choose what reaches your feed and inbox.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.75rem] border border-border bg-muted/20 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold tracking-[-0.02em]">In-app feed</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Shown inside orbitlist.</p>
                  </div>
                  <Badge variant="secondary">
                    {inAppPreferences.filter((item) => notificationPreferences[item.key]).length}/
                    {inAppPreferences.length} on
                  </Badge>
                </div>

                <div className="grid gap-2">
                  {inAppPreferences.map((item) => {
                    const enabled = Boolean(notificationPreferences[item.key]);

                    return (
                      <label
                        className={cn(
                          "group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-3 transition",
                          enabled
                            ? "border-primary/30 bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/30"
                        )}
                        key={item.key}
                      >
                        <input
                          checked={enabled}
                          className="sr-only"
                          onChange={(event) =>
                            updateNotificationPreference(item.key, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span>
                          <span className="block text-sm font-bold text-foreground">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "relative h-7 w-12 shrink-0 rounded-full border transition",
                            enabled
                              ? "border-primary bg-primary"
                              : "border-border bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-1 size-5 rounded-full bg-card shadow-sm transition",
                              enabled ? "left-6" : "left-1"
                            )}
                          />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold tracking-[-0.02em]">Email delivery</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Sent outside the app.</p>
                  </div>
                  <Badge variant="secondary">
                    {emailPreferences.filter((item) => notificationPreferences[item.key]).length}/
                    {emailPreferences.length} on
                  </Badge>
                </div>

                <div className="grid gap-2">
                  {emailPreferences.map((item) => {
                    const enabled = Boolean(notificationPreferences[item.key]);

                    return (
                      <label
                        className={cn(
                          "group flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-3 transition",
                          enabled
                            ? "border-primary/30 bg-primary/10 shadow-sm"
                            : "border-border bg-muted/20 hover:border-primary/30"
                        )}
                        key={item.key}
                      >
                        <input
                          checked={enabled}
                          className="sr-only"
                          onChange={(event) =>
                            updateNotificationPreference(item.key, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span>
                          <span className="block text-sm font-bold text-foreground">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "relative h-7 w-12 shrink-0 rounded-full border transition",
                            enabled
                              ? "border-primary bg-primary"
                              : "border-border bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-1 size-5 rounded-full bg-card shadow-sm transition",
                              enabled ? "left-6" : "left-1"
                            )}
                          />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {preferencesError ? <p className={errorClass}>{preferencesError}</p> : null}
            {preferencesSuccess ? <p className={successClass}>{preferencesSuccess}</p> : null}

            <div className="flex justify-end">
              <Button disabled={isSavingPreferences} type="submit">
                {isSavingPreferences ? "Saving..." : "Save preferences"}
              </Button>
            </div>
            </form>
          </Card>

          <Card className={activeSection === "identity" ? undefined : "hidden"}>
            <form className={formClass} onSubmit={handleIdentitySubmit}>
            <div className={panelHeaderClass}>
              <div>
                <span className={eyebrowClass}>Protected deals</span>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                  Identity verification
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                {identityStatusCopy.message}
              </p>
            </div>

            <div className={statusTextClass}>
              <p>Status: {identityStatusCopy.tone}</p>
              {identityQuery.data?.rejectionReason ? (
                <p>Admin note: {identityQuery.data.rejectionReason}</p>
              ) : null}
              {identityQuery.data?.reviewedAt ? (
                <p>Last reviewed: {new Date(identityQuery.data.reviewedAt).toLocaleString()}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldClass}>
                <span>Legal name</span>
                <input
                  className={getIdentityInputClass("legalName")}
                  onChange={(event) => updateIdentityField("legalName", event.target.value)}
                  value={identityForm.legalName}
                />
                {renderIdentityFieldError("legalName")}
              </label>

              <label className={fieldClass}>
                <span>Date of birth</span>
                <input
                  className={getIdentityInputClass("dateOfBirth")}
                  max={getTodayDateInputValue()}
                  onChange={(event) => updateIdentityField("dateOfBirth", event.target.value)}
                  type="date"
                  value={identityForm.dateOfBirth}
                />
                {renderIdentityFieldError("dateOfBirth")}
              </label>

              <label className={fieldClass}>
                <span>Country</span>
                <input
                  className={getIdentityInputClass("country")}
                  onChange={(event) => updateIdentityField("country", event.target.value)}
                  value={identityForm.country}
                />
                {renderIdentityFieldError("country")}
              </label>

              <label className={fieldClass}>
                <span>Document type</span>
                <select
                  className={getIdentityInputClass("documentType")}
                  onChange={(event) => updateIdentityField("documentType", event.target.value)}
                  value={identityForm.documentType}
                >
                  <option value="">Select document</option>
                  <option value="Passport">Passport</option>
                  <option value="National ID">National ID</option>
                  <option value="Driving License">Driving license</option>
                  <option value="Business Document">Business document</option>
                </select>
                {renderIdentityFieldError("documentType")}
              </label>

              <label className={fieldClass}>
                <span>Government ID last 4 digits</span>
                <input
                  className={getIdentityInputClass("documentNumberLast4")}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) =>
                    updateIdentityField(
                      "documentNumberLast4",
                      event.target.value.replace(/\D/g, "").slice(0, 4)
                    )
                  }
                  placeholder="1234"
                  value={identityForm.documentNumberLast4}
                />
                <span className="text-xs font-medium leading-5 text-muted-foreground">
                  For safety, store only the last four digits, not the full document number.
                </span>
                {renderIdentityFieldError("documentNumberLast4")}
              </label>

              <label className={fieldClass}>
                <span>Postal code</span>
                <input
                  className={getIdentityInputClass("postalCode")}
                  onChange={(event) => updateIdentityField("postalCode", event.target.value)}
                  value={identityForm.postalCode}
                />
                {renderIdentityFieldError("postalCode")}
              </label>

              <label className={fieldFullClass}>
                <span>Address line</span>
                <input
                  className={getIdentityInputClass("addressLine1")}
                  onChange={(event) => updateIdentityField("addressLine1", event.target.value)}
                  value={identityForm.addressLine1}
                />
                {renderIdentityFieldError("addressLine1")}
              </label>

              <label className={fieldClass}>
                <span>City</span>
                <input
                  className={getIdentityInputClass("city")}
                  onChange={(event) => updateIdentityField("city", event.target.value)}
                  value={identityForm.city}
                />
                {renderIdentityFieldError("city")}
              </label>

              <label className={fieldFullClass}>
                <span>Document proof URL</span>
                <input
                  className={getIdentityInputClass("documentUrl")}
                  onChange={(event) => updateIdentityField("documentUrl", event.target.value)}
                  placeholder="Upload a file below or paste a secure proof URL"
                  value={identityForm.documentUrl}
                />
                {renderIdentityFieldError("documentUrl")}
              </label>

              <label className={fieldFullClass}>
                <span>Supporting notes</span>
                <textarea
                  className={cn(
                    textareaClass,
                    identityFieldErrors.notes
                      ? "border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-red-200"
                      : null
                  )}
                  onChange={(event) => updateIdentityField("notes", event.target.value)}
                  placeholder="Share anything admins should know about this identity package."
                  rows={4}
                  value={identityForm.notes}
                />
                {renderIdentityFieldError("notes")}
              </label>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Upload document proof</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Accepted: PNG, JPEG, WEBP, or PDF up to 5 MB.
                </p>
              </div>
              <label
                className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}
                htmlFor="identity-document-upload"
              >
                {isUploadingDocument ? "Uploading..." : "Upload identity proof"}
              </label>
              <input
                accept=".png,.jpg,.jpeg,.webp,.pdf,image/*,application/pdf"
                className="hidden"
                id="identity-document-upload"
                onChange={handleIdentityDocumentUpload}
                type="file"
              />
            </div>

            {identityQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading identity status...</p> : null}
            {identityError ? <p className={errorClass}>{identityError}</p> : null}
            {identitySuccess ? <p className={successClass}>{identitySuccess}</p> : null}

            <div className="flex justify-end">
              <Button
                disabled={identityMutation.isPending || isUploadingDocument}
                type="submit"
              >
                {identityMutation.isPending ? "Submitting..." : "Submit identity packet"}
              </Button>
            </div>
            </form>
          </Card>

          {canSell ? (
            <Card
              className={cn(
                "space-y-6 p-6 md:p-7",
                activeSection === "payouts" ? undefined : "hidden"
              )}
            >
              <div className={panelHeaderClass}>
                <div>
                  <span className={eyebrowClass}>Stripe payouts</span>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                    Seller payouts
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  {payoutStatusCopy.message}
                </p>
              </div>

              <div className={statusTextClass}>
                <p>Status: {payoutStatusCopy.tone}</p>
                <p>
                  Stripe keys:{" "}
                  {payoutQuery.data?.stripeConfigured
                    ? "configured for live onboarding"
                    : "not configured, so onboarding opens in demo mode locally."}
                </p>
                <p>
                  Connected account: {payoutQuery.data?.connectedAccountId ?? "Not created yet"}
                </p>
                {payoutQuery.data?.lastSyncedAt ? (
                  <p>
                    Last synced: {new Date(payoutQuery.data.lastSyncedAt).toLocaleString()}
                  </p>
                ) : null}
                {payoutQuery.data?.statusReason ? <p>{payoutQuery.data.statusReason}</p> : null}
              </div>

              <div className="flex justify-end">
                <Button
                  disabled={payoutMutation.isPending || identityStatus !== "APPROVED"}
                  onClick={() =>
                    void payoutMutation.mutateAsync(
                      payoutStatus === "ACTIVE" ? "update" : "onboarding"
                    )
                  }
                  type="button"
                >
                  {payoutMutation.isPending
                    ? "Preparing..."
                    : payoutStatus === "ACTIVE"
                      ? "Update Stripe payout details"
                      : "Start Stripe payout onboarding"}
                </Button>
              </div>

              {payoutQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading payout readiness...</p> : null}
              {payoutMutation.error instanceof Error ? (
                <p className={errorClass}>{payoutMutation.error.message}</p>
              ) : null}
            </Card>
          ) : null}

          <Card className={activeSection === "security" ? undefined : "hidden"}>
            <form className={formClass} onSubmit={handlePasswordSubmit}>
            <div className={panelHeaderClass}>
              <div>
                <span className={eyebrowClass}>Security</span>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Password</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Update your password when account access changes.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldClass}>
                <span>Current password</span>
                <input
                  className={inputClass}
                  onChange={(event) => updatePasswordField("currentPassword", event.target.value)}
                  type="password"
                  value={passwordForm.currentPassword}
                />
              </label>

              <label className={fieldClass}>
                <span>New password</span>
                <input
                  className={inputClass}
                  onChange={(event) => updatePasswordField("nextPassword", event.target.value)}
                  type="password"
                  value={passwordForm.nextPassword}
                />
              </label>
            </div>

            {passwordError ? <p className={errorClass}>{passwordError}</p> : null}
            {passwordSuccess ? <p className={successClass}>{passwordSuccess}</p> : null}

            <div className="flex justify-end">
              <Button disabled={isSavingPassword} type="submit">
                {isSavingPassword ? "Updating..." : "Change password"}
              </Button>
            </div>
            </form>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/25 p-6">
              <span className={eyebrowClass}>Account readiness</span>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-bold tracking-[-0.04em]">{readinessPercent}%</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {completedChecks} of {onboardingChecks.length} checks complete
                  </p>
                </div>
                <Badge variant={readinessPercent === 100 ? "default" : "secondary"}>
                  {readinessPercent === 100 ? "Ready" : "In progress"}
                </Badge>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
            </div>

            <div className="space-y-3 p-5">
              {onboardingChecks.map((check) => (
                <div className="flex items-center gap-3 text-sm" key={check.label}>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                      check.complete
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {check.complete ? "OK" : ""}
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      check.complete ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {check.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-5">
              <p className="text-sm font-semibold text-foreground">
                {nextReadinessStep
                  ? `Next: ${nextReadinessStep.label}`
                  : "All readiness checks are complete."}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                KYC is {identityStatusCopy.tone.toLowerCase()}
                {canSell ? ` and payouts are ${payoutStatusCopy.tone.toLowerCase()}.` : "."}
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
