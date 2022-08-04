import { named_list_store, EDITING_FILTER } from "./state";

export const add_list = () => {
    named_list_store.update(prev_val => {
        if ("unnamed_list" in prev_val) {
            let i = 2;
            while (`unnamed_list_${i}` in prev_val) {
                i++;
            }
            return {
                ...prev_val,
                [`unnamed_list_${i}`]: []
            };
        }
        else return {
            ...prev_val,
            unnamed_list: []
        };
    });
};

export const remove_list = (get_editing: () => string, set_editing: (arg0: string) => void): (() => void) => {
    return () => {
        const editing = get_editing();
        named_list_store.update(prev_val => {
            if (editing !== EDITING_FILTER && editing in prev_val) {
                const res: Record<string, string[]> = {};
                for (const key in prev_val) {
                    if (key !== editing) {
                        res[key] = prev_val[key];
                    }
                }
                set_editing(EDITING_FILTER);
                return res;
            }
            else {
                console.log(`Cannot remove list - a valid list is not selected.`);
                return prev_val;
            }
        });
    }
}

export const rename_list = (get_editing: () => string, set_editing: (arg0: string) => void): ((new_name: string) => void) => {
    return new_name => {
        const editing = get_editing();
        let did_change = false;
        named_list_store.update(prev_val => {
            if (editing !== EDITING_FILTER && editing in prev_val) {
                const res: Record<string, string[]> = {};
                for (const key in prev_val) {
                    if (key !== editing) {
                        res[key] = prev_val[key];
                    }
                    else {
                        res[new_name] = prev_val[key];
                    }
                }
                did_change = true;
                return res;
            }
            else {
                console.log(`Cannot rename list - a valid list is not selected.`);
                return prev_val;
            }
        });
        if (did_change) set_editing(new_name);
    }
}