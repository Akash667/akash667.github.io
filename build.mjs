// Builds the site into out/.
//
//   node build.mjs           build once
//   node build.mjs --serve   build, serve on http://localhost:3000, rebuild on change
//
// src/ is copied as-is. Each posts/<slug>.md becomes /blog/<slug>/ and /blog/ lists them all.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const root = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(root, 'src');
const POSTS = path.join(root, 'posts');
const OUT = path.join(root, 'out');
const BLOG = false; // blog is parked for now; posts/ stays in the repo, set true to publish /blog/ again
const SITE = 'https://akashirl.me';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const blogPage = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${esc(title)}</title>
<meta name="description" content="a lot of thoughts go on here">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/blog.css">
</head>
<body>
<section class="blog">
  <header class="header">
    <nav>
      <h1><a href="/">akash667</a></h1>
      <nav class="navigation">
        <a href="/blog/">blog</a>
        <a href="/objects/">objects</a>
      </nav>
    </nav>
  </header>
  <div class="childrenWrapper">
${body}
  </div>
</section>
</body>
</html>
`;

function readPosts() {
  return fs.readdirSync(POSTS)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(POSTS, file), 'utf8'));
      const slug = file.replace(/\.md$/, '');
      return { slug, title: data.title || slug, date: data.date ? new Date(data.date) : null, content };
    })
    .sort((a, b) => (b.date ?? 0) - (a.date ?? 0) || a.slug.localeCompare(b.slug));
}

function write(file, html) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

export function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.cpSync(SRC, OUT, { recursive: true });
  if (fs.existsSync(path.join(root, 'CNAME'))) fs.copyFileSync(path.join(root, 'CNAME'), path.join(OUT, 'CNAME'));
  if (BLOG) buildBlog();
  else {
    fs.rmSync(path.join(OUT, 'css', 'blog.css'));
    console.log('built out/ · blog off');
  }
  writeSitemap();
}

// Every built page (folders with an index.html) goes into sitemap.xml; robots.txt points at it.
function writeSitemap() {
  const pages = fs.readdirSync(OUT, { recursive: true })
    .filter((f) => path.basename(f) === 'index.html')
    .map((f) => `${SITE}/${path.dirname(f) === '.' ? '' : `${path.dirname(f).split(path.sep).join('/')}/`}`)
    .sort();
  write(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`);
  write(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
}

function buildBlog() {
  const posts = readPosts();
  const list = posts.map((p) => `      <li>
        <a class="listTitle" href="/blog/${p.slug}/">${esc(p.title)}</a>
        <div>${esc(p.content.trim().slice(0, 100))}...</div>
      </li>`).join('\n');
  write(path.join(OUT, 'blog', 'index.html'), blogPage('Blog · Akash Rawat', `    <main class="main">
      <h2>All Posts</h2>
      <ul class="postList">
${list}
      </ul>
    </main>`));

  for (const p of posts) {
    write(path.join(OUT, 'blog', p.slug, 'index.html'), blogPage(`${p.title} · Akash Rawat`, `    <article>
      <h1>${esc(p.title)}</h1>
      <div>${marked(p.content)}</div>
    </article>`));
  }
  console.log(`built out/ · ${posts.length} post(s)`);
}

// A tiny static server that behaves like GitHub Pages: folders serve index.html,
// folder URLs without a trailing slash redirect, unknown paths get 404.html.
function serve(port = 3000) {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
  http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, url);
    if (!file.startsWith(OUT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.endsWith('/')) { res.writeHead(301, { Location: `${url}/` }).end(); return; }
      file = path.join(file, 'index.html');
    }
    const found = fs.existsSync(file);
    if (!found) file = path.join(OUT, '404.html');
    res.writeHead(found ? 200 : 404, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`serving http://localhost:${port}`));

  let timer;
  for (const dir of [SRC, POSTS]) {
    fs.watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => { try { build(); } catch (e) { console.error(e); } }, 100);
    });
  }
}

build();
if (process.argv.includes('--serve')) serve(Number(process.env.PORT) || 3000);
