import mongoose, { InferSchemaType } from 'mongoose';

/**
 * Atomic named counters.
 *
 * Introduced for human-readable order numbers: orders previously had no reference of their
 * own, so emails, the admin panel and support all quoted the raw Mongo `_id` — or, in the
 * case of the order-confirmation and delivered emails, quoted a field that did not exist and
 * rendered `undefined`.
 *
 * Keys are namespaced by what they count and the period they reset on, e.g. `order:2608`.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

export type CounterType = InferSchemaType<typeof counterSchema>;
const Counter = mongoose.model('Counter', counterSchema);

/**
 * Increments `key` and returns the new value.
 *
 * Deliberately runs outside any caller transaction: a burnt sequence number when a
 * transaction aborts is a harmless gap in the order reference, whereas creating the counter
 * document inside a transaction is a failure mode we do not want on the checkout path.
 */
export async function nextSequence(key: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return counter?.seq ?? 1;
}

/**
 * Raises `key` to at least `value`. Used by the order-number backfill so newly created
 * orders cannot collide with the references it assigned to historical ones.
 */
export async function ensureSequenceAtLeast(key: string, value: number): Promise<void> {
  await Counter.findByIdAndUpdate(key, { $max: { seq: value } }, { upsert: true, setDefaultsOnInsert: true });
}

export default Counter;
