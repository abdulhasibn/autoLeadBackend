import { DataIntegrityError } from '../../../../domain/errors/data-integrity.error';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import { FinanceTag } from '../../domain/finance-tag.entity';
import type { SealedFinanceTag } from '../../domain/sealed-finance-records';
import { TagColor } from '../../domain/tag-color.value-object';
import { TagName } from '../../domain/tag-name.value-object';

interface TagPayload {
  readonly name: string;
  readonly color: string | null;
}

/** Seals a tag's name and colour into a payload bound to `finance_tags:<id>`. */
export class TagSealer {
  seal(tag: FinanceTag, cipher: FinanceCipher): SealedFinanceTag {
    const payload: TagPayload = { name: tag.name.value, color: tag.color?.value ?? null };
    return {
      id: tag.id,
      payload: cipher.seal(JSON.stringify(payload), aad(tag.id)),
      keyVersion: cipher.keyVersion,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      archivedAt: tag.archivedAt,
    };
  }

  open(record: SealedFinanceTag, cipher: FinanceCipher): FinanceTag {
    const payload = parsePayload(cipher.open(record.payload, aad(record.id)), record.id);
    return FinanceTag.reconstitute({
      id: record.id,
      name: TagName.create(payload.name),
      color: payload.color === null ? null : TagColor.create(payload.color),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      archivedAt: record.archivedAt,
    });
  }

  openAll(records: readonly SealedFinanceTag[], cipher: FinanceCipher): FinanceTag[] {
    return records.map((record) => this.open(record, cipher));
  }
}

function aad(id: string): string {
  return `finance_tags:${id}`;
}

function parsePayload(json: string, id: string): TagPayload {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new DataIntegrityError(`Finance tag ${id} has an unreadable payload`);
  }
  const p = value as Partial<Record<keyof TagPayload, unknown>>;
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof p.name !== 'string' ||
    !(p.color === null || typeof p.color === 'string')
  ) {
    throw new DataIntegrityError(`Finance tag ${id} has an invalid payload`);
  }
  return value as TagPayload;
}
