import { encodeCrockfordBase32, groupInFours, normalizeCrockfordBase32 } from './crockford-base32';

interface SecretFormat {
  readonly prefix: string;
  readonly byteLength: number;
  readonly label: string;
}

/**
 * Shared shape of the finance key and the recovery key: random bytes shown as
 * `<PREFIX>-XXXX-XXXX-…` in Crockford base32. Input is normalised, so case,
 * spaces, dashes and O/I/L look-alikes don't matter. `value` is the canonical
 * text that keys are derived from.
 */
export abstract class VaultSecret {
  protected constructor(readonly value: string) {}

  protected static canonicalFromBytes(format: SecretFormat, bytes: Uint8Array): string {
    if (bytes.length !== format.byteLength) {
      throw new Error(`${format.label} needs ${format.byteLength} random bytes`);
    }
    return `${format.prefix}-${groupInFours(encodeCrockfordBase32(bytes))}`;
  }

  protected static canonicalFromInput(format: SecretFormat, input: string): string {
    const normalized = normalizeCrockfordBase32(input.trim());
    const expectedLength = Math.ceil((format.byteLength * 8) / 5);
    // The prefix is optional when typing the key back in.
    const body =
      normalized !== null && normalized.length === expectedLength + format.prefix.length
        ? normalized.startsWith(format.prefix)
          ? normalized.slice(format.prefix.length)
          : null
        : normalized;
    if (body === null || body.length !== expectedLength) {
      throw new Error(`${format.label} is not in the expected format`);
    }
    return `${format.prefix}-${groupInFours(body)}`;
  }
}

const FINANCE_KEY_FORMAT: SecretFormat = { prefix: 'FK', byteLength: 15, label: 'Finance key' };
const RECOVERY_KEY_FORMAT: SecretFormat = { prefix: 'RK', byteLength: 32, label: 'Recovery key' };

/** The admin's day-to-day finance key: 120 random bits, `FK-XXXX-…` (6 groups). */
export class FinanceKey extends VaultSecret {
  static readonly BYTE_LENGTH = FINANCE_KEY_FORMAT.byteLength;

  static fromBytes(bytes: Uint8Array): FinanceKey {
    return new FinanceKey(VaultSecret.canonicalFromBytes(FINANCE_KEY_FORMAT, bytes));
  }

  static create(input: string): FinanceKey {
    return new FinanceKey(VaultSecret.canonicalFromInput(FINANCE_KEY_FORMAT, input));
  }
}

/** The offline recovery key: 256 random bits, `RK-XXXX-…` (13 groups). */
export class RecoveryKey extends VaultSecret {
  static readonly BYTE_LENGTH = RECOVERY_KEY_FORMAT.byteLength;

  static fromBytes(bytes: Uint8Array): RecoveryKey {
    return new RecoveryKey(VaultSecret.canonicalFromBytes(RECOVERY_KEY_FORMAT, bytes));
  }

  static create(input: string): RecoveryKey {
    return new RecoveryKey(VaultSecret.canonicalFromInput(RECOVERY_KEY_FORMAT, input));
  }
}
