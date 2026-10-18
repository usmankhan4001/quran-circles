// Stands in, in the web bundle, for the parts of zod the app never runs (metro.redirects.cjs):
// JSON Schema output and input (`z.toJSONSchema`, `z.fromJSONSchema`, a schema's
// `toJSONSchema()`) and ahead-of-time compiling (`z.compile`). Parsing and validation do not use
// them. They are about 20 KB gzip of the first screen's JavaScript.
//
// Every export of the modules it replaces is here, so nothing is undefined; calling one throws
// and says why. A test checks the names against zod's own files.
const LEFT_OUT =
  "This part of zod (JSON Schema, z.compile) is left out of the web bundle: see the app's metro.redirects.cjs.";

function leftOut() {
  throw new Error(LEFT_OUT);
}

// zod/v4/core/compile.js
export const INVALID = Symbol.for('zod.compile.invalid');
export class ZodCompileAsyncError extends Error {}
export class ZodCompileUnsupportedError extends Error {}
export const compile = leftOut;
export const compileFn = leftOut;
export const withParser = leftOut;

// zod/v4/core/to-json-schema.js. A schema's `~standard` builds these two methods when it is read.
export const createStandardJSONSchemaMethod = () => leftOut;
export const createToJSONSchemaMethod = () => leftOut;
export const extractDefs = leftOut;
export const finalize = leftOut;
export const handleUnrepresentable = leftOut;
export const initializeContext = leftOut;
export const process = leftOut;
export const processSchema = leftOut;

// zod/v4/core/json-schema-processors.js
export const allProcessors = {};
export const aggregateChecks = leftOut;
export const toJSONSchema = leftOut;
export const anyProcessor = leftOut;
export const arrayProcessor = leftOut;
export const bigintProcessor = leftOut;
export const booleanProcessor = leftOut;
export const catchProcessor = leftOut;
export const customProcessor = leftOut;
export const dateProcessor = leftOut;
export const defaultProcessor = leftOut;
export const enumProcessor = leftOut;
export const fileProcessor = leftOut;
export const functionProcessor = leftOut;
export const intersectionProcessor = leftOut;
export const lazyProcessor = leftOut;
export const literalProcessor = leftOut;
export const mapProcessor = leftOut;
export const nanProcessor = leftOut;
export const neverProcessor = leftOut;
export const nonoptionalProcessor = leftOut;
export const nullProcessor = leftOut;
export const nullableProcessor = leftOut;
export const numberProcessor = leftOut;
export const objectProcessor = leftOut;
export const optionalProcessor = leftOut;
export const pipeProcessor = leftOut;
export const prefaultProcessor = leftOut;
export const promiseProcessor = leftOut;
export const readonlyProcessor = leftOut;
export const recordProcessor = leftOut;
export const setProcessor = leftOut;
export const stringProcessor = leftOut;
export const successProcessor = leftOut;
export const symbolProcessor = leftOut;
export const templateLiteralProcessor = leftOut;
export const transformProcessor = leftOut;
export const tupleProcessor = leftOut;
export const undefinedProcessor = leftOut;
export const unionProcessor = leftOut;
export const unknownProcessor = leftOut;
export const voidProcessor = leftOut;

// zod/v4/classic/from-json-schema.js and zod/v4/core/json-schema-generator.js
export const fromJSONSchema = leftOut;
export class JSONSchemaGenerator {
  constructor() {
    leftOut();
  }
}
