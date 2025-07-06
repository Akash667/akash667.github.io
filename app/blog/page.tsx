import styles from "./page.module.css";

export default function BlogIndex() {
  // Replace with your blog post data
  const posts = [
    { slug: "first-post", title: "First Post" , content:"Wow there is so much going on here i watned to put some stuff on here"},
    { slug: "second-post", title: "Second Post", content: "wow i need to hmm perhaps thinkm ore about htis and put this up" },
  ];

  return (
    <main className={styles.main}>
    <h2>All Posts</h2> 
      <ul className={styles.postList}>
        {posts.map(post => (
          <li key={post.slug}>
            <a  className={styles.listTitle} href={`/blog/${post.slug}`}>{post.title}</a>
            <div>{post.content}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}