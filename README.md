# akashirl.me

Plain HTML/CSS site with one small build script. Deployed to GitHub Pages by
`.github/workflows/publish.yaml` on every push to `main`.

```
src/           static files, copied to the site as-is (home page, CSS, 404, objects page)
posts/         blog posts as markdown (blog is off for now, see BLOG in build.mjs)
photos/        original photos for the objects page
tools/         background-removal tool that turns photos into objects for /objects/
build.mjs      builds everything into out/
```

## Develop

```bash
npm install
npm run dev     # http://localhost:3000, rebuilds when src/ or posts/ change
npm run build   # writes out/
```

## Write a post

The blog is parked: set `BLOG = true` in `build.mjs` to publish `/blog/` again.

Add `posts/<slug>.md` with frontmatter:

```markdown
---
title: My post
date: 2026-10-23
---

Markdown here.
```

Posts are listed newest first (by `date`), then by file name.

## Add objects

`/objects/` is a three.js page where cut-out photos of random objects lie on a table and can be dragged around.

1. Put photos in `photos/`.
2. `cd tools && npm install && npm run cutout`. This removes the backgrounds, writes cut-outs
   to `src/objects/objects/` and updates `src/objects/objects.json`. The first run downloads the model.
3. Optionally edit `title` and `size` (real longest side in cm) in `src/objects/objects.json`.
