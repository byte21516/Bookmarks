const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cheerio = require("cheerio");
const path = require("path");

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const db = new sqlite3.Database(path.join(__dirname, "data", "db.sqlite"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- DATABASE ---
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      parent_id INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      title TEXT,
      favicon TEXT,
      category_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      visits INTEGER DEFAULT 0
    )
  `);
});

// --- Fetch metadata ---
async function fetchMeta(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim() || url;

    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="apple-touch-icon"]').attr("href") ||
      "/favicon.png";

    if (favicon && !favicon.startsWith("http")) {
      const parsed = new URL(url);
      favicon = new URL(favicon, parsed.origin).href;
    }

    return { title, favicon };
  } catch (err) {
    console.error("Error fetching metadata for", url, err);
    return { title: url, favicon: "/favicon.png" };
  }
}

// --- ROUTES ---

// Home
app.get("/", (req, res) => {
  db.all("SELECT * FROM categories WHERE parent_id IS NULL", (err, categories) => {
    if (err) {
      console.error(err);
      categories = [];
    }
    res.render("index", { categories, links: [], search: "" });
  });
});

// Search
app.get("/search", (req, res) => {
  const q = req.query.q || "";

  db.all("SELECT * FROM categories WHERE name LIKE ?", [`%${q}%`], (err, categories) => {
    if (err) {
      console.error("DB Error (categories):", err);
      return res.status(500).send("DB Error (categories)");
    }
    db.all(
      "SELECT id, url, title, favicon, category_id, visits, created_at FROM links WHERE title LIKE ? OR url LIKE ?",
      [`%${q}%`, `%${q}%`],
      (err2, links) => {
        if (err2) {
          console.error("DB Error (links):", err2);
          return res.status(500).send("DB Error (links)");
        }
        res.render("search", { categories, links, search: q });
      }
    );
  });
});

// View category
app.get("/category/:id", (req, res) => {
  const categoryId = req.params.id;

  db.get("SELECT * FROM categories WHERE id = ?", [categoryId], (err, category) => {
    if (!category) return res.redirect("/");

    db.all("SELECT * FROM categories WHERE parent_id = ?", [categoryId], (err, subcategories) => {
      db.all(
        "SELECT id, url, title, favicon, category_id, visits, created_at FROM links WHERE category_id = ?",
        [categoryId],
        (err, links) => {
          res.render("category", {
            category,
            subcategories,
            links,
            parentId: category.parent_id,
            search: ""
          });
        }
      );
    });
  });
});

// Add category
app.post("/category", (req, res) => {
  const { name, parent_id } = req.body;
  db.run(
    "INSERT INTO categories (name, parent_id) VALUES (?, ?)",
    [name, parent_id || null],
    () => res.redirect(parent_id ? "/category/" + parent_id : "/")
  );
});

// Add link
app.post("/link", async (req, res) => {
  const { url, category_id } = req.body;
  const { title, favicon } = await fetchMeta(url);

  db.run(
    "INSERT INTO links (url, title, favicon, category_id) VALUES (?, ?, ?, ?)",
    [url, title, favicon, category_id],
    () => res.redirect("/category/" + category_id)
  );
});

// Redirect and increment visits
app.get("/link/:id/go", (req, res) => {
  const id = req.params.id;

  db.get("SELECT url, visits FROM links WHERE id = ?", [id], (err, link) => {
    if (!link) return res.redirect("/");

    const newVisits = (link.visits || 0) + 1;

    db.run("UPDATE links SET visits = ? WHERE id = ?", [newVisits, id], (err) => {
      if (err) console.error(err);

      let redirectUrl = link.url;
      if (!/^https?:\/\//i.test(redirectUrl)) {
        redirectUrl = "http://" + redirectUrl;
      }

      res.redirect(redirectUrl);
    });
  });
});

// Delete category
app.post("/category/:id/delete", (req, res) => {
  const id = req.params.id;

  db.get("SELECT parent_id FROM categories WHERE id = ?", [id], (err, row) => {
    const redirectTo = row && row.parent_id ? "/category/" + row.parent_id : "/";

    db.run("DELETE FROM links WHERE category_id = ?", [id], () => {
      db.run("DELETE FROM categories WHERE parent_id = ?", [id], () => {
        db.run("DELETE FROM categories WHERE id = ?", [id], () => {
          res.redirect(redirectTo);
        });
      });
    });
  });
});

// Delete link
app.post("/link/:id/delete", (req, res) => {
  const id = req.params.id;

  db.get("SELECT category_id FROM links WHERE id = ?", [id], (err, link) => {
    if (!link) return res.redirect("/");
    db.run("DELETE FROM links WHERE id = ?", [id], () => {
      res.redirect("/category/" + link.category_id);
    });
  });
});

// --- START SERVER ---
app.listen(3000, () => console.log("Server running on http://localhost:3000"));
