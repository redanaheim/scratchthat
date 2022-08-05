# Scratch That

A Firefox extension for creating filters that remove/alter text across the web, using regular expressions and complex substitutions

## How to Use

When you click on the extension button in the toolbar, a tab will open allowing you to edit your filters.

Each filter goes on a new line.

### What is a filter?

At the most basic level, a filter specifies some text which will be matched and replaced with some other text.

A filter is composed of three parts, separated by commas: A URL specifier, a target specifier, and a replacement specifier.

### URL Specifiers

A URL specifier specifies the webpages that the filter will be active on. It can take one of three forms:
- A domain name (`twitter.com`)
- A regular expression to match against the URL (`/^http(s)?:\/\/www.google.com\/search\?(.+)/`)
- A wildcard (`*`, matching webpage)

Domain names may only include alphanumeric fragments separated by periods. `twitter.com/i` is not a valid domain name, nor is `https://www.google.com`. Instead, `www.google.com` or just `google.com` should be used.

### Target Specifiers

A target specifier specifies the text to be replaced. It can take one of two forms:
- Exact text (`omg`)
- A regular expression to match against (`/(?:omg)|(?:wow)/i`)

The regular expression may not include the global flag. Valid flags are any of `[dimsuy]`.

Regular expressions may include capture groups.

### Replacement Specifiers

A replacement specifier specifies the text to be substituted for the replacement. It is made up of a series of fragments, each one of which should be one of the following:
- Exact text (`hi my name is`)
- A capture group captured in the regular expression to be inserted, specified by name or number (`($1)` or `($name)`)
- A list

#### Lists

A list specifies possible phrases to insert into the substitution. They can be referenced by name or filled in inline.
Named lists are stored in a separate editor so that they can be really long and not interfere with the filter editor.

A list takes one of the following forms:

- `(<seed>,<periodization>,<name>)`
- `(<seed>,<periodization>,<elements>)`, where the elements are comma-separated and there are at least two elements.

The seed is either a number used to pick a random element from the list (preferably a large prime) or `autogen`. If the seed is `autogen`, an autogenerated large prime seed will be created for the list that only changes when the list's content changes.

The periodization is one of `inst`, `min`, `hr`, `day`, `wk`. It specifies when the random element selected from the list for insertion will change. If `inst` is specified, the element picked will change every time a substitution is made.

For example, if the list `(autogen,inst,Jimmy John,Papa Murphy)` is used in the replacement specifier, either "Jimmy John" or "Papa Murphy" will be inserted into the substitution at random each time.

If `day` was used instead of `inst`, each day one of "Jimmy John" or "Papa Murphy" would be picked and inserted into the substitution for that whole day.

#### How to Edit Named Lists

To make or edit a named list, open the Scratch That extension page by clicking on the button and click "+" next to "List:" in the upper left hand corner. Click on the dropdown menu next to "Editing" at the middle of the top of the window. Select the newly created list. It will bring you to an editor. Each line you type in the editor is an element of the named list which can be selected. You can rename the list you're editing using the "Rename" button and remove it using the "-" button.

List edits will automatically save, as indicated in the top right hand corner (the filter list does not automatically save the filters, though editor content will be preserved when the tab is closed.)