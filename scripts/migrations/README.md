# Database Migration Scripts

Run migrations from the project root using `ts-node -r tsconfig-paths/register`.

---

## Required Migrations (must run before enabling specific features)

### `add-shipping-dimensions-to-products.ts`

**Purpose**: Backfills `weight`, `height`, `width`, `length`, and `isVolumetric` fields on all existing products that were created before GIG Logistics shipping was introduced.

**Must run before**: Enabling GIG shipping in the admin panel. Without this, existing products will fail GIG price calculations.

```bash
# Run migration
npx ts-node -r tsconfig-paths/register scripts/migrations/add-shipping-dimensions-to-products.ts

# Roll back (removes dimension fields from all products)
npx ts-node -r tsconfig-paths/register scripts/migrations/add-shipping-dimensions-to-products.ts --rollback
```

**Defaults applied**: `weight=1kg`, `length=10cm`, `width=10cm`, `height=10cm`, `isVolumetric=false`

> After running, update per-product dimensions in Admin → Products → Edit to reflect actual values.

---

## Other Migrations

### `add-shipping-dimensions-to-products.ts`

See above — covered under Required Migrations.

---

### `backfill-campaign-slugs.ts`

**Purpose**: Generates URL slugs for campaign documents that were created without one. Ensures all campaigns have a unique, URL-safe slug.

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/backfill-campaign-slugs.ts
```

---

### `add-priority-to-categories.ts`

**Purpose**: Adds a `priority` sort field to all category documents that don't already have one. Used for controlling display order in navigation and filters.

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/add-priority-to-categories.ts
```

**Rollback**:

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/rollback-priority-from-categories.ts
```

---

### `add-fullimage-to-banners.ts`

**Purpose**: Adds a `fullImage` field to existing banner documents, used for larger display contexts (e.g., hero banners).

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/add-fullimage-to-banners.ts
```

---

### `add-text-fields-to-banners.ts`

**Purpose**: Adds text overlay fields (title, subtitle, CTA) to banner documents.

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/add-text-fields-to-banners.ts
```

**Rollback**:

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/rollback-text-fields-from-banners.ts
```

---

### `add-supporting-text-and-cta-color-to-banners.ts`

**Purpose**: Backfills `supportingText` (defaults to `null`) and `ctaColor` (defaults to `'#000000'`) on existing banner documents.

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/add-supporting-text-and-cta-color-to-banners.ts
```

**Rollback**:

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/rollback-supporting-text-and-cta-color-from-banners.ts
```

---

### `verify-priority-field.ts`

**Purpose**: Read-only verification script. Checks that all category documents have the `priority` field set correctly after running `add-priority-to-categories.ts`.

```bash
npx ts-node -r tsconfig-paths/register scripts/migrations/verify-priority-field.ts
```

---

## Notes

- All scripts load `.env` from the project root automatically.
- `MONGODB_URI` must be set in `.env` before running any migration.
- Migrations are idempotent — running them more than once is safe (they skip already-updated documents).
- Always run against a database backup or staging environment first.
