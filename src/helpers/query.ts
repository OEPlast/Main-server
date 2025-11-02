/**
 * Builds MongoDB update query with $set and $unset operators
 * @param updates - Object with update values
 * @param removeValues - Values that trigger field removal (default: null, '', 'null')
 * @returns MongoDB update query object
 */
export function buildUpdateQuery<T extends Record<string, any>>(
  updates: Partial<T>,
  removeValues: any[] = [null, '', 'null']
): { $set?: Partial<T>; $unset?: Record<string, ''> } {
  const setFields: Partial<T> = {};
  const unsetFields: Record<string, ''> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue; // Skip undefined (field not provided)

    if (removeValues.includes(value)) {
      unsetFields[key] = '';
    } else {
      setFields[key as keyof T] = value;
    }
  }

  const query: { $set?: Partial<T>; $unset?: Record<string, ''> } = {};
  if (Object.keys(setFields).length > 0) query.$set = setFields;
  if (Object.keys(unsetFields).length > 0) query.$unset = unsetFields;

  return query;
}