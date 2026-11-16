import type {FoodFieldErrors} from '../foodEditorValidation';

export const foodFieldProps = (field: string, errors: FoodFieldErrors, prefix: string) => ({
  'data-field': field,
  'aria-invalid': errors[field] ? true as const : undefined,
  'aria-describedby': errors[field] ? `${prefix}-${field}-error` : undefined,
});
export default function FoodFieldError({field, errors, prefix}: {field: string; errors: FoodFieldErrors; prefix: string}) {
  return errors[field] ? <span id={`${prefix}-${field}-error`} className="food-field-error">{errors[field]}</span> : null;
}
