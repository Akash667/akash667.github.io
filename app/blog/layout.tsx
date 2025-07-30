import styles from "./layout.module.css";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className={styles.blog}>
      <header className={styles.header}>
       <nav>
        <h1>akash667</h1>
            <nav className={styles.navigation} >
                <a href="/about">about</a>
            </nav>
       </nav>
      </header>
      <div className={styles.childrenWrapper}>
        {children}
      </div>
    </section>
  );
}