const history = [];

async function searchWiki() {

    const query = document
        .getElementById("searchInput")
        .value;

    if (query === "") return;

    if (!history.includes(query)) {
        history.unshift(query);
        if (history.length > 5) history.pop();
        renderHistory();
    }

    const url =
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&format=json&origin=*`;

    const response = await fetch(url);

    const data = await response.json();

    const resultsDiv =
        document.getElementById("results");

    resultsDiv.innerHTML = "";

    if (data.query.search.length === 0) {
        resultsDiv.innerHTML = `<p style="color:#aaa; text-align:center; margin-top:30px;">По запросу «${query}» ничего не найдено.</p>`;
        return;
    }

    data.query.search.forEach(article => {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}`;

        resultsDiv.innerHTML += `
            <a class="result-card" href="${url}" target="_blank">
                <h2>${article.title}</h2>
                <p>${article.snippet}</p>
            </a>
        `;
    });
}

function renderHistory() {
    const historyDiv = document.getElementById("history");
    historyDiv.innerHTML = history.map(q => `
        <span class="history-item" onclick="searchFromHistory('${q}')">${q}</span>
    `).join("");
}

function searchFromHistory(query) {
    document.getElementById("searchInput").value = query;
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