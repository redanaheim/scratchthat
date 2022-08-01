import { Filter } from "./deserialize_filter";

type StorageKeyResults = {
    "filters": Filter[],
    "editor_val": string,
    "named_lists": Record<string, string[]>
}

type StorageKey = keyof StorageKeyResults;

type StorageKeyResult<T extends StorageKey> = StorageKeyResults[T];

type StorageKeyUnion<T extends StorageKey | StorageKey[]> = T extends StorageKey
    ? T
    : T[number];

type StorageKeysResult<T extends StorageKey | StorageKey[]> = { [K in StorageKeyUnion<T>]: StorageKeyResult<K> }

export type Browser = {
    storage: {
        local: {
            get: <T extends StorageKey[] | StorageKey>(keys: T) => Promise<StorageKeysResult<T>>,
            set: (obj: Partial<{ [K in StorageKey]: StorageKeyResult<K> }>) => Promise<unknown>,
        }
    }
}