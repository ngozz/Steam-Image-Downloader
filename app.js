document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('fetch-form');
    const input = document.getElementById('app-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const statusMsg = document.getElementById('status-message');
    const resultsContainer = document.getElementById('results-container');
    const gameInfoContainer = document.getElementById('game-info-container');
    const gamePosterImg = document.getElementById('game-poster');
    const gameNameEl = document.getElementById('game-name');
    const downloadAllBtn = document.getElementById('download-all-btn');

    let parsedCategories = []; // Will hold all parsed data for "Download All"

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputValue = input.value.trim();
        if (!inputValue) return;

        // Extract App ID
        // Supports plain numbers or URLs like https://store.steampowered.com/app/1119980/
        let appId = inputValue;
        const urlMatch = inputValue.match(/(?:app|sub)\/(\d+)/) || inputValue.match(/appid-(\d+)/);
        if (urlMatch && urlMatch[1]) {
            appId = urlMatch[1];
        } else if (!/^\d+$/.test(appId)) {
            showStatus('Invalid input. Please provide a numeric App ID or a valid Steam Store link.', 'error');
            return;
        }

        fetchImages(appId);
    });

    async function fetchImages(appId) {
        showStatus(`Fetching data for App ID ${appId}...`, 'info', true);
        fetchBtn.disabled = true;
        fetchBtn.textContent = 'Fetching...';
        resultsContainer.innerHTML = '';
        gameInfoContainer.style.display = 'none';
        parsedCategories = [];

        try {
            const targetUrl = `https://www.steamcardexchange.net/index.php?gamepage-appid-${appId}`;
            // Use corsproxy.io to bypass CORS
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch data (Status ${response.status})`);
            }

            const html = await response.text();
            
            // Basic sanity check to see if the page is a valid SteamCardExchange app page
            if (html.includes('Game not found') || !html.includes('showcase-element-container') && !html.includes('tracking-wider')) {
                throw new Error('Game not found on SteamCardExchange.');
            }

            parseHTML(html);
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Fetch Images';
        }
    }

    function parseHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract Game Name and Poster
        const titleEl = doc.querySelector('title');
        gameNameEl.textContent = titleEl ? titleEl.textContent.replace('Showcase :: ', '').trim() : 'Unknown Game';
        
        let gamePoster = '';
        const ogImage = doc.querySelector('meta[property="og:image"]');
        if (ogImage) {
            // Replace the small thumbnail with the high res header and fix double slashes from steam cdn
            gamePoster = ogImage.content.replace('header_292x136.jpg', 'header.jpg').replace('//steam/', '/steam/');
        }
        gamePosterImg.src = gamePoster;

        // SteamCardExchange groups items in .grid containers preceded by headers.
        // The headers are usually inside <span class="tracking-wider...">
        const headers = doc.querySelectorAll('span.tracking-wider');
        let totalItems = 0;

        headers.forEach(headerSpan => {
            const categoryName = headerSpan.textContent.trim();
            if (!categoryName) return;

            // Skip unwanted categories
            if (categoryName === 'Booster Pack' || categoryName === 'Foil Trading Cards') {
                return;
            }

            // Navigate up to the header's container, then find the next sibling which is the grid
            const headerContainer = headerSpan.closest('.flex.items-center');
            if (!headerContainer) return;

            const gridContainer = headerContainer.nextElementSibling;
            if (!gridContainer || !gridContainer.classList.contains('grid')) return;

            const items = gridContainer.querySelectorAll('.flex.flex-col.items-center');
            if (items.length === 0) return;

            const categoryData = {
                name: categoryName,
                items: []
            };

            items.forEach(itemNode => {
                // Title
                const titleNode = itemNode.querySelector('.text-sm.text-center');
                let title = titleNode ? titleNode.textContent.trim() : 'Unknown Item';
                
                // Cleanup title for filenames (remove invalid characters)
                title = title.replace(/[\\/:*?"<>|]/g, '');

                // Media URL
                let mediaUrl = '';
                let isVideo = false;

                const videoLink = itemNode.querySelector('.gallery-video-src');
                const imgLink = itemNode.querySelector('.gallery-src');
                
                // Some items (like emoticons) have two images, the first is a tiny chat preview, the second is the real one.
                const allImgs = itemNode.querySelectorAll('img');
                const imgTag = Array.from(allImgs).find(img => !img.src.includes('/economy/emoticon/')) || allImgs[allImgs.length - 1];

                if (videoLink && videoLink.href) {
                    mediaUrl = videoLink.href;
                    isVideo = true;
                } else if (imgLink && imgLink.href) {
                    mediaUrl = imgLink.href;
                } else if (imgTag && imgTag.src) {
                    mediaUrl = imgTag.src;
                }

                if (mediaUrl) {
                    // Extract filename and extension
                    const urlParts = mediaUrl.split('?')[0].split('/');
                    const originalFilename = urlParts[urlParts.length - 1] || 'image.jpg';
                    const ext = originalFilename.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
                    
                    const filename = `${title}.${ext}`;

                    categoryData.items.push({
                        title: title,
                        url: mediaUrl,
                        filename: filename,
                        isVideo: isVideo
                    });
                    totalItems++;
                }
            });

            if (categoryData.items.length > 0) {
                parsedCategories.push(categoryData);
            }
        });

        if (parsedCategories.length === 0) {
            showStatus('Game not found on SteamCardExchange.', 'error');
            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Fetch Images';
            return;
        }

        renderResults();
        showStatus(`Successfully loaded ${totalItems} items across ${parsedCategories.length} categories.`, 'success');
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'Fetch Images';
        gameInfoContainer.style.display = 'flex';
    }

    function renderResults() {
        parsedCategories.forEach((category, catIndex) => {
            const section = document.createElement('div');
            section.className = 'category-section';

            const header = document.createElement('div');
            header.className = 'category-header';
            
            const title = document.createElement('h2');
            title.textContent = `${category.name} (${category.items.length})`;
            
            const catDlBtn = document.createElement('button');
            catDlBtn.className = 'btn-category-dl';
            catDlBtn.textContent = 'Download Category';
            catDlBtn.onclick = (e) => downloadCategory(catIndex, e.target);

            header.appendChild(title);
            header.appendChild(catDlBtn);
            section.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'items-grid';

            category.items.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'item-card';

                const mediaContainer = document.createElement('div');
                mediaContainer.className = 'item-media';

                if (item.isVideo) {
                    const video = document.createElement('video');
                    video.src = item.url;
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true;
                    video.playsInline = true;
                    mediaContainer.appendChild(video);
                } else {
                    const img = document.createElement('img');
                    img.src = item.url;
                    img.alt = item.title;
                    img.loading = 'lazy';
                    mediaContainer.appendChild(img);
                }

                const info = document.createElement('div');
                info.className = 'item-info';

                const itemTitle = document.createElement('div');
                itemTitle.className = 'item-title';
                itemTitle.textContent = item.title;

                const dlBtn = document.createElement('button');
                dlBtn.className = 'btn-download';
                dlBtn.textContent = 'Download';
                dlBtn.onclick = (e) => downloadSingle(item.url, item.filename, e.target);

                info.appendChild(itemTitle);
                info.appendChild(dlBtn);

                card.appendChild(mediaContainer);
                card.appendChild(info);
                grid.appendChild(card);
            });

            section.appendChild(grid);
            resultsContainer.appendChild(section);
        });
    }

    async function downloadSingle(url, filename) {
        try {
            // Use wsrv.nl proxy for images as it handles CORS perfectly. For videos, try direct fetch.
            const isVideo = url.endsWith('.mp4') || url.endsWith('.webm');
            const fetchUrl = isVideo ? url : `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error('Proxy fetch failed');
            const blob = await response.blob();
            saveAs(blob, filename);
        } catch (err) {
            console.error('Download failed:', err);
            // Fallback: open in new tab (original url, no proxy needed for basic navigation)
            window.open(url, '_blank');
        }
    }

    // Download a whole category as a ZIP
    async function downloadCategory(index, btnElement) {
        const category = parsedCategories[index];
        if (!category) return;
        
        const originalText = btnElement ? btnElement.textContent : 'Download Category';
        if (btnElement) {
            btnElement.disabled = true;
            btnElement.textContent = 'Zipping...';
        }
        
        showStatus(`Zipping category: ${category.name}...`, 'info', true);
        try {
            await createAndDownloadZip(category.items, `${category.name}.zip`);
            showStatus(`Category ${category.name} downloaded successfully!`, 'success');
        } catch (err) {
            console.error(err);
            showStatus(`Error creating category ZIP.`, 'error');
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.textContent = originalText;
            }
        }
    }

    // Global Download All
    downloadAllBtn.addEventListener('click', async () => {
        const originalText = downloadAllBtn.textContent;
        downloadAllBtn.disabled = true;
        downloadAllBtn.textContent = 'Zipping Everything...';
        
        showStatus(`Zipping everything... This might take a while depending on the amount of images.`, 'info', true);
        try {
            let allItems = [];
            
            // Add Game Poster to the zip if it exists
            if (gamePosterImg.src && !gamePosterImg.src.endsWith(window.location.host + '/')) {
                const ext = gamePosterImg.src.split('.').pop() || 'jpg';
                allItems.push({
                    url: gamePosterImg.src,
                    filename: `poster.${ext}`,
                    zipPath: `poster.${ext}`,
                    isVideo: false
                });
            }

            parsedCategories.forEach(cat => {
                const itemsWithPrefix = cat.items.map(item => ({
                    ...item,
                    zipPath: `${cat.name}/${item.filename}`
                }));
                allItems = allItems.concat(itemsWithPrefix);
            });

            // Sanitize game name to ensure it's a valid filename with spaces
            const safeGameName = gameNameEl.textContent.replace(/[\\/:*?"<>|]/g, '').trim();
            await createAndDownloadZip(allItems, `${safeGameName || 'Steam_Items_All'}.zip`, true);
            showStatus(`All items downloaded successfully!`, 'success');
        } catch (err) {
            console.error(err);
            showStatus(`Error creating ZIP file.`, 'error');
        } finally {
            downloadAllBtn.disabled = false;
            downloadAllBtn.textContent = originalText;
        }
    });

    async function createAndDownloadZip(items, zipFilename, useFolderStructure = false) {
        const zip = new JSZip();
        
        const fetchPromises = items.map(async (item) => {
            try {
                const isVideo = item.url.endsWith('.mp4') || item.url.endsWith('.webm');
                const fetchUrl = isVideo ? item.url : `https://wsrv.nl/?url=${encodeURIComponent(item.url)}`;
                const response = await fetch(fetchUrl);
                if (response.ok) {
                    const blob = await response.blob();
                    const path = useFolderStructure && item.zipPath ? item.zipPath : item.filename;
                    zip.file(path, blob);
                } else {
                    console.warn(`Failed to fetch ${item.url}`);
                }
            } catch (err) {
                console.error(`Failed to fetch ${item.url}:`, err);
            }
        });

        await Promise.all(fetchPromises);
        
        const zipContent = await zip.generateAsync({ type: 'blob' });
        saveAs(zipContent, zipFilename);
    }

    let statusTimeout;
    function showStatus(message, type = 'info', persistent = false) {
        statusMsg.textContent = message;
        statusMsg.className = `show ${type}`;
        
        clearTimeout(statusTimeout);
        if (!persistent) {
            statusTimeout = setTimeout(() => {
                statusMsg.classList.remove('show');
            }, 5000);
        }
    }
});