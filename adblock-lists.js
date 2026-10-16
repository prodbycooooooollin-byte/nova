// The filter lists Nova's ad blocker is built from: uBlock Origin's own lists plus EasyList and EasyPrivacy, and uBlock Origin's
// scriptlet resources (they power the "+js(...)" rules that defuse YouTube ads and anti-adblock walls). A snapshot of every file is
// bundled in assets/filters so the blocker works on the very first start and offline (scripts/fetch-filters.js refreshes the snapshot).
module.exports = {
  lists: [
    { file: 'ubo-filters.txt', url: 'https://ublockorigin.github.io/uAssets/filters/filters.txt' },
    { file: 'ubo-badware.txt', url: 'https://ublockorigin.github.io/uAssets/filters/badware.txt' },
    { file: 'ubo-privacy.txt', url: 'https://ublockorigin.github.io/uAssets/filters/privacy.txt' },
    { file: 'ubo-quick-fixes.txt', url: 'https://ublockorigin.github.io/uAssets/filters/quick-fixes.txt' },
    { file: 'ubo-unbreak.txt', url: 'https://ublockorigin.github.io/uAssets/filters/unbreak.txt' },
    { file: 'easylist.txt', url: 'https://easylist.to/easylist/easylist.txt' },
    { file: 'easyprivacy.txt', url: 'https://easylist.to/easylist/easyprivacy.txt' },
  ],
  resources: { file: 'resources.json', url: 'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/ublock-origin/resources.json' },
};
