import fs from "fs";
import path from "path";
import matter from "gray-matter";
import styles from "./page.module.css";

const postsDir = path.join(process.cwd(), "app/blog/posts");

function getPosts() {
  const files = fs.readdirSync(postsDir).filter(file => file.endsWith(".md"));
  return files.map(filename => {
    const fileContent = fs.readFileSync(path.join(postsDir, filename), "utf8");
    const { data, content } = matter(fileContent);
    return {
      slug: filename.replace(/\.md$/, ""),
      title: data.title || filename.replace(/\.md$/, ""),
      excerpt: content.slice(0, 100) + "...", // or use frontmatter excerpt if available
    };
  });
}

export default function BlogIndex() {
  const posts = getPosts();

  return (
    <main className={styles.main}>
      <h2>All Posts</h2>
      <ul className={styles.postList}>
        {posts.map(post => (
          <li key={post.slug}>
            <a className={styles.listTitle} href={`/blog/${post.slug}`}>{post.title}</a>
            <div>{post.excerpt}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}