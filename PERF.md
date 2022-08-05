# Perf Issues

The replacement procedure is currently extremely slow (400-500ms/page load). 
- It must monitor the DOM for changes, then recursively travel the changed elements and check for text nodes.
- Once it finds a text node, it has to travel all the way up the parent hierarchy to deduce whether it is the child of an editable element. If so, it can't replace.
- Once it finds a text node it can replace in, it has to check each filter against its contents (this part isn't too slow).

## Remedies

- Find a way to avoid the parent hierarchy travel (that is very slow for every text node).
- Make the checks asynchronous, at least, so they're non-blocking. (tough because the MutationObserver needs to be stopped while modifications are being made, but we can't miss anything either. modification queue?)
- Use WASM (it's questionable the perf improvement this would give)
- Determine whether it's necessary to recursively travel the changed elements.