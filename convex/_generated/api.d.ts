/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */


import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as actions from "../actions.js";
import type * as agent from "../agent.js";
import type * as authz from "../authz.js";
import type * as birthdays from "../birthdays.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as migration from "../migration.js";
import type * as migrations from "../migrations.js";
import type * as mutations from "../mutations.js";
import type * as pushActions from "../pushActions.js";
import type * as queries from "../queries.js";
import type * as suggestions from "../suggestions.js";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  agent: typeof agent;
  authz: typeof authz;
  birthdays: typeof birthdays;
  crons: typeof crons;
  http: typeof http;
  migration: typeof migration;
  migrations: typeof migrations;
  mutations: typeof mutations;
  pushActions: typeof pushActions;
  queries: typeof queries;
  suggestions: typeof suggestions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
