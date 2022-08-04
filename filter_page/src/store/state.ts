import type { Filter } from "../deserialize_filter";
import { writable } from "svelte/store";

type StorageKeyResults = {
    "filters": Filter[],
    "editor_val": string,
    "named_lists": Record<string, string[]>
}

type StorageKey = keyof StorageKeyResults;

type StorageKeyResult<T extends StorageKey> = StorageKeyResults[T];

type StorageKeysResult<T extends StorageKey[]> = { [K in T[number]]: StorageKeyResult<K> | undefined | null }

export type Browser = {
    storage: {
        local: {
            get: <T extends StorageKey[]>(keys: T) => Promise<StorageKeysResult<T>>,
            set: (obj: Partial<{ [K in StorageKey]: StorageKeyResult<K> }>) => Promise<unknown>,
        }
    }
}

type UndefinedOrNull<T> = T | null | undefined;
type UndefinedOrNullFixer<T> = (arg0: UndefinedOrNull<T>) => T;

export const EDITING_FILTER = "0";

export const undef_or_null_default = <T>(def: T): UndefinedOrNullFixer<T> => {
    return x => {
        if (x === null || x === undefined) return def;
        else return x;
    }
}

/**
 * Creates a store which can be used for persistent extension storage
 * @param key The string indicating the key in persistent extension storage
 * @param browser The browser object
 * @param value_map A map from the original value from persistent extension storage, which may include undefined or null, to an initial value
 * @param update_predicate A predicate that should return true when a store value change should be reflected in persistent extension storage
 * @returns Writable
 */
export const persistent_store = async <Name extends StorageKey, ResultantValue extends Awaited<StorageKeysResult<[Name]>>[Name]>(key: Name, browser: Browser, value_map: (arg0: Awaited<StorageKeysResult<[Name]>>[Name]) => ResultantValue, update_predicate: (val: ResultantValue) => (boolean | Promise<boolean>)) => {

    // Update value when promise returns
    const original_value = (await browser.storage.local.get([key] as [Name]))[key];

    const store = writable(value_map(original_value));

    const _unsubscribe = store.subscribe(val => {
        const res = update_predicate(val);
        const promise = typeof res === "boolean" ? new Promise<boolean>((resolve) => { resolve(res) }) : res;
        promise.then((resolved) => {
            if (resolved) {
                browser.storage.local.set({
                    [key]: val
                }).then(() => {
                    console.log(`Updated store value - ${key}`)
                });
            }
        });
    });

    return store;
}

declare const browser: Browser;

export const editor_val_store = await persistent_store(
    "editor_val", 
    browser, 
    undef_or_null_default<string>(""),
    // Always update the persistent value when the store value changes
    () => true
);

export const filter_list_store = await persistent_store(
    "filters", 
    browser, 
    undef_or_null_default<Filter[]>([]),
    // Always update the persistent value when the store value changes
    () => true
);

export const named_list_store = await persistent_store(
    "named_lists",
    browser,
    undef_or_null_default<Record<string,string[]>>({}),
    // Always update the persistent value when the store value changes
    () => true
)