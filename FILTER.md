# Filter structure

- Contains a URL specifier, target specifier, and replacement specifier, separated by commas

## URL specifier

### Domain name


```
twitter.com
```


- Matches any URL on a specific domain
- Commas must be escaped

### URL regex

```
/^https:\/\/.*twitter\.com/
```

- Match a URL based on a regex

### All

```
*
```

- Match all URLs

## Target specifier

### Raw text

```
lol
```

- Replaces the text exactly
- Commas must be escaped

### Regex

```
/l(.)l/i
```

- Matches text based on a regex, may include capture groups

## Replacement specifier

### Lists

- Allows to select an item from a list for replacement, items are processed in the same way as exact text

- Contains a periodization specifier, one of `min`, `hr`, `day`, `wk`, `inst` specifying when to change the list selection


```
(day, Jimmy, Johnny, Marcus, Jake)
```

### Regex groups

- Allows you to refer to a regex capture group

```
($1)
```

```
($name)
```

### Exact text

- Replace with exact text

```
laughing out loud\n
```

Newlines must be written as `\n`
Parentheses must be escaped
Backslashes not before n or parentheses must be escaped

## Examples

- Replace all instances of "lol" with "laughing out loud" on twitter domain names

```
twitter.com,lol,laughing out loud
```

- Replace all instances of "John Doe" with a random name from a list changing each day on all domains

```
*,John Doe,(autogen, day, James Doe, Jimmy John, Papa Murphy)
```