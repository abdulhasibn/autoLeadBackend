# AutoLead

Operating language for a used-car brokerage. The default is listing a vehicle on an Owner's behalf. The brokerage also buys vehicles into its own stock.

## Language

**Owner**:
The person who brought a vehicle to the brokerage. This is not settled as “current legal title holder” — on a purchase deal the brokerage may hold title.
_Avoid_: Using Owner to mean title holder until that decision is made

**Contact**:
A person who reached the brokerage without an account (walk-in, phone call), keyed by phone. A Contact becomes a Buyer when they register; `contacts.merged_into_user_id` records the link.
_Avoid_: Calling a Contact a Buyer before they have an account

**Lead**:
One internal sales opportunity: a Contact (or, later, a registered Buyer) interested in a vehicle. One person can have many Leads. Leads are never shown to buyers.

**Assignee**:
The staff member who owns a Lead (`leads.assigned_to`). A salesperson works only the Leads assigned to them; admins assign and see all.

**Home showroom**:
The showroom on a staff member's user record. New vehicles and leads are filed there unless an admin names another.

**Listed**:
A vehicle in status `open` or `linked`, i.e. in stock and able to take leads. `linked` means at least one active lead is working it; `sold` closes it (through the lead that converted) and `dropped` takes it out of stock.

**Active lead**:
A lead in `new`, `not_now` or `booking_confirmed`. Active leads keep their vehicle `linked`; `converted` and `lost` are closed, and `vehicle_unavailable` means another lead bought the vehicle (the lead can be revived with a different vehicle).

**Lead preference**:
What a buyer asked for, in the terms a vehicle is recorded in: catalog make → model → variant, colours, fuel types, transmissions, body types, a model-year window, a km ceiling and a previous-owners limit. The Lead's budget is the price ceiling. Every part is optional; blank means "any".
_Avoid_: Using `preferredVehicle` (legacy free text) as the preference

**Match score**:
How well one vehicle fits one Lead's preference: 0–100, weighted, with partial credit for near misses, computed only over the criteria the Lead filled in (budget is skipped while the vehicle has no listed price). It is computed on read and never stored.
