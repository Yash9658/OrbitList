import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import { uploadProofFile } from "../../services/upload.service";
import { ListingOption, ListingRecord } from "../../types/listing";

type ListingMediaFormValue = {
  type: string;
  fileUrl: string;
};

type ListingFormValues = {
  title: string;
  platformSlug: string;
  nicheSlug: string;
  handle: string;
  description: string;
  price: string;
  currency: string;
  status: "DRAFT" | "ACTIVE";
  primaryCountry: string;
  audienceAgeRange: string;
  transferNotes: string;
  followersCount: string;
  engagementRate: string;
  monthlyViews: string;
  monthlyReach: string;
  audienceTopCountry: string;
  monetized: boolean;
  media: ListingMediaFormValue[];
};

type ListingSubmitPayload = {
  title: string;
  platformSlug: string;
  nicheSlug?: string | null;
  handle?: string | null;
  description?: string | null;
  price: number;
  currency: string;
  status: "DRAFT" | "ACTIVE";
  isFeatured: boolean;
  isVerified: boolean;
  primaryCountry?: string | null;
  audienceAgeRange?: string | null;
  transferNotes?: string | null;
  metrics?: {
    followersCount?: number;
    engagementRate?: number;
    monthlyViews?: number;
    monthlyReach?: number;
    monetized?: boolean;
    verifiedBadge?: boolean;
    audienceTopCountry?: string;
  };
  media?: Array<{
    type: string;
    fileUrl: string;
    sortOrder: number;
  }>;
};

type ListingFormProps = {
  mode: "create" | "edit";
  initialListing?: ListingRecord;
  platforms: ListingOption[];
  niches: ListingOption[];
  isSubmitting: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: ListingSubmitPayload) => Promise<unknown>;
  submitLabel: string;
};

const formControlScope =
  "[&_input:not([type='checkbox']):not([type='file'])]:h-11 [&_input:not([type='checkbox']):not([type='file'])]:rounded-xl [&_input:not([type='checkbox']):not([type='file'])]:border [&_input:not([type='checkbox']):not([type='file'])]:bg-card [&_input:not([type='checkbox']):not([type='file'])]:px-3 [&_input:not([type='checkbox']):not([type='file'])]:text-sm [&_input:not([type='checkbox']):not([type='file'])]:outline-none [&_input:not([type='checkbox']):not([type='file'])]:transition [&_input:not([type='checkbox']):not([type='file'])]:focus:border-primary [&_input:not([type='checkbox']):not([type='file'])]:focus:ring-2 [&_input:not([type='checkbox']):not([type='file'])]:focus:ring-primary/15 [&_select]:h-11 [&_select]:rounded-xl [&_select]:border [&_select]:bg-card [&_select]:px-3 [&_select]:text-sm [&_select]:outline-none [&_select]:transition [&_select]:focus:border-primary [&_select]:focus:ring-2 [&_select]:focus:ring-primary/15 [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:bg-card [&_textarea]:px-3 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:outline-none [&_textarea]:transition [&_textarea]:focus:border-primary [&_textarea]:focus:ring-2 [&_textarea]:focus:ring-primary/15";
const fieldClass = "flex flex-col gap-2";
const fullFieldClass = "flex flex-col gap-2 md:col-span-2";

function createInitialValues(initialListing?: ListingRecord): ListingFormValues {
  return {
    title: initialListing?.title ?? "",
    platformSlug: initialListing?.platform.slug ?? "",
    nicheSlug: initialListing?.niche?.slug ?? "",
    handle: initialListing?.handle ?? "",
    description: initialListing?.description ?? "",
    price: initialListing ? String(initialListing.price) : "",
    currency: initialListing?.currency ?? "USD",
    status:
      initialListing?.status === "ACTIVE" || initialListing?.status === "PENDING_REVIEW"
        ? "ACTIVE"
        : "DRAFT",
    primaryCountry: initialListing?.primaryCountry ?? "",
    audienceAgeRange: initialListing?.audienceAgeRange ?? "",
    transferNotes: initialListing?.transferNotes ?? "",
    followersCount: initialListing?.metrics?.followersCount
      ? String(initialListing.metrics.followersCount)
      : "",
    engagementRate: initialListing?.metrics?.engagementRate
      ? String(initialListing.metrics.engagementRate)
      : "",
    monthlyViews: initialListing?.metrics?.monthlyViews
      ? String(initialListing.metrics.monthlyViews)
      : "",
    monthlyReach: initialListing?.metrics?.monthlyReach
      ? String(initialListing.metrics.monthlyReach)
      : "",
    audienceTopCountry: initialListing?.metrics?.audienceTopCountry ?? "",
    monetized: initialListing?.metrics?.monetized ?? false,
    media:
      initialListing?.media.map((item) => ({
        type: item.type,
        fileUrl: item.fileUrl
      })) ?? [{ type: "screenshot", fileUrl: "" }]
  };
}

export function ListingForm({
  mode,
  initialListing,
  platforms,
  niches,
  isSubmitting,
  errorMessage,
  onSubmit,
  submitLabel
}: ListingFormProps) {
  const [form, setForm] = useState<ListingFormValues>(() =>
    createInitialValues(initialListing)
  );
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const heading =
    mode === "create"
      ? "Create a listing buyers can understand in one glance."
      : `Refine ${initialListing?.title ?? "your listing"} with better buying context.`;

  const copy =
    mode === "create"
      ? "Package the platform, audience quality, pricing, media proof, and transfer story into one clear marketplace asset."
      : "Sharpen the price, audience signals, proof links, and transfer notes so the listing stays credible and competitive.";

  const normalizedError = useMemo(() => errorMessage ?? null, [errorMessage]);

  const readinessNotes = useMemo(
    () => [
      {
        label: "Profile basics",
        complete: Boolean(form.title && form.platformSlug && form.price)
      },
      {
        label: "Buyer-facing description",
        complete: Boolean(form.description && form.description.trim().length >= 40)
      },
      {
        label: "Audience signal",
        complete: Boolean(form.followersCount || form.monthlyViews || form.monthlyReach)
      },
      {
        label: "Proof media",
        complete: form.media.some((item) => item.fileUrl.trim().length > 0)
      },
      {
        label: "Transfer context",
        complete: Boolean(form.transferNotes)
      }
    ],
    [
      form.description,
      form.followersCount,
      form.media,
      form.monthlyReach,
      form.monthlyViews,
      form.platformSlug,
      form.price,
      form.title,
      form.transferNotes
    ]
  );

  function updateField<Key extends keyof ListingFormValues>(
    key: Key,
    value: ListingFormValues[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateMedia(index: number, key: keyof ListingMediaFormValue, value: string) {
    setForm((current) => ({
      ...current,
      media: current.media.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  }

  function addMediaRow() {
    setForm((current) => ({
      ...current,
      media: [...current.media, { type: "screenshot", fileUrl: "" }]
    }));
  }

  function moveMedia(index: number, direction: "up" | "down") {
    setForm((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= current.media.length) {
        return current;
      }

      const nextMedia = [...current.media];
      const [movedItem] = nextMedia.splice(index, 1);
      nextMedia.splice(targetIndex, 0, movedItem);

      return {
        ...current,
        media: nextMedia
      };
    });
  }

  function removeMediaRow(index: number) {
    setForm((current) => ({
      ...current,
      media:
        current.media.length === 1
          ? [{ type: "screenshot", fileUrl: "" }]
          : current.media.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function uploadMediaFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsUploadingMedia(true);
    setUploadError(null);

    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const result = await uploadProofFile(file);

          return {
            type: file.type.startsWith("image/") ? "image" : "document",
            fileUrl: result.fileUrl
          };
        })
      );

      setForm((current) => ({
        ...current,
        media: [
          ...current.media.filter((item) => item.fileUrl.trim().length > 0),
          ...uploaded
        ]
      }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingMedia(false);
      setIsDragActive(false);
    }
  }

  async function handleMediaUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    await uploadMediaFiles(files);
    event.target.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      title: form.title,
      platformSlug: form.platformSlug,
      nicheSlug: form.nicheSlug || null,
      handle: form.handle || null,
      description: form.description || null,
      price: Number(form.price),
      currency: form.currency,
      status: form.status,
      isFeatured: initialListing?.isFeatured ?? false,
      isVerified: initialListing?.isVerified ?? false,
      primaryCountry: form.primaryCountry || null,
      audienceAgeRange: form.audienceAgeRange || null,
      transferNotes: form.transferNotes || null,
      metrics: {
        followersCount: form.followersCount ? Number(form.followersCount) : undefined,
        engagementRate: form.engagementRate ? Number(form.engagementRate) : undefined,
        monthlyViews: form.monthlyViews ? Number(form.monthlyViews) : undefined,
        monthlyReach: form.monthlyReach ? Number(form.monthlyReach) : undefined,
        audienceTopCountry: form.audienceTopCountry || undefined,
        monetized: form.monetized,
        verifiedBadge: initialListing?.metrics?.verifiedBadge ?? false
      },
      media: form.media
        .filter((item) => item.fileUrl.trim().length > 0)
        .map((item, index) => ({
          type: item.type,
          fileUrl: item.fileUrl.trim(),
          sortOrder: index
        }))
    });
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-5 py-8 lg:grid-cols-[1fr_340px] lg:items-end">
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.22em]">
            Seller workspace
          </Badge>
          <h1 className="font-serif text-5xl font-black leading-[0.96] tracking-[-0.06em] md:text-6xl">{heading}</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">{copy}</p>
        </div>

        <Card className="p-5">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Listing mode</span>
          <strong className="mt-2 block text-2xl tracking-[-0.04em]">
            {mode === "create"
              ? "New draft"
              : form.status === "ACTIVE"
                ? "Review-ready"
                : "Draft"}
          </strong>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {mode === "create"
              ? "Start in draft if you still need to prepare screenshots, proof, or pricing."
              : "Update carefully so buyers keep seeing consistent metrics, proof links, and transfer details."}
          </p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form
          className={cn(
            "rounded-2xl border bg-card p-5 shadow-[0_18px_50px_rgba(41,35,25,0.08)] md:p-6",
            formControlScope
          )}
          onSubmit={handleSubmit}
        >
          <section className="flex flex-col gap-5 border-b pb-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Basics</Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Listing identity</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">Make it instantly clear what the asset is and why it matters.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={fullFieldClass}>
                <span className="text-sm font-semibold">Title</span>
                <input
                  required
                  placeholder="Example: Finance YouTube channel with monetized tutorials"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Platform</span>
                <select
                  required
                  value={form.platformSlug}
                  onChange={(event) => updateField("platformSlug", event.target.value)}
                >
                  <option value="">Select platform</option>
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.slug}>
                      {platform.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Niche</span>
                <select
                  value={form.nicheSlug}
                  onChange={(event) => updateField("nicheSlug", event.target.value)}
                >
                  <option value="">Select niche</option>
                  {niches.map((niche) => (
                    <option key={niche.id} value={niche.slug}>
                      {niche.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Handle</span>
                <input
                  placeholder="@brandname or channel URL slug"
                  value={form.handle}
                  onChange={(event) => updateField("handle", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Price</span>
                <input
                  required
                  min="1"
                  step="0.01"
                  type="number"
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Currency</span>
                <input
                  value={form.currency}
                  onChange={(event) => updateField("currency", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as "DRAFT" | "ACTIVE")
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Submit for review</option>
                </select>
              </label>

              <div className="rounded-2xl bg-secondary p-4 md:col-span-2">
                <strong>Review flow</strong>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Listings marked for review go to the admin moderation queue first. They become
                  live only after approval.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 flex flex-col gap-5 border-b pb-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Story</Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Audience and offer</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">Help buyers understand the quality, niche, and handoff expectations.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldClass}>
                <span className="text-sm font-semibold">Primary country</span>
                <input
                  placeholder="India, United States, Global"
                  value={form.primaryCountry}
                  onChange={(event) => updateField("primaryCountry", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Audience age range</span>
                <input
                  placeholder="18-24, 25-34"
                  value={form.audienceAgeRange}
                  onChange={(event) => updateField("audienceAgeRange", event.target.value)}
                />
              </label>

              <label className={fullFieldClass}>
                <span className="text-sm font-semibold">Description</span>
                <textarea
                  required
                  rows={6}
                  placeholder="Describe the content niche, growth quality, revenue potential, and what makes this account valuable."
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                />
              </label>

              <label className={fullFieldClass}>
                <span className="text-sm font-semibold">Transfer notes</span>
                <textarea
                  rows={5}
                  placeholder="Explain what is included in the transfer, how access will be handed off, and whether post-sale support is available."
                  value={form.transferNotes}
                  onChange={(event) => updateField("transferNotes", event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="mt-8 flex flex-col gap-5 border-b pb-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Proof</Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Media and ownership signals</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">Add screenshots, analytics snapshots, or proof links that support verification.</p>
            </div>

            <div className="flex flex-col gap-4">
              <label
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-2xl border border-dashed bg-background/70 p-6 text-center transition hover:border-primary",
                  isDragActive && "border-primary bg-secondary"
                )}
                onDragEnter={() => setIsDragActive(true)}
                onDragLeave={() => setIsDragActive(false)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void uploadMediaFiles(Array.from(event.dataTransfer.files));
                }}
              >
                <Badge variant="secondary" className="mx-auto uppercase tracking-[0.22em]">Upload proof</Badge>
                <strong className="text-xl">Drag screenshots or documents here</strong>
                <p className="text-sm leading-6 text-muted-foreground">
                  Or click to choose files from your device. Uploaded files are stored locally for
                  this project.
                </p>
                <input className="mx-auto text-sm" multiple type="file" onChange={handleMediaUpload} />
              </label>

              {form.media.map((item, index) => (
                <div className="grid gap-4 rounded-2xl border bg-background/70 p-4 lg:grid-cols-[130px_1fr_auto]" key={`${item.fileUrl}-${index}`}>
                  <div className="grid min-h-28 place-items-center overflow-hidden rounded-xl bg-secondary">
                    {item.fileUrl && item.type === "image" ? (
                      <img
                        alt={`Proof item ${index + 1}`}
                        className="size-full object-cover"
                        src={item.fileUrl}
                      />
                    ) : (
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <span>{item.type}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                    <label className={fieldClass}>
                      <span className="text-sm font-semibold">Media type</span>
                      <select
                        value={item.type}
                        onChange={(event) => updateMedia(index, "type", event.target.value)}
                      >
                        <option value="screenshot">Screenshot</option>
                        <option value="image">Image</option>
                        <option value="document">Document</option>
                        <option value="proof">Proof link</option>
                      </select>
                    </label>

                    <label className={fieldClass}>
                      <span className="text-sm font-semibold">Media URL</span>
                      <input
                        placeholder="https://..."
                        value={item.fileUrl}
                        onChange={(event) => updateMedia(index, "fileUrl", event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:flex-col">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => moveMedia(index, "up")}
                      type="button"
                    >
                      Move up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={index === form.media.length - 1}
                      onClick={() => moveMedia(index, "down")}
                      type="button"
                    >
                      Move down
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeMediaRow(index)}
                      type="button"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addMediaRow} type="button">
                Add another proof link
              </Button>

              {isUploadingMedia ? <p className="text-sm text-muted-foreground">Uploading files...</p> : null}
              {uploadError ? <p className="rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">{uploadError}</p> : null}
            </div>
          </section>

          <section className="mt-8 flex flex-col gap-5 border-b pb-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="uppercase tracking-[0.22em]">Metrics</Badge>
                <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.05em]">Performance snapshot</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">These numbers give buyers the first reason to open a conversation.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldClass}>
                <span className="text-sm font-semibold">Followers</span>
                <input
                  min="0"
                  type="number"
                  value={form.followersCount}
                  onChange={(event) => updateField("followersCount", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Engagement %</span>
                <input
                  min="0"
                  step="0.1"
                  type="number"
                  value={form.engagementRate}
                  onChange={(event) => updateField("engagementRate", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Monthly views</span>
                <input
                  min="0"
                  type="number"
                  value={form.monthlyViews}
                  onChange={(event) => updateField("monthlyViews", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Monthly reach</span>
                <input
                  min="0"
                  type="number"
                  value={form.monthlyReach}
                  onChange={(event) => updateField("monthlyReach", event.target.value)}
                />
              </label>

              <label className={fieldClass}>
                <span className="text-sm font-semibold">Top audience country</span>
                <input
                  value={form.audienceTopCountry}
                  onChange={(event) =>
                    updateField("audienceTopCountry", event.target.value)
                  }
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-sm font-semibold">
                <input
                  checked={form.monetized}
                  className="size-4 accent-primary"
                  type="checkbox"
                  onChange={(event) => updateField("monetized", event.target.checked)}
                />
                <span>Monetized account</span>
              </label>
            </div>
          </section>

          {normalizedError ? (
            <p className="mt-6 rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">
              {normalizedError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
            <Link className={buttonVariants({ variant: "outline" })} to="/dashboard">
              Cancel
            </Link>
          </div>
        </form>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Readiness</Badge>
            <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">Buyer confidence checklist</h2>
            <div className="mt-4 flex flex-col gap-3">
              {readinessNotes.map((item) => (
                <div className="rounded-xl border bg-background/70 p-3" key={item.label}>
                  <strong className="block text-sm">{item.complete ? "Ready" : "Pending"}</strong>
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <Badge variant="outline" className="uppercase tracking-[0.22em]">Advice</Badge>
            <h2 className="mt-2 font-serif text-2xl font-bold tracking-[-0.04em]">What strong listings include</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
              <p>Use a title that describes niche and scale, not just the platform.</p>
              <p>Describe audience quality and monetization, not only raw follower count.</p>
              <p>Add screenshots or proof links before you request verification review.</p>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
