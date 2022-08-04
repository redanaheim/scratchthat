import { named_list_store, EDITING_FILTER } from "../store/state";
import { except_key, exclude_key } from "./util";

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
                set_editing(EDITING_FILTER);
                return exclude_key(prev_val, editing);
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
                did_change = true;
                return except_key(prev_val, editing, (cur, prev) => { cur[new_name] = prev[editing] });
            }
            else {
                console.log(`Cannot rename list - a valid list is not selected.`);
                return prev_val;
            }
        });
        if (did_change) set_editing(new_name);
    }
}