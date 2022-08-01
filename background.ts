browser.runtime.onInstalled.addListener(() => {
    browser.browserAction.onClicked.addListener(() => {
        browser.tabs.create({
            "active": true,
            "url": "/filter_page/index.html"
        });
    });
});
