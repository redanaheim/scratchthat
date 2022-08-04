export const except_key = <T>(val: Record<string, T>, key: string, modifier: (current_val: Record<string, T>, prev_val: Record<string, T>) => void): Record<string, T> => {
    const res: Record<string, T> = {};
    for (const obj_key in val) {
        if (obj_key !== key) {
            res[obj_key] = val[obj_key];
        }
        else {
            modifier(res, val);
        }
    }
    return res;
}

export const exclude_key = <T>(val: Record<string, T>, key: string): Record<string, T> => {
    return except_key(val, key, () => void 0);
}