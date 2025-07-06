import styles from "./page.module.css";

export default function BlogIndex() {
  // Replace with your blog post data
  const posts = [
    { slug: "first-post", title: "First Post" },
    { slug: "second-post", title: "Second Post" },
  ];

  return (
    <main className={styles.main}>
      <h2>All Posts</h2>
      <ul className={styles.postList}>
        {posts.map(post => (
          <li key={post.slug}>
            <a href={`/blog/${post.slug}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}