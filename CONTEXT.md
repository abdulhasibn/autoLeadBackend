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
A vehicle in status `available`. `reserved` means a buyer is committed; `sold` closes it.
