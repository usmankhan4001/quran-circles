import { z } from 'zod';

/** The parts of a zod schema's internals (`_zod`) that `lazy` reads. */
interface Internals {
  constr: (def: unknown) => unknown;
  def: unknown;
  bag: Record<string, unknown>;
}
interface Built {
  _zod: Internals;
}

/**
 * Carries over what zod's factories change on a schema after constructing it, which running the
 * constructor again does not repeat: the parent `clone` records (for inherited metadata), extra
 * `bag` entries, and internals a factory replaces (`z.instanceof` swaps in its own `check` so the
 * refusal is `invalid_type`). A replaced function is told apart from the constructor's own by its
 * source text; the constructor's closures are left alone, because they must point at the stand-in.
 */
function adoptChanges(mine: Internals, theirs: Internals): void {
  const target = mine as unknown as Record<PropertyKey, unknown>;
  const source = theirs as unknown as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(source)) {
    if (key === 'deferred') continue;
    const value = source[key];
    const current = target[key];
    if (key === 'bag') {
      Object.assign(current as object, value);
    } else if (!(key in target)) {
      target[key] = value;
    } else if (
      typeof value === 'function' &&
      (typeof current !== 'function' || String(value) !== String(current))
    ) {
      target[key] = value;
    }
  }
}

/**
 * Builds a schema the first time anything reads from it, not when the module is imported.
 *
 * Zod builds every schema object eagerly, and `@qc/contracts` declares a few hundred of them. On a
 * low-end phone that was about a quarter of a second of start-up spent on schemas the first screen
 * never uses. `lazy(() => z.object({ ... }))` returns a stand-in object instead. The first property
 * read, `in` check or assignment on it (`parse`, `safeParse`, `optional()`, `_zod`, `instanceof`,
 * and zod reading it as part of a parent schema) runs `build` once and turns the stand-in into the
 * schema itself: same prototype, same internals, same registered metadata (`id`, `examples`,
 * `description`). From then on it is an ordinary zod schema with no wrapper in the way, so parsing,
 * refusals, issue codes and the JSON Schema output are exactly those of the built schema.
 *
 * The stand-in is the only object the rest of the code ever sees, so identity stays consistent:
 * parents hold it, `X.optional()` wraps it, and the metadata registry knows it. Listing its own
 * keys before the first read gives nothing; nothing in the contracts does that.
 *
 * Internal to the package: every exported schema keeps its name, type and behaviour.
 */
export function lazy<T extends z.core.$ZodType>(build: () => T): T {
  const standIn: object = {};
  let state: 'waiting' | 'building' | 'built' = 'waiting';

  const materialise = (): void => {
    if (state === 'built') return;
    if (state === 'building') {
      throw new Error('@qc/contracts: a lazy schema was read while it was being built');
    }
    state = 'building';
    try {
      become(build());
    } catch (error) {
      state = 'waiting';
      throw error;
    }
    state = 'built';
  };

  const become = (built: T): void => {
    // Run the built schema's own constructor again with the stand-in as the instance, as zod's
    // `clone` does, so every closure zod keeps in the internals points at the stand-in. The
    // definition (and so every child schema) is shared, not rebuilt.
    const internals = (built as unknown as Built)._zod;
    Object.setPrototypeOf(standIn, Object.getPrototypeOf(built) as object);
    Reflect.apply(internals.constr, standIn, [internals.def]);
    adoptChanges((standIn as unknown as Built)._zod, internals);
    const registry = z.globalRegistry as unknown as {
      _map: WeakMap<object, unknown>;
      add(schema: object, meta: unknown): unknown;
    };
    if (registry._map.has(built)) registry.add(standIn, registry._map.get(built));
  };

  // Sits below the stand-in only until the first read. Reads that miss the stand-in's own
  // properties reach this proxy, which builds the schema and answers from the real prototype.
  const trigger = new Proxy(Object.create(null) as object, {
    get(_target, key, receiver) {
      materialise();
      return Reflect.get(standIn, key, receiver);
    },
    has(_target, key) {
      materialise();
      return Reflect.has(standIn, key);
    },
    set(_target, key, value, receiver) {
      materialise();
      return Reflect.set(standIn, key, value, receiver);
    },
    getPrototypeOf() {
      materialise();
      return Object.getPrototypeOf(standIn) as object | null;
    },
  });
  Object.setPrototypeOf(standIn, trigger);
  return standIn as T;
}

/** True once `value`, made by `lazy`, has been built (or for anything `lazy` did not make). */
export function isBuilt(value: object): boolean {
  return Object.prototype.hasOwnProperty.call(value, '_zod');
}
