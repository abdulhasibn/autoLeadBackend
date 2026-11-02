import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import { DEFAULT_FINANCE_TAGS } from '../../domain/default-finance-tags';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import { toFinanceTagId } from '../../domain/finance-tag-id';
import { FinanceTag } from '../../domain/finance-tag.entity';
import type { IFinanceTagRepository } from '../../domain/finance-tag.repository';
import { TagName } from '../../domain/tag-name.value-object';
import type { TagSealer } from './tag.sealer';

/**
 * Creates the client's default tags the first time finance is unlocked. Tag
 * names are encrypted, so this needs an unlocked cipher and can't be a SQL
 * seed. Archived tags count, so it never runs twice.
 */
export class DefaultTagSeeder {
  constructor(
    private readonly tags: IFinanceTagRepository,
    private readonly sealer: TagSealer,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async seedIfEmpty(cipher: FinanceCipher): Promise<void> {
    if ((await this.tags.count()) > 0) {
      return;
    }
    const now = this.clock.now();
    const sealed = DEFAULT_FINANCE_TAGS.map((name) =>
      this.sealer.seal(
        FinanceTag.create({
          id: toFinanceTagId(this.ids.generate()),
          name: TagName.create(name),
          color: null,
          now,
        }),
        cipher,
      ),
    );
    await this.tags.saveMany(sealed);
  }
}
