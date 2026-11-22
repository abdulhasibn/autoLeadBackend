import { InvalidMobileError } from '../../domain/errors/invalid-mobile.error';
import { IndianMobile } from '../../domain/indian-mobile.value-object';
import type { IPreferenceIntake } from '../../domain/preference-intake.port';
import type { AttributedTouch, ShowroomLocation } from '../../domain/test-drive-intake.port';
import type { ITouchClassifier, VisitorTouch } from '../../domain/touch-classifier.port';

export interface SubmitPreferenceCommand {
  readonly fullName: string;
  readonly phone: string;
  readonly ipHash: string;
  readonly attribution?: {
    readonly visitorId: string;
    readonly sessionId: string;
    readonly firstTouch: VisitorTouch;
    readonly lastTouch: VisitorTouch;
  };
  /** Rupees. */
  readonly budgetMax?: number;
  readonly bodyTypes?: readonly string[];
  readonly fuelTypes?: readonly string[];
  readonly transmissions?: readonly string[];
  readonly make?: string;
  readonly model?: string;
  readonly makeId?: string;
  readonly modelId?: string;
  readonly variantId?: string;
  readonly referenceVehicleId?: string;
}

export interface PreferenceReceiptDto {
  readonly outcome: 'created' | 'updated';
  readonly showroom: ShowroomLocation | null;
}

/**
 * A website visitor says what they are looking for. It always lands as a lead
 * (or a merge into their open one); the car-less lead has no vehicle to link.
 */
export class SubmitPreferenceUseCase {
  constructor(
    private readonly intake: IPreferenceIntake,
    private readonly touchClassifier: ITouchClassifier,
  ) {}

  async execute(command: SubmitPreferenceCommand): Promise<PreferenceReceiptDto> {
    const phone = IndianMobile.parse(command.phone);
    if (phone === null) {
      throw new InvalidMobileError();
    }

    const result = await this.intake.submit({
      fullName: command.fullName.trim().replace(/\s+/g, ' '),
      phone: phone.value,
      ipHash: command.ipHash,
      attribution:
        command.attribution === undefined
          ? null
          : {
              visitorId: command.attribution.visitorId,
              sessionId: command.attribution.sessionId,
              firstTouch: this.attribute(command.attribution.firstTouch),
              lastTouch: this.attribute(command.attribution.lastTouch),
            },
      budgetMax: command.budgetMax ?? null,
      bodyTypes: command.bodyTypes ?? [],
      fuelTypes: command.fuelTypes ?? [],
      transmissions: command.transmissions ?? [],
      make: blankToNull(command.make),
      model: blankToNull(command.model),
      makeId: command.makeId ?? null,
      modelId: command.modelId ?? null,
      variantId: command.variantId ?? null,
      referenceVehicleId: command.referenceVehicleId ?? null,
    });

    return { outcome: result.outcome, showroom: result.showroom };
  }

  private attribute(touch: VisitorTouch): AttributedTouch {
    const { channel, referrerHost } = this.touchClassifier.classify(touch);
    return {
      channel,
      utmSource: touch.utmSource ?? null,
      utmMedium: touch.utmMedium ?? null,
      utmCampaign: touch.utmCampaign ?? null,
      utmContent: touch.utmContent ?? null,
      utmTerm: touch.utmTerm ?? null,
      referrerHost,
      landingPath: touch.landingPath,
    };
  }
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}
