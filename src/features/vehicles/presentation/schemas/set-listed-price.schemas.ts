import { z } from 'zod';

// numeric(12, 2) in the database; whole rupees are all the UI ever sends.
const MAX_LISTED_PRICE = 9_999_999_999;

export const setListedPriceBodySchema = z.object({
  listedPrice: z
    .number({ error: 'listedPrice must be a number or null' })
    .int('listedPrice must be whole rupees')
    .positive('listedPrice must be greater than 0')
    .max(MAX_LISTED_PRICE, 'listedPrice is too large')
    .nullable(),
});
