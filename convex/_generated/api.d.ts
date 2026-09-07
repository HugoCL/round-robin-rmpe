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
import type * as adminDirectory from "../adminDirectory.js";
import type * as adminOps from "../adminOps.js";
import type * as agent from "../agent.js";
import type * as announcements from "../announcements.js";
import type * as appAdmins from "../appAdmins.js";
import type * as appConfig from "../appConfig.js";
import type * as appSettings from "../appSettings.js";
import type * as authz from "../authz.js";
import type * as birthdays from "../birthdays.js";
import type * as crons from "../crons.js";
import type * as featureFlags from "../featureFlags.js";
import type * as http from "../http.js";
import type * as maintenanceLog from "../maintenanceLog.js";
import type * as migration from "../migration.js";
import type * as migrations from "../migrations.js";
import type * as mutations from "../mutations.js";
import type * as pushActions from "../pushActions.js";
import type * as queries from "../queries.js";
import type * as reviewerLookup from "../reviewerLookup.js";
import type * as suggestions from "../suggestions.js";
import type * as surveys from "../surveys.js";
import type * as teamRoles from "../teamRoles.js";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  adminDirectory: typeof adminDirectory;
  adminOps: typeof adminOps;
  agent: typeof agent;
  announcements: typeof announcements;
  appAdmins: typeof appAdmins;
  appConfig: typeof appConfig;
  appSettings: typeof appSettings;
  authz: typeof authz;
  birthdays: typeof birthdays;
  crons: typeof crons;
  featureFlags: typeof featureFlags;
  http: typeof http;
  maintenanceLog: typeof maintenanceLog;
  migration: typeof migration;
  migrations: typeof migrations;
  mutations: typeof mutations;
  pushActions: typeof pushActions;
  queries: typeof queries;
  reviewerLookup: typeof reviewerLookup;
  suggestions: typeof suggestions;
  surveys: typeof surveys;
  teamRoles: typeof teamRoles;
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
