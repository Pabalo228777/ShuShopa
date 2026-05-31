const searchHistory = [];

async function searchWiki() {
    const query = document.getElementById("searchInput").value.trim();
    if (query === "") return;

    if (!searchHistory.includes(query)) {
        searchHistory.unshift(query);
        if (searchHistory.length > 5) searchHistory.pop();
        renderHistory();
    }

    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = `<p style="color:#aaa; text-align:center; margin-top:30px;">Поиск...</p>`;

    try {
        // Шаг 1: поиск статей
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=10`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const articles = searchData.query.search;

        if (articles.length === 0) {
            resultsDiv.innerHTML = `<p style="color:#aaa; text-align:center; margin-top:30px;">По запросу «${query}» ничего не найдено.</p>`;
            return;
        }

        // Шаг 2: получаем картинки для найденных статей
        const pageIds = articles.map(a => a.pageid).join("|");
        const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages&piprop=thumbnail&pithumbsize=120&format=json&origin=*`;
        const imgRes = await fetch(imgUrl);
        const imgData = await imgRes.json();
        const pages = imgData.query.pages;

        resultsDiv.innerHTML = "";

        // цвета для плейсхолдеров — циклически по индексу
        const colors = [
            "#1a4a6b", "#2d6a4f", "#6b2d5a", "#6b4a1a",
            "#1a5c6b", "#4a1a6b", "#3d5a1a", "#6b1a2d"
        ];

        articles.forEach((article, i) => {
            const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}`;
            const thumb = pages[article.pageid]?.thumbnail?.source || null;
            const letter = article.title.trim()[0].toUpperCase();
            const color = colors[i % colors.length];

            const imageBlock = thumb
                ? `<img class="result-thumb" src="${thumb}" alt="${article.title}" loading="lazy">`
                : `<div class="result-thumb result-placeholder" style="background:${color}">${letter}</div>`;

            resultsDiv.innerHTML += `
                <a class="result-card" href="${wikiUrl}" target="_blank">
                    ${imageBlock}
                    <div class="result-text">
                        <h2>${article.title}</h2>
                        <p>${article.snippet}</p>
                    </div>
                </a>
            `;
        });
    } catch (e) {
        resultsDiv.innerHTML = `<p style="color:#e57373; text-align:center; margin-top:30px;">Ошибка соединения. Проверь интернет.</p>`;
    }
}

function renderHistory() {
    const historyDiv = document.getElementById("history");
    historyDiv.innerHTML = searchHistory.map(q => `
        <span class="history-item" onclick="searchFromHistory('${q}')">${q}</span>
    `).join("");
}

function searchFromHistory(query) {
    document.getElementById("searchInput").value = query;
    toggleHistory();
    searchWiki();
}

function clearSearch() {
    document.getElementById("searchInput").value = "";
    document.getElementById("results").innerHTML = "";
}

function toggleHistory() {
    const modal = document.getElementById("historyModal");
    modal.style.display = modal.style.display === "block" ? "none" : "block";
}

document.getElementById("searchInput").addEventListener("keydown", e => {
    if (e.key === "Enter") searchWiki();
});