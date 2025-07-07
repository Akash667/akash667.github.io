import styles from "./layout.module.css";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className={styles.blog}>
      <header className={styles.header}>
       <nav>
        <h1>akash667</h1>
            <nav   className={styles.navigation} >
                <a href="/recipes">recipes</a>
                <a href="/random">random</a>
                <a href="/about">about</a>
            </nav>
       </nav>
      </header>
      {children}
    </section>
  );
}