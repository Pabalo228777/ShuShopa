const searchHistory = [];
let favorites = [];
let currentLang = 'ru';
let currentQuery = '';
let currentOffset = 0;
let currentArticle = null;
let autocompleteTimeout = null;
let currentAutocompleteIndex = -1;
let currentSuggestions = [];

const langConfig = {
    ru: {
        apiBase: 'https://ru.wikipedia.org/w/api.php',
        wikiBase: 'https://ru.wikipedia.org/wiki/',
        placeholder: 'Поиск по русской Wikipedia...',
        notFound: (q) => `По запросу «${q}» ничего не найдено.`,
    },
    en: {
        apiBase: 'https://en.wikipedia.org/w/api.php',
        wikiBase: 'https://en.wikipedia.org/wiki/',
        placeholder: 'Search English Wikipedia...',
        notFound: (q) => `Nothing found for "${q}".`,
    }
};

// Autocomplete functions
async function fetchAutocomplete(query) {
    if (!query || query.length < 2) {
        hideAutocomplete();
        return;
    }

    const cfg = langConfig[currentLang];
    const autocompleteDiv = document.getElementById('autocomplete-results');
    autocompleteDiv.innerHTML = '';
    autocompleteDiv.classList.remove('hidden');

    try {
        const searchUrl = `${cfg.apiBase}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        const suggestions = data.query.search;

        if (suggestions.length === 0) {
            autocompleteDiv.innerHTML = '<div class="no-results">Ничего не найдено</div>';
            return;
        }

        currentSuggestions = suggestions;
        renderAutocomplete(suggestions);
    } catch (error) {
        console.error('Autocomplete error:', error);
        hideAutocomplete();
    }
}

function renderAutocomplete(suggestions) {
    const autocompleteDiv = document.getElementById('autocomplete-results');
    autocompleteDiv.innerHTML = '';
    
    suggestions.forEach((suggestion, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        if (index === currentAutocompleteIndex) {
            item.classList.add('active');
        }
        
        const snippet = suggestion.snippet.replace(/<[^>]*>/g, '').slice(0, 100);
        
        item.innerHTML = `
            <div class="autocomplete-title">${escapeHtml(suggestion.title)}</div>
            <div class="autocomplete-snippet">${escapeHtml(snippet)}${snippet.length >= 100 ? '...' : ''}</div>
        `;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('searchInput').value = suggestion.title;
            hideAutocomplete();
            searchWiki();
        });
        
        item.addEventListener('mouseenter', () => {
            currentAutocompleteIndex = index;
            updateAutocompleteActive();
        });
        
        autocompleteDiv.appendChild(item);
    });
}

function updateAutocompleteActive() {
    const items = document.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        if (index === currentAutocompleteIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function hideAutocomplete() {
    const autocompleteDiv = document.getElementById('autocomplete-results');
    autocompleteDiv.classList.add('hidden');
    autocompleteDiv.innerHTML = '';
    currentAutocompleteIndex = -1;
    currentSuggestions = [];
}

function handleAutocompleteKeydown(e) {
    if (!currentSuggestions.length) return false;
    
    const autocompleteDiv = document.getElementById('autocomplete-results');
    if (autocompleteDiv.classList.contains('hidden')) return false;
    
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            currentAutocompleteIndex = Math.min(currentAutocompleteIndex + 1, currentSuggestions.length - 1);
            updateAutocompleteActive();
            scrollToActiveItem();
            return true;
        case 'ArrowUp':
            e.preventDefault();
            currentAutocompleteIndex = Math.max(currentAutocompleteIndex - 1, -1);
            updateAutocompleteActive();
            scrollToActiveItem();
            return true;
        case 'Enter':
            if (currentAutocompleteIndex >= 0 && currentSuggestions[currentAutocompleteIndex]) {
                e.preventDefault();
                const selected = currentSuggestions[currentAutocompleteIndex];
                document.getElementById('searchInput').value = selected.title;
                hideAutocomplete();
                searchWiki();
                return true;
            }
            break;
        case 'Escape':
            hideAutocomplete();
            return true;
    }
    return false;
}

function scrollToActiveItem() {
    const activeItem = document.querySelector('.autocomplete-item.active');
    if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// Favorites functions
function loadFavorites() {
    const saved = localStorage.getItem('wikipedia_favorites');
    if (saved) {
        try {
            favorites = JSON.parse(saved);
        } catch(e) {
            favorites = [];
        }
    }
    renderFavorites();
}

function saveFavorites() {
    localStorage.setItem('wikipedia_favorites', JSON.stringify(favorites));
    renderFavorites();
}

function addToFavorites(article) {
    if (!favorites.some(fav => fav.title === article.title && fav.lang === currentLang)) {
        favorites.push({
            title: article.title,
            url: article.url,
            lang: currentLang,
            snippet: article.snippet,
            thumb: article.thumb,
            timestamp: Date.now()
        });
        saveFavorites();
        updateFavoriteButton(true);
        return true;
    }
    return false;
}

function removeFromFavorites(title) {
    favorites = favorites.filter(fav => !(fav.title === title && fav.lang === currentLang));
    saveFavorites();
    updateFavoriteButton(false);
    renderFavorites();
}

function isFavorite(title) {
    return favorites.some(fav => fav.title === title && fav.lang === currentLang);
}

function toggleCurrentFavorite() {
    if (currentArticle && currentArticle.title) {
        if (isFavorite(currentArticle.title)) {
            removeFromFavorites(currentArticle.title);
        } else {
            addToFavorites(currentArticle);
        }
        updateFavoriteButton(isFavorite(currentArticle.title));
    }
}

function updateFavoriteButton(isFav) {
    const favBtn = document.getElementById('favoriteBtn');
    if (favBtn) {
        favBtn.textContent = isFav ? '★' : '☆';
        if (isFav) {
            favBtn.classList.add('active');
        } else {
            favBtn.classList.remove('active');
        }
    }
}

function renderFavorites() {
    const favoritesDiv = document.getElementById('favoritesList');
    if (!favoritesDiv) return;
    
    if (favorites.length === 0) {
        favoritesDiv.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Нет избранных статей</div>';
        return;
    }
    
    favoritesDiv.innerHTML = '';
    favorites.sort((a, b) => b.timestamp - a.timestamp).forEach(fav => {
        const favItem = document.createElement('div');
        favItem.className = 'favorite-item';
        favItem.innerHTML = `
            <div class="favorite-title" onclick="openFavorite('${escapeHtml(fav.title)}', '${fav.lang}')">
                ${escapeHtml(fav.title)} <span class="result-lang-badge" style="font-size:9px;">${fav.lang.toUpperCase()}</span>
            </div>
            <button class="remove-favorite" onclick="removeFromFavorites('${escapeHtml(fav.title)}')" title="Удалить">✕</button>
        `;
        favoritesDiv.appendChild(favItem);
    });
}

function openFavorite(title, lang) {
    if (lang !== currentLang) {
        setLang(lang);
    }
    document.getElementById('searchInput').value = title;
    closeAllModals();
    hideAutocomplete();
    searchWiki();
}

function clearAllFavorites() {
    if (confirm('Вы уверены, что хотите удалить все избранные статьи?')) {
        favorites = [];
        saveFavorites();
        updateFavoriteButton(false);
    }
}

// Search functions
function setLang(lang) {
    currentLang = lang;
    document.getElementById('btnRU').classList.toggle('active', lang === 'ru');
    document.getElementById('btnEN').classList.toggle('active', lang === 'en');
    document.getElementById('searchInput').placeholder = langConfig[lang].placeholder;
    const query = document.getElementById('searchInput').value.trim();
    if (query) searchWiki();
}

async function showPreview(title, thumb, snippet, wikiUrl) {
    const panel = document.getElementById('preview-panel');
    const img = document.getElementById('preview-img');
    const titleEl = document.getElementById('preview-title');
    const excerptEl = document.getElementById('preview-excerpt');
    const link = document.getElementById('preview-link');
    
    currentArticle = {
        title: title,
        url: wikiUrl,
        lang: currentLang,
        snippet: snippet,
        thumb: thumb
    };
    
    updateFavoriteButton(isFavorite(title));
    
    const cfg = langConfig[currentLang];
    try {
        const url = `${cfg.apiBase}?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = data.query.pages;
        const page = pages[Object.keys(pages)[0]];
        const extract = page.extract || snippet;
        
        const firstParagraph = extract.split('\n').find(p => p.trim().length > 50) || extract;
        excerptEl.textContent = firstParagraph.slice(0, 300) + (firstParagraph.length > 300 ? '...' : '');
    } catch {
        excerptEl.textContent = snippet;
    }

    if (thumb) {
        img.src = thumb;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
        img.src = '';
    }

    titleEl.textContent = title;
    link.href = wikiUrl;

    panel.classList.remove('hidden');
    
    document.querySelectorAll('.result-card').forEach(c => c.classList.remove('active'));
}

let searchTimeout;

function handleSearchInput() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (autocompleteTimeout) clearTimeout(autocompleteTimeout);
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (query.length >= 2) {
        autocompleteTimeout = setTimeout(() => {
            fetchAutocomplete(query);
        }, 300);
    } else {
        hideAutocomplete();
    }
    
    searchTimeout = setTimeout(() => {
        if (query) {
            searchWiki();
        }
    }, 800);
}

async function searchWiki(loadMore = false) {
    const query = document.getElementById('searchInput').value.trim();
    if (query === '') return;

    hideAutocomplete();

    if (!loadMore) {
        currentOffset = 0;
        currentQuery = query;
        document.getElementById('results').innerHTML = '';
        document.getElementById('preview-panel').classList.add('hidden');
    }

    if (!searchHistory.includes(currentQuery)) {
        searchHistory.unshift(currentQuery);
        if (searchHistory.length > 5) searchHistory.pop();
        renderHistory();
    }

    const resultsDiv = document.getElementById('results');

    if (!loadMore) {
        resultsDiv.innerHTML = `<p style="color:#aaa; text-align:center; margin-top:30px;">Поиск...</p>`;
    }

    const cfg = langConfig[currentLang];

    try {
        const searchUrl = `${cfg.apiBase}?action=query&list=search&srsearch=${encodeURIComponent(currentQuery)}&format=json&origin=*&srlimit=10&sroffset=${currentOffset}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const articles = searchData.query.search;

        if (articles.length === 0) {
            if (!loadMore) {
                resultsDiv.innerHTML = `<p style="color:#aaa; text-align:center; margin-top:30px;">${cfg.notFound(currentQuery)}</p>`;
            }
            const oldBtn = document.getElementById('load-more-btn');
            if (oldBtn) oldBtn.remove();
            return;
        }

        const pageIds = articles.map(a => a.pageid).join('|');
        const imgUrl = `${cfg.apiBase}?action=query&pageids=${pageIds}&prop=pageimages&piprop=thumbnail&pithumbsize=300&format=json&origin=*`;
        const imgRes = await fetch(imgUrl);
        const imgData = await imgRes.json();
        const pages = imgData.query.pages;

        if (!loadMore) resultsDiv.innerHTML = '';

        const oldBtn = document.getElementById('load-more-btn');
        if (oldBtn) oldBtn.remove();

        const colors = [
            '#1a4a6b', '#2d6a4f', '#6b2d5a', '#6b4a1a',
            '#1a5c6b', '#4a1a6b', '#3d5a1a', '#6b1a2d'
        ];

        articles.forEach((article, i) => {
            const wikiUrl = `${cfg.wikiBase}${encodeURIComponent(article.title)}`;
            const thumb = pages[article.pageid]?.thumbnail?.source || null;
            const letter = article.title.trim()[0].toUpperCase();
            const color = colors[i % colors.length];
            const snippet = article.snippet.replace(/<[^>]*>/g, '');
            const isFav = isFavorite(article.title);

            const imageBlock = thumb
                ? `<img class="result-thumb" src="${thumb}" alt="${escapeHtml(article.title)}" loading="lazy">`
                : `<div class="result-thumb result-placeholder" style="background:${color}">${escapeHtml(letter)}</div>`;

            const card = document.createElement('a');
            card.className = 'result-card';
            card.href = '#';
            card.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.result-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                showPreview(article.title, thumb, snippet, wikiUrl);
            });
            card.innerHTML = `
                ${imageBlock}
                <div class="result-text">
                    <h2>${escapeHtml(article.title)} <span class="result-lang-badge">${currentLang.toUpperCase()}</span></h2>
                    <p>${escapeHtml(snippet)}</p>
                </div>
                ${isFav ? '<div class="result-favorite-icon">★</div>' : ''}
            `;
            resultsDiv.appendChild(card);
        });

        currentOffset += 10;

        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-btn';
        loadMoreBtn.textContent = 'Загрузить ещё';
        loadMoreBtn.onclick = () => searchWiki(true);
        loadMoreBtn.style.cssText = 'display:block;margin:20px auto;padding:12px 30px;background:#00ffd5;color:#0f0f0f;border:none;border-radius:10px;font-weight:bold;font-size:16px;cursor:pointer;';
        resultsDiv.appendChild(loadMoreBtn);

    } catch (e) {
        resultsDiv.innerHTML = `<p style="color:#e57373; text-align:center; margin-top:30px;">Ошибка соединения. Проверь интернет.</p>`;
    }
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderHistory() {
    const historyDiv = document.getElementById('history');
    historyDiv.innerHTML = '';
    searchHistory.forEach(q => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.textContent = q;
        historyItem.onclick = () => searchFromHistory(q);
        historyDiv.appendChild(historyItem);
    });
}

function searchFromHistory(query) {
    document.getElementById('searchInput').value = query;
    closeAllModals();
    hideAutocomplete();
    searchWiki();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('preview-panel').classList.add('hidden');
    currentArticle = null;
    hideAutocomplete();
    closeAllModals();
}

// Modal functions
function toggleHistory() {
    const modal = document.getElementById('historyModal');
    const favoritesModal = document.getElementById('favoritesModal');
    const wpModal = document.getElementById('wallpaperModal');
    const menu = document.getElementById('menuDropdown');
    
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        favoritesModal.style.display = 'none';
        wpModal.style.display = 'none';
        menu.style.display = 'none';
        modal.style.display = 'block';
    }
}

function toggleFavorites() {
    const modal = document.getElementById('favoritesModal');
    const historyModal = document.getElementById('historyModal');
    const wpModal = document.getElementById('wallpaperModal');
    const menu = document.getElementById('menuDropdown');
    
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        historyModal.style.display = 'none';
        wpModal.style.display = 'none';
        menu.style.display = 'none';
        modal.style.display = 'block';
        renderFavorites();
    }
}

function toggleWallpaper() {
    const modal = document.getElementById('wallpaperModal');
    const historyModal = document.getElementById('historyModal');
    const favoritesModal = document.getElementById('favoritesModal');
    const menu = document.getElementById('menuDropdown');
    
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        historyModal.style.display = 'none';
        favoritesModal.style.display = 'none';
        menu.style.display = 'none';
        modal.style.display = 'block';
    }
}

function closeAllModals() {
    document.getElementById('historyModal').style.display = 'none';
    document.getElementById('favoritesModal').style.display = 'none';
    document.getElementById('wallpaperModal').style.display = 'none';
    document.getElementById('menuDropdown').style.display = 'none';
}

// Wallpaper functions
function applyWallpaper(value, label) {
    const body = document.body;
    if (!value || value === 'none') {
        body.style.background = '#0f0f0f';
        body.classList.remove('has-wallpaper');
        document.getElementById('wpCurrentLabel').textContent = 'Текущий фон: нет';
    } else if (value.startsWith('data:') || value.startsWith('http')) {
        body.style.background = `url('${value}') center/cover fixed`;
        body.classList.add('has-wallpaper');
        document.getElementById('wpCurrentLabel').textContent = `Текущий фон: ${label || 'изображение'}`;
    } else {
        body.style.background = value;
        body.style.backgroundSize = 'cover';
        body.classList.add('has-wallpaper');
        document.getElementById('wpCurrentLabel').textContent = `Текущий фон: градиент`;
    }
    
    document.querySelectorAll('.wp-preset').forEach(b => b.classList.remove('active'));
}

function resetWallpaper() {
    localStorage.removeItem('wallpaper');
    localStorage.removeItem('wallpaperLabel');
    applyWallpaper('none');
    document.querySelector('.wp-preset[data-bg="none"]').classList.add('active');
    closeAllModals();
}

function initWallpaperPresets() {
    document.querySelectorAll('.wp-preset[data-bg]').forEach(btn => {
        const bg = btn.getAttribute('data-bg');
        if (bg !== 'none') {
            btn.style.background = bg;
        }
        btn.addEventListener('click', () => {
            applyWallpaper(bg, btn.title);
            localStorage.setItem('wallpaper', bg);
            localStorage.setItem('wallpaperLabel', btn.title);
            document.querySelectorAll('.wp-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            closeAllModals();
        });
    });
    
    const wpFileInput = document.getElementById('wpFileInput');
    if (wpFileInput) {
        wpFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                alert('Пожалуйста, выберите изображение');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = ev.target.result;
                try {
                    localStorage.setItem('wallpaper', base64);
                    localStorage.setItem('wallpaperLabel', file.name);
                } catch {
                    alert('Не удалось сохранить обои: превышен лимит localStorage');
                }
                applyWallpaper(base64, file.name);
                closeAllModals();
            };
            reader.readAsDataURL(file);
        });
    }
    
    const saved = localStorage.getItem('wallpaper');
    const savedLabel = localStorage.getItem('wallpaperLabel');
    if (saved) {
        applyWallpaper(saved, savedLabel);
        const activeBtn = document.querySelector(`.wp-preset[data-bg="${CSS.escape(saved)}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    } else {
        const noneBtn = document.querySelector('.wp-preset[data-bg="none"]');
        if (noneBtn) noneBtn.classList.add('active');
    }
}

function toggleMenu() {
    const menu = document.getElementById('menuDropdown');
    const historyModal = document.getElementById('historyModal');
    const favoritesModal = document.getElementById('favoritesModal');
    const wpModal = document.getElementById('wallpaperModal');
    
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    } else {
        historyModal.style.display = 'none';
        favoritesModal.style.display = 'none';
        wpModal.style.display = 'none';
        menu.style.display = 'block';
    }
}

// Event listeners
document.addEventListener('click', (e) => {
    const menu = document.getElementById('menuDropdown');
    const wpModal = document.getElementById('wallpaperModal');
    const histModal = document.getElementById('historyModal');
    const favModal = document.getElementById('favoritesModal');
    const menuBtn = document.querySelector('.menu-btn');
    const autocompleteDiv = document.getElementById('autocomplete-results');
    const searchInput = document.getElementById('searchInput');
    
    if (menu && !menu.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) {
        menu.style.display = 'none';
    }
    
    if (wpModal && !wpModal.contains(e.target) && !e.target.closest('[onclick="toggleWallpaper()"]') && !e.target.closest('.wp-preset')) {
        wpModal.style.display = 'none';
    }
    
    if (histModal && !histModal.contains(e.target) && !e.target.closest('[onclick="toggleHistory()"]')) {
        histModal.style.display = 'none';
    }
    
    if (favModal && !favModal.contains(e.target) && !e.target.closest('[onclick="toggleFavorites()"]')) {
        favModal.style.display = 'none';
    }
    
    if (autocompleteDiv && !autocompleteDiv.contains(e.target) && searchInput && e.target !== searchInput) {
        hideAutocomplete();
    }
});

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
        if (handleAutocompleteKeydown(e)) return;
        if (e.key === 'Enter') {
            hideAutocomplete();
            searchWiki();
        }
    });
    
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.placeholder = langConfig[currentLang].placeholder;
}

// Initialize
loadFavorites();
initWallpaperPresets();
