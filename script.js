async function searchWiki() {

    const query = document
        .getElementById("searchInput")
        .value;

    if(query === "") return;

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

        resultsDiv.innerHTML += `
            <div class="result-card">

                <h2>${article.title}</h2>

                <p>${article.snippet}</p>

            </div>
        
            

            `;
    });
}

function clearSearch() {
    document.getElementById("searchInput").value = "";
    document.getElementById("results").innerHTML = "";
}