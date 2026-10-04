# Registered-buyer leads use user_id XOR contact_id

**Status:** accepted

The schema already enforces `leads_buyer_xor_check`: a lead references either a registered buyer (`user_id`) or an anonymous contact (`contact_id`), never both. Today the `Lead` aggregate models only `contactId`. The mapper rejects a lead with no contact, and the read model hides it.

When marketplace inquiries ship (Stint 4.2), the lead's person becomes a discriminated union in the domain:

```ts
type LeadPerson =
  | { kind: 'contact'; contactId: ContactId }
  | { kind: 'buyer'; userId: UserId };
```

`Lead.create` enforces exactly one. The mapper, read model (`buyerUserId` beside `contactId`), queries and `save_lead` (stop hardcoding `user_id = null`) all change together. Buyer-initiated leads get their own use case (`SubmitInquiry`), because the actor is the buyer, not staff, and the result is never shown to the buyer (PRD §18).

## Considered Options

- **Model it now** — rejected. There would be no caller, and the union would ship untested against real inquiries.
- **Always create a Contact for registered buyers** — rejected. It duplicates identity and makes the merge flow ambiguous.
