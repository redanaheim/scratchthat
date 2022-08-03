// Only allow one tab to be opened with the btn
// If there are multiple open, it will cause conflicting versions within the editors
// People can still bug it out by manually copying the tab URL but who cares

let tab: Tab | undefined = undefined;

const handle_update = (id: number) => {
    let listener = (removed_id, _r) => {
        console.log(id);
        if (id === removed_id) {
            tab = undefined;
            browser.tabs.onRemoved.removeListener(listener);
        }
    }
    browser.tabs.onRemoved.addListener(listener);
}

browser.runtime.onInstalled.addListener(() => {
    browser.browserAction.onClicked.addListener(async () => {
        if (tab === undefined) {
            tab = await browser.tabs.create({
                "active": true,
                "url": "/filter_page/dist/index.html"
            });
            handle_update(tab.id);
        }
        else {
            tab = await browser.tabs.update(tab.id, { active: true });
        }
    });
});
