import { updateTieFormFields } from '$lib/domain/tieFormSchema';
import * as v from 'valibot';

export const updateTieSchema = v.object(updateTieFormFields);
