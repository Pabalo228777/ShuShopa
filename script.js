const searchHistory = [];
let currentLang = 'ru';
let currentQuery = '';
let currentOffset = 0;

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

    // Получаем первый абзац через API
    const cfg = langConfig[currentLang];
    try {
        const url = `${cfg.apiBase}?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = data.query.pages;
        const page = pages[Object.keys(pages)[0]];
        const extract = page.extract || snippet;
        // Берём первый абзац
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
    }

    titleEl.textContent = title;
    link.href = wikiUrl;

    panel.classList.remove('hidden');

    // Подсветить активную карточку
    document.querySelectorAll('.result-card').forEach(c => c.classList.remove('active'));
}

async function searchWiki(loadMore = false) {
    const query = document.getElementById('searchInput').value.trim();
    if (query === '') return;

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

            const imageBlock = thumb
                ? `<img class="result-thumb" src="${thumb}" alt="${escapeHtml(article.title)}" loading="lazy">`
                : `<div class="result-thumb result-placeholder" style="background:${color}">${letter}</div>`;

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
        .replace(/"/g, '&quot;');
}

function renderHistory() {
    const historyDiv = document.getElementById('history');
    historyDiv.innerHTML = searchHistory.map(q => `
        <span class="history-item" onclick="searchFromHistory('${escapeHtml(q)}')">${escapeHtml(q)}</span>
    `).join('');
}

function searchFromHistory(query) {
    document.getElementById('searchInput').value = query;
    toggleHistory();
    searchWiki();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('preview-panel').classList.add('hidden');
}

function toggleHistory() {
    const modal = document.getElementById('historyModal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchWiki();
});

document.getElementById('searchInput').placeholder = langConfig[currentLang].placeholder;