# Architecture compliance pitfalls

Concrete PASS/FAIL pairs for AutoLead. Use with [`SKILL.md`](SKILL.md). Each pair is one decision — score the matching H-id.

---

## 1. Soft-warn lookup on create/update (H5)

**FAIL — command UC depends on query interface**

```
CreateLeadUseCase(repo, queries, policy)
// create: ids = await queries.findOpenByPhone(...)
```

**PASS — lookup on command repository**

```
CreateLeadUseCase(repo, policy)
// create: ids = await repo.findOpenLeadIdsByPhone(...)
// then repo.save(lead); return warnings in DTO
```

Soft warn itself (200/201 + `warnings[]`) is fine. The port used for the lookup is what H5 judges.

---

## 2. VehicleId / OwnerId for a second feature (H9)

**FAIL — fuzzy or aggregate import**

- Plan: "VehicleId via shared or same brand pattern"
- Code: `import { Vehicle } from '../../vehicles/domain/vehicle.entity'`
- Code: duplicate `Brand<string, 'VehicleId'>` in leads with no shared move

**PASS — promote branded id**

- `src/domain/shared/vehicle-id.ts` exports `VehicleId` / `toVehicleId`
- vehicles and leads both import from shared
- Leads holds `vehicleId: VehicleId` only — never the `Vehicle` entity

---

## 3. Cross-feature owner/vehicle check (H8)

**FAIL**

```
// features/vehicles/application/create-vehicle.policy.ts
import type { OwnerRepository } from '../../owners/domain/owner.repository';
import { SupabaseOwnerRepository } from '../../owners/infrastructure/...'; // worse
```

**PASS**

```
// features/vehicles/domain/registered-owner.port.ts
export interface RegisteredOwnerPort {
  isRegistered(ownerId: OwnerId): Promise<boolean>;
}
// composition-root: composeVehiclesFeature(..., { isRegistered: ownerRepo.isRegistered.bind(ownerRepo) })
```

---

## 4. Nested owner URLs vs feature ownership (H1 / H8)

**FAIL** — `POST /owners/:id/vehicles` handler added inside `features/owners/presentation/`

**PASS** — same URL mounted from app routes; controller/schemas/use cases live in `features/vehicles/`

---

## 5. List/get reconstituting entities (H12)

**FAIL**

```
ListVehiclesUseCase {
  constructor(private readonly repo: VehicleRepository) {}
  execute() { return this.repo.findAll(...); } // returns Vehicle[]
}
```

**PASS**

```
ListVehiclesUseCase {
  constructor(private readonly queries: VehicleQueries) {}
  execute() { return this.queries.list(...); } // Page<VehicleSummary>
}
```

---

## 6. Fat port (H5)

**FAIL**

```
interface VehicleRepository {
  save(vehicle: Vehicle): Promise<void>;
  listInventory(criteria, page): Promise<Page<VehicleSummary>>;
  listBySalesperson(...): Promise<Page<VehicleSummary>>;
}
```

**PASS** — command: `findById` / `save` / invariant lookups; query: `listInventory` / `listBySalesperson` on a separate interface.

---

## 7. Zod re-implements VO (H3)

**FAIL** — schema `z.string().length(17)` for VIN while `VehicleVin.create` exists with the same rules and schema never calls it.

**PASS** — schema transforms/refines via `VehicleVin.create` (catch → Zod issue).

---

## 8. Scope / soft-delete omitted (H10)

**FAIL** — `from('leads').select('*').eq('id', leadId)` with no `salesperson_id` when the feature scopes by salesperson, and no `deleted_at` filter.

**PASS** — `.eq('salesperson_id', salespersonId).is('deleted_at', null)` on default reads/writes; scope args required on the port method when the feature defines them.
