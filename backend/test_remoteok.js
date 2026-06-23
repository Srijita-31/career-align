const fetch = require('node-fetch');
const cheerio = require('cheerio');
fetch("https://remoteok.com/remote-software-engineer-jobs", {headers: {"User-Agent": "Mozilla/5.0"}})
  .then(r => r.text())
  .then(html => {
    const $ = cheerio.load(html);
    console.log("tr.job:", $("tr.job").length);
    console.log("tr[data-id]:", $("tr[data-id]").length);
    console.log("tr[data-url]:", $("tr[data-url]").length);
    console.log("tr row:", $("tr.row").length);
    console.log("Total tr:", $("tr").length);
    console.log("td.position h2:", $("td.position h2").length);
    console.log("table#jobsboard:", $("table#jobsboard").length);
    $("tr").each((i, el) => {
      const id = $(el).attr("data-id");
      if (id) console.log("data-id:", id, "company:", $(el).attr("data-company"), "position:", $(el).attr("data-position"));
    });
    // show first tr classes
    $("tr").slice(0, 5).each((i, el) => {
      console.log("tr class:", $(el).attr("class"), "id:", $(el).attr("id"));
    });
  });
