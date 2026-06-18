# Steam Image Downloader

A simple, purely static web app that lets you easily grab high-res Steam trading cards, profile backgrounds, and emoticons for any game. 

It pulls data straight from [SteamCardExchange](https://www.steamcardexchange.net/) and organizes everything into neat categories right in your browser. Originally a [Python script](https://github.com/ngozz/steam-trading-card-images-downloader), it's now fully web-based—no server or backend required!

## What it does
- **Easy Search:** Just drop in a game's App ID or paste the full Steam Store link.
- **Auto-Categorized:** Automatically sorts items into Trading Cards, Backgrounds, Animated Backgrounds, Badges, and Emoticons.
- **Bulk Downloads:** Grab individual items, download a specific category, or hit "Download ALL" to get a neatly organized `.zip` file of everything (including the game's poster).
- **100% Client-Side:** Everything happens locally in your browser. 

## How to use
You can use the live GitHub Pages link directly, or since this is completely static, you can just clone the repo and open `index.html` in your browser and it'll work right out of the box.

## Under the hood
Because browsers normally block cross-origin requests, this app uses `corsproxy.io` and `wsrv.nl` as middlemen to fetch the HTML and images directly from the CDNs. Zipping is handled instantly on your machine using `JSZip` and `FileSaver.js`.

