import { DataIntegrityError } from '../../../../domain/errors/data-integrity.error';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import { Money } from '../../domain/money.value-object';
import type { SealedVehicleQuote } from '../../domain/sealed-finance-records';
import { VehicleQuote } from '../../domain/vehicle-quote.entity';

interface QuotePayload {
  readonly amount: number;
  readonly quotedTo: string | null;
  readonly note: string | null;
}

/** Seals a quote's amount, person and note, bound to `vehicle_quotes:<id>`. */
export class QuoteSealer {
  seal(quote: VehicleQuote, cipher: FinanceCipher): SealedVehicleQuote {
    const payload: QuotePayload = {
      amount: quote.amount.paise,
      quotedTo: quote.quotedTo,
      note: quote.note,
    };
    return {
      id: quote.id,
      vehicleId: quote.vehicleId,
      leadId: quote.leadId,
      quotedOn: quote.quotedOn.value,
      payload: cipher.seal(JSON.stringify(payload), aad(quote.id)),
      keyVersion: cipher.keyVersion,
      createdBy: quote.createdBy,
      createdAt: quote.createdAt,
      deletedAt: quote.deletedAt,
    };
  }

  open(record: SealedVehicleQuote, cipher: FinanceCipher): VehicleQuote {
    const p = parsePayload(cipher.open(record.payload, aad(record.id)), record.id);
    return VehicleQuote.reconstitute({
      id: record.id,
      vehicleId: record.vehicleId,
      leadId: record.leadId,
      quotedOn: CalendarDate.create(record.quotedOn),
      amount: Money.ofPaise(p.amount),
      quotedTo: p.quotedTo,
      note: p.note,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
    });
  }
}

function aad(id: string): string {
  return `vehicle_quotes:${id}`;
}

function parsePayload(json: string, id: string): QuotePayload {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new DataIntegrityError(`Quote ${id} has an unreadable payload`);
  }
  const p = value as Partial<Record<keyof QuotePayload, unknown>>;
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof p.amount !== 'number' ||
    !Number.isSafeInteger(p.amount) ||
    p.amount <= 0 ||
    !(p.quotedTo === null || typeof p.quotedTo === 'string') ||
    !(p.note === null || typeof p.note === 'string')
  ) {
    throw new DataIntegrityError(`Quote ${id} has an invalid payload`);
  }
  return value as QuotePayload;
}
