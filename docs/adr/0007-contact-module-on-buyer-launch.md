# Contact moves to its own module when buyers launch

**Status:** accepted

`Contact` (an anonymous person keyed by phone) lives in `features/leads/domain` because only leads use it today, and `save_lead` upserts it in the same transaction. Once the buyer feature exists, a Contact can become a registered Buyer (`contacts.merged_into_user_id`). Both features will then need the same entity, and features MUST NOT import each other's internals (architecture.md §5).

When the buyer feature is built, extract `Contact`, `ContactId` and contact persistence into `features/contacts/`. Leads keep upserting contacts through a contacts port so the write stays atomic, and the merge flow lives in contacts. Until then, do not import `Contact` from outside `features/leads`.

## Considered Options

- **Extract now** — rejected. The module would have a single caller and no merge flow, and the extraction is mechanical whenever it lands.
- **Put Contact in `domain/shared`** — rejected. It has its own lifecycle and persistence, so it is not a kernel type.
