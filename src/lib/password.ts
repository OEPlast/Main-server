import bcrypt from 'bcrypt';

const PEPPER = process.env.PEPPER_SECRET;
// Without this guard a missing pepper hashed every password against the literal string
// "undefined", silently, and every login broke the day the variable was finally set.
if (!PEPPER) {
  throw new Error('Set PEPPER_SECRET in environment variables');
}
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  const peppered = password + PEPPER;
  return bcrypt.hashSync(peppered, SALT_ROUNDS);
}

export async function comparePassword(storedHash: string, password: string): Promise<boolean> {
  const peppered = password + PEPPER;
  return bcrypt.compareSync(peppered, storedHash);
}

export default {
  hashPassword,
  comparePassword,
};
