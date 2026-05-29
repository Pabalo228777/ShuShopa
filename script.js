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

    data.query.search.forEach(article => {

        resultsDiv.innerHTML += `
            <div class="result-card">

                <h2>${article.title}</h2>

                <p>${article.snippet}</p>

            </div>
        `;
    });
}